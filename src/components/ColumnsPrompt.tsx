import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CornerDownLeft,
  HelpCircle,
  Link2,
  Unlink,
  XCircle,
} from 'lucide-react';
import {
  ColumnsQuestion,
  CommitPayload,
  ConfidenceLevel,
  KeyMapConfig,
  PromptEvaluation,
} from '@/src/types/vocab';
import { formatKeyLabel, matchesMappedKey, normalizeEventKey } from '@/src/utils/keymapStorage';
import { ConfidenceSlider } from './ConfidenceSlider';

interface ColumnsPromptProps {
  question: ColumnsQuestion;
  itemMasteries: Record<string, number>;
  keymap: KeyMapConfig;
  evaluation: PromptEvaluation | null;
  isModalOpen: boolean;
  onCommit: (payload: CommitPayload) => void;
}

const PAIR_MARKERS = ['A', 'B', 'C', 'D'];
const PAIR_ACCENTS = [
  'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300',
];

const SLIP_DWELL_THRESHOLD_MS = 320;

export const ColumnsPrompt: React.FC<ColumnsPromptProps> = ({
  question,
  itemMasteries,
  keymap,
  evaluation,
  isModalOpen,
  onCommit,
}) => {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [isGuessMode, setIsGuessMode] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<ConfidenceLevel>(ConfidenceLevel.HIGH);
  const [stagedLeftId, setStagedLeftId] = useState<string | null>(null);
  const [stagedRightId, setStagedRightId] = useState<string | null>(null);
  const [stageChanges, setStageChanges] = useState(0);
  const [filteredSlips, setFilteredSlips] = useState(0);

  const startTimeRef = useRef<number>(performance.now());
  const firstActionMsRef = useRef<number | null>(null);
  const lastActionTimeRef = useRef<number>(0);
  const pairTimestampsRef = useRef<Record<string, number>>({});
  const pairOrderRef = useRef<string[]>([]);

  useEffect(() => {
    setPairs({});
    setIsGuessMode(false);
    setConfidence(ConfidenceLevel.HIGH);
    setStagedLeftId(null);
    setStagedRightId(null);
    setStageChanges(0);
    setFilteredSlips(0);
    startTimeRef.current = performance.now();
    firstActionMsRef.current = null;
    lastActionTimeRef.current = 0;
    pairTimestampsRef.current = {};
    pairOrderRef.current = [];
  }, [question]);

  const leftKeys = [keymap.opt1, keymap.opt2, keymap.opt3, keymap.opt4];
  const rightKeys = [keymap.right1, keymap.right2, keymap.right3, keymap.right4];
  const totalPairs = question.leftItems.length;
  const pairedCount = Object.keys(pairs).length;
  const allPaired = pairedCount === totalPairs;
  const canSubmit = isGuessMode ? pairedCount >= 1 : allPaired;

  const markFirstAction = () => {
    const now = performance.now();
    if (firstActionMsRef.current === null) {
      firstActionMsRef.current = Math.round(now - startTimeRef.current);
    }
    return now;
  };

  const recordSwitchOrSlip = (now: number, referenceTs?: number) => {
    const ref = referenceTs ?? lastActionTimeRef.current;
    const elapsed = ref > 0 ? now - ref : 9999;
    if (elapsed < SLIP_DWELL_THRESHOLD_MS) {
      setFilteredSlips((s) => s + 1);
    } else {
      setStageChanges((c) => c + 1);
    }
  };

  const assignPair = (leftId: string, rightId: string, now: number) => {
    setPairs((prev) => {
      const next = { ...prev };
      let changedExisting = false;
      let prevPairTs = 0;

      if (next[leftId] !== undefined) {
        changedExisting = true;
        prevPairTs = pairTimestampsRef.current[leftId] ?? 0;
      }
      for (const [k, v] of Object.entries(next)) {
        if (v === rightId) {
          if (k !== leftId) {
            changedExisting = true;
            prevPairTs = Math.max(prevPairTs, pairTimestampsRef.current[k] ?? 0);
          }
          delete next[k];
          pairOrderRef.current = pairOrderRef.current.filter((id) => id !== k);
        }
      }
      next[leftId] = rightId;
      pairTimestampsRef.current[leftId] = now;
      pairOrderRef.current = [...pairOrderRef.current.filter((id) => id !== leftId), leftId];

      if (changedExisting) {
        recordSwitchOrSlip(now, prevPairTs);
      }
      return next;
    });
    lastActionTimeRef.current = now;
    setStagedLeftId(null);
    setStagedRightId(null);
  };

  const handleLeftSelect = (leftId: string) => {
    if (evaluation) return;
    const now = markFirstAction();

    if (stagedRightId) {
      assignPair(leftId, stagedRightId, now);
      return;
    }

    if (pairs[leftId] !== undefined && stagedLeftId !== leftId) {
      const prevTs = pairTimestampsRef.current[leftId] ?? lastActionTimeRef.current;
      setPairs((prev) => {
        const next = { ...prev };
        delete next[leftId];
        return next;
      });
      pairOrderRef.current = pairOrderRef.current.filter((id) => id !== leftId);
      recordSwitchOrSlip(now, prevTs);
      lastActionTimeRef.current = now;
      setStagedLeftId(leftId);
      return;
    }

    if (stagedLeftId && stagedLeftId !== leftId) {
      recordSwitchOrSlip(now);
    }
    lastActionTimeRef.current = now;
    setStagedLeftId((prev) => (prev === leftId ? null : leftId));
  };

  const handleRightSelect = (rightId: string) => {
    if (evaluation) return;
    const now = markFirstAction();

    if (stagedLeftId) {
      assignPair(stagedLeftId, rightId, now);
      return;
    }

    const existingLeft = Object.entries(pairs).find(([, r]) => r === rightId)?.[0];
    if (existingLeft && stagedRightId !== rightId) {
      const prevTs = pairTimestampsRef.current[existingLeft] ?? lastActionTimeRef.current;
      setPairs((prev) => {
        const next = { ...prev };
        delete next[existingLeft];
        return next;
      });
      pairOrderRef.current = pairOrderRef.current.filter((id) => id !== existingLeft);
      recordSwitchOrSlip(now, prevTs);
      lastActionTimeRef.current = now;
      setStagedRightId(rightId);
      return;
    }

    if (stagedRightId && stagedRightId !== rightId) {
      recordSwitchOrSlip(now);
    }
    lastActionTimeRef.current = now;
    setStagedRightId((prev) => (prev === rightId ? null : rightId));
  };

  const handleCommit = () => {
    if (evaluation || !canSubmit) return;
    const now = performance.now();
    const totalMs = Math.max(200, Math.round(now - startTimeRef.current));
    const firstMs = firstActionMsRef.current ?? totalMs;

    if (isGuessMode) {
      const pairEntries = Object.entries(pairs);
      const kGuessValue = Number((1 / pairEntries.length).toFixed(4));
      const guessMarks: { itemId: string; kGuess: number }[] = [];

      pairEntries.forEach(([leftId, rightId]) => {
        if (leftId === rightId) {
          guessMarks.push({ itemId: leftId, kGuess: kGuessValue });
        } else {
          guessMarks.push({ itemId: leftId, kGuess: kGuessValue });
          guessMarks.push({ itemId: rightId, kGuess: kGuessValue });
        }
      });

      onCommit({
        perItemScores: question.itemIds.map((id) => ({ itemId: id, score: 0 })),
        commitTimeMs: totalMs,
        firstActionLatencyMs: firstMs,
        stageChanges,
        filteredSlips,
        hintsUsed: 0,
        confidence: ConfidenceLevel.LOW,
        isGuessMode: true,
        guessMarks,
        boardItemIds: question.itemIds,
      });
      return;
    }

    const sequence = pairOrderRef.current;
    const eliminationSuspectIds: string[] = [];

    if (totalPairs >= 3 && sequence.length === totalPairs) {
      const lastItemId = sequence[sequence.length - 1];
      const earlierIds = sequence.slice(0, sequence.length - 1);

      const avgEarlierMastery =
        earlierIds.reduce((sum, id) => sum + (itemMasteries[id] ?? 0.15), 0) /
        Math.max(1, earlierIds.length);
      const lastItemMastery = itemMasteries[lastItemId] ?? 0.15;

      const earlierIntervals: number[] = [];
      for (let i = 0; i < earlierIds.length; i++) {
        const ts = pairTimestampsRef.current[earlierIds[i]] ?? startTimeRef.current;
        const prevTs =
          i === 0
            ? startTimeRef.current
            : pairTimestampsRef.current[earlierIds[i - 1]] ?? startTimeRef.current;
        earlierIntervals.push(Math.max(100, ts - prevTs));
      }
      const avgEarlierInterval =
        earlierIntervals.reduce((a, b) => a + b, 0) / Math.max(1, earlierIntervals.length);
      const lastPairInterval = Math.max(
        100,
        (pairTimestampsRef.current[lastItemId] ?? now) -
          (pairTimestampsRef.current[earlierIds[earlierIds.length - 1]] ?? startTimeRef.current)
      );

      const cherryPickedKnownFirst = avgEarlierMastery - lastItemMastery >= 0.12;
      const switchedToIsolate = stageChanges >= 1;
      const stalledOnFinalResidual = lastPairInterval > avgEarlierInterval * 1.65;

      if (cherryPickedKnownFirst || switchedToIsolate || stalledOnFinalResidual) {
        eliminationSuspectIds.push(lastItemId);
        if (totalPairs === 4 && switchedToIsolate && stageChanges >= 2) {
          const secondLastId = sequence[sequence.length - 2];
          if ((itemMasteries[secondLastId] ?? 0.15) < avgEarlierMastery) {
            eliminationSuspectIds.push(secondLastId);
          }
        }
      }
    }

    const perItemScores = question.leftItems.map((left) => ({
      itemId: left.itemId,
      score: pairs[left.itemId] === left.itemId ? 1.0 : 0.0,
    }));

    onCommit({
      perItemScores,
      commitTimeMs: totalMs,
      firstActionLatencyMs: firstMs,
      stageChanges,
      filteredSlips,
      hintsUsed: 0,
      confidence,
      eliminationSuspectIds,
    });
  };

  useEffect(() => {
    if (evaluation || isModalOpen) return;

    const usedLeftNormalized = new Set(leftKeys.map(normalizeEventKey));
    const fallbackNumKeys = ['5', '6', '7', '8'];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      for (let i = 0; i < question.leftItems.length; i++) {
        if (matchesMappedKey(e.key, leftKeys[i])) {
          e.preventDefault();
          handleLeftSelect(question.leftItems[i].itemId);
          return;
        }
      }

      for (let i = 0; i < question.rightItems.length; i++) {
        const matchesPrimary = matchesMappedKey(e.key, rightKeys[i]);
        const matchesFallback =
          !usedLeftNormalized.has(fallbackNumKeys[i]) &&
          matchesMappedKey(e.key, fallbackNumKeys[i]);

        if (matchesPrimary || matchesFallback) {
          e.preventDefault();
          handleRightSelect(question.rightItems[i].itemId);
          return;
        }
      }

      if (matchesMappedKey(e.key, keymap.commit) && canSubmit) {
        e.preventDefault();
        handleCommit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const leftIndexMap = new Map(question.leftItems.map((item, idx) => [item.itemId, idx]));
  const rightToLeftMap = new Map<string, string>();
  Object.entries(pairs).forEach(([lId, rId]) => rightToLeftMap.set(rId, lId));
  const liveKGuess = isGuessMode && pairedCount > 0 ? (1 / pairedCount).toFixed(2) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Matching Pairs · {totalPairs} pairs
            {question.softened ? ' · Flow Reset' : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={Boolean(evaluation)}
              onClick={() => setIsGuessMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default whitespace-nowrap ${
                isGuessMode
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-300'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>
                {isGuessMode ? 'Guess Mode: ON (Uncounted)' : 'Toggle Guess mode'}
              </span>
            </button>
            <span className="font-mono tabular-nums">
              {pairedCount}/{totalPairs} paired
            </span>
          </div>
        </div>

        {isGuessMode && !evaluation && (
          <div className="px-3.5 py-2 rounded-lg border border-amber-500/35 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
            Guess Mode active: link 1 or more suspected pairs (each marked k_guess = 1 / pairs). Prompt count stays unchanged and all words on this board will resurface soon.
          </div>
        )}

        <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Pair each item on the left with its match on the right
        </h2>
      </div>

      {/* Two-Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Column */}
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
            Left ({leftKeys.slice(0, totalPairs).map(formatKeyLabel).join(' / ')})
          </div>
          {question.leftItems.map((item, idx) => {
            const isStaged = stagedLeftId === item.itemId;
            const pairedRightId = pairs[item.itemId];
            const isPaired = pairedRightId !== undefined;
            const isRevealed = evaluation !== null;
            const isCorrectPair = isRevealed && pairedRightId === item.itemId;

            let rowClass =
              'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100';

            if (!isRevealed) {
              if (isStaged) {
                rowClass = isGuessMode
                  ? 'border-amber-500 bg-amber-500/12 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500/40'
                  : 'border-cyan-500 bg-cyan-500/12 text-slate-900 dark:text-slate-100 ring-1 ring-cyan-500/40';
              } else if (isPaired) {
                rowClass = isGuessMode
                  ? 'border-amber-500/80 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : PAIR_ACCENTS[idx % PAIR_ACCENTS.length];
              }
            } else if (evaluation.isGuessMode) {
              rowClass = isPaired
                ? isCorrectPair
                  ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                  : 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                : 'border-slate-200 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-950/30 text-slate-400 dark:text-slate-500';
            } else {
              rowClass = isCorrectPair
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                : 'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-100';
            }

            return (
              <button
                key={item.itemId}
                type="button"
                disabled={isRevealed}
                onClick={() => handleLeftSelect(item.itemId)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${rowClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    {formatKeyLabel(leftKeys[idx])}
                  </span>
                  <span className="text-sm font-medium leading-snug break-words">
                    {item.text}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isRevealed && isStaged && (
                    <span
                      className={`text-xs font-medium ${
                        isGuessMode
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-cyan-600 dark:text-cyan-400'
                      }`}
                    >
                      Staged
                    </span>
                  )}
                  {!isRevealed && isPaired && !isStaged && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        Pair {PAIR_MARKERS[idx]}
                        {isGuessMode && liveKGuess ? ` (${liveKGuess})` : ''}
                      </span>
                    </span>
                  )}
                  {isRevealed && !evaluation.isGuessMode && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        isCorrectPair
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isCorrectPair ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Matched</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Mismatch</span>
                        </>
                      )}
                    </span>
                  )}
                  {isRevealed && evaluation.isGuessMode && isPaired && (
                    <span className="font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
                      Pair {PAIR_MARKERS[idx]}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
            Right ({rightKeys.slice(0, totalPairs).map(formatKeyLabel).join(' / ')})
          </div>
          {question.rightItems.map((item, idx) => {
            const isStaged = stagedRightId === item.itemId;
            const pairedLeftId = rightToLeftMap.get(item.itemId);
            const pairedLeftIdx =
              pairedLeftId !== undefined ? leftIndexMap.get(pairedLeftId) : undefined;
            const isPaired = pairedLeftIdx !== undefined;
            const isRevealed = evaluation !== null;
            const isCorrectPair = isRevealed && pairedLeftId === item.itemId;

            let rowClass =
              'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100';

            if (!isRevealed) {
              if (isStaged) {
                rowClass = isGuessMode
                  ? 'border-amber-500 bg-amber-500/12 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500/40'
                  : 'border-cyan-500 bg-cyan-500/12 text-slate-900 dark:text-slate-100 ring-1 ring-cyan-500/40';
              } else if (isPaired) {
                rowClass = isGuessMode
                  ? 'border-amber-500/80 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : PAIR_ACCENTS[pairedLeftIdx % PAIR_ACCENTS.length];
              }
            } else if (evaluation.isGuessMode) {
              rowClass = isPaired
                ? isCorrectPair
                  ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                  : 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                : 'border-slate-200 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-950/30 text-slate-400 dark:text-slate-500';
            } else {
              rowClass = isCorrectPair
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                : 'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-100';
            }

            const trueLeftIdx = leftIndexMap.get(item.itemId);

            return (
              <button
                key={item.itemId}
                type="button"
                disabled={isRevealed}
                onClick={() => handleRightSelect(item.itemId)}
                onDoubleClick={() => {
                  if (!isRevealed && canSubmit) handleCommit();
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${rowClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    {formatKeyLabel(rightKeys[idx])}
                  </span>
                  <span className="text-sm leading-snug break-words">{item.text}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isRevealed && isStaged && (
                    <span
                      className={`text-xs font-medium ${
                        isGuessMode
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-cyan-600 dark:text-cyan-400'
                      }`}
                    >
                      Staged
                    </span>
                  )}
                  {!isRevealed && isPaired && !isStaged && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold">
                      <span>Pair {PAIR_MARKERS[pairedLeftIdx]}</span>
                      <Unlink className="w-3 h-3 opacity-60" />
                    </span>
                  )}
                  {isRevealed && !isCorrectPair && trueLeftIdx !== undefined && (
                    <span
                      className={`font-mono text-xs ${
                        evaluation.isGuessMode
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      Matches #{formatKeyLabel(leftKeys[trueLeftIdx])}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Commit Footer + Self-Report Confidence Slider */}
      {!evaluation && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isGuessMode
                ? pairedCount > 0
                  ? `${pairedCount} pair${pairedCount === 1 ? '' : 's'} marked (k_guess = ${liveKGuess}) · Press ${formatKeyLabel(
                      keymap.commit
                    )} to submit`
                  : 'Pair 1 or more suspected matches to log a guess mark'
                : allPaired
                ? `All ${totalPairs} pairs linked · Click any item to unpair, or press ${formatKeyLabel(
                    keymap.commit
                  )} to commit`
                : 'Select one left item and one right item to pair. Unpair anytime before committing.'}
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleCommit}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed ${
                isGuessMode
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950'
              }`}
            >
              <span>{isGuessMode ? 'Submit Guess Mark' : 'Confirm Board'}</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span className="font-mono text-xs opacity-80">
                {formatKeyLabel(keymap.commit)}
              </span>
            </button>
          </div>

          {!isGuessMode && (
            <ConfidenceSlider value={confidence} onChange={setConfidence} />
          )}
        </div>
      )}
    </div>
  );
};
