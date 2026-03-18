import { motion, AnimatePresence } from 'framer-motion';
import { File, Plus, Trash2, FileCode } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { saveFile } from '../db';

export function FileExplorer() {
  const { files, activeFileId, createFile, deleteFile, setActiveFile } = useStore();
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fileList = Object.values(files).sort((a, b) => b.lastModified - a.lastModified);

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    const fileId = uuidv4();
    const newFile = {
      id: fileId,
      name: newFileName,
      content: '',
      language: 'javascript',
      lastModified: Date.now(),
      revision: 0,
    };

    await saveFile(newFile);
    createFile(newFile);
    setActiveFile(fileId);
    setNewFileName('');
    setIsCreating(false);
  };

  const handleDeleteFile = async (id: string) => {
    deleteFile(id);
    if (activeFileId === id && fileList.length > 1) {
      const nextFile = fileList.find(f => f.id !== id);
      if (nextFile) setActiveFile(nextFile.id);
    }
  };

  const getLanguageIcon = (language: string) => {
    const icons: Record<string, string> = {
      javascript: '🟨',
      typescript: '🔵',
      python: '🔴',
      html: '🟠',
      css: '🔷',
      json: '📄',
      markdown: '📝',
    };
    return icons[language] || '📄';
  };

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 bg-[#0d1117] border-r border-[#30363d] h-screen overflow-y-auto flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-[#30363d] sticky top-0 bg-[#0d1117]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#c9d1d9]">Files</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCreating(true)}
            className="text-[#7d8590] hover:text-[#2f81f7] transition-colors"
            title="New file"
          >
            <Plus size={18} />
          </motion.button>
        </div>

        {/* Create Input */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                autoFocus
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                placeholder="File name..."
                className="w-full px-2 py-2 bg-[#21262d] border border-[#30363d] rounded text-[#e6edf3] placeholder-[#7d8590] text-sm focus:outline-none focus:border-[#2f81f7]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {fileList.map((file) => (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={() => setActiveFile(file.id)}
              className={`px-4 py-3 cursor-pointer flex items-center justify-between group transition-colors ${
                activeFileId === file.id ? 'bg-[#21262d]' : 'hover:bg-[#161b22]'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg">{getLanguageIcon(file.language)}</span>
                <div className="min-w-0">
                  <p className="font-medium text-[#c9d1d9] truncate text-sm">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#7d8590] truncate">
                    {new Date(file.lastModified).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFile(file.id);
                }}
                className="text-[#7d8590] hover:text-[#f85149] opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>

        {fileList.length === 0 && (
          <div className="p-4 text-center text-[#7d8590] text-sm">
            <p>No files yet</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreating(true)}
              className="mt-3 text-[#2f81f7] hover:text-[#79c0ff]"
            >
              Create one
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
