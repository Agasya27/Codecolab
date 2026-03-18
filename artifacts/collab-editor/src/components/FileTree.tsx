import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2, Plus, Trash2, FolderTree } from 'lucide-react';
import { useStore, FileData } from '../store';

interface FileTreeProps {
  onCreateFile: (file: Omit<FileData, 'id'>) => void;
  onDeleteFile: (id: string) => void;
  readOnlyFileId?: string | null;
}

export function FileTree({ onCreateFile, onDeleteFile, readOnlyFileId }: FileTreeProps) {
  const files = useStore((s) => s.files);
  const activeFileId = useStore((s) => s.activeFileId);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const pendingOps = useStore((s) => s.pendingOps);
  const isOnline = useStore((s) => s.isOnline);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const list = useMemo(() => Object.values(files).sort((a, b) => a.name.localeCompare(b.name)), [files]);

  const create = () => {
    const value = name.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    const language = lower.endsWith('.py') ? 'python' : 'javascript';

    onCreateFile({
      name: value,
      content: language === 'python' ? '# Start coding\n' : '// Start coding\n',
      language,
      lastModified: Date.now(),
      revision: 0,
    });

    setName('');
    setCreating(false);
  };

  return (
    <aside className="filetree-panel w-72 border-r border-[#30363d] bg-[linear-gradient(170deg,#161b22,#10151e)] flex flex-col">
      <div className="filetree-header h-16 px-3 flex items-center justify-between border-b border-[#30363d]">
        <div className="flex items-center gap-2 text-[#c9d1d9]">
          <FolderTree size={15} className="text-[#59a7ff]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Workspace</span>
        </div>
        <button
          onClick={() => setCreating(true)}
            className="filetree-new p-1.5 rounded text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="New file"
        >
          <Plus size={15} />
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="filetree-create p-3 border-b border-[#30363d]"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="new-file.js"
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
                if (e.key === 'Escape') setCreating(false);
              }}
              className="filetree-input w-full h-9 px-3 text-sm rounded-md border border-[#30363d] bg-[#0d1117] text-[#e6edf3] outline-none focus:border-[#2f81f7]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="filetree-list flex-1 overflow-y-auto p-2">
        {list.map((file) => {
          const active = file.id === activeFileId;
          const locked = readOnlyFileId ? file.id !== readOnlyFileId : false;

          return (
            <motion.div
              key={file.id}
              layout
              onClick={() => !locked && setActiveFile(file.id)}
              className={`filetree-item group mb-1 h-10 px-2 rounded-md flex items-center gap-2 text-sm ${
                active
                  ? 'bg-[linear-gradient(90deg,rgba(47,129,247,0.22),rgba(47,129,247,0.08))] border border-[#2f81f755] text-[#e6edf3]'
                  : 'text-[#c9d1d9] hover:bg-[#21262d]/80 border border-transparent'
              } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <FileCode2 size={14} className="text-[#7d8590]" />
              <span className="truncate flex-1">{file.name}</span>
              <span
                className="w-2 h-2 rounded-full"
                title={!isOnline ? 'Offline' : pendingOps.length > 0 && active ? 'Syncing' : 'Synced'}
                style={{
                  backgroundColor: !isOnline ? '#7d8590' : pendingOps.length > 0 && active ? '#d29922' : '#3fb950',
                  boxShadow: !isOnline ? 'none' : '0 0 10px rgba(63,185,80,0.45)',
                }}
              />
              {!locked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#30363d] text-[#7d8590] hover:text-[#f85149] transition-all"
                  title="Delete file"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </aside>
  );
}
