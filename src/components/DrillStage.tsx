import React, { useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  ActiveQuestion,
  AdaptiveEngineState,
  AdaptiveRegime,
  CommitPayload,
  ConfidenceLevel,
  DifficultyMode,
  KeyMapConfig,
  PromptEvaluation,
  QuestionFormat,
  SessionConfig,
  SessionMode,
} from '@/src/types/vocab';
import { formatKeyLabel, matchesMappedKey } from '@/src/utils/keymapStorage';
import { MCQPrompt } from './MCQPrompt';
import { ColumnsPrompt } from './ColumnsPrompt';
import { ClozePrompt } from './ClozePrompt';

interface DrillStageProps {
  engineState: AdaptiveEngineState;
  currentQuestion: ActiveQuestion;
  evaluation: PromptEvaluation | null;
  sessionConfig: SessionConfig;
  elapsedMs: number;
  timeExpired: boolean;
  isFinalPrompt: boolean;
  keymap: KeyMapConfig;
  isModalOpen: boolean;
  onCommitAnswer: (payload: CommitPayload) => void;
  onNextPrompt: () => void;
}

function formatDurationMinutesSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDifficultyLabel(diff: DifficultyMode): string {
  if (diff === DifficultyMode.LAZY) return 'Lazy (MCQ)';
  if (diff === DifficultyMode.EXTREME) return 'Extreme';
  return 'Adaptive';
}

