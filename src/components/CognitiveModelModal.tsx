import React, { useEffect } from 'react';
import { Brain, X } from 'lucide-react';

interface CognitiveModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CognitiveModelModal: React.FC<CognitiveModelModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cognitive-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 id="cognitive-modal-title" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Adaptive Cognitive Engine
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              01. Intra-Session Spacing &amp; Stability
            </h3>
            <p>
              Each word tracks Mastery (<span className="font-mono">M</span> starting at{' '}
              <span className="font-mono">0.15</span>) and short-term Stability (
              <span className="font-mono">S</span>). Clean, low-hesitation recalls extend stability;
              errors drop mastery and queue a corrective recovery window 2–4 prompts later.
            </p>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              02. Live Sensitivity Vector (<span className="font-mono">k</span>)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  k_pace
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ratio of your recent commit time to your rolling median baseline. Detects focus acceleration or fatigue stalls.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  k_hesitation
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Measures stage-changes and pause duration before committing. Spikes temporarily soften format difficulty to restore flow.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  k_error
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Scales with recent misses so weak pairs get recognition scaffolding before returning to Cloze recall.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  k_recovery
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Elevates priority of recently missed items after a 2–4 prompt gap for immediate corrective reinforcement.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              03. Deliberate Commit Friction
            </h3>
            <p>
              Single-click or number keys stage your choice without firing an accidental miss. Double-click or press{' '}
              <span className="font-mono text-slate-900 dark:text-slate-100">Enter</span> to commit, keeping impulse errors out while feeding genuine indecision into{' '}
              <span className="font-mono">k_hesitation</span>.
            </p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
