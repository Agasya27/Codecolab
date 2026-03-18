import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Link2, Pencil, Trash2, ArrowRight, Sparkles, Users2, ShieldCheck, Cpu, Search, Check, Sun, Moon } from 'lucide-react';
import { useLocation } from 'wouter';
import { deleteFileDB, getAllFiles, initDB, saveFile } from '../db';
import { formatDate } from '../utils/formatDate';
import { makeId } from '../utils/makeId';
import { normalizeRoomInput } from '../utils/room';
import { useTheme } from '../hooks/useTheme';

interface SessionMeta {
  id: string;
  name: string;
  lastModified: number;
}

interface LanguageBadge {
  label: string;
  glyph: string;
  tint: string;
  shadow: string;
  x: string;
  y: string;
  delay: number;
}

const SESSIONS_KEY = 'codecollab_sessions';
const RUNNING_WORDS = ['Collaborate', 'Edit', 'Configure', 'Ship'];

const LANGUAGE_BADGES: LanguageBadge[] = [
  { label: 'PHP', glyph: 'PHP', tint: '#ef5d73', shadow: 'rgba(239,93,115,0.45)', x: '14%', y: '16%', delay: 0.05 },
  { label: 'CSS', glyph: 'CSS', tint: '#2dd4bf', shadow: 'rgba(45,212,191,0.42)', x: '78%', y: '18%', delay: 0.12 },
  { label: 'JS', glyph: 'JS', tint: '#60a5fa', shadow: 'rgba(96,165,250,0.44)', x: '10%', y: '46%', delay: 0.18 },
  { label: 'HTML', glyph: 'HTML', tint: '#93c5fd', shadow: 'rgba(147,197,253,0.42)', x: '80%', y: '48%', delay: 0.24 },
  { label: '<CODE>', glyph: '<CODE>', tint: '#7dd3fc', shadow: 'rgba(125,211,252,0.38)', x: '24%', y: '66%', delay: 0.31 },
];

function readSessionMeta(): SessionMeta[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SessionMeta[];
  } catch {
    return [];
  }
}

