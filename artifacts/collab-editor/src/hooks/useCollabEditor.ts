import { useCallback, useEffect, useRef, useState } from 'react';
import { SyncManager } from '../sync/SyncManager';
import { Operation } from '../ot/operations';
import { makeId } from '../utils/makeId';

export function useCollabEditor() {
  const [userId] = useState(() => {
    let id = localStorage.getItem('codecollab_userId');
    if (!id) {
      id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : makeId();
      localStorage.setItem('codecollab_userId', id);
    }
    return id;
  });

  const [userName] = useState(() => {
    let name = localStorage.getItem('codecollab_username');
    if (!name) {
      name = `User ${userId.slice(0, 4)}`;
      localStorage.setItem('codecollab_username', name);
    }
    return name;
  });

  const syncManagerRef = useRef<SyncManager | null>(null);
  const remoteOpHandlerRef = useRef<((op: Operation) => void) | null>(null);
  const editorContentHandlerRef = useRef<((content: string) => void) | null>(null);

  const setRemoteOpHandler = useCallback((handler: (op: Operation) => void) => {
    remoteOpHandlerRef.current = handler;
    syncManagerRef.current?.setRemoteOpHandler(handler);
  }, []);

  const setEditorContentHandler = useCallback((handler: (content: string) => void) => {
    editorContentHandlerRef.current = handler;
    syncManagerRef.current?.setRemoteContentHandler(handler);
  }, []);

  useEffect(() => {
    const sm = new SyncManager(
      userId,
      userName,
      (op) => {
        if (remoteOpHandlerRef.current) {
          remoteOpHandlerRef.current(op);
        }
      },
      (content) => {
        if (editorContentHandlerRef.current) {
          editorContentHandlerRef.current(content);
        }
      }
    );
    syncManagerRef.current = sm;
    sm.connect();

    return () => {
      sm.disconnect();
    };
  }, [userId, userName]);

  return {
    syncManagerRef,
    userId,
    userName,
    setRemoteOpHandler,
    setEditorContentHandler,
  };
}