export const DrillStage: React.FC<DrillStageProps> = ({
  engineState,
  currentQuestion,
  evaluation,
  sessionConfig,
  elapsedMs,
  timeExpired,
  isFinalPrompt,
  keymap,
  isModalOpen,
  onCommitAnswer,
  onNextPrompt,
}) => {
  const nextReadyTimestampRef = useRef<number>(0);

  const itemMasteries = useMemo(() => {
    const map: Record<string, number> = {};
    engineState.items.forEach((it) => {
      map[it.id] = it.mastery;
    });
    return map;
  }, [engineState.items]);

  useEffect(() => {
    if (evaluation) {
      nextReadyTimestampRef.current = performance.now();
    }
  }, [evaluation]);

  useEffect(() => {
    if (!evaluation || isModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (performance.now() - nextReadyTimestampRef.current < 120) return;

      if (matchesMappedKey(e.key, keymap.next) || e.key === ' ') {
        e.preventDefault();
        onNextPrompt();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaluation, isModalOpen, keymap.next, onNextPrompt]);

  const progressRatio =
    sessionConfig.mode === SessionMode.COUNT
      ? Math.min(1, engineState.countedPrompts / Math.max(1, sessionConfig.targetCount))
      : Math.min(1, elapsedMs / Math.max(1000, sessionConfig.targetMinutes * 60 * 1000));

  const regimeColor =
    engineState.regime === AdaptiveRegime.FLOW_STATE
      ? 'text-cyan-600 dark:text-cyan-400'
      : engineState.regime === AdaptiveRegime.RAMPING_DIFFICULTY
      ? 'text-emerald-600 dark:text-emerald-400'
      : engineState.regime === AdaptiveRegime.REINFORCING_WEAK
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-sky-600 dark:text-sky-400';

  const avgDeckMastery =
    engineState.items.reduce((sum, it) => sum + it.mastery, 0) /
    Math.max(1, engineState.items.length);

  const isPositiveFeedback =
    evaluation &&
    !evaluation.isGuessMode &&
    evaluation.score >= 0.99 &&
    !evaluation.impulsiveDetected &&
    !evaluation.eliminationDetected &&
    evaluation.confidence !== ConfidenceLevel.LOW;

  const isAmberFeedback =
    evaluation &&
    (evaluation.isGuessMode ||
      (evaluation.score >= 0.5 && evaluation.score < 0.99) ||
      evaluation.impulsiveDetected ||
      evaluation.eliminationDetected ||
      evaluation.confidence === ConfidenceLevel.LOW);

  const displayedPromptNumber =
    evaluation && !evaluation.isGuessMode
      ? engineState.countedPrompts
      : Math.min(engineState.countedPrompts + 1, sessionConfig.targetCount);

  return (
    <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      {/* Calm Progress & Subtle Live Micro-Telemetry Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 tabular-nums">
            {sessionConfig.mode === SessionMode.COUNT ? (
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Prompt {displayedPromptNumber} of {sessionConfig.targetCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                <Clock className="w-3.5 h-3.5 wv-text-accent" />
                <span>
                  {formatDurationMinutesSeconds(elapsedMs)} / {sessionConfig.targetMinutes}:00
                </span>
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{formatDifficultyLabel(sessionConfig.difficulty)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Deck Mastery {Math.round(avgDeckMastery * 100)}%</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tabular-nums">
            <span
              className={`inline-flex items-center gap-1 font-sans text-xs font-medium ${regimeColor}`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{engineState.regime}</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              |
            </span>
            <span>k_pace {engineState.k.kPace.toFixed(2)}</span>
            <span>k_hes {engineState.k.kHesitation.toFixed(2)}</span>
            <span>k_err {engineState.k.kError.toFixed(2)}</span>
            <span>k_rec {engineState.k.kRecovery.toFixed(2)}</span>
          </div>
        </div>

        {/* Calm, low-pressure progress bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full wv-progress-fill transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progressRatio * 100)}%` }}
          />
        </div>

        {timeExpired && (
          <div className="px-3.5 py-2 rounded-lg border wv-border-accent wv-bg-accent-soft text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2">
            <span>Target time reached — finish this prompt cleanly at your own pace.</span>
            <span className="font-mono wv-text-accent">Final prompt</span>
          </div>
        )}
      </div>

      {/* Main Prompt Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
        {currentQuestion.format === QuestionFormat.MCQ && (
          <MCQPrompt
            question={currentQuestion}
            keymap={keymap}
            evaluation={evaluation}
            isModalOpen={isModalOpen}
            onCommit={onCommitAnswer}
          />
        )}

        {currentQuestion.format === QuestionFormat.COLUMNS && (
          <ColumnsPrompt
            question={currentQuestion}
            itemMasteries={itemMasteries}
            keymap={keymap}
            evaluation={evaluation}
            isModalOpen={isModalOpen}
            onCommit={onCommitAnswer}
          />
        )}

        {currentQuestion.format === QuestionFormat.CLOZE && (
          <ClozePrompt
            question={currentQuestion}
            keymap={keymap}
            evaluation={evaluation}
            isModalOpen={isModalOpen}
            onCommit={onCommitAnswer}
          />
        )}
      </section>

      {/* Immediate Post-Commit Feedback & Next Bar */}
      {evaluation && (
        <section
          className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            isPositiveFeedback
              ? 'border-emerald-500/40 bg-emerald-500/8'
              : isAmberFeedback
              ? 'border-amber-500/40 bg-amber-500/8'
              : 'border-rose-500/40 bg-rose-500/8'
          }`}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {evaluation.isGuessMode ? (
                <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : isPositiveFeedback ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isAmberFeedback ? (
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span
                className={`font-display text-sm font-semibold ${
                  isPositiveFeedback
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isAmberFeedback
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {evaluation.feedbackHeadline}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {evaluation.feedbackDetail}
              </span>
            </div>

            {evaluation.isGuessMode ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-amber-700 dark:text-amber-300 tabular-nums">
                <span>
                  k_guess:{' '}
                  {evaluation.guessMarks
                    .map((g) => `${g.term} (${g.kGuess.toFixed(2)})`)
                    .join(', ')}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                <span>{(evaluation.commitTimeMs / 1000).toFixed(2)}s commit</span>
                <span aria-hidden="true">·</span>
                <span>
                  {evaluation.stageChanges}{' '}
                  {evaluation.stageChanges === 1 ? 'switch' : 'switches'}
                  {evaluation.filteredSlips > 0
                    ? ` (${evaluation.filteredSlips} slip${
                        evaluation.filteredSlips === 1 ? '' : 's'
                      } filtered)`
                    : ''}
                </span>
                {evaluation.confidence !== ConfidenceLevel.HIGH && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Confidence:{' '}
                      {evaluation.confidence === ConfidenceLevel.LOW ? 'Low (Guessed)' : 'Medium'}
                    </span>
                  </>
                )}
                {evaluation.outcomes.length === 1 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {evaluation.outcomes[0].term}:{' '}
                      {Math.round(evaluation.outcomes[0].masteryBefore * 100)}% →{' '}
                      {Math.round(evaluation.outcomes[0].masteryAfter * 100)}%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onNextPrompt}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span>{isFinalPrompt ? 'View Summary' : 'Next Prompt'}</span>
            <ArrowRight className="w-4 h-4" />
            <span className="font-mono text-xs opacity-75">
              {formatKeyLabel(keymap.next)} / Space
            </span>
          </button>
        </section>
      )}
    </main>
  );
};
