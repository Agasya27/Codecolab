import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw, Clock3 } from 'lucide-react';
import { useStore, Snapshot } from '../store';
import { formatDate } from '../utils/formatDate';

interface VersionTimelineProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VersionTimeline({ isOpen, onClose }: VersionTimelineProps) {
  const activeFileId = useStore((s) => s.activeFileId);
  const snapshots = useStore((s) => s.snapshots);
  const updateFileContent = useStore((s) => s.updateFileContent);

  const fileSnapshots = snapshots
    .filter((snap) => snap.fileId === activeFileId)
    .sort((a, b) => b.timestamp - a.timestamp);

  const restore = (snapshot: Snapshot) => {
    updateFileContent(snapshot.fileId, snapshot.content, snapshot.revision);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: 'spring', damping: 26, stiffness: 290 }}
            className="timeline-panel fixed right-0 top-0 h-full w-[360px] bg-[#161b22] border-l border-[#30363d] z-50 flex flex-col"
          >
            <div className="h-14 px-4 border-b border-[#30363d] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#e6edf3]">Version History</h3>
                <button
                  onClick={onClose}
                  className="timeline-close p-1.5 rounded text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-2 text-xs text-[#7d8590] border-b border-[#30363d]">
              Snapshots every 10 seconds
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {fileSnapshots.length === 0 && (
                <div className="h-full flex items-center justify-center text-sm text-[#7d8590]">
                  No snapshots yet
                </div>
              )}

              {fileSnapshots.map((snapshot) => (
                <button
                  key={`${snapshot.fileId}-${snapshot.timestamp}`}
                  onClick={() => restore(snapshot)}
                  className="timeline-item w-full text-left p-3 rounded-lg border border-[#30363d] bg-[#0d1117] hover:bg-[#21262d] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock3 size={14} className="text-[#2f81f7]" />
                      <span className="text-xs text-[#c9d1d9] truncate">{formatDate(snapshot.timestamp)}</span>
                    </div>
                    <RotateCcw size={14} className="text-[#7d8590]" />
                  </div>
                  <div className="mt-1 text-[11px] text-[#7d8590]">
                    {snapshot.content.split('\n').length} lines • Rev {snapshot.revision}
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
