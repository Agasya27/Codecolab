import { useEffect, useRef } from 'react';
import { EditorState, Annotation } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { useStore } from '../store';
import { Operation } from '../ot/operations';
import { AppTheme } from '../hooks/useTheme';
import {
  peerCursorsExtension,
  setCursorEffect,
  removeCursorEffect,
  clearCursorsEffect,
} from '../extensions/peerCursors';

const remoteAnnotation = Annotation.define<boolean>();

interface EditorPaneProps {
  fileId: string;
  initialContent: string;
  language: string;
  theme: AppTheme;
  userId: string;
  onLocalOp: (op: Operation) => void;
  onCursorMove: (pos: number, line: number, col: number) => void;
  setRemoteOpHandler: (handler: (op: Operation) => void) => void;
  setEditorContentHandler: (handler: (content: string) => void) => void;
}

export function EditorPane({
  fileId,
  initialContent,
  language,
  theme,
  userId,
  onLocalOp,
  onCursorMove,
  setRemoteOpHandler,
  setEditorContentHandler,
}: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onLocalOpRef = useRef(onLocalOp);
  const onCursorMoveRef = useRef(onCursorMove);

  useEffect(() => {
    onLocalOpRef.current = onLocalOp;
  }, [onLocalOp]);

  useEffect(() => {
    onCursorMoveRef.current = onCursorMove;
  }, [onCursorMove]);

  const peers = useStore((state) => state.peers);
  const prevPeersRef = useRef<typeof peers>({});

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const effects = [];
    const prev = prevPeersRef.current;

    for (const peer of Object.values(peers)) {
      if (peer.cursor !== undefined) {
        effects.push(
          setCursorEffect.of({
            userId: peer.userId,
            userName: peer.userName,
            color: peer.color,
            position: Math.min(peer.cursor, view.state.doc.length),
            lastUpdate: peer.lastCursorAt ?? Date.now(),
          }),
        );
      }
    }

    for (const peerId of Object.keys(prev)) {
      if (!peers[peerId]) {
        effects.push(removeCursorEffect.of(peerId));
      }
    }

    prevPeersRef.current = peers;

    if (effects.length > 0) {
      view.dispatch({ effects });
    }
  }, [peers]);

  useEffect(() => {
    const editor = viewRef.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current === initialContent) return;

    editor.dispatch(
      editor.state.update({
        changes: { from: 0, to: editor.state.doc.length, insert: initialContent },
        annotations: [remoteAnnotation.of(true)],
      }),
    );
  }, [initialContent, fileId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const langExtension = language === 'python' ? python() : javascript({ jsx: true, typescript: true });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const isRemote = update.transactions.some((tr) => tr.annotation(remoteAnnotation));
        if (!isRemote) {
          update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            if (fromA < toA) {
              for (let i = 0; i < toA - fromA; i++) {
                onLocalOpRef.current({ type: 'delete', position: fromA, userId, timestamp: Date.now() });
              }
            }
            if (fromB < toB) {
              const text = inserted.toString();
              for (let i = 0; i < text.length; i++) {
                onLocalOpRef.current({ type: 'insert', position: fromB + i, char: text[i], userId, timestamp: Date.now() });
              }
            }
          });
        }
      }

      if (update.selectionSet) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        onCursorMoveRef.current(head, line.number, head - line.from + 1);
      }
    });

    const customTheme = EditorView.theme(
      {
        '&': {
          background:
            theme === 'dark'
              ? 'radial-gradient(circle at 80% 6%, rgba(56,189,248,0.14), transparent 30%), radial-gradient(circle at 10% 86%, rgba(59,130,246,0.1), transparent 34%), #0b111b'
              : 'radial-gradient(circle at 80% 6%, rgba(14,165,233,0.1), transparent 30%), radial-gradient(circle at 10% 86%, rgba(59,130,246,0.07), transparent 34%), #f8fbff',
          color: theme === 'dark' ? '#e6edf3' : '#0f172a',
          height: '100%',
        },
        '.cm-content': {
          paddingTop: '14px',
          paddingBottom: '240px',
          caretColor: theme === 'dark' ? '#f0f6fc' : '#0f172a',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: '13px',
          lineHeight: '1.72',
        },
        '.cm-focused': { outline: 'none' },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: theme === 'dark' ? '#f0f6fc' : '#0f172a',
          borderLeftWidth: '2px',
          filter: theme === 'dark' ? 'drop-shadow(0 0 5px rgba(125,211,252,0.55))' : 'drop-shadow(0 0 4px rgba(59,130,246,0.32))',
        },
        '.cm-scroller': { height: '100%', overflow: 'auto' },
        '.cm-gutters': {
          backgroundColor: theme === 'dark' ? '#0a1018' : '#f1f6ff',
          borderRight: theme === 'dark' ? '1px solid #2d3a4f' : '1px solid #d5e2f6',
          color: theme === 'dark' ? '#52617a' : '#6b7d99',
          minWidth: '56px',
        },
        '.cm-gutter .cm-gutterElement': {
          paddingLeft: '10px',
          paddingRight: '12px',
          textAlign: 'right',
          color: theme === 'dark' ? '#52617a' : '#6b7d99',
          fontSize: '12px',
        },
        '.cm-lineNumbers .cm-activeLineGutter': {
          backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)',
          color: theme === 'dark' ? '#c9d1d9' : '#1e3a5f',
        },
        '.cm-activeLine': {
          backgroundColor: theme === 'dark' ? 'rgba(56,189,248,0.07)' : 'rgba(59,130,246,0.06)',
          borderTop: theme === 'dark' ? '1px solid rgba(56,189,248,0.08)' : '1px solid rgba(59,130,246,0.08)',
          borderBottom: theme === 'dark' ? '1px solid rgba(56,189,248,0.08)' : '1px solid rgba(59,130,246,0.08)',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: theme === 'dark' ? 'rgba(47,129,247,0.3)' : 'rgba(59,130,246,0.2)',
        },
        '.cm-matchingBracket': {
          backgroundColor: theme === 'dark' ? 'rgba(47,129,247,0.2)' : 'rgba(59,130,246,0.14)',
          outline: theme === 'dark' ? '1px solid rgba(47,129,247,0.6)' : '1px solid rgba(59,130,246,0.45)',
        },
      },
      { dark: theme === 'dark' },
    );

    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        highlightActiveLine(),
        ...(theme === 'dark' ? [oneDark] : []),
        customTheme,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langExtension,
        updateListener,
        EditorView.lineWrapping,
        peerCursorsExtension,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });
    viewRef.current = view;

    const onUndo = () => {
      const current = viewRef.current;
      if (current) undo(current);
    };

    const onRedo = () => {
      const current = viewRef.current;
      if (current) redo(current);
    };

    window.addEventListener('codecollab:undo', onUndo);
    window.addEventListener('codecollab:redo', onRedo);

    const currentPeers = useStore.getState().peers;
    const initEffects = Object.values(currentPeers)
      .filter((peer) => peer.cursor !== undefined)
      .map((peer) =>
        setCursorEffect.of({
          userId: peer.userId,
          userName: peer.userName,
          color: peer.color,
          position: Math.min(peer.cursor!, view.state.doc.length),
          lastUpdate: peer.lastCursorAt ?? Date.now(),
        }),
      );

    if (initEffects.length > 0) {
      view.dispatch({ effects: initEffects });
    }

    setRemoteOpHandler((op: Operation) => {
      const editor = viewRef.current;
      if (!editor) return;
      const docLen = editor.state.doc.length;

      if (op.type === 'insert') {
        const pos = Math.min(op.position, docLen);
        editor.dispatch(
          editor.state.update({
            changes: { from: pos, insert: op.char ?? '' },
            annotations: [remoteAnnotation.of(true)],
          }),
        );
      } else if (op.type === 'delete' && op.position < docLen) {
        editor.dispatch(
          editor.state.update({
            changes: { from: op.position, to: op.position + 1 },
            annotations: [remoteAnnotation.of(true)],
          }),
        );
      }
    });

    setEditorContentHandler((content: string) => {
      const editor = viewRef.current;
      if (!editor) return;
      const docLen = editor.state.doc.length;
      editor.dispatch(
        editor.state.update({
          changes: { from: 0, to: docLen, insert: content },
          annotations: [remoteAnnotation.of(true)],
        }),
      );
      editor.dispatch({ effects: [clearCursorsEffect.of(null)] });
    });

    return () => {
      window.removeEventListener('codecollab:undo', onUndo);
      window.removeEventListener('codecollab:redo', onRedo);
      view.destroy();
      viewRef.current = null;
    };
  }, [fileId, language, setEditorContentHandler, setRemoteOpHandler, theme, userId]);

  return (
    <div className={`editor-pane-wrap relative h-full overflow-hidden p-3 md:p-4 ${theme === 'dark' ? 'bg-[radial-gradient(circle_at_80%_0%,rgba(47,129,247,0.08),transparent_35%)]' : 'bg-[radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.06),transparent_35%)]'}`}>
      <div className="editor-shell h-full">
        <div className="editor-topbar px-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f85149]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#d29922]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950]" />
          <span className="ml-2 text-[11px] text-[#91a3bc] tracking-[0.16em] uppercase">{language}</span>
        </div>
        <div ref={containerRef} style={{ height: 'calc(100% - 34px)', width: '100%', overflow: 'hidden' }} />
      </div>
    </div>
  );
}
