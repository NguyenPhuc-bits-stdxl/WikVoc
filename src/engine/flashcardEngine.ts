import {
  FlashcardCardStatus,
  FlashcardRating,
  FlashcardState,
  VocabPair,
} from '@/src/types/vocab';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function initFlashcardDeck(
  pairs: VocabPair[],
  savedCards: FlashcardState[] | null,
  nowMs: number = Date.now()
): FlashcardState[] {
  const byTermKey = new Map<string, FlashcardState>();
  if (savedCards) {
    savedCards.forEach((c) => {
      byTermKey.set(`${c.term.trim().toLowerCase()}||${c.def.trim().toLowerCase()}`, c);
    });
  }

  return pairs.map((pair) => {
    const key = `${pair.term.trim().toLowerCase()}||${pair.def.trim().toLowerCase()}`;
    const existing = byTermKey.get(key);
    if (existing) {
      return {
        ...existing,
        id: pair.id,
        term: pair.term,
        def: pair.def,
      };
    }

    return {
      id: pair.id,
      term: pair.term,
      def: pair.def,
      status: FlashcardCardStatus.NEW,
      reps: 0,
      lapses: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      dueAt: nowMs,
      lastReviewedAt: null,
    };
  });
}

function computeTransition(
  card: FlashcardState,
  rating: FlashcardRating,
  nowMs: number
): {
  nextStatus: FlashcardCardStatus;
  nextReps: number;
  nextLapses: number;
  nextEase: number;
  nextIntervalDays: number;
  dueDelayMs: number;
  requeueInSession: boolean;
} {
  const ease = clamp(card.easeFactor || 2.5, 1.3, 3.2);

  if (rating === FlashcardRating.AGAIN) {
    const nextEase = clamp(ease - 0.2, 1.3, 3.2);
    const nextLapses = card.status === FlashcardCardStatus.REVIEW ? card.lapses + 1 : card.lapses;
    return {
      nextStatus:
        card.status === FlashcardCardStatus.NEW
          ? FlashcardCardStatus.LEARNING
          : FlashcardCardStatus.RELEARNING,
      nextReps: 0,
      nextLapses,
      nextEase,
      nextIntervalDays: 0,
      dueDelayMs: 60 * 1000, // 1m intra-session re-queue
      requeueInSession: true,
    };
  }

  if (rating === FlashcardRating.HARD) {
    if (card.status === FlashcardCardStatus.NEW || card.status === FlashcardCardStatus.LEARNING || card.status === FlashcardCardStatus.RELEARNING) {
      return {
        nextStatus: FlashcardCardStatus.LEARNING,
        nextReps: Math.max(1, card.reps),
        nextLapses: card.lapses,
        nextEase: clamp(ease - 0.1, 1.3, 3.2),
        nextIntervalDays: 0.25,
        dueDelayMs: 6 * MINUTE_MS,
        requeueInSession: true,
      };
    }

    const nextIntervalDays = Math.max(1, Number((card.intervalDays * 1.2).toFixed(2)));
    return {
      nextStatus: FlashcardCardStatus.REVIEW,
      nextReps: card.reps + 1,
      nextLapses: card.lapses,
      nextEase: clamp(ease - 0.15, 1.3, 3.2),
      nextIntervalDays,
      dueDelayMs: nextIntervalDays * DAY_MS,
      requeueInSession: false,
    };
  }

  if (rating === FlashcardRating.GOOD) {
    if (card.status === FlashcardCardStatus.NEW) {
      return {
        nextStatus: FlashcardCardStatus.LEARNING,
        nextReps: 1,
        nextLapses: card.lapses,
        nextEase: ease,
        nextIntervalDays: 0.5,
        dueDelayMs: 10 * MINUTE_MS,
        requeueInSession: false,
      };
    }
    if (card.status === FlashcardCardStatus.LEARNING || card.status === FlashcardCardStatus.RELEARNING) {
      return {
        nextStatus: FlashcardCardStatus.REVIEW,
        nextReps: card.reps + 1,
        nextLapses: card.lapses,
        nextEase: ease,
        nextIntervalDays: 1,
        dueDelayMs: 1 * DAY_MS,
        requeueInSession: false,
      };
    }

    const nextIntervalDays =
      card.reps <= 1
        ? 3
        : Math.max(2, Math.round(card.intervalDays * ease));
    return {
      nextStatus: FlashcardCardStatus.REVIEW,
      nextReps: card.reps + 1,
      nextLapses: card.lapses,
      nextEase: ease,
      nextIntervalDays,
      dueDelayMs: nextIntervalDays * DAY_MS,
      requeueInSession: false,
    };
  }

  // FlashcardRating.EASY
  const nextEase = clamp(ease + 0.15, 1.3, 3.2);
  const nextIntervalDays =
    card.status === FlashcardCardStatus.NEW || card.status === FlashcardCardStatus.LEARNING || card.status === FlashcardCardStatus.RELEARNING
      ? 4
      : Math.max(4, Math.round(card.intervalDays * nextEase * 1.3));

  return {
    nextStatus: FlashcardCardStatus.REVIEW,
    nextReps: card.reps + 1,
    nextLapses: card.lapses,
    nextEase,
    nextIntervalDays,
    dueDelayMs: nextIntervalDays * DAY_MS,
    requeueInSession: false,
  };
}