function writeSessionMeta(items: SessionMeta[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [joinId, setJoinId] = useState('');
  const [username, setUsername] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [runningWordIndex, setRunningWordIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      await initDB();
      const files = await getAllFiles();
      const stored = readSessionMeta();
      const byId = new Map(stored.map((s) => [s.id, s]));

      const merged = files.map((file) => {
        const meta = byId.get(file.id);
        return {
          id: file.id,
          name: meta?.name ?? file.name,
          lastModified: file.lastModified,
        };
      });

      merged.sort((a, b) => b.lastModified - a.lastModified);
      writeSessionMeta(merged);
      setSessions(merged);

      const storedName = localStorage.getItem('codecollab_username');
      if (storedName) setUsername(storedName);
    };

    void load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRunningWordIndex((prev) => (prev + 1) % RUNNING_WORDS.length);
    }, 1700);
    return () => clearInterval(timer);
  }, []);

  const featureCards = useMemo(
    () => [
      {
        title: 'Realtime Team Editing',
        desc: 'Live synchronized typing, cursors, and peers with zero backend latency.',
        icon: Users2,
      },
      {
        title: 'Offline Resilience',
        desc: 'Work disconnected, queue operations safely, and flush on reconnect.',
        icon: ShieldCheck,
      },
      {
        title: 'Operational Transform',
        desc: 'Conflict-safe transforms and snapshot-based version recovery.',
        icon: Cpu,
      },
    ],
    [],
  );

  const createSession = async () => {
    if (username.trim()) {
      localStorage.setItem('codecollab_username', username.trim());
    }

    const id = makeId();
    const now = Date.now();
    const next = { id, name: `Session ${new Date(now).toLocaleDateString()}`, lastModified: now };

    await saveFile({
      id,
      name: next.name,
      content: '// Start collaborating in another tab\n',
      language: 'javascript',
      lastModified: now,
      revision: 0,
    });

    const updated = [next, ...sessions];
    setSessions(updated);
    writeSessionMeta(updated);
    navigate(`/editor?room=${id}`);
  };

  const joinSession = () => {
    if (username.trim()) {
      localStorage.setItem('codecollab_username', username.trim());
    }

    const id = normalizeRoomInput(joinId);
    if (!id) return;
    navigate(`/editor?room=${encodeURIComponent(id)}`);
  };

  const renameSession = async (id: string) => {
    const current = sessions.find((s) => s.id === id);
    const nextName = window.prompt('Session name', current?.name ?? '');
    if (!nextName?.trim()) return;

    const files = await getAllFiles();
    const file = files.find((item) => item.id === id);
    if (file) {
      await saveFile({ ...file, name: nextName.trim(), lastModified: Date.now() });
    }

    const updated = sessions.map((s) => (s.id === id ? { ...s, name: nextName.trim() } : s));
    setSessions(updated);
    writeSessionMeta(updated);
  };

  const removeSession = async (id: string) => {
    if (!window.confirm('Delete this session?')) return;
    await deleteFileDB(id);
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    writeSessionMeta(updated);
  };

  const shareSession = async (id: string) => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}editor?room=${id}`;
    await navigator.clipboard.writeText(link);
  };

  const saveUsername = () => {
    const trimmed = username.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem('codecollab_username', trimmed);
    }
    setIsEditingName(false);
  };

  const initials = (username.trim() || 'User')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <main className={`landing-root min-h-screen relative overflow-hidden bg-[#0d1117] text-[#e6edf3] ${theme === 'light' ? 'theme-light' : ''}`}>
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />
      <div className="landing-orb landing-orb-c" />
      <div className="landing-grid" />
      <div className="landing-noise" />

      <div className="relative z-10 max-w-7xl mx-auto px-5 py-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="landing-hero-shell"
        >
          <button
            onClick={toggleTheme}
            className="landing-theme-toggle"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-12">
            <div>
              <div className="landing-kicker inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#8cc8ff] mb-4">
                <Sparkles size={13} /> Interactive Collaborative Coding
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.92] mb-4">
                <span className="landing-title-shine bg-[linear-gradient(92deg,#c7deff_0%,#6ab0ff_32%,#6ee7f7_65%,#9ed3ff_100%)] bg-clip-text text-transparent">
                  CodeCollab
                </span>
              </h1>
              <div className="landing-running-copy mb-4">
                <span className="landing-running-static">Build.</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={RUNNING_WORDS[runningWordIndex]}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.24 }}
                    className="landing-running-dynamic"
                  >
                    {RUNNING_WORDS[runningWordIndex]}.
                  </motion.span>
                </AnimatePresence>
              </div>
              <p className="landing-desc text-[#97a3b4] text-base md:text-lg max-w-2xl">
                Real-time multi-user editor with offline persistence, conflict-safe operations, and production-grade workflow from session creation to timeline restore.
              </p>

              <div className="mt-5">
                {!isEditingName ? (
                  <button className="landing-user-pill" onClick={() => setIsEditingName(true)}>
                    <span className="landing-user-avatar">{initials}</span>
                    <span className="landing-user-name">{username.trim() || 'Set your name'}</span>
                    <span className="landing-user-edit-icon">
                      <Pencil size={16} />
                    </span>
                  </button>
                ) : (
                  <div className="landing-user-edit">
                    <span className="landing-user-avatar">{initials}</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveUsername();
                      }}
                      placeholder="Your name"
                      className="landing-user-input"
                    />
                    <button className="landing-user-save" onClick={saveUsername}>
                      <Check size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="landing-command mt-4">
                <Search size={18} className="text-[#8a94a6] ml-5 shrink-0" />
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Paste room link"
                  className="landing-command-input"
                />
                <button onClick={joinSession} className="landing-command-join">
                  Join Session <ArrowRight size={15} />
                </button>
                <button onClick={createSession} className="landing-command-create">
                  <Plus size={15} /> Create New
                </button>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }} className="landing-visual-card">
              <div className="coder-scene" aria-hidden>
                <div className="orbit-system">
                  {LANGUAGE_BADGES.map((badge) => (
                    <motion.div
                      key={badge.label}
                      className="orbit-node orbit-node-static"
                      style={
                        {
                          '--lang-tint': badge.tint,
                          '--lang-shadow': badge.shadow,
                          left: badge.x,
                          top: badge.y,
                        } as CSSProperties
                      }
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
                      transition={{ delay: badge.delay, duration: 0.45 }}
                    >
                      <div className="orbit-logo">
                        <span className="orbit-glyph">{badge.glyph}</span>
                      </div>
                      <span className="orbit-label">{badge.label}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="coder-backboard">
                  <div className="coder-windowbar" />
                  <div className="coder-code-line w1" />
                  <div className="coder-code-line w2" />
                  <div className="coder-code-line w3" />
                </div>
                <div className="coder-body">
                  <div className="coder-head">
                    <span className="coder-brow coder-brow-left" />
                    <span className="coder-brow coder-brow-right" />
                    <span className="coder-eye coder-eye-left" />
                    <span className="coder-eye coder-eye-right" />
                    <span className="coder-eye-highlight coder-eye-highlight-left" />
                    <span className="coder-eye-highlight coder-eye-highlight-right" />
                    <span className="coder-nose" />
                    <span className="coder-mouth" />
                    <span className="coder-ear coder-ear-left" />
                    <span className="coder-ear coder-ear-right" />
                  </div>
                  <div className="coder-torso" />
                  <div className="coder-arm coder-arm-left" />
                  <div className="coder-arm coder-arm-right" />
                  <div className="coder-laptop">
                    <div className="coder-screen" />
                    <div className="coder-base" />
                  </div>
                  <div className="coder-leg coder-leg-left" />
                  <div className="coder-leg coder-leg-right" />
                  <div className="coder-shoe coder-shoe-left" />
                  <div className="coder-shoe coder-shoe-right" />
                </div>
                <div className="coder-desk" />
              </div>
            </motion.div>
          </div>
        </motion.section>

        <section className="landing-features grid md:grid-cols-3 gap-4 mt-7">
          {featureCards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.07 }}
              className="landing-feature-card p-4"
            >
              <card.icon size={18} className="text-[#77b5ff] mb-2" />
              <h3 className="landing-feature-title text-sm font-semibold mb-1">{card.title}</h3>
              <p className="landing-feature-desc text-sm text-[#94a3b8]">{card.desc}</p>
            </motion.article>
          ))}
        </section>

        <section className="landing-sessions mt-7 rounded-xl border border-[#334155] bg-[linear-gradient(150deg,rgba(10,14,22,0.92),rgba(14,22,35,0.92))] overflow-hidden backdrop-blur-xl">
          <header className="landing-sessions-header h-12 px-4 border-b border-[#334155] flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sessions</h2>
            <span className="landing-session-count text-xs text-[#8091a7]">{sessions.length} total</span>
          </header>

          <div className="divide-y divide-[#334155]">
            {sessions.length === 0 && (
              <div className="p-5 text-sm text-[#8091a7]">No sessions yet. Create one to start collaborating.</div>
            )}

            {sessions.map((session) => (
              <motion.div key={session.id} className="landing-session-row p-4 flex items-center gap-3 transition-colors">
                <button onClick={() => navigate(`/editor?room=${session.id}`)} className="text-left flex-1 min-w-0">
                  <p className="landing-session-name truncate text-sm font-semibold text-[#e6edf3]">{session.name}</p>
                  <p className="landing-session-date text-xs text-[#7f8ea3]">{formatDate(session.lastModified)}</p>
                </button>
                <button onClick={() => renameSession(session.id)} className="p-2 rounded-md border border-[#334155] text-[#d0d7e2] hover:bg-[#1b2432]" title="Rename">
                  <Pencil size={14} />
                </button>
                <button onClick={() => shareSession(session.id)} className="p-2 rounded-md border border-[#334155] text-[#d0d7e2] hover:bg-[#1b2432]" title="Copy share link">
                  <Link2 size={14} />
                </button>
                <button onClick={() => removeSession(session.id)} className="p-2 rounded-md border border-[#334155] text-[#d0d7e2] hover:text-[#f85149] hover:bg-[#1b2432]" title="Delete">
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
