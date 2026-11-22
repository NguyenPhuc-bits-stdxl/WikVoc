import React from 'react';
import { ConfidenceLevel } from '@/src/types/vocab';

interface ConfidenceSliderProps {
  value: ConfidenceLevel;
  disabled?: boolean;
  onChange: (next: ConfidenceLevel) => void;
}

const LEVELS: { level: ConfidenceLevel; num: number; label: string; short: string }[] = [
  { level: ConfidenceLevel.LOW, num: 0, label: 'Low (Guessed)', short: 'Low · Guessed' },
  { level: ConfidenceLevel.MEDIUM, num: 1, label: 'Medium', short: 'Medium' },
  { level: ConfidenceLevel.HIGH, num: 2, label: 'High', short: 'High · Confident' },
];

export const ConfidenceSlider: React.FC<ConfidenceSliderProps> = ({
  value,
  disabled = false,
  onChange,
}) => {
  const current = LEVELS.find((l) => l.level === value) ?? LEVELS[2];

  const accentText =
    value === ConfidenceLevel.LOW
      ? 'text-amber-600 dark:text-amber-400'
      : value === ConfidenceLevel.MEDIUM
      ? 'text-cyan-600 dark:text-cyan-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="pt-3 mt-1 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs">
        <label
          htmlFor="self-report-confidence-range"
          className="font-medium text-slate-600 dark:text-slate-300"
        >
          Self-Report Confidence:
        </label>
        <span className={`font-mono font-semibold ${accentText}`}>{current.short}</span>
      </div>

      <div className="flex items-center gap-3 sm:w-72">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(ConfidenceLevel.LOW)}
          className={`text-[11px] font-medium whitespace-nowrap cursor-pointer disabled:cursor-default transition-colors ${
            value === ConfidenceLevel.LOW
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Low (Guessed)
        </button>

        <input
          id="self-report-confidence-range"
          type="range"
          min={0}
          max={2}
          step={1}
          disabled={disabled}
          value={current.num}
          onChange={(e) => {
            const idx = Number(e.target.value);
            const matched = LEVELS.find((l) => l.num === idx);
            if (matched) onChange(matched.level);
          }}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer disabled:cursor-default bg-slate-200 dark:bg-slate-800 accent-cyan-600 dark:accent-cyan-400"
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(ConfidenceLevel.MEDIUM)}
          className={`text-[11px] font-medium whitespace-nowrap cursor-pointer disabled:cursor-default transition-colors ${
            value === ConfidenceLevel.MEDIUM
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Med
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(ConfidenceLevel.HIGH)}
          className={`text-[11px] font-medium whitespace-nowrap cursor-pointer disabled:cursor-default transition-colors ${
            value === ConfidenceLevel.HIGH
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          High
        </button>
      </div>
    </div>
  );
};
