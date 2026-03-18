import { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { Operation } from '../ot/operations';

interface CodeEditorProps {
  onLocalOp?: (op: Operation) => void;
  onCursorMove?: (position: number) => void;
}

export function CodeEditor({ onLocalOp, onCursorMove }: CodeEditorProps) {
  const { activeFileId, files, updateFileContent } = useStore();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(0);

  const activeFile = activeFileId ? files[activeFileId] : null;

  // Handle local content changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.currentTarget.value;
      if (!activeFileId) return;

      const oldContent = activeFile?.content || '';
      const cursorPos = e.currentTarget.selectionStart;

      // Detect what changed
      if (newContent.length > oldContent.length) {
        // Insert
        const diff = newContent.length - oldContent.length;
        for (let i = 0; i < diff; i++) {
          const op: Operation = {
            type: 'insert',
            position: cursorPos - diff + i,
            char: newContent[cursorPos - diff + i],
            userId: 'local',
            timestamp: Date.now(),
          };
          onLocalOp?.(op);
        }
      } else if (newContent.length < oldContent.length) {
        // Delete
        const op: Operation = {
          type: 'delete',
          position: cursorPos,
          userId: 'local',
          timestamp: Date.now(),
        };
        onLocalOp?.(op);
      }

      updateFileContent(activeFileId, newContent);
      setCursorPos(cursorPos);
      onCursorMove?.(cursorPos);
    },
    [activeFileId, activeFile?.content, onLocalOp, onCursorMove, updateFileContent]
  );

  // Sync external changes to textarea
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    const wasAtEnd = editorRef.current.selectionStart === (editorRef.current.value || '').length;
    editorRef.current.value = activeFile.content;

    if (wasAtEnd) {
      editorRef.current.selectionStart = editorRef.current.selectionEnd = activeFile.content.length;
    }
  }, [activeFile?.content]);

  // Focus on file change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [activeFileId]);

  const lineCount = activeFile?.content.split('\n').length || 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col bg-[#0d1117] border-l border-[#30363d] overflow-hidden"
    >
      {/* Line numbers + Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 bg-[#0d1117] border-r border-[#30363d] text-right px-2 py-4 text-[#7d8590] text-xs font-mono select-none overflow-y-hidden">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={editorRef}
          value={activeFile?.content || ''}
          onChange={handleChange}
          placeholder="Start typing to collaborate..."
          className="flex-1 bg-[#0d1117] text-[#e6edf3] font-mono text-sm p-4 resize-none outline-none focus:outline-none placeholder-[#7d8590]"
          spellCheck="false"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: '1.5',
            tabSize: 2,
          }}
        />
      </div>

      {/* Status bar */}
      <div className="bg-[#161b22] border-t border-[#30363d] px-4 py-2 text-xs text-[#7d8590] flex items-center justify-between">
        <div>
          Line {Math.floor(cursorPos / (activeFile?.content.length || 1)) + 1} of {lineCount} ·{' '}
          {cursorPos} chars
        </div>
        <div>{activeFile?.language || 'javascript'}</div>
      </div>
    </motion.div>
  );
}
