import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, CornerDownLeft, HelpCircle, XCircle } from 'lucide-react';
import {
  CommitPayload,
  ConfidenceLevel,
  KeyMapConfig,
  MCQQuestion,
  PromptEvaluation,
} from '@/src/types/vocab';
import { formatKeyLabel, matchesMappedKey } from '@/src/utils/keymapStorage';
import { ConfidenceSlider } from './ConfidenceSlider';

interface MCQPromptProps {
  question: MCQQuestion;
  keymap: KeyMapConfig;
  evaluation: PromptEvaluation | null;
  isModalOpen: boolean;
  onCommit: (payload: CommitPayload) => void;
}

const SLIP_DWELL_THRESHOLD_MS = 320;
const BOUNCE_ROUNDTRIP_MS = 480;

export const MCQPrompt: React.FC<MCQPromptProps> = ({
  question,
  keymap,
  evaluation,
  isModalOpen,
  onCommit,
}) => {
  const [stagedOptionId, setStagedOptionId] = useState<string | null>(null);
  const [isGuessMode, setIsGuessMode] = useState<boolean>(false);
  const [guessSelectedIds, setGuessSelectedIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceLevel>(ConfidenceLevel.HIGH);
  const [stageChanges, setStageChanges] = useState(0);
  const [filteredSlips, setFilteredSlips] = useState(0);

  const startTimeRef = useRef<number>(performance.now());
  const firstActionMsRef = useRef<number | null>(null);
  const stageHistoryRef = useRef<{ optionId: string; ts: number; countedCognitive: boolean }[]>([]);

  useEffect(() => {
    setStagedOptionId(null);
    setIsGuessMode(false);
    setGuessSelectedIds([]);
    setConfidence(ConfidenceLevel.HIGH);
    setStageChanges(0);
    setFilteredSlips(0);
    startTimeRef.current = performance.now();
    firstActionMsRef.current = null;
    stageHistoryRef.current = [];
  }, [question]);

  const optionKeys = [keymap.opt1, keymap.opt2, keymap.opt3, keymap.opt4];

  const handleToggleGuessMode = () => {
    if (evaluation) return;
    setIsGuessMode((prev) => {
      const next = !prev;
      if (next) {
        // Carry over any currently staged option into initial guess selection
        setGuessSelectedIds(stagedOptionId ? [stagedOptionId] : []);
      } else {
        setGuessSelectedIds([]);
      }
      return next;
    });
  };

  const handleStage = (optionId: string) => {
    if (evaluation) return;
    const now = performance.now();
    if (firstActionMsRef.current === null) {
      firstActionMsRef.current = Math.round(now - startTimeRef.current);
    }

    if (isGuessMode) {
      setGuessSelectedIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
      return;
    }

    if (stagedOptionId !== null && stagedOptionId !== optionId) {
      const history = stageHistoryRef.current;
      const lastEntry = history[history.length - 1];
      const prevEntry = history.length >= 2 ? history[history.length - 2] : null;
      const dwellMs = lastEntry ? now - lastEntry.ts : 9999;

      const isBounceBack =
        prevEntry !== null &&
        prevEntry.optionId === optionId &&
        now - prevEntry.ts < BOUNCE_ROUNDTRIP_MS;

      if (isBounceBack) {
        if (lastEntry?.countedCognitive) {
          setStageChanges((prev) => Math.max(0, prev - 1));
        }
        setFilteredSlips((prev) => prev + 1);
        stageHistoryRef.current.push({ optionId, ts: now, countedCognitive: false });
      } else if (dwellMs < SLIP_DWELL_THRESHOLD_MS) {
        setFilteredSlips((prev) => prev + 1);
        stageHistoryRef.current.push({ optionId, ts: now, countedCognitive: false });
      } else {
        setStageChanges((prev) => prev + 1);
        stageHistoryRef.current.push({ optionId, ts: now, countedCognitive: true });
      }
    } else if (stagedOptionId === null) {
      stageHistoryRef.current.push({ optionId, ts: now, countedCognitive: false });
    }

    setStagedOptionId(optionId);
  };

  const handleCommit = (overrideOptionId?: string) => {
    if (evaluation) return;
    const totalMs = Math.max(120, Math.round(performance.now() - startTimeRef.current));
    const firstMs = firstActionMsRef.current ?? totalMs;

    if (isGuessMode) {
      if (guessSelectedIds.length === 0) return;
      const kGuessValue = Number((1 / guessSelectedIds.length).toFixed(4));
      const guessMarks = guessSelectedIds
        .map((optId) => {
          const found = question.options.find((o) => o.id === optId);
          return found ? { itemId: found.itemId, kGuess: kGuessValue } : null;
        })
        .filter((entry): entry is { itemId: string; kGuess: number } => entry !== null);

      onCommit({
        perItemScores: [{ itemId: question.primaryItemId, score: 0 }],
        commitTimeMs: totalMs,
        firstActionLatencyMs: firstMs,
        stageChanges,
        filteredSlips,
        hintsUsed: 0,
        confidence: ConfidenceLevel.LOW,
        isGuessMode: true,
        guessMarks,
        boardItemIds: question.options.map((o) => o.itemId),
      });
      return;
    }

    const chosenId = overrideOptionId ?? stagedOptionId;
    if (!chosenId) return;
    const chosen = question.options.find((opt) => opt.id === chosenId);
    if (!chosen) return;

    onCommit({
      perItemScores: [
        {
          itemId: question.primaryItemId,
          score: chosen.isCorrect ? 1.0 : 0.0,
        },
      ],
      commitTimeMs: totalMs,
      firstActionLatencyMs: firstMs,
      stageChanges,
      filteredSlips,
      hintsUsed: 0,
      confidence,
      chosenDistractorItemId: chosen.isCorrect ? undefined : chosen.itemId,
    });
  };

  useEffect(() => {
    if (evaluation || isModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      for (let i = 0; i < question.options.length; i++) {
        if (matchesMappedKey(e.key, optionKeys[i])) {
          e.preventDefault();
          handleStage(question.options[i].id);
          return;
        }
      }

      const canCommit = isGuessMode ? guessSelectedIds.length > 0 : Boolean(stagedOptionId);
      if (matchesMappedKey(e.key, keymap.commit) && canCommit) {
        e.preventDefault();
        handleCommit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const liveKGuess =
    isGuessMode && guessSelectedIds.length > 0
      ? (1 / guessSelectedIds.length).toFixed(2)
      : null;

  return (
    <div className="space-y-6">
      {/* Prompt Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Multiple Choice · {question.promptSublabel}
            {question.hasConfusableTrap ? ' · Lookalike Trap Active' : ''}
            {question.softened ? ' · Flow Reset' : ''}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={Boolean(evaluation)}
              onClick={handleToggleGuessMode}
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
              Item Mastery {Math.round(question.masteryBefore * 100)}%
            </span>
          </div>
        </div>

        {isGuessMode && !evaluation && (
          <div className="px-3.5 py-2 rounded-lg border border-amber-500/35 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
            Guess Mode active: select one or more suspected choices (each marked k_guess = 1 / N). This prompt will not count toward your session total, and all words here will be prioritized soon.
          </div>
        )}

        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 leading-snug text-balance">
          {question.promptText}
        </h2>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {question.options.map((opt, idx) => {
          const isStaged = isGuessMode
            ? guessSelectedIds.includes(opt.id)
            : stagedOptionId === opt.id;
          const isRevealed = evaluation !== null;

          let cardClasses =
            'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100';
          let statusLabel: string | null = null;

          if (!isRevealed && isStaged) {
            if (isGuessMode) {
              cardClasses =
                'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500/40';
              statusLabel = `k_guess = ${liveKGuess}`;
            } else {
              cardClasses =
                'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/10 text-slate-900 dark:text-slate-100 ring-1 ring-cyan-500/40';
              statusLabel = 'Staged';
            }
          } else if (isRevealed) {
            if (evaluation.isGuessMode) {
              if (opt.isCorrect) {
                cardClasses =
                  'border-emerald-500/70 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
                statusLabel = isStaged ? `Guessed · Answer` : 'Answer';
              } else if (isStaged) {
                cardClasses =
                  'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100';
                statusLabel = 'Marked Guess';
              } else {
                cardClasses =
                  'border-slate-200 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-950/30 text-slate-400 dark:text-slate-500';
              }
            } else if (opt.isCorrect) {
              cardClasses =
                'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
              statusLabel = isStaged ? 'Correct' : 'Correct Answer';
            } else if (isStaged && !opt.isCorrect) {
              cardClasses =
                'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-100';
              statusLabel = opt.isConfusableDistractor ? 'Lookalike Miss' : 'Missed';
            } else {
              cardClasses =
                'border-slate-200 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-950/30 text-slate-400 dark:text-slate-500';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isRevealed}
              onClick={() => handleStage(opt.id)}
              onDoubleClick={() => {
                if (!isRevealed && !isGuessMode) {
                  handleStage(opt.id);
                  handleCommit(opt.id);
                }
              }}
              className={`group relative text-left p-4 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${cardClasses}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`mt-0.5 w-6 h-6 rounded-md font-mono text-xs font-semibold flex items-center justify-center shrink-0 border transition-colors ${
                    !isRevealed && isStaged
                      ? isGuessMode
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-cyan-500 bg-cyan-500 text-slate-950'
                      : isRevealed && opt.isCorrect
                      ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                      : isRevealed && isStaged && !opt.isCorrect
                      ? evaluation?.isGuessMode
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-rose-500 bg-rose-500 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {formatKeyLabel(optionKeys[idx])}
                </span>
                <span className="text-sm sm:text-base font-medium leading-snug break-words">
                  {opt.label}
                </span>
              </div>

              {statusLabel && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap shrink-0 mt-0.5 font-mono ${
                    !isRevealed && isStaged
                      ? isGuessMode
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-cyan-600 dark:text-cyan-400'
                      : opt.isCorrect
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : evaluation?.isGuessMode
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isRevealed && opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isRevealed && isStaged && !opt.isCorrect && !evaluation?.isGuessMode && (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {!isRevealed && isStaged && !isGuessMode && <Check className="w-3.5 h-3.5" />}
                  <span>{statusLabel}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Deliberate Commit Action Footer + Self-Report Confidence Slider */}
      {!evaluation && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isGuessMode
                ? guessSelectedIds.length > 0
                  ? `${guessSelectedIds.length} choice${
                      guessSelectedIds.length === 1 ? '' : 's'
                    } marked (k_guess = ${liveKGuess}) · Press ${formatKeyLabel(
                      keymap.commit
                    )} to submit`
                  : 'Select 1 or more choices to mark your guess'
                : stagedOptionId
                ? `Option staged · Press ${formatKeyLabel(
                    keymap.commit
                  )} or double-click to commit`
                : `Single-click or press ${optionKeys
                    .slice(0, question.options.length)
                    .map(formatKeyLabel)
                    .join(' / ')} to stage`}
            </p>
            <button
              type="button"
              disabled={isGuessMode ? guessSelectedIds.length === 0 : !stagedOptionId}
              onClick={() => handleCommit()}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed ${
                isGuessMode
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950'
              }`}
            >
              <span>{isGuessMode ? 'Submit Guess Mark' : 'Confirm'}</span>
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