export function formatIntervalLabel(delayMs: number): string {
  if (delayMs <= 65 * 1000) return '< 1m';
  const mins = Math.round(delayMs / MINUTE_MS);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(delayMs / DAY_MS);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

export function previewNextIntervals(
  card: FlashcardState,
  nowMs: number = Date.now()
): Record<FlashcardRating, string> {
  return {
    [FlashcardRating.AGAIN]: formatIntervalLabel(
      computeTransition(card, FlashcardRating.AGAIN, nowMs).dueDelayMs
    ),
    [FlashcardRating.HARD]: formatIntervalLabel(
      computeTransition(card, FlashcardRating.HARD, nowMs).dueDelayMs
    ),
    [FlashcardRating.GOOD]: formatIntervalLabel(
      computeTransition(card, FlashcardRating.GOOD, nowMs).dueDelayMs
    ),
    [FlashcardRating.EASY]: formatIntervalLabel(
      computeTransition(card, FlashcardRating.EASY, nowMs).dueDelayMs
    ),
  };
}

export function applyFlashcardReview(
  card: FlashcardState,
  rating: FlashcardRating,
  nowMs: number = Date.now()
): { updatedCard: FlashcardState; requeueInSession: boolean } {
  const t = computeTransition(card, rating, nowMs);
  return {
    updatedCard: {
      ...card,
      status: t.nextStatus,
      reps: t.nextReps,
      lapses: t.nextLapses,
      easeFactor: Number(t.nextEase.toFixed(2)),
      intervalDays: t.nextIntervalDays,
      dueAt: nowMs + t.dueDelayMs,
      lastReviewedAt: nowMs,
    },
    requeueInSession: t.requeueInSession,
  };
}

export function buildDueFlashcardQueue(
  cards: FlashcardState[],
  nowMs: number = Date.now(),
  includeAhead: boolean = false
): string[] {
  const dueOrLearning = cards
    .filter(
      (c) =>
        includeAhead ||
        c.status === FlashcardCardStatus.NEW ||
        c.status === FlashcardCardStatus.LEARNING ||
        c.status === FlashcardCardStatus.RELEARNING ||
        c.dueAt <= nowMs
    )
    .sort((a, b) => {
      const priority = (s: FlashcardCardStatus) =>
        s === FlashcardCardStatus.RELEARNING
          ? 0
          : s === FlashcardCardStatus.LEARNING
          ? 1
          : s === FlashcardCardStatus.REVIEW
          ? 2
          : 3;
      const pa = priority(a.status);
      const pb = priority(b.status);
      if (pa !== pb) return pa - pb;
      return a.dueAt - b.dueAt;
    });

  return dueOrLearning.map((c) => c.id);
}

export function summarizeFlashcardDeck(
  cards: FlashcardState[],
  nowMs: number = Date.now()
): { total: number; newCount: number; learningCount: number; dueCount: number; masteredCount: number } {
  let newCount = 0;
  let learningCount = 0;
  let dueCount = 0;
  let masteredCount = 0;

  cards.forEach((c) => {
    if (c.status === FlashcardCardStatus.NEW) {
      newCount += 1;
      dueCount += 1;
    } else if (
      c.status === FlashcardCardStatus.LEARNING ||
      c.status === FlashcardCardStatus.RELEARNING
    ) {
      learningCount += 1;
      dueCount += 1;
    } else {
      if (c.dueAt <= nowMs) dueCount += 1;
      if (c.intervalDays >= 3) masteredCount += 1;
    }
  });

  return {
    total: cards.length,
    newCount,
    learningCount,
    dueCount,
    masteredCount,
  };
}
