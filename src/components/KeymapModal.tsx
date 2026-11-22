import React, { useEffect, useState } from 'react';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import { KeyMapConfig } from '@/src/types/vocab';
import { DEFAULT_KEYMAP, formatKeyLabel, normalizeEventKey } from '@/src/utils/keymapStorage';

interface KeymapModalProps {
  isOpen: boolean;
  keymap: KeyMapConfig;
  onUpdateKeymap: (next: KeyMapConfig) => void;
  onClose: () => void;
}

interface BindingRow {
  field: keyof KeyMapConfig;
  label: string;
  description: string;
  group: 'selection' | 'columns' | 'flow';
}

const BINDING_ROWS: BindingRow[] = [
  { field: 'opt1', label: 'Option 1 / Left Col 1', description: 'Stage first choice or left column item', group: 'selection' },
  { field: 'opt2', label: 'Option 2 / Left Col 2', description: 'Stage second choice or left column item', group: 'selection' },
  { field: 'opt3', label: 'Option 3 / Left Col 3', description: 'Stage third choice or left column item', group: 'selection' },
  { field: 'opt4', label: 'Option 4 / Left Col 4', description: 'Stage fourth choice or left column item', group: 'selection' },
  { field: 'right1', label: 'Right Column 1', description: 'Pair with right column item 1', group: 'columns' },
  { field: 'right2', label: 'Right Column 2', description: 'Pair with right column item 2', group: 'columns' },
  { field: 'right3', label: 'Right Column 3', description: 'Pair with right column item 3', group: 'columns' },
  { field: 'right4', label: 'Right Column 4', description: 'Pair with right column item 4', group: 'columns' },
  { field: 'commit', label: 'Commit Answer', description: 'Submit staged MCQ, Columns, or Cloze answer', group: 'flow' },
  { field: 'next', label: 'Next Prompt', description: 'Advance after viewing feedback (Space also advances)', group: 'flow' },
  { field: 'hint', label: 'Reveal 1 Letter (Cloze)', description: 'Reveal a blank letter in Cloze mode (slight penalty)', group: 'flow' },
];

export const KeymapModal: React.FC<KeymapModalProps> = ({
  isOpen,
  keymap,
  onUpdateKeymap,
  onClose,
}) => {
  const [listeningField, setListeningField] = useState<keyof KeyMapConfig | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setListeningField(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (listeningField) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          setListeningField(null);
          return;
        }
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
          return;
        }
        const normalized = normalizeEventKey(e.key);
        onUpdateKeymap({
          ...keymap,
          [listeningField]: normalized,
        });
        setListeningField(null);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, listeningField, keymap, onUpdateKeymap, onClose]);

  if (!isOpen) return null;

  const isRightQwer =
    keymap.right1 === 'q' &&
    keymap.right2 === 'w' &&
    keymap.right3 === 'e' &&
    keymap.right4 === 'r';

  const isRightNum =
    keymap.right1 === '5' &&
    keymap.right2 === '6' &&
    keymap.right3 === '7' &&
    keymap.right4 === '8';

  const applyRightPreset = (preset: 'qwer' | '5678') => {
    setListeningField(null);
    if (preset === 'qwer') {
      onUpdateKeymap({ ...keymap, right1: 'q', right2: 'w', right3: 'e', right4: 'r' });
    } else {
      onUpdateKeymap({ ...keymap, right1: '5', right2: '6', right3: '7', right4: '8' });
    }
  };

  // Detect duplicate keys inside selection+columns+hint (commit/next are allowed to share Enter)
  const keyUsage = new Map<string, string[]>();
  BINDING_ROWS.forEach((row) => {
    if (row.field === 'next' || row.field === 'commit') return;
    const val = normalizeEventKey(keymap[row.field]);
    const list = keyUsage.get(val) ?? [];
    list.push(row.label);
    keyUsage.set(val, list);
  });
  const conflicts = Array.from(keyUsage.entries()).filter(([, labels]) => labels.length > 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keymap-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h2 id="keymap-modal-title" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Keyboard Mapping
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard settings"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Columns Right-Hand Preset
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Only your custom keybindings are saved locally in this browser.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => applyRightPreset('qwer')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isRightQwer
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Q W E R
              </button>
              <button
                type="button"
                onClick={() => applyRightPreset('5678')}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isRightNum
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                5 6 7 8
              </button>
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
              Duplicate key detected:{' '}
              {conflicts.map(([k, labels]) => `"${formatKeyLabel(k)}" (${labels.join(' & ')})`).join('; ')}.
              Rebind one to avoid accidental triggers.
            </div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {BINDING_ROWS.map((row) => {
              const isListening = listeningField === row.field;
              const currentKey = keymap[row.field];
              return (
                <div key={row.field} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {row.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {row.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setListeningField(isListening ? null : row.field)}
                    className={`min-w-[96px] px-3.5 py-2 rounded-lg font-mono text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isListening
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-cyan-500/60'
                    }`}
                  >
                    {isListening ? 'Press key...' : formatKeyLabel(currentKey)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={() => {
              setListeningField(null);
              onUpdateKeymap({ ...DEFAULT_KEYMAP });
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
