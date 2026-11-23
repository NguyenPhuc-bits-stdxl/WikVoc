import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
} from 'lucide-react';
import {
  DrillDirection,
  FlashcardCardStatus,
  FlashcardRating,
  FlashcardState,
  VocabPair,
} from '@/src/types/vocab';
import {
  applyFlashcardReview,
  buildDueFlashcardQueue,
  previewNextIntervals,
  summarizeFlashcardDeck,
} from '@/src/engine/flashcardEngine';

interface FlashcardStageProps {
  deckTitle: string;
  cards: FlashcardState[];
  isModalOpen: boolean;
  onUpdateCards: (nextCards: FlashcardState[]) => void;
  onResetProgress: () => void;
  onDrillLapsedWords: (pairs: VocabPair[]) => void;
  onBackToSetup: () => void;
}

export const FlashcardStage: React.FC<FlashcardStageProps> = ({
  deckTitle,
  cards,
  isModalOpen,
  onUpdateCards,
  onResetProgress,
  onDrillLapsedWords,
  onBackToSetup,
}) => {
  const [direction, setDirection] = useState<
    DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF
  >(DrillDirection.TERM_TO_DEF);

  const [queue, setQueue] = useState<string[]>(() => buildDueFlashcardQueue(cards));
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedInSession, setReviewedInSession] = useState(0);
  const [lapsedIds, setLapsedIds] = useState<string[]>([]);

  // Reset queue only when card set identity changes completely
  const deckSignature = useMemo(() => cards.map((c) => c.id).join('|'), [cards]);
  useEffect(() => {
    setQueue(buildDueFlashcardQueue(cards));
    setIsFlipped(false);
    setReviewedInSession(0);
    setLapsedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckSignature]);

  const cardById = useMemo(
    () => new Map(cards.map((c) => [c.id, c])),
    [cards]
  );

  const activeCardId = queue[0] ?? null;
  const activeCard = activeCardId ? cardById.get(activeCardId) ?? null : null;

  const stats = useMemo(() => summarizeFlashcardDeck(cards), [cards]);

  const intervalPreviews = useMemo(
    () => (activeCard ? previewNextIntervals(activeCard) : null),
    [activeCard]
  );

  const handleRate = (rating: FlashcardRating) => {
    if (!activeCard) return;

    const { updatedCard, requeueInSession } = applyFlashcardReview(
      activeCard,
      rating
    );

    const nextCards = cards.map((c) => (c.id === updatedCard.id ? updatedCard : c));
    onUpdateCards(nextCards);

    if (rating === FlashcardRating.AGAIN) {
      setLapsedIds((prev) =>
        prev.includes(activeCard.id) ? prev : [...prev, activeCard.id]
      );
    }

    const restQueue = queue.slice(1);
    if (requeueInSession) {
      const insertAt = Math.min(
        restQueue.length,
        rating === FlashcardRating.AGAIN ? 2 : 4
      );
      restQueue.splice(insertAt, 0, activeCard.id);
    }

    setQueue(restQueue);
    setIsFlipped(false);
    setReviewedInSession((prev) => prev + 1);
  };

  // Keyboard shortcuts: Space/Enter flips; 1-4 rate after flip
  useEffect(() => {
    if (isModalOpen || !activeCard) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setIsFlipped(true);
        }
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        handleRate(FlashcardRating.AGAIN);
      } else if (e.key === '2') {
        e.preventDefault();
        handleRate(FlashcardRating.HARD);
      } else if (e.key === '3' || e.key === ' ') {
        e.preventDefault();
        handleRate(FlashcardRating.GOOD);
      } else if (e.key === '4') {
        e.preventDefault();
        handleRate(FlashcardRating.EASY);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, activeCard, isFlipped, queue, cards]);

  const lapsedPairs: VocabPair[] = useMemo(() => {
    const set = new Set(lapsedIds);
    const chosen = cards.filter(
      (c) => set.has(c.id) || c.lapses > 0 || c.status === FlashcardCardStatus.RELEARNING
    );
    return chosen.map((c) => ({ id: c.id, term: c.term, def: c.def }));
  }, [cards, lapsedIds]);

  const handleReviewAhead = () => {
    setQueue(buildDueFlashcardQueue(cards, Date.now(), true));
    setIsFlipped(false);
  };

  return (
    <main className="max-w-[840px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Header & Spaced Repetition Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Layers className="w-3.5 h-3.5 wv-text-accent" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Spaced Repetition Flashcards
            </span>
            <span aria-hidden="true">·</span>
            <span>{deckTitle}</span>
          </div>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {queue.length} in queue · {stats.newCount} new · {stats.learningCount} learning · {stats.masteredCount}/{stats.total} mature · {reviewedInSession} reviewed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDirection((prev) =>
                prev === DrillDirection.TERM_TO_DEF
                  ? DrillDirection.DEF_TO_TERM
                  : DrillDirection.TERM_TO_DEF
              );
              setIsFlipped(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>
              {direction === DrillDirection.TERM_TO_DEF ? 'Term → Def' : 'Def → Term'}
            </span>
          </button>

          <button
            type="button"
            onClick={onResetProgress}
            title="Reset SRS intervals for this deck"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset SRS</span>
          </button>
        </div>
      </div>

      {activeCard && intervalPreviews ? (
        <div className="space-y-5">
          {/* Interactive Study Card */}
          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-10 min-h-[280px] flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400">
              <span>
                {activeCard.status === FlashcardCardStatus.NEW
                  ? 'NEW CARD'
                  : activeCard.status === FlashcardCardStatus.LEARNING
                  ? 'LEARNING'
                  : activeCard.status === FlashcardCardStatus.RELEARNING
                  ? 'RELEARNING'
                  : `REVIEW · EF ${activeCard.easeFactor.toFixed(2)}`}
              </span>
              <span>
                {isFlipped ? 'Click to hide answer' : 'Space / Click to reveal'}
              </span>
            </div>

            <div className="my-6 space-y-5 text-center">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                  {direction === DrillDirection.TERM_TO_DEF ? 'Term' : 'Definition'}
                </p>
                <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 text-balance leading-snug">
                  {direction === DrillDirection.TERM_TO_DEF
                    ? activeCard.term
                    : activeCard.def}
                </p>
              </div>

              {isFlipped && (
                <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <p className="text-xs uppercase tracking-wider wv-text-accent font-mono">
                    {direction === DrillDirection.TERM_TO_DEF ? 'Definition' : 'Term'}
                  </p>
                  <p className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-200 text-balance leading-relaxed">
                    {direction === DrillDirection.TERM_TO_DEF
                      ? activeCard.def
                      : activeCard.term}
                  </p>
                </div>
              )}
            </div>

            <div className="text-center text-xs text-slate-400 font-mono tabular-nums">
              {activeCard.reps > 0
                ? `${activeCard.reps} successful reps · ${activeCard.lapses} lapses`
                : 'First exposure'}
            </div>
          </button>

          {/* Rating Controls */}
          {!isFlipped ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="px-8 py-3 rounded-xl font-display text-sm font-semibold wv-btn-primary transition-colors cursor-pointer"
              >
                Reveal Answer (Space)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleRate(FlashcardRating.AGAIN)}
                className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-rose-700 dark:text-rose-300">
                    Again
                  </span>
                  <span className="font-mono text-xs text-rose-600/80 dark:text-rose-400">
                    [1]
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-rose-600 dark:text-rose-300">
                  {intervalPreviews[FlashcardRating.AGAIN]} (re-queue)
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleRate(FlashcardRating.HARD)}
                className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Hard
                  </span>
                  <span className="font-mono text-xs text-amber-600/80 dark:text-amber-400">
                    [2]
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-amber-700 dark:text-amber-300">
                  {intervalPreviews[FlashcardRating.HARD]}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleRate(FlashcardRating.GOOD)}
                className="p-3.5 rounded-xl border wv-border-accent wv-bg-accent-soft hover:opacity-90 text-left transition-opacity cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold wv-text-accent">
                    Good
                  </span>
                  <span className="font-mono text-xs wv-text-accent opacity-80">
                    [3]
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {intervalPreviews[FlashcardRating.GOOD]}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleRate(FlashcardRating.EASY)}
                className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Easy
                  </span>
                  <span className="font-mono text-xs text-emerald-600/80 dark:text-emerald-400">
                    [4]
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                  {intervalPreviews[FlashcardRating.EASY]}
                </p>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Session Queue Cleared */
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-6">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              All due cards cleared
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your spaced-repetition intervals are saved locally. Come back when cards become due, or review ahead now.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleReviewAhead}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold wv-btn-primary transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Review Ahead ({cards.length} cards)</span>
            </button>

            {lapsedPairs.length >= 2 && (
              <button
                type="button"
                onClick={() => onDrillLapsedWords(lapsedPairs)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border wv-border-accent wv-bg-accent-soft text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <Flame className="w-4 h-4 wv-text-accent" />
                <span>Drill Lapsed Words ({lapsedPairs.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onBackToSetup}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Setup</span>
            </button>
          </div>
        </section>
      )}
    </main>
  );
};
