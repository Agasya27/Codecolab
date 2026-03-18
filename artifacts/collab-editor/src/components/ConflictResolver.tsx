import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Server } from 'lucide-react';
import { useStore } from '../store';

export function ConflictResolver() {
  const conflicts = useStore((s) => s.conflicts);
  const resolveConflict = useStore((s) => s.resolveConflict);
  const updateFileContent = useStore((s) => s.updateFileContent);

  const conflict = conflicts[0];
  if (!conflict) return null;

  const choose = (resolution: 'local' | 'remote') => {
    const content = resolution === 'local' ? conflict.localContent : conflict.remoteContent;
    updateFileContent(conflict.fileId, content);
    resolveConflict(conflict.id, resolution);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={conflict.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          className="conflict-modal w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22]"
        >
          <div className="h-14 px-5 border-b border-[#30363d] bg-[#0d1117] flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#f85149]" />
            <div>
              <p className="text-sm text-[#e6edf3] font-semibold">Conflict Detected</p>
              <p className="text-xs text-[#7d8590]">Choose local or remote content</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 min-h-[340px]">
            <Pane title="Your Local Changes" icon={<Check size={14} />} color="#3fb950" content={conflict.localContent} onChoose={() => choose('local')} />
            <Pane title="Remote Version" icon={<Server size={14} />} color="#2f81f7" content={conflict.remoteContent} onChoose={() => choose('remote')} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface PaneProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  content: string;
  onChoose: () => void;
}

function Pane({ title, icon, color, content, onChoose }: PaneProps) {
  const lines = content.split('\n');

  return (
    <div className="flex flex-col border-r border-[#30363d] last:border-r-0">
      <div className="h-11 px-4 border-b border-[#30363d] flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-xs uppercase tracking-wider font-semibold">{title}</span>
      </div>
      <div className="flex-1 overflow-auto bg-[#0d1117]">
        <table className="w-full">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="w-10 text-right pr-3 text-[11px] text-[#7d8590] align-top">{index + 1}</td>
                <td className="font-mono text-xs text-[#e6edf3] whitespace-pre pr-3">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#30363d] bg-[#161b22]">
        <button
          onClick={onChoose}
          className="w-full h-9 rounded-md border text-sm font-semibold transition-colors"
          style={{ borderColor: color, color }}
        >
          Keep This Version
        </button>
      </div>
    </div>
  );
}
