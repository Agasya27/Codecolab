import { useState } from 'react';
import { FileCode, FileText, FileJson, Plus, Trash2, Hash, ChevronDown, Lock } from 'lucide-react';
import { useStore, FileData } from '../store';

interface SidebarTreeProps {
  onCreateFile: (file: Omit<FileData, 'id'>) => void;
  onDeleteFile: (id: string) => void;
  roomId?: string | null;
}

function getFileIcon(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.tsx'))
    return <FileCode className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#3b82f6' }} />;
  if (name.endsWith('.js') || name.endsWith('.jsx'))
    return <FileCode className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f1c40f' }} />;
  if (name.endsWith('.json'))
    return <FileJson className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f0a500' }} />;
  if (name.endsWith('.css') || name.endsWith('.scss'))
    return <Hash className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#60a5fa' }} />;
  if (name.endsWith('.py'))
    return <FileCode className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#3fb950' }} />;
  return <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7d8590' }} />;
}

export function SidebarTree({ onCreateFile, onDeleteFile, roomId }: SidebarTreeProps) {
  const { files, activeFileId, setActiveFile, pendingOps, isOnline } = useStore();
  const fileList = Object.values(files).sort((a, b) => a.name.localeCompare(b.name));
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleCreate = () => {
    if (roomId) return; // no new files in room sessions
    const name = window.prompt('File name (e.g. index.js, main.py):');
    if (!name?.trim()) return;

    let language = 'text';
    const n = name.toLowerCase();
    if (n.endsWith('.js') || n.endsWith('.ts') || n.endsWith('.jsx') || n.endsWith('.tsx'))
      language = 'javascript';
    else if (n.endsWith('.py'))
      language = 'python';

    onCreateFile({
      name: name.trim(),
      content: language === 'python' ? '# Start coding...\n' : '// Start coding...\n',
      language,
      lastModified: Date.now(),
      revision: 0,
    });
  };

  const handleFileClick = (fileId: string) => {
    // In room mode, only the room file is editable
    if (roomId && fileId !== roomId) return;
    setActiveFile(fileId);
  };

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        width: '220px',
        background: '#161b22',
        borderRight: '1px solid #30363d',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown className="w-3 h-3" style={{ color: '#484f58' }} />
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: '#7d8590' }}
          >
            Explorer
          </span>
          {roomId && (
            <span
              className="text-[9px] font-semibold px-1 rounded"
              style={{ background: 'rgba(47,129,247,0.15)', color: '#2f81f7', letterSpacing: '0.04em' }}
              title="Room session — only the shared file is editable"
            >
              ROOM
            </span>
          )}
        </div>
        {!roomId && (
          <button
            onClick={handleCreate}
            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
            style={{ color: '#7d8590' }}
            title="New file"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(230,237,243,0.08)';
              (e.currentTarget as HTMLElement).style.color = '#e6edf3';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#7d8590';
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileList.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: '#484f58' }}>No files yet</p>
            {!roomId && (
              <button
                onClick={handleCreate}
                className="text-xs mt-2 transition-colors"
                style={{ color: '#2f81f7' }}
              >
                + New file
              </button>
            )}
          </div>
        ) : (
          fileList.map(file => {
            const isActive = activeFileId === file.id;
            const isHovered = hoveredId === file.id;
            const hasPending = pendingOps.length > 0;
            const isRoomLocked = !!roomId && file.id !== roomId;

            return (
              <div
                key={file.id}
                className="group relative flex items-center"
                style={{
                  padding: '3px 8px 3px 12px',
                  cursor: isRoomLocked ? 'not-allowed' : 'pointer',
                  background: isActive
                    ? 'rgba(47,129,247,0.12)'
                    : isHovered && !isRoomLocked
                    ? 'rgba(230,237,243,0.04)'
                    : 'transparent',
                  borderLeft: isActive ? '2px solid #2f81f7' : '2px solid transparent',
                  opacity: isRoomLocked ? 0.38 : 1,
                }}
                onClick={() => handleFileClick(file.id)}
                onMouseEnter={() => setHoveredId(file.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={isRoomLocked ? 'Switch to a non-room session to edit other files' : undefined}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(file.name)}
                  <span
                    className="text-sm truncate"
                    style={{
                      color: isActive ? '#e6edf3' : '#c9d1d9',
                      fontFamily: 'inherit',
                    }}
                  >
                    {file.name}
                  </span>
                  {isRoomLocked && (
                    <Lock className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#484f58' }} />
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
                  {/* Sync dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    title={!isOnline ? 'Offline' : hasPending && isActive ? 'Syncing…' : 'Synced'}
                    style={{
                      background: !isOnline
                        ? '#484f58'
                        : hasPending && isActive
                        ? '#d29922'
                        : '#3fb950',
                      opacity: isActive ? 1 : 0.35,
                    }}
                  />

                  {/* Delete button — only on hover, not in room mode */}
                  {!roomId && (
                    <button
                      className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: '#7d8590' }}
                      onClick={e => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${file.name}"?`)) onDeleteFile(file.id);
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#f85149')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#7d8590')}
                      title="Delete file"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: new file button (hidden in room mode) */}
      {!roomId && (
        <div style={{ padding: '8px', borderTop: '1px solid #21262d' }}>
          <button
            onClick={handleCreate}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-all"
            style={{
              background: 'rgba(230,237,243,0.04)',
              border: '1px solid #30363d',
              color: '#7d8590',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(47,129,247,0.08)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(47,129,247,0.3)';
              (e.currentTarget as HTMLElement).style.color = '#2f81f7';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(230,237,243,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = '#30363d';
              (e.currentTarget as HTMLElement).style.color = '#7d8590';
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New File
          </button>
        </div>
      )}
    </div>
  );
}
