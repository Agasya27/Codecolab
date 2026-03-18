import { create } from 'zustand';
import { Operation } from '../ot/operations';
import { v4 as uuidv4 } from 'uuid';

export interface Peer {
  userId: string;
  userName: string;
  color: string;
  cursor?: number;
  lastCursorAt?: number;
}

export interface FileData {
  id: string;
  name: string;
  content: string;
  language: string;
  lastModified: number;
  revision: number;
}

export interface Snapshot {
  fileId: string;
  timestamp: number;
  content: string;
  revision: number;
  label: string;
}

export interface Conflict {
  id: string;
  fileId: string;
  localContent: string;
  remoteContent: string;
  timestamp: number;
}

export interface Toast {
  id: string;
  type: 'join' | 'leave';
  userId: string;
  userName: string;
  color: string;
  createdAt: number;
}

interface EditorState {
  // Files Slice
  files: Record<string, FileData>;
  activeFileId: string | null;
  setFiles: (files: FileData[]) => void;
  createFile: (file: FileData) => void;
  deleteFile: (id: string) => void;
  setActiveFile: (id: string | null) => void;
  updateFileContent: (id: string, content: string, revision?: number) => void;
  renameFile: (id: string, name: string) => void;

  // Collab Slice
  peers: Record<string, Peer>;
  pendingOps: Operation[];
  serverRevision: number;
  localRevision: number;
  isOnline: boolean;
  addPeer: (peer: Peer) => void;
  updatePeerCursor: (userId: string, cursor: number) => void;
  removePeer: (userId: string) => void;
  setPeers: (peers: Record<string, Peer>) => void;
  enqueueOp: (op: Operation) => void;
  clearPendingOps: () => void;
  setOnlineStatus: (status: boolean) => void;
  setRevisions: (server: number, local: number) => void;

  // Toast Slice
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void;
  removeToast: (id: string) => void;

  // History Slice
  snapshots: Snapshot[];
  takeSnapshot: (snapshot: Snapshot) => void;
  setSnapshots: (snapshots: Snapshot[]) => void;

  // Conflict Slice
  conflicts: Conflict[];
  addConflict: (conflict: Conflict) => void;
  resolveConflict: (id: string, resolution: 'local' | 'remote') => void;
}

export const useStore = create<EditorState>((set, get) => ({
  // Files
  files: {},
  activeFileId: null,
  setFiles: (files) => set(() => {
    const fileMap: Record<string, FileData> = {};
    files.forEach(f => fileMap[f.id] = f);
    return { files: fileMap };
  }),
  createFile: (file) => set((state) => ({
    files: { ...state.files, [file.id]: file },
    activeFileId: file.id,
  })),
  deleteFile: (id) => set((state) => {
    const newFiles = { ...state.files };
    delete newFiles[id];
    return {
      files: newFiles,
      activeFileId: state.activeFileId === id ? null : state.activeFileId,
    };
  }),
  setActiveFile: (id) => set({ activeFileId: id }),
  updateFileContent: (id, content, revision) => set((state) => {
    const file = state.files[id];
    if (!file) return state;
    const nextRevision = revision ?? file.revision;
    if (file.content === content && file.revision === nextRevision) return state;
    return {
      files: {
        ...state.files,
        [id]: { ...file, content, lastModified: Date.now(), revision: nextRevision },
      },
    };
  }),
  renameFile: (id, name) => set((state) => {
    const file = state.files[id];
    const nextName = name.trim();
    if (!file || !nextName || file.name === nextName) return state;
    return {
      files: {
        ...state.files,
        [id]: { ...file, name: nextName, lastModified: Date.now() },
      },
    };
  }),

  // Collab
  peers: {},
  pendingOps: [],
  serverRevision: 0,
  localRevision: 0,
  isOnline: false,
  addPeer: (peer) => set((state) => {
    const existing = state.peers[peer.userId];
    if (
      existing &&
      existing.userName === peer.userName &&
      existing.color === peer.color &&
      existing.cursor === peer.cursor
    ) {
      return state;
    }
    return { peers: { ...state.peers, [peer.userId]: peer } };
  }),
  updatePeerCursor: (userId, cursor) => set((state) => {
    const peer = state.peers[userId];
    if (!peer) return state;
    if (peer.cursor === cursor) return state;
    return { peers: { ...state.peers, [userId]: { ...peer, cursor, lastCursorAt: Date.now() } } };
  }),
  removePeer: (userId) => set((state) => {
    if (!state.peers[userId]) return state;
    const newPeers = { ...state.peers };
    delete newPeers[userId];
    return { peers: newPeers };
  }),
  setPeers: (peers) => set({ peers }),
  enqueueOp: (op) => set((state) => ({ pendingOps: [...state.pendingOps, op] })),
  clearPendingOps: () => set({ pendingOps: [] }),
  setOnlineStatus: (status) => set((state) => (state.isOnline === status ? state : { isOnline: status })),
  setRevisions: (server, local) => set({ serverRevision: server, localRevision: local }),

  // Toasts
  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts:
      state.toasts.some(
        (t) =>
          t.userId === toast.userId &&
          t.type === toast.type &&
          Date.now() - t.createdAt < 1200,
      )
        ? state.toasts
        : [...state.toasts, { ...toast, id: uuidv4(), createdAt: Date.now() }],
  })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  // History
  snapshots: [],
  takeSnapshot: (snapshot) => set((state) => ({ snapshots: [snapshot, ...state.snapshots] })),
  setSnapshots: (snapshots) => set({ snapshots }),

  // Conflicts
  conflicts: [],
  addConflict: (conflict) => set((state) => ({ conflicts: [...state.conflicts, conflict] })),
  resolveConflict: (id) => set((state) => ({
    conflicts: state.conflicts.filter(c => c.id !== id),
  })),
}));
