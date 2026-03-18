import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useCollabEditor } from '../hooks/useCollabEditor';
import { useStore, FileData } from '../store';
import { Operation, applyOp } from '../ot/operations';
import { deleteFileDB, getAllFiles, getSnapshots, initDB, saveFile, saveSnapshot } from '../db';
import { EditorPane } from '../components/EditorPane';
import { CollabBar } from '../components/CollabBar';
import { FileTree } from '../components/FileTree';
import { VersionTimeline } from '../components/VersionTimeline';
import { ConflictResolver } from '../components/ConflictResolver';
import { Skeleton } from '../components/Skeleton';
import { Toast } from '../components/Toast';
import { makeId } from '../utils/makeId';
import { normalizeRoomInput } from '../utils/room';
import { useTheme } from '../hooks/useTheme';

const SESSIONS_KEY = 'codecollab_sessions';

export default function EditorPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const roomId = normalizeRoomInput(new URLSearchParams(search).get('room'));

  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const previousFileRef = useRef<string | null>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedFileRef = useRef<string | null>(null);
  const loadedRoomRef = useRef<string | null | undefined>(undefined);

  const files = useStore((s) => s.files);
  const activeFileId = useStore((s) => s.activeFileId);

  const {
    syncManagerRef,
    userId,
    userName,
    setRemoteOpHandler,
    setEditorContentHandler,
  } = useCollabEditor();

  const activeFile = activeFileId ? files[activeFileId] : null;

  useEffect(() => {
    if (loadedRoomRef.current === roomId) return;
    loadedRoomRef.current = roomId;

    const load = async () => {
      const store = useStore.getState();
      await initDB();
      const currentFiles = await getAllFiles();

      let initialFileId: string;
      if (roomId) {
        const found = currentFiles.find((f) => f.id === roomId);
        if (found) {
          store.setFiles(currentFiles);
        } else {
          const roomFile = {
            id: roomId,
            name: 'session.js',
            content: '// Collaborative room\n',
            language: 'javascript',
            lastModified: Date.now(),
            revision: 0,
          } satisfies FileData;
          await saveFile(roomFile);
          store.setFiles([...currentFiles, roomFile]);
        }
        initialFileId = roomId;
      } else if (currentFiles.length === 0) {
        const base = {
          id: makeId(),
          name: 'index.js',
          content: 'console.log("Welcome to CodeCollab");\n',
          language: 'javascript',
          lastModified: Date.now(),
          revision: 0,
        } satisfies FileData;
        await saveFile(base);
        store.setFiles([base]);
        initialFileId = base.id;
      } else {
        store.setFiles(currentFiles);
        initialFileId = currentFiles[0].id;
      }

      const latestFiles = await getAllFiles();
      const allSnapshots = await Promise.all(latestFiles.map((f) => getSnapshots(f.id)));
      store.setSnapshots(allSnapshots.flat().sort((a, b) => b.timestamp - a.timestamp));

      store.setActiveFile(initialFileId);
      setLoading(false);
    };

    void load();
  }, [roomId]);

  useEffect(() => {
    const manager = syncManagerRef.current;
    if (!manager || !activeFileId) return;

    if (joinedFileRef.current && joinedFileRef.current !== activeFileId) {
      manager.leaveFile(joinedFileRef.current);
    }

    if (previousFileRef.current && previousFileRef.current !== activeFileId) {
      const prev = useStore.getState().files[previousFileRef.current];
      if (prev) {
        const snapshot = {
          fileId: prev.id,
          timestamp: Date.now(),
          content: prev.content,
          revision: prev.revision,
          label: 'Switch Snapshot',
        };
        void saveSnapshot(snapshot);
        useStore.getState().takeSnapshot(snapshot);
      }
    }

    previousFileRef.current = activeFileId;
    joinedFileRef.current = activeFileId;
    manager.joinFile(activeFileId);
  }, [activeFileId, syncManagerRef]);

  useEffect(() => {
    return () => {
      const manager = syncManagerRef.current;
      if (manager && joinedFileRef.current) {
        manager.leaveFile(joinedFileRef.current);
      }
    };
  }, [syncManagerRef]);

  useEffect(() => {
    if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);

    snapshotTimerRef.current = setInterval(() => {
      const state = useStore.getState();
      const fileId = state.activeFileId;
      if (!fileId) return;
      const file = state.files[fileId];
      if (!file) return;

      const snapshot = {
        fileId,
        timestamp: Date.now(),
        content: file.content,
        revision: file.revision,
        label: 'Auto-save',
      };
      void saveSnapshot(snapshot);
      useStore.getState().takeSnapshot(snapshot);
    }, 10_000);

    return () => {
      if (snapshotTimerRef.current) clearInterval(snapshotTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeFile) return;
    void saveFile(activeFile);
  }, [activeFile]);

  const handleLocalOp = useCallback(
    (op: Operation) => {
      const manager = syncManagerRef.current;
      const state = useStore.getState();
      const fileId = state.activeFileId;
      if (!manager || !fileId) return;

      manager.sendOp(fileId, op);

      const file = state.files[fileId];
      if (!file) return;

      const next = applyOp(file.content, op);
      useStore.getState().updateFileContent(fileId, next, file.revision + 1);
      state.setRevisions(file.revision + 1, file.revision + 1);
    },
    [syncManagerRef],
  );

  const handleCursorMove = useCallback(
    (position: number) => {
      const manager = syncManagerRef.current;
      const fileId = useStore.getState().activeFileId;
      if (!manager || !fileId) return;
      manager.sendCursor(fileId, position);
    },
    [syncManagerRef],
  );

  const onCreateFile = async (file: Omit<FileData, 'id'>) => {
    const id = makeId();
    const full = { ...file, id };
    await saveFile(full);
    useStore.getState().createFile(full);
    syncManagerRef.current?.sendFileCreate(full);
  };

  const onDeleteFile = async (id: string) => {
    syncManagerRef.current?.sendFileDelete(id);
    await deleteFileDB(id);
    useStore.getState().deleteFile(id);

    const state = useStore.getState();
    if (!state.activeFileId) {
      const next = Object.values(state.files)[0];
      if (next) state.setActiveFile(next.id);
      if (!next) navigate('/');
    }
  };

  const onRenameSession = useCallback(async () => {
    const state = useStore.getState();
    const fileId = state.activeFileId;
    if (!fileId) return;
    const file = state.files[fileId];
    if (!file) return;

    const nextName = window.prompt('Session name', file.name);
    const trimmed = nextName?.trim();
    if (!trimmed || trimmed === file.name) return;

    const updated = { ...file, name: trimmed, lastModified: Date.now() };
    await saveFile(updated);
    state.renameFile(fileId, trimmed);
    syncManagerRef.current?.sendFileRename(fileId, trimmed);

    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return;
    try {
      const sessions = JSON.parse(raw) as Array<{ id: string; name: string; lastModified: number }>;
      const nextSessions = sessions.map((session) =>
        session.id === fileId ? { ...session, name: trimmed, lastModified: updated.lastModified } : session,
      );
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(nextSessions));
    } catch {
      // ignore corrupted localStorage metadata
    }
  }, []);

  const editorShell = useMemo(() => {
    if (loading) {
      return (
        <div className="flex flex-1">
          <aside className="w-64 p-3 border-r border-[#30363d] bg-[#161b22] space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </aside>
          <div className="flex-1 p-4 bg-[#0d1117]">
            <Skeleton className="h-10 mb-3" />
            <Skeleton className="h-[78%]" />
          </div>
        </div>
      );
    }

    if (!activeFile) {
      return <div className="flex-1 grid place-items-center text-sm text-[#7d8590]">No active file selected.</div>;
    }

    return (
      <>
        <FileTree
          onCreateFile={onCreateFile}
          onDeleteFile={onDeleteFile}
          readOnlyFileId={roomId}
        />
        <div className={`flex-1 min-w-0 h-full ${theme === 'light' ? 'bg-[#f4f8ff]' : 'bg-[#0d1117]'}`}>
          <EditorPane
            fileId={activeFile.id}
            initialContent={activeFile.content}
            language={activeFile.language}
            theme={theme}
            userId={userId}
            onLocalOp={handleLocalOp}
            onCursorMove={handleCursorMove}
            setRemoteOpHandler={setRemoteOpHandler}
            setEditorContentHandler={setEditorContentHandler}
          />
        </div>
      </>
    );
  }, [
    loading,
    activeFile,
    roomId,
    onCreateFile,
    onDeleteFile,
    userId,
    handleLocalOp,
    handleCursorMove,
    setRemoteOpHandler,
    setEditorContentHandler,
  ]);

  return (
    <main className={`editor-main h-screen flex flex-col bg-[#0d1117] text-[#e6edf3] ${theme === 'light' ? 'theme-light' : ''}`}>
      <CollabBar
        onUndo={() => window.dispatchEvent(new Event('codecollab:undo'))}
        onRedo={() => window.dispatchEvent(new Event('codecollab:redo'))}
        onOpenHistory={() => setHistoryOpen(true)}
        onRenameSession={onRenameSession}
        roomId={roomId ?? activeFileId}
        userName={userName}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <section className="editor-workspace flex flex-1 overflow-hidden">{editorShell}</section>

      <VersionTimeline isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <ConflictResolver />
      <Toast />
    </main>
  );
}
