import React from 'react';
import { Flame, FolderPlus, RotateCcw, Sparkles, Target } from 'lucide-react';
import {
  QuestionFormat,
  SessionSummaryData,
  SuggestedDrillPlan,
  VocabPair,
} from '@/src/types/vocab';

interface SummaryViewProps {
  summary: SessionSummaryData;
  onDrillWeakWords: (weakPairs: VocabPair[]) => void;
  onRestartBySuggestion: (plan: SuggestedDrillPlan) => void;
  onRestartFullDeck: () => void;
  onLoadNewDeck: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  onDrillWeakWords,
  onRestartBySuggestion,
  onRestartFullDeck,
  onLoadNewDeck,
}) => {
  const accuracyPct = Math.round(summary.overallAccuracy * 100);
  const avgSec = (summary.avgCommitTimeMs / 1000).toFixed(2);

  const exposedItems = summary.weakestItems.filter(
    (it) => it.exposures > 0 || it.guessMarksCount > 0
  );
  const flaggedWeak = exposedItems.filter(
    (it) => it.errorCount > 0 || it.guessMarksCount > 0 || it.mastery < 0.55
  );
  const revengePool =
    flaggedWeak.length >= 2
      ? flaggedWeak
      : (exposedItems.length >= 2 ? exposedItems : summary.weakestItems).slice(
          0,
          Math.min(5, summary.weakestItems.length)
        );

  const revengePairs: VocabPair[] = revengePool.map((it) => ({
    id: it.id,
    term: it.term,
    def: it.def,
  }));

  return (
    <main className="max-w-[1040px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header & Action Buttons */}
      <div className="space-y-5">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
            Session Complete · {summary.formatBreakdown[QuestionFormat.MCQ]} MCQ ·{' '}
            {summary.formatBreakdown[QuestionFormat.COLUMNS]} Columns ·{' '}
            {summary.formatBreakdown[QuestionFormat.CLOZE]} Cloze
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            {accuracyPct >= 85
              ? 'Strong recall momentum locked in'
              : accuracyPct >= 65
              ? 'Solid run — target the remaining weak traces'
              : 'High-value calibration complete — run it back'}
          </h1>
        </div>

        {/* 4 Zero-Friction Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={summary.suggestedPlan.pairs.length < 2}
            onClick={() => onRestartBySuggestion(summary.suggestedPlan)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Restart Drill by Suggestion</span>
          </button>

          <button
            type="button"
            disabled={revengePairs.length < 2}
            onClick={() => onDrillWeakWords(revengePairs)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-cyan-600/40 dark:border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/15 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <Flame className="w-4 h-4" />
            <span>Drill Weak Words Only ({revengePairs.length})</span>
          </button>

          <button
            type="button"
            onClick={onRestartFullDeck}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Full Deck</span>
          </button>

          <button
            type="button"
            onClick={onLoadNewDeck}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Load New Deck</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          Suggested Drill: {summary.suggestedPlan.rationale}
        </p>
      </div>

      {/* 4-Column KPI Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Overall Accuracy</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {accuracyPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Weighted across counted prompts
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Prompts Completed</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {summary.promptsCompleted}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {Math.round(summary.durationMs / 1000)}s active session
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Commit Time</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {avgSec}s
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            k_pace {summary.finalK.kPace.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Hesitation Index</p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {summary.hesitationIndex.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            k_hes {summary.finalK.kHesitation.toFixed(2)}
          </p>
        </div>
      </section>

      {/* Most Missed / Weakest Words Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Weakest Words &amp; Final Mastery
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sorted by lowest final mastery M
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 pl-6 pr-3 font-medium">Term</th>
                <th className="py-3 px-3 font-medium">Definition</th>
                <th className="py-3 px-3 font-medium text-right">Attempts</th>
                <th className="py-3 px-3 font-medium text-right">Misses</th>
                <th className="py-3 px-3 font-medium text-right">Guesses</th>
                <th className="py-3 pl-3 pr-6 font-medium text-right">Mastery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {summary.weakestItems.map((item) => {
                const masteryPct = Math.round(item.mastery * 100);
                const masteryColor =
                  item.mastery >= 0.7
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : item.mastery >= 0.4
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pl-6 pr-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.term}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-md">
                      {item.def}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {item.exposures}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {item.errorCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                      {item.guessMarksCount}
                    </td>
                    <td
                      className={`py-3 pl-3 pr-6 text-right font-mono text-xs font-semibold tabular-nums ${masteryColor}`}
                    >
                      {masteryPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
