import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Undo2, Redo2, History, Home, Share2, Check, Sun, Moon, Pencil } from 'lucide-react';
import { useLocation } from 'wouter';
import { useStore } from '../store';
import { AppTheme } from '../hooks/useTheme';

interface CollabBarProps {
  onUndo: () => void;
  onRedo: () => void;
  onOpenHistory: () => void;
  roomId?: string | null;
  userName: string;
  theme: AppTheme;
  onToggleTheme: () => void;
  onRenameSession: () => void;
}

function shortRoom(roomId?: string | null): string {
  if (!roomId) return 'local-session';
  return roomId.length > 12 ? `${roomId.slice(0, 5)}...${roomId.slice(-4)}` : roomId;
}

export function CollabBar({ onUndo, onRedo, onOpenHistory, roomId, userName, theme, onToggleTheme, onRenameSession }: CollabBarProps) {
  const [, navigate] = useLocation();
  const activeFileId = useStore((s) => s.activeFileId);
  const files = useStore((s) => s.files);
  const isOnline = useStore((s) => s.isOnline);
  const peers = useStore((s) => s.peers);
  const [copied, setCopied] = useState(false);

  const activeFile = activeFileId ? files[activeFileId] : null;
  const peerList = useMemo(() => {
    const list = Object.values(peers);
    const counts = new Map<string, number>();

    return list
      .map((peer) => {
        const count = (counts.get(peer.userName) ?? 0) + 1;
        counts.set(peer.userName, count);

        const suffix = peer.userId.split(':')[1]?.slice(-3)?.toUpperCase() ?? 'TAB';
        const badgeName = count > 1 ? `${peer.userName} ${count}` : peer.userName;
        return { ...peer, badgeName, tabLabel: `Tab ${suffix}` };
      })
      .sort((a, b) => a.badgeName.localeCompare(b.badgeName));
  }, [peers]);

  const participants = 1 + peerList.length;
  const isLight = theme === 'light';

  const shareRoom = async () => {
    const id = roomId ?? activeFileId;
    if (!id) return;
    const link = `${window.location.origin}${import.meta.env.BASE_URL}editor?room=${id}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="collab-header h-16 border-b border-[#30363d] bg-[linear-gradient(120deg,rgba(22,27,34,0.96),rgba(13,17,23,0.96)_40%,rgba(15,23,35,0.96))] backdrop-blur px-3 md:px-5 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all"
          title="Back to sessions"
        >
          <Home size={17} />
        </button>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7d8590]">Session</p>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm md:text-[15px] text-[#e6edf3] font-semibold truncate">
              {activeFile?.name ?? 'Untitled Session'}
            </p>
            <button
              onClick={onRenameSession}
              className="p-1 rounded-md text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
              title="Rename session"
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        <div
          className={`hidden lg:flex items-center gap-2 ml-2 px-2.5 py-1 rounded-md border text-xs ${
            isLight
              ? 'border-[#c4d6ee] bg-white/80 text-[#3f5a7b]'
              : 'border-[#30363d] bg-[#0d1117] text-[#8b949e]'
          }`}
        >
          <span className={isLight ? 'text-[#284361]' : 'text-[#c9d1d9]'}>Room</span>
          <code className={isLight ? 'text-[#1d5ec8]' : 'text-[#79c0ff]'}>{shortRoom(roomId ?? activeFileId)}</code>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div
          className={`hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border ${
            isLight ? 'border-[#c4d6ee] bg-white/80' : 'border-[#30363d] bg-[#0d1117]'
          }`}
        >
          {isOnline ? <Wifi size={14} className="text-[#3fb950]" /> : <WifiOff size={14} className="text-[#f85149]" />}
          <span className={`text-xs ${isOnline ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div
          className={`hidden md:flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
            isLight
              ? 'border-[#c4d6ee] bg-white/80 text-[#3f5a7b]'
              : 'border-[#30363d] bg-[#0d1117] text-[#8b949e]'
          }`}
        >
          <span>{participants}</span>
          <span>{participants === 1 ? 'member' : 'members'}</span>
        </div>

        <div className="flex -space-x-2 mr-1">
          <motion.div
            whileHover={{ y: -1, scale: 1.05 }}
            className="relative w-8 h-8 rounded-full border-2 border-[#161b22] flex items-center justify-center text-[10px] text-white font-semibold"
            style={{
              background: 'linear-gradient(145deg,#2f81f7,#1f6feb)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 18px rgba(47,129,247,0.35)',
            }}
            title={`${userName} (You)`}
          >
            {userName.slice(0, 2).toUpperCase()}
          </motion.div>

          {peerList.slice(0, 4).map((peer) => (
            <motion.div
              key={peer.userId}
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ y: -1, scale: 1.08 }}
              className="relative w-8 h-8 rounded-full border-2 border-[#161b22] flex items-center justify-center text-[10px] text-white font-semibold"
              style={{ backgroundColor: peer.color, boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 8px 16px ${peer.color}44` }}
              title={`${peer.badgeName} • ${peer.tabLabel}`}
            >
              {peer.badgeName.slice(0, 2).toUpperCase()}
            </motion.div>
          ))}
        </div>

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-md border border-[#30363d] text-[#c9d1d9] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={shareRoom}
          className="p-2 rounded-md border border-[#30363d] text-[#c9d1d9] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="Share room link"
        >
          {copied ? <Check size={16} className="text-[#3fb950]" /> : <Share2 size={16} />}
        </button>

        <button
          onClick={onUndo}
          className="p-2 rounded-md border border-[#30363d] text-[#c9d1d9] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>

        <button
          onClick={onRedo}
          className="p-2 rounded-md border border-[#30363d] text-[#c9d1d9] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>

        <button
          onClick={onOpenHistory}
          className="p-2 rounded-md border border-[#30363d] text-[#c9d1d9] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="Version history"
        >
          <History size={16} />
        </button>
      </div>
    </motion.header>
  );
}
