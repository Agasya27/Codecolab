import { useStore } from '../store';
import type { FileData } from '../store';
import { Operation, applyOp, transformOp } from '../ot/operations';
import { colorFromId } from '../utils/colorFromId';
import { clearPendingOps, deleteFileDB, getPendingOps, saveFile, savePendingOp } from '../db';
import { makeId } from '../utils/makeId';

type SyncMessageType =
  | 'peer_join'
  | 'peer_leave'
  | 'peer_hello'
  | 'file_sync'
  | 'file_create'
  | 'file_delete'
  | 'file_rename'
  | 'op'
  | 'cursor';

interface SyncMessage {
  id: string;
  type: SyncMessageType;
  userId: string;
  userName?: string;
  color?: string;
  tabId: string;
  targetTabId?: string;
  fileId?: string;
  op?: Operation;
  position?: number;
  content?: string;
  file?: FileData;
  name?: string;
  revision?: number;
  ts: number;
}

interface RawSyncMessage {
  id?: string;
  type?: string;
  userId?: string;
  userName?: string;
  color?: string;
  tabId?: string;
  connectionId?: string;
  targetTabId?: string;
  fileId?: string;
  roomId?: string;
  op?: Operation;
  operation?: Operation;
  position?: number;
  content?: string;
  file?: FileData;
  name?: string;
  revision?: number;
  ts?: number;
}

interface PendingLocal {
  op: Operation;
  ts: number;
}

export class SyncManager {
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private wsUrls: string[] = [];
  private wsUrlIndex = 0;
  private wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private wsConnecting = false;

  private readonly userId: string;
  private readonly userName: string;
  private readonly userColor: string;
  private readonly tabId: string;

  private activeFileId: string | null = null;
  private onRemoteOp?: (op: Operation) => void;
  private onRemoteContent?: (content: string) => void;

  private online = navigator.onLine;
  private readonly batchWindowMs = 50;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private batchedOps: Array<{ fileId: string; op: Operation }> = [];

  private pendingLocalOps: PendingLocal[] = [];
  private readonly pendingOpWindowMs = 1500;

  private readonly peerByTab = new Map<string, string>();
  private readonly peerToastLock = new Set<string>();
  private readonly seenMessageIds = new Set<string>();
  private inboundQueue: SyncMessage[] = [];

  private readonly onOnline = () => {
    this.online = true;
    useStore.getState().setOnlineStatus(true);
    this.ensureWs();
    void this.flushPendingOps();
    if (this.activeFileId) {
      this.broadcast({ type: 'peer_join', fileId: this.activeFileId, userName: this.userName, color: this.userColor });
    }
  };

  private readonly onOffline = () => {
    this.online = false;
    useStore.getState().setOnlineStatus(false);
  };

  private readonly onBeforeUnload = () => {
    if (!this.activeFileId) return;
    this.broadcast({ type: 'peer_leave', fileId: this.activeFileId });
  };

  constructor(userId: string, userName: string, onRemoteOp?: (op: Operation) => void, onRemoteContent?: (content: string) => void) {
    this.userId = userId;
    this.userName = userName;
    this.userColor = colorFromId(userId);
    this.tabId = makeId();
    this.onRemoteOp = onRemoteOp;
    this.onRemoteContent = onRemoteContent;
    const localOverride = localStorage.getItem('codecollab_ws_url')?.trim();
    const envUrl = import.meta.env.VITE_COLLAB_WS_URL as string | undefined;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const currentPort = window.location.port;

    const candidates = [
      localOverride,
      envUrl?.trim(),
      `${protocol}://${host}:8787/collab`,
      currentPort ? `${protocol}://${host}:${currentPort}/collab` : undefined,
      protocol === 'wss' ? `ws://${host}:8787/collab` : undefined,
    ].filter((v): v is string => Boolean(v));
    this.wsUrls = [...new Set(candidates)];

    useStore.getState().setOnlineStatus(this.online);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  setRemoteOpHandler(handler: (op: Operation) => void) {
    this.onRemoteOp = handler;
  }

  setRemoteContentHandler(handler: (content: string) => void) {
    this.onRemoteContent = handler;
  }

  connect() {
    if (this.channel) return;
    this.channel = new BroadcastChannel('codecollab');
    this.channel.onmessage = (event) => this.handleMessage(event.data as SyncMessage);
    this.ensureWs();
  }

  disconnect() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.activeFileId) {
      this.broadcast({ type: 'peer_leave', fileId: this.activeFileId });
    }

