import { motion } from 'framer-motion';
import { MoreVertical, Home } from 'lucide-react';
import { useLocation } from 'wouter';
import { useStore } from '../store';
import { useState } from 'react';

export function Navbar() {
  const [, navigate] = useLocation();
  const { activeFileId, isOnline, peers, files } = useStore();
  const activeFile = activeFileId ? files[activeFileId] : null;
  const [showMenu, setShowMenu] = useState(false);

  const peerList = Object.values(peers);

  return (
    <motion.nav
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      className="bg-[#0d1117] border-b border-[#30363d] px-6 py-4 flex items-center justify-between sticky top-0 z-40"
    >
      {/* Left: Logo & File Name */}
      <div className="flex items-center gap-6">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/')}
          className="text-[#2f81f7] hover:text-[#79c0ff] transition-colors"
          title="Back to landing"
        >
          <Home size={24} />
        </motion.button>
        <div>
          <div className="text-sm text-[#7d8590]">Session</div>
          <div className="font-semibold text-[#e6edf3]">{activeFile?.name || 'Untitled'}</div>
        </div>
      </div>

      {/* Center: Connection Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: isOnline ? 1 : 0.8 }}
            className={`w-3 h-3 rounded-full ${isOnline ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`}
          />
          <span className="text-sm text-[#7d8590]">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Peer Avatars */}
        {peerList.length > 0 && (
          <div className="flex -space-x-2 ml-4">
            {peerList.slice(0, 3).map((peer) => (
              <motion.div
                key={peer.userId}
                whileHover={{ scale: 1.2, zIndex: 10 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border border-[#0d1117]"
                style={{ backgroundColor: peer.color }}
                title={peer.userName}
              >
                {peer.userName.slice(0, 1).toUpperCase()}
              </motion.div>
            ))}
            {peerList.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-[#21262d] flexitems-center justify-center text-xs text-[#7d8590] border border-[#30363d]">
                +{peerList.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Menu */}
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMenu(!showMenu)}
          className="text-[#7d8590] hover:text-[#c9d1d9] transition-colors"
        >
          <MoreVertical size={20} />
        </motion.button>
      </div>
    </motion.nav>
  );
}
