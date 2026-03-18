import { useEffect, useRef, useState } from 'react';
import { History, Undo2, Redo2, Wifi, WifiOff, ChevronRight, Users, Link, Check } from 'lucide-react';
import { useStore, FileData, Peer } from '../store';
import { getInitials, colorFromId } from '../utils/colorFromId';

interface TopBarProps {
  activeFile: FileData | null;
  onToggleHistory: () => void;
  onNavigateHome: () => void;
  userId: string;
  userName: string;
  roomId?: string | null;
}

export function TopBar({ activeFile, onToggleHistory, onNavigateHome, userId, userName, roomId }: TopBarProps) {
  const { isOnline, peers, serverRevision } = useStore();
  const peerList = Object.values(peers);
  const myColor = colorFromId(userId);
  const [copied, setCopied] = useState(false);

  // Track "now" for typing detection (updates every 500 ms)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Track peers that are in the process of fading out after disconnect
  const [fadingPeers, setFadingPeers] = useState<Map<string, Peer>>(new Map());
  const prevPeersRef = useRef<Record<string, Peer>>({});

  useEffect(() => {
    const prev = prevPeersRef.current;
    for (const [uid, peer] of Object.entries(prev)) {
      if (!peers[uid]) {
        setFadingPeers(m => {
          if (m.has(uid)) return m;
          const next = new Map(m);
          next.set(uid, peer);
          return next;
        });
        setTimeout(() => {
          setFadingPeers(m => {
            const next = new Map(m);
            next.delete(uid);
            return next;
          });
        }, 450);
      }
    }
    prevPeersRef.current = peers;
  }, [peers]);

  const isTyping = (peer: Peer): boolean =>
    peer.lastCursorAt !== undefined && now - peer.lastCursorAt < 2000;

  const totalOnline = peerList.length + 1;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex items-center justify-between px-4 flex-shrink-0"
      style={{ height: '48px', background: '#161b22', borderBottom: '1px solid #30363d' }}
    >
      {/* Left: logo + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          title="Back to home"
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2f81f7, #1a65d6)' }}
          >
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm" style={{ color: '#e6edf3' }}>CodeCollab</span>
        </button>

        {activeFile && (
          <>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#484f58' }} />
            <span
              className="text-sm truncate max-w-[180px]"
              style={{ color: '#e6edf3', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {activeFile.name}
            </span>
          </>
        )}
      </div>

      {/* Center: status pill + rev */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            background: isOnline ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${isOnline ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
            color: isOnline ? '#3fb950' : '#f85149',
          }}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Connected' : 'Offline'}
        </div>
        <span className="text-xs" style={{ color: '#484f58' }}>
          Rev <span style={{ color: '#7d8590' }}>{serverRevision}</span>
        </span>
      </div>

      {/* Right: peers + share + actions */}
      <div className="flex items-center gap-3">

        {/* Peer avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1.5">
            {/* Self avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-black z-10 flex-shrink-0"
              style={{ backgroundColor: myColor, boxShadow: '0 0 0 2px #161b22' }}
              title={`${userName} (you)`}
            >
              {getInitials(userName)}
            </div>

            {/* Active peers */}
            {peerList.map((peer, idx) => {
              const typing = isTyping(peer);
              return (
                <div
                  key={peer.userId}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0 transition-all duration-300${typing ? ' peer-typing' : ''}`}
                  style={{
                    backgroundColor: peer.color,
                    boxShadow: '0 0 0 2px #161b22',
                    zIndex: 9 - idx,
                    '--peer-color': peer.color,
                  } as React.CSSProperties}
                  title={`${peer.userName}${typing ? ' (typing…)' : ''}`}
                >
                  {getInitials(peer.userName)}
                </div>
              );
            })}

            {/* Fading-out peers (just disconnected) */}
            {[...fadingPeers.values()].map((peer, idx) => (
              <div
                key={`fading-${peer.userId}`}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                style={{
                  backgroundColor: peer.color,
                  boxShadow: '0 0 0 2px #161b22',
                  zIndex: 8 - idx,
                  opacity: 0,
                  transition: 'opacity 0.4s ease',
                  pointerEvents: 'none',
                }}
                title={peer.userName}
              >
                {getInitials(peer.userName)}
              </div>
            ))}
          </div>

          {/* Peer count badge */}
          {peerList.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: 'rgba(47,129,247,0.1)',
                border: '1px solid rgba(47,129,247,0.2)',
                color: '#7d8590',
              }}
            >
              {totalOnline} {totalOnline === 1 ? 'peer' : 'peers'}
            </span>
          )}
        </div>

        <div className="w-px h-4" style={{ background: '#30363d' }} />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <TopBarBtn title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></TopBarBtn>
          <TopBarBtn title="Redo (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></TopBarBtn>

          {roomId && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ml-1"
              style={{
                background: copied ? 'rgba(63,185,80,0.12)' : 'rgba(47,129,247,0.08)',
                border: `1px solid ${copied ? 'rgba(63,185,80,0.3)' : 'rgba(47,129,247,0.2)'}`,
                color: copied ? '#3fb950' : '#7d8590',
              }}
              title="Copy invite link"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copied!</span></>
              ) : (
                <><Link className="w-3.5 h-3.5" /><span className="hidden sm:inline">Share</span></>
              )}
            </button>
          )}

          <button
            onClick={onToggleHistory}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ml-1"
            style={{
              background: 'rgba(47,129,247,0.1)',
              border: '1px solid rgba(47,129,247,0.25)',
              color: '#2f81f7',
            }}
            title="Version History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TopBarBtn({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <button
      className="w-7 h-7 rounded flex items-center justify-center transition-all"
      style={{ color: '#7d8590' }}
      title={title}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(230,237,243,0.06)';
        (e.currentTarget as HTMLElement).style.color = '#e6edf3';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = '#7d8590';
      }}
    >
      {children}
    </button>
  );
}