    this.channel?.close();
    this.channel = null;
    if (this.wsRetryTimer) {
      clearTimeout(this.wsRetryTimer);
      this.wsRetryTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnecting = false;

    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  joinFile(fileId: string) {
    if (this.activeFileId && this.activeFileId !== fileId) {
      this.broadcast({ type: 'peer_leave', fileId: this.activeFileId });
      this.peerByTab.clear();
      this.peerToastLock.clear();
      useStore.getState().setPeers({});
    }

    this.activeFileId = fileId;
    this.pendingLocalOps = [];
    this.flushInboundQueue();

    this.broadcast({ type: 'peer_join', fileId, userName: this.userName, color: this.userColor });
    void this.flushPendingOps();
  }

  leaveFile(fileId: string) {
    this.broadcast({ type: 'peer_leave', fileId });
    this.activeFileId = null;
    this.pendingLocalOps = [];
    this.peerByTab.clear();
    this.peerToastLock.clear();
    useStore.getState().setPeers({});
  }

  sendOp(fileId: string, op: Operation) {
    if (!this.channel && !this.ws) return;

    if (!this.online) {
      useStore.getState().enqueueOp(op);
      void savePendingOp(fileId, op);
      return;
    }

    this.pendingLocalOps.push({ op, ts: Date.now() });
    this.prunePendingLocalOps();

    this.batchedOps.push({ fileId, op });
    if (this.batchTimer) clearTimeout(this.batchTimer);

    this.batchTimer = setTimeout(() => {
      const flush = [...this.batchedOps];
      this.batchedOps = [];
      for (const item of flush) {
        this.broadcast({ type: 'op', fileId: item.fileId, op: item.op });
      }
    }, this.batchWindowMs);
  }

  sendCursor(fileId: string, position: number) {
    this.broadcast({ type: 'cursor', fileId, position });
  }

  sendFileCreate(file: FileData) {
    this.broadcast({ type: 'file_create', file });
  }

  sendFileDelete(fileId: string) {
    this.broadcast({ type: 'file_delete', fileId });
  }

  sendFileRename(fileId: string, name: string) {
    this.broadcast({ type: 'file_rename', fileId, name });
  }

  private prunePendingLocalOps() {
    const cutoff = Date.now() - this.pendingOpWindowMs;
    this.pendingLocalOps = this.pendingLocalOps.filter((entry) => entry.ts >= cutoff);
    if (this.pendingLocalOps.length > 180) {
      this.pendingLocalOps = this.pendingLocalOps.slice(-90);
    }
  }

  private newMessage(base: Omit<SyncMessage, 'id' | 'userId' | 'tabId' | 'ts'>): SyncMessage {
    return {
      id: makeId(),
      userId: this.userId,
      tabId: this.tabId,
      ts: Date.now(),
      ...base,
    };
  }

  private isSelf(msg: SyncMessage): boolean {
    return msg.userId === this.userId && msg.tabId === this.tabId;
  }

  private shouldIgnoreFile(msg: SyncMessage): boolean {
    if (msg.type === 'file_create' || msg.type === 'file_delete' || msg.type === 'file_rename') {
      return false;
    }
    if (!this.activeFileId) return false;
    if (!msg.fileId) return false;
    return msg.fileId !== this.activeFileId;
  }

  private trackSeen(id: string) {
    this.seenMessageIds.add(id);
    if (this.seenMessageIds.size > 4000) {
      const first = this.seenMessageIds.values().next().value;
      if (first) this.seenMessageIds.delete(first);
    }
  }

  private broadcast(base: Omit<SyncMessage, 'id' | 'userId' | 'tabId' | 'ts'>) {
    const msg = this.newMessage(base);
    this.trackSeen(msg.id);
    if (this.channel) {
      this.channel.postMessage(msg);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private peerKeyFor(msg: SyncMessage): string {
    return `${msg.userId}:${msg.tabId}`;
  }

  private handleMessage(rawMsg: SyncMessage | RawSyncMessage) {
    const msg = this.normalizeMessage(rawMsg);
    if (!msg) return;
    if (this.seenMessageIds.has(msg.id)) return;

    if (this.isSelf(msg)) return;
    if (!this.activeFileId) {
      this.queueInbound(msg);
      return;
    }
    if (this.shouldIgnoreFile(msg)) return;
    this.trackSeen(msg.id);

    const store = useStore.getState();

    if (msg.type === 'peer_join') {
      const peerKey = this.peerKeyFor(msg);
      const existing = store.peers[peerKey];

      this.peerByTab.set(msg.tabId, peerKey);
      store.addPeer({
        userId: peerKey,
        userName: msg.userName ?? `User ${msg.userId.slice(0, 4)}`,
        color: msg.color ?? colorFromId(msg.userId),
      });

      if (!existing && !this.peerToastLock.has(peerKey)) {
        this.peerToastLock.add(peerKey);
        store.addToast({
          type: 'join',
          userId: peerKey,
          userName: msg.userName ?? `User ${msg.userId.slice(0, 4)}`,
          color: msg.color ?? colorFromId(msg.userId),
        });
      }

      this.broadcast({
        type: 'peer_hello',
        fileId: this.activeFileId ?? undefined,
        userName: this.userName,
        color: this.userColor,
        targetTabId: msg.tabId,
      });

      const activeId = this.activeFileId;
      if (activeId) {
        const file = store.files[activeId];
        if (file) {
          this.broadcast({
            type: 'file_sync',
            fileId: activeId,
            targetTabId: msg.tabId,
            content: file.content,
            revision: file.revision,
          });
        }
      }
      return;
    }

    if (msg.type === 'peer_hello') {
      if (msg.targetTabId !== this.tabId) return;
      const peerKey = this.peerKeyFor(msg);
      this.peerByTab.set(msg.tabId, peerKey);
      store.addPeer({
        userId: peerKey,
        userName: msg.userName ?? `User ${msg.userId.slice(0, 4)}`,
        color: msg.color ?? colorFromId(msg.userId),
      });
      return;
    }

    if (msg.type === 'peer_leave') {
      const peerKey = this.peerByTab.get(msg.tabId) ?? this.peerKeyFor(msg);
      const peer = store.peers[peerKey];
      if (peer) {
        store.addToast({ type: 'leave', userId: peerKey, userName: peer.userName, color: peer.color });
      }
      store.removePeer(peerKey);
      this.peerByTab.delete(msg.tabId);
      this.peerToastLock.delete(peerKey);
      return;
    }

    if (msg.type === 'cursor') {
      if (typeof msg.position !== 'number') return;
      const peerKey = this.peerByTab.get(msg.tabId) ?? this.peerKeyFor(msg);
      if (!store.peers[peerKey]) {
        store.addPeer({
          userId: peerKey,
          userName: msg.userName ?? `User ${msg.userId.slice(0, 4)}`,
          color: msg.color ?? colorFromId(msg.userId),
        });
      }
      store.updatePeerCursor(peerKey, msg.position);
      return;
    }

    if (msg.type === 'file_sync') {
      if (msg.targetTabId !== this.tabId) return;
      const fileId = msg.fileId ?? this.activeFileId;
      if (!fileId || typeof msg.content !== 'string') return;

      const file = store.files[fileId];
      if (!file) {
        this.queueInbound(msg);
        return;
      }
      if (file.content === msg.content) return;

      const nextRevision = Math.max(file.revision + 1, msg.revision ?? file.revision + 1);
      store.updateFileContent(fileId, msg.content, nextRevision);
      store.setRevisions(nextRevision, nextRevision);
      if (fileId === this.activeFileId) {
        this.onRemoteContent?.(msg.content);
      }
      return;
    }

    if (msg.type === 'file_create') {
      const incoming = msg.file;
      if (!incoming) return;
      if (store.files[incoming.id]) return;

      const previousActive = store.activeFileId;
      store.createFile(incoming);
      if (previousActive) {
        store.setActiveFile(previousActive);
      }
      void saveFile(incoming);
      return;
    }

    if (msg.type === 'file_delete') {
      if (!msg.fileId) return;
      if (!store.files[msg.fileId]) return;
      store.deleteFile(msg.fileId);
      void deleteFileDB(msg.fileId);
      return;
    }

    if (msg.type === 'file_rename') {
      if (!msg.fileId || !msg.name?.trim()) return;
      const existing = store.files[msg.fileId];
      if (!existing) return;
      if (existing.name === msg.name.trim()) return;
      const renamed = { ...existing, name: msg.name.trim(), lastModified: Date.now() };
      store.renameFile(msg.fileId, msg.name.trim());
      void saveFile(renamed);
      return;
    }

    if (msg.type === 'op') {
      if (!msg.op) return;

      const fileId = msg.fileId ?? this.activeFileId;
      if (!fileId) return;

      const file = store.files[fileId];
      if (!file) {
        this.queueInbound(msg);
        return;
      }

      this.prunePendingLocalOps();

      let transformed: Operation | null = msg.op;
      for (const pending of this.pendingLocalOps) {
        if (!transformed) break;
        transformed = transformOp(transformed, pending.op, 'right');
      }

      if (!transformed) {
        store.addConflict({
          id: makeId(),
          fileId,
          localContent: file.content,
          remoteContent: applyOp(file.content, msg.op),
          timestamp: Date.now(),
        });
        return;
      }

      const next = applyOp(file.content, transformed);
      const nextRevision = file.revision + 1;
      store.updateFileContent(fileId, next, nextRevision);
      store.setRevisions(nextRevision, nextRevision);

      if (fileId === this.activeFileId) {
        this.onRemoteOp?.(transformed);
      }
    }
  }

  private async flushPendingOps() {
    if ((!this.channel && !this.ws) || !this.activeFileId || !this.online) return;

    const queued = await getPendingOps(this.activeFileId);
    if (queued.length === 0) return;

    for (const entry of queued) {
      this.broadcast({ type: 'op', fileId: this.activeFileId, op: entry.op });
      this.pendingLocalOps.push({ op: entry.op, ts: Date.now() });
    }

    this.prunePendingLocalOps();
    await clearPendingOps(this.activeFileId);
    useStore.getState().clearPendingOps();
  }

  private queueInbound(msg: SyncMessage) {
    this.inboundQueue.push(msg);
    if (this.inboundQueue.length > 600) {
      this.inboundQueue = this.inboundQueue.slice(-300);
    }
  }

  private flushInboundQueue() {
    if (!this.activeFileId || this.inboundQueue.length === 0) return;
    const pending = [...this.inboundQueue];
    this.inboundQueue = [];
    for (const msg of pending) {
      if (msg.fileId && msg.fileId !== this.activeFileId) continue;
      if (!this.seenMessageIds.has(msg.id)) {
        this.handleMessage(msg);
      }
    }
  }

  private ensureWs() {
    if (this.wsUrls.length === 0 || !this.online || this.ws || this.wsConnecting) return;
    this.wsConnecting = true;
    const targetUrl = this.wsUrls[this.wsUrlIndex % this.wsUrls.length];

    try {
      const ws = new WebSocket(targetUrl);
      ws.onopen = () => {
        this.ws = ws;
        this.wsConnecting = false;
        this.wsUrlIndex = 0;
        if (this.activeFileId) {
          this.broadcast({
            type: 'peer_join',
            fileId: this.activeFileId,
            userName: this.userName,
            color: this.userColor,
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as SyncMessage | { payload?: SyncMessage; data?: SyncMessage };
          const message = (parsed as any)?.payload ?? (parsed as any)?.data ?? parsed;
          this.handleMessage(message as SyncMessage);
        } catch {
          // ignore non-collab payloads
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.wsConnecting = false;
        this.wsUrlIndex = (this.wsUrlIndex + 1) % Math.max(this.wsUrls.length, 1);
        if (this.online) {
          this.wsRetryTimer = setTimeout(() => this.ensureWs(), 1200);
        }
      };

      ws.onerror = () => {
        this.wsConnecting = false;
        ws.close();
      };
    } catch {
      this.wsConnecting = false;
      this.wsUrlIndex = (this.wsUrlIndex + 1) % Math.max(this.wsUrls.length, 1);
    }
  }

  private normalizeMessage(raw: SyncMessage | RawSyncMessage): SyncMessage | null {
    if (!raw || typeof raw !== 'object') return null;
    const type = raw.type as SyncMessageType | undefined;
    const userId = raw.userId;
    if (!type || !userId) return null;

    const tabId = (raw as RawSyncMessage).tabId ?? (raw as RawSyncMessage).connectionId ?? `${userId}-legacy`;
    const fileId = (raw as RawSyncMessage).fileId ?? (raw as RawSyncMessage).roomId;
    const op = (raw as RawSyncMessage).op ?? (raw as RawSyncMessage).operation;
    const ts = raw.ts ?? Date.now();
    const id =
      raw.id ??
      `${type}:${userId}:${tabId}:${fileId ?? '-'}:${(raw as RawSyncMessage).position ?? '-'}:${ts}`;

    return {
      id,
      type,
      userId,
      userName: raw.userName,
      color: raw.color,
      tabId,
      targetTabId: raw.targetTabId,
      fileId,
      op,
      position: raw.position,
      content: raw.content,
      file: raw.file,
      name: raw.name,
      revision: raw.revision,
      ts,
    };
  }
}
