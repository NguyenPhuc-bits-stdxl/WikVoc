import {
  ActiveQuestion,
  AdaptiveEngineState,
  AdaptiveRegime,
  ClozeQuestion,
  ClozeSlot,
  ColumnsQuestion,
  CommitPayload,
  ConfidenceLevel,
  DifficultyMode,
  DrillDirection,
  ItemOutcomeDetail,
  ItemState,
  MCQOption,
  MCQQuestion,
  PromptEvaluation,
  QuestionFormat,
  SensitivityVector,
  SessionConfig,
  SessionMode,
  SuggestedDrillPlan,
  VocabPair,
} from '@/src/types/vocab';

const INITIAL_MASTERY = 0.15;
const INITIAL_STABILITY = 22;
const DEFAULT_BASELINE_MS = 4500;

const WEIGHTS = {
  w1MasteryGap: 0.36,
  w2ForgettingSpacing: 0.2,
  w3ErrorWeight: 0.21,
  w4Hesitation: 0.11,
  w5RecoveryWindow: 0.44,
  w6Confusion: 0.3,
  w7EliminationProbe: 0.54,
  w8GuessAttention: 0.68,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function median(values: number[]): number {
  if (values.length === 0) return DEFAULT_BASELINE_MS;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

export function computeOrthographicSimilarity(termA: string, termB: string): number {
  const a = termA.trim().toLowerCase();
  const b = termB.trim().toLowerCase();
  if (!a || !b || a === b) return a === b ? 1 : 0;

  const maxLen = Math.max(a.length, b.length);
  const dist = damerauLevenshtein(a, b);
  const editSim = 1 - dist / maxLen;

  let prefixLen = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prefixRatio = prefixLen / maxLen;
  const suffixRatio = suffixLen / maxLen;

  return clamp(editSim * 0.65 + prefixRatio * 0.2 + suffixRatio * 0.15, 0, 1);
}

export function createAdaptiveEngineState(pairs: VocabPair[]): AdaptiveEngineState {
  const confusableMap = new Map<string, string[]>();
  for (let i = 0; i < pairs.length; i++) {
    const scoredPeers: { id: string; sim: number }[] = [];
    for (let j = 0; j < pairs.length; j++) {
      if (i === j) continue;
      const sim = computeOrthographicSimilarity(pairs[i].term, pairs[j].term);
      if (sim >= 0.44) {
        scoredPeers.push({ id: pairs[j].id, sim });
      }
    }
    scoredPeers.sort((a, b) => b.sim - a.sim);
    confusableMap.set(
      pairs[i].id,
      scoredPeers.slice(0, 4).map((p) => p.id)
    );
  }

  const items: ItemState[] = pairs.map((pair) => ({
    id: pair.id,
    term: pair.term,
    def: pair.def,
    mastery: INITIAL_MASTERY,
    stability: INITIAL_STABILITY,
    lastSeenPromptIndex: null,
    lastSeenTimestamp: null,
    exposures: 0,
    correctCount: 0,
    errorCount: 0,
    errorWeight: 0,
    hesitationScore: 0,
    confusionWeight: 0,
    confusableItemIds: confusableMap.get(pair.id) ?? [],
    eliminationWeight: 0,
    guessWeight: 0,
    guessMarksCount: 0,
    recoveryPending: false,
    recoveryTargetPrompt: null,
    lastScore: null,
    history: [],
  }));

  return {
    items,
    k: {
      kPace: 1.0,
      kHesitation: 1.0,
      kError: 1.0,
      kRecovery: 1.0,
    },
    promptIndex: 0,
    countedPrompts: 0,
    lastPrimaryItemId: null,
    recentCommitTimesMs: [],
    recentScores: [],
    baselineMedianMs: DEFAULT_BASELINE_MS,
    regime: AdaptiveRegime.FLOW_STATE,
    softeningCooldown: 0,
    columnsCooldown: 0,
  };
}

export function computeItemPriority(
  item: ItemState,
  state: AdaptiveEngineState,
  nowMs: number,
  difficulty: DifficultyMode,
  remainingCountedPrompts?: number
): number {
  const { k, promptIndex, lastPrimaryItemId, items } = state;

  if (items.length >= 3 && item.id === lastPrimaryItemId) {
    return -999;
  }

  const promptGap =
    item.lastSeenPromptIndex === null ? 6 : Math.max(1, promptIndex - item.lastSeenPromptIndex);

  const elapsedSec =
    item.lastSeenTimestamp === null ? 15 : Math.max(1, (nowMs - item.lastSeenTimestamp) / 1000);

  const retrievability = Math.exp(-elapsedSec / Math.max(8, item.stability));
  const decayUrgency = 1 - retrievability;
  const timeSinceLastSeen = clamp((promptGap / 6) * 0.55 + decayUrgency * 0.65, 0, 1.8);

  let recoveryWindowBonus = 0;
  if (item.recoveryPending && item.recoveryTargetPrompt !== null) {
    if (promptIndex >= item.recoveryTargetPrompt) {
      recoveryWindowBonus = 1.0;
    } else if (promptIndex === item.recoveryTargetPrompt - 1) {
      recoveryWindowBonus = 0.25;
    }
  }

  // Coverage guarantee boost: ensure unseen words are never starved by early-error loops
  const unseenCount = items.filter((it) => it.exposures === 0).length;
  let unseenCoverageBoost = 0;
  if (item.exposures === 0) {
    const coveragePressure =
      remainingCountedPrompts !== undefined && remainingCountedPrompts > 0
        ? clamp(unseenCount / remainingCountedPrompts, 0.35, 1.5)
        : 0.65;
    unseenCoverageBoost = 0.62 + coveragePressure * 0.65;
  }

  const extremeClozeEscalationNudge =
    difficulty === DifficultyMode.EXTREME &&
    item.correctCount >= 1 &&
    item.mastery < 0.72 &&
    !item.history.some((h) => h.format === QuestionFormat.CLOZE && h.score >= 0.85)
      ? 0.28
      : 0;

  const pScore =
    WEIGHTS.w1MasteryGap * (1 - item.mastery) +
    WEIGHTS.w2ForgettingSpacing * timeSinceLastSeen * k.kPace +
    WEIGHTS.w3ErrorWeight * item.errorWeight * k.kError +
    WEIGHTS.w4Hesitation * item.hesitationScore * k.kHesitation +
    WEIGHTS.w5RecoveryWindow * recoveryWindowBonus * k.kRecovery +
    WEIGHTS.w6Confusion * item.confusionWeight +
    WEIGHTS.w7EliminationProbe * item.eliminationWeight * k.kRecovery +
    WEIGHTS.w8GuessAttention * item.guessWeight * k.kRecovery +
    unseenCoverageBoost +
    extremeClozeEscalationNudge;

  return pScore + Math.random() * 0.03;
}

function resolvePromptDirection(
  configured: DrillDirection,
  targetFormat: QuestionFormat
): DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF {
  if (targetFormat === QuestionFormat.CLOZE) {
    return DrillDirection.DEF_TO_TERM;
  }
  if (configured === DrillDirection.MIXED) {
    return Math.random() < 0.6 ? DrillDirection.DEF_TO_TERM : DrillDirection.TERM_TO_DEF;
  }
  return configured;
}

function buildClozeSlots(
  term: string,
  mastery: number,
  difficulty: DifficultyMode,
  exposures: number
): {
  slots: ClozeSlot[];
  blankIndices: number[];
  level: 1 | 2 | 3;
} {
  const chars = Array.from(term);
  const letterIndices: number[] = [];

  chars.forEach((ch, idx) => {
    if (/[a-zA-Z0-9]/.test(ch)) {
      letterIndices.push(idx);
    }
  });

  if (letterIndices.length <= 1) {
    return {
      slots: chars.map((ch, idx) => ({
        index: idx,
        char: ch,
        isBlank: idx === letterIndices[0],
        isSeparator: !/[a-zA-Z0-9]/.test(ch),
      })),
      blankIndices: letterIndices.slice(0, 1),
      level: 1,
    };
  }

  // Extreme Mode: Single First-Letter Cloze OR Blind Cloze (0 anchors revealed!)
  if (difficulty === DifficultyMode.EXTREME) {
    const useBlindCloze =
      mastery >= 0.55 || (mastery >= 0.36 && exposures >= 2 && Math.random() < 0.65);

    if (useBlindCloze) {
      const allBlanks = new Set<number>(letterIndices);
      return {
        slots: chars.map((ch, idx) => ({
          index: idx,
          char: ch,
          isBlank: allBlanks.has(idx),
          isSeparator: !/[a-zA-Z0-9]/.test(ch),
        })),
        blankIndices: letterIndices,
        level: 3,
      };
    }

    // Single first-letter hint only (keep ONLY letterIndices[0] visible)
    const firstIdx = letterIndices[0];
    const remainingBlanks = letterIndices.filter((idx) => idx !== firstIdx);
    const blankSet = new Set<number>(remainingBlanks);
    return {
      slots: chars.map((ch, idx) => ({
        index: idx,
        char: ch,
        isBlank: blankSet.has(idx),
        isSeparator: !/[a-zA-Z0-9]/.test(ch),
      })),
      blankIndices: remainingBlanks,
      level: 2,
    };
  }

  let level: 1 | 2 | 3 = 1;
  let targetBlanks = 2;

  if (mastery < 0.55) {
    level = 1;
    if (letterIndices.length <= 3) {
      targetBlanks = 1;
    } else if (letterIndices.length <= 5) {
      targetBlanks = 2;
    } else if (letterIndices.length <= 8) {
      targetBlanks = 3;
    } else {
      targetBlanks = 4;
    }
  } else if (mastery < 0.78) {
    level = 2;
    targetBlanks = Math.max(2, Math.round(letterIndices.length * 0.55));
  } else {
    level = 3;
    targetBlanks = Math.max(2, Math.round(letterIndices.length * 0.78));
  }

  targetBlanks = Math.min(targetBlanks, Math.max(1, letterIndices.length - 1));

  const firstLetterIdx = letterIndices[0];
  const lastLetterIdx = letterIndices[letterIndices.length - 1];

  const candidateIndices = letterIndices.filter((idx) => {
    if (idx === firstLetterIdx) return false;
    if (level === 1 && letterIndices.length >= 5 && idx === lastLetterIdx) return false;
    if (level === 2 && letterIndices.length >= 7 && idx === lastLetterIdx) return false;
    return true;
  });

  const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
  const sortedCandidates = [...candidateIndices].sort((a, b) => {
    if (level === 1) {
      const aVowel = vowels.has(chars[a].toLowerCase()) ? 1 : 0;
      const bVowel = vowels.has(chars[b].toLowerCase()) ? 1 : 0;
      if (aVowel !== bVowel) return bVowel - aVowel;
    }
    return Math.random() - 0.5;
  });

  const chosen = new Set<number>(sortedCandidates.slice(0, targetBlanks));

  if (chosen.size < targetBlanks && !chosen.has(lastLetterIdx) && lastLetterIdx !== firstLetterIdx) {
    chosen.add(lastLetterIdx);
  }

  const blankIndices = letterIndices.filter((idx) => chosen.has(idx));
  const slots: ClozeSlot[] = chars.map((ch, idx) => ({
    index: idx,
    char: ch,
    isBlank: chosen.has(idx),
    isSeparator: !/[a-zA-Z0-9]/.test(ch),
  }));

  return { slots, blankIndices, level };
}

function buildMCQQuestion(
  primaryItem: ItemState,
  allItems: ItemState[],
  direction: DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF,
  softened: boolean
): MCQQuestion {
  const maxDistractors = Math.min(3, allItems.length - 1);
  const itemById = new Map(allItems.map((it) => [it.id, it]));

  const confusableDistractors: ItemState[] = [];
  const shouldIncludeConfusable =
    primaryItem.confusableItemIds.length > 0 &&
    (primaryItem.confusionWeight > 0 || primaryItem.exposures > 0 || Math.random() < 0.7);

  if (shouldIncludeConfusable) {
    const confusableLimit = primaryItem.confusionWeight > 0.3 ? 2 : 1;
    for (const cid of primaryItem.confusableItemIds) {
      if (confusableDistractors.length >= Math.min(confusableLimit, maxDistractors)) break;
      const peer = itemById.get(cid);
      if (peer && peer.id !== primaryItem.id) {
        confusableDistractors.push(peer);
      }
    }
  }

  const confusableSet = new Set(confusableDistractors.map((c) => c.id));
  const remainingNeeded = maxDistractors - confusableDistractors.length;
  const otherDistractors = shuffleArray(
    allItems.filter((it) => it.id !== primaryItem.id && !confusableSet.has(it.id))
  ).slice(0, remainingNeeded);

  const rawChoices = shuffleArray([primaryItem, ...confusableDistractors, ...otherDistractors]);
  const options: MCQOption[] = rawChoices.map((item, idx) => ({
    id: `opt_${idx}_${item.id}`,
    itemId: item.id,
    label: direction === DrillDirection.DEF_TO_TERM ? item.term : item.def,
    isCorrect: item.id === primaryItem.id,
    isConfusableDistractor: confusableSet.has(item.id),
  }));

  return {
    format: QuestionFormat.MCQ,
    primaryItemId: primaryItem.id,
    promptDirection: direction,
    promptText: direction === DrillDirection.DEF_TO_TERM ? primaryItem.def : primaryItem.term,
    promptSublabel:
      direction === DrillDirection.DEF_TO_TERM
        ? 'Select the matching English term'
        : 'Select the matching definition',
    targetAnswer: direction === DrillDirection.DEF_TO_TERM ? primaryItem.term : primaryItem.def,
    options,
    softened,
    masteryBefore: primaryItem.mastery,
    hasConfusableTrap: confusableDistractors.length > 0,
  };
}

function buildColumnsQuestion(
  rankedItems: ItemState[],
  direction: DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF,
  softened: boolean
): ColumnsQuestion {
  const pairCount = softened
    ? Math.min(3, rankedItems.length)
    : Math.min(4, rankedItems.length);

  // Exclude items flagged for standalone elimination/guess probing unless needed for coverage
  const nonProbeCandidates = rankedItems.filter(
    (it) => it.exposures === 0 || (it.eliminationWeight < 0.5 && it.guessWeight < 0.5)
  );
  const pool =
    nonProbeCandidates.length >= pairCount ? nonProbeCandidates : rankedItems;

  const selected = pool.slice(0, pairCount);
  const leftOrder = shuffleArray(selected);
  const rightOrder = shuffleArray(selected);

  return {
    format: QuestionFormat.COLUMNS,
    primaryItemId: selected[0].id,
    itemIds: selected.map((s) => s.id),
    promptDirection: direction,
    leftItems: leftOrder.map((item) => ({
      itemId: item.id,
      text: direction === DrillDirection.DEF_TO_TERM ? item.term : item.def,
    })),
    rightItems: rightOrder.map((item) => ({
      itemId: item.id,
      text: direction === DrillDirection.DEF_TO_TERM ? item.def : item.term,
    })),
    softened,
    masteryBefore: selected[0].mastery,
  };
}

export function selectNextQuestion(
  state: AdaptiveEngineState,
  configuredDirection: DrillDirection,
  difficulty: DifficultyMode = DifficultyMode.ADAPTIVE,
  remainingCountedPrompts?: number
): ActiveQuestion {
  const nowMs = Date.now();
  const scored = state.items
    .map((item) => ({
      item,
      priority: computeItemPriority(item, state, nowMs, difficulty, remainingCountedPrompts),
    }))
    .sort((a, b) => b.priority - a.priority);

  const unseenScored = scored.filter((s) => s.item.exposures === 0);

  // Hard Deck Coverage Guarantee:
  // Whenever remaining prompts <= unseen items (or no slack left), force selection from unseen items!
  const mustForceUnseen =
    unseenScored.length > 0 &&
    remainingCountedPrompts !== undefined &&
    unseenScored.length >= remainingCountedPrompts;

  const primary = mustForceUnseen ? unseenScored[0].item : scored[0].item;
  const rankedItems = mustForceUnseen
    ? [...unseenScored.map((s) => s.item), ...scored.filter((s) => s.item.exposures > 0).map((s) => s.item)]
    : scored.map((s) => s.item);

  if (difficulty === DifficultyMode.LAZY) {
    const dir = resolvePromptDirection(configuredDirection, QuestionFormat.MCQ);
    return buildMCQQuestion(primary, state.items, dir, false);
  }

  const isStandaloneProbe =
    primary.exposures > 0 && (primary.eliminationWeight >= 0.5 || primary.guessWeight >= 0.5);
  const canUseColumns =
    state.items.length >= 3 && state.columnsCooldown === 0 && !isStandaloneProbe;

  if (difficulty === DifficultyMode.EXTREME) {
    const readyForExtremeCloze =
      configuredDirection !== DrillDirection.TERM_TO_DEF &&
      (primary.correctCount >= 1 || primary.mastery >= 0.26) &&
      (primary.lastScore === null || primary.lastScore >= 0.6 || isStandaloneProbe);

    let chosenFormat: QuestionFormat;
    if (readyForExtremeCloze) {
      chosenFormat = QuestionFormat.CLOZE;
    } else if (isStandaloneProbe) {
      chosenFormat =
        configuredDirection !== DrillDirection.TERM_TO_DEF && primary.mastery >= 0.25
          ? QuestionFormat.CLOZE
          : QuestionFormat.MCQ;
    } else if (canUseColumns && (state.promptIndex % 3 === 1 || Math.random() < 0.42)) {
      chosenFormat = QuestionFormat.COLUMNS;
    } else {
      chosenFormat = QuestionFormat.MCQ;
    }

    if (chosenFormat === QuestionFormat.CLOZE) {
      const { slots, blankIndices, level } = buildClozeSlots(
        primary.term,
        primary.mastery,
        difficulty,
        primary.exposures
      );
      return {
        format: QuestionFormat.CLOZE,
        primaryItemId: primary.id,
        promptDirection: DrillDirection.DEF_TO_TERM,
        promptDef: primary.def,
        targetTerm: primary.term,
        level,
        slots,
        blankIndices,
        masteryBefore: primary.mastery,
      };
    }

    if (chosenFormat === QuestionFormat.COLUMNS) {
      const dir = resolvePromptDirection(configuredDirection, QuestionFormat.COLUMNS);
      return buildColumnsQuestion(rankedItems, dir, false);
    }

    const dir = resolvePromptDirection(configuredDirection, QuestionFormat.MCQ);
    return buildMCQQuestion(primary, state.items, dir, false);
  }

  // Standard Adaptive Mode
  const fatigueSpike = state.k.kHesitation > 1.42 || state.k.kPace > 1.45;
  const softened = fatigueSpike && state.softeningCooldown === 0 && !isStandaloneProbe;

  let chosenFormat: QuestionFormat = QuestionFormat.MCQ;

  if (isStandaloneProbe) {
    chosenFormat =
      primary.mastery >= 0.4 && configuredDirection !== DrillDirection.TERM_TO_DEF
        ? QuestionFormat.CLOZE
        : QuestionFormat.MCQ;
  } else if (softened) {
    chosenFormat =
      canUseColumns && Math.random() < 0.4 ? QuestionFormat.COLUMNS : QuestionFormat.MCQ;
  } else if (primary.mastery < 0.4 || state.k.kError > 1.45) {
    if (canUseColumns && (state.promptIndex % 4 === 2 || Math.random() < 0.34)) {
      chosenFormat = QuestionFormat.COLUMNS;
    } else {
      chosenFormat = QuestionFormat.MCQ;
    }
  } else if (configuredDirection !== DrillDirection.TERM_TO_DEF) {
    chosenFormat = QuestionFormat.CLOZE;
  } else {
    chosenFormat = canUseColumns && Math.random() < 0.45 ? QuestionFormat.COLUMNS : QuestionFormat.MCQ;
  }

  if (chosenFormat === QuestionFormat.CLOZE) {
    const { slots, blankIndices, level } = buildClozeSlots(
      primary.term,
      primary.mastery,
      difficulty,
      primary.exposures
    );
    return {
      format: QuestionFormat.CLOZE,
      primaryItemId: primary.id,
      promptDirection: DrillDirection.DEF_TO_TERM,
      promptDef: primary.def,
      targetTerm: primary.term,
      level,
      slots,
      blankIndices,
      masteryBefore: primary.mastery,
    };
  }

  if (chosenFormat === QuestionFormat.COLUMNS && state.items.length >= 3) {
    const dir = resolvePromptDirection(configuredDirection, QuestionFormat.COLUMNS);
    return buildColumnsQuestion(rankedItems, dir, softened);
  }

  const dir = resolvePromptDirection(configuredDirection, QuestionFormat.MCQ);
  return buildMCQQuestion(primary, state.items, dir, softened);
}

function detectImpulsiveCommit(
  question: ActiveQuestion,
  commitTimeMs: number,
  firstActionLatencyMs: number,
  baselineMedianMs: number
): boolean {
  if (question.format === QuestionFormat.MCQ) {
    const reflexFloor = commitTimeMs < 550 || firstActionLatencyMs < 220;
    const abnormalPaceDrop =
      baselineMedianMs >= 1600 &&
      commitTimeMs < baselineMedianMs * 0.3 &&
      commitTimeMs < 950;
    return reflexFloor || abnormalPaceDrop;
  }

  if (question.format === QuestionFormat.COLUMNS) {
    const boardReflexFloor = commitTimeMs < 1100 || firstActionLatencyMs < 240;
    const abnormalPaceDrop =
      baselineMedianMs >= 2400 &&
      commitTimeMs < baselineMedianMs * 0.3 &&
      commitTimeMs < 1600;
    return boardReflexFloor || abnormalPaceDrop;
  }

  if (question.format === QuestionFormat.CLOZE) {
    return question.blankIndices.length >= 2 && commitTimeMs < 480;
  }

  return false;
}

function updateItemMasteryAndStability(
  item: ItemState,
  score: number,
  commitTimeMs: number,
  firstActionLatencyMs: number,
  stageChanges: number,
  hintUsed: boolean,
  format: QuestionFormat,
  promptIndex: number,
  baselineMedianMs: number,
  nowMs: number,
  wasImpulsive: boolean,
  wasEliminationGuess: boolean,
  confusableHit: boolean,
  confidence: ConfidenceLevel
): ItemState {
  const prevMastery = item.mastery;
  const paceRatio = commitTimeMs / Math.max(1200, baselineMedianMs);
  const speedBonus = !wasImpulsive && paceRatio < 0.9 ? 0.04 : paceRatio > 1.5 ? -0.03 : 0.01;
  const hesitationPenalty = Math.min(0.1, stageChanges * 0.025);
  const hintPenalty = hintUsed ? 0.06 : 0;

  const formatGainMultiplier =
    format === QuestionFormat.CLOZE ? 1.25 : format === QuestionFormat.COLUMNS ? 1.05 : 0.9;

  const isLowConfidenceGuess = confidence === ConfidenceLevel.LOW;
  const isMediumConfidence = confidence === ConfidenceLevel.MEDIUM;

  let nextMastery = prevMastery;
  let nextStability = item.stability;
  let nextErrorWeight = item.errorWeight;
  let nextConfusionWeight = Math.max(0, item.confusionWeight * 0.75);
  let nextEliminationWeight = item.eliminationWeight;
  let nextGuessWeight = item.guessWeight;
  let nextRecoveryPending = item.recoveryPending;
  let nextRecoveryTarget = item.recoveryTargetPrompt;

  if (wasEliminationGuess) {
    nextMastery = clamp(prevMastery + (score >= 0.99 ? 0.02 : -0.18), 0.05, 0.75);
    nextStability = score >= 0.99 ? item.stability : Math.max(10, item.stability * 0.7);
    nextEliminationWeight = clamp(item.eliminationWeight + 0.9, 0, 2.0);
    nextRecoveryPending = true;
    nextRecoveryTarget = promptIndex + 1 + Math.floor(Math.random() * 2);
    if (score < 0.99) {
      nextErrorWeight = clamp(item.errorWeight + 0.65, 0, 2.5);
    }
  } else if (isLowConfidenceGuess) {
    if (score >= 0.99) {
      nextMastery = clamp(prevMastery + 0.03, 0.05, 0.8);
      nextStability = item.stability;
      nextRecoveryPending = true;
      nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 2);
    } else {
      nextMastery = clamp(prevMastery - 0.26 - hintPenalty, 0.05, 0.8);
      nextStability = Math.max(9, item.stability * 0.5);
      nextErrorWeight = clamp(item.errorWeight + 0.85, 0, 2.5);
      nextRecoveryPending = true;
      nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 2);
    }
  } else if (wasImpulsive) {
    if (score >= 0.99) {
      nextMastery = clamp(prevMastery + 0.04, 0.05, 0.85);
      nextStability = clamp(item.stability * 1.05, 10, 120);
      nextErrorWeight = clamp(item.errorWeight + 0.15, 0, 2.5);
    } else {
      nextMastery = clamp(prevMastery - 0.28 - hintPenalty, 0.05, 0.8);
      nextStability = Math.max(8, item.stability * 0.45);
      nextErrorWeight = clamp(item.errorWeight + 0.95, 0, 2.5);
      nextRecoveryPending = true;
      nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 2);
    }
  } else if (score >= 0.99) {
    const confidenceScale = isMediumConfidence ? 0.72 : 1.0;
    const baseGain = 0.24 * (1 - prevMastery * 0.45) * formatGainMultiplier * confidenceScale;
    nextMastery = clamp(
      prevMastery + baseGain + speedBonus - hesitationPenalty - hintPenalty,
      0.05,
      1.0
    );
    nextStability = clamp(
      item.stability * ((isMediumConfidence ? 1.35 : 1.75) - hesitationPenalty * 2),
      12,
      300
    );
    nextErrorWeight = Math.max(0, item.errorWeight * 0.55);
    nextEliminationWeight =
      format !== QuestionFormat.COLUMNS ? 0 : Math.max(0, item.eliminationWeight * 0.4);
    nextGuessWeight = nextGuessWeight > 0 ? Math.max(0, nextGuessWeight * 0.25) : 0;
    if (nextGuessWeight < 0.15) nextGuessWeight = 0;
    nextRecoveryPending = false;
    nextRecoveryTarget = null;
  } else if (score >= 0.5) {
    const partialGain = 0.14 * score * formatGainMultiplier * (isMediumConfidence ? 0.75 : 1);
    nextMastery = clamp(
      prevMastery + partialGain - hesitationPenalty - hintPenalty,
      0.05,
      0.95
    );
    nextStability = clamp(item.stability * 1.15, 10, 180);
    nextErrorWeight = clamp(item.errorWeight * 0.8 + (1 - score) * 0.35, 0, 2.0);
    if (score < 0.75) {
      nextRecoveryPending = true;
      nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 2);
    }
  } else {
    const drop = 0.22 + (1 - score) * 0.1;
    nextMastery = clamp(prevMastery - drop - hintPenalty, 0.05, 0.85);
    nextStability = Math.max(10, item.stability * 0.55);
    nextErrorWeight = clamp(item.errorWeight + 0.75 * (1 - score), 0, 2.5);
    nextRecoveryPending = true;
    nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 3);
  }

  if (confusableHit) {
    nextConfusionWeight = clamp(nextConfusionWeight + 0.85, 0, 2.0);
    nextRecoveryPending = true;
    nextRecoveryTarget = promptIndex + 2 + Math.floor(Math.random() * 2);
  }

  const confidenceHesitationAdd = isLowConfidenceGuess ? 0.6 : isMediumConfidence ? 0.15 : 0;

  const itemHesitation = clamp(
    item.hesitationScore * 0.5 +
      Math.min(1.5, stageChanges * 0.35 + Math.max(0, paceRatio - 1.2) * 0.4) +
      confidenceHesitationAdd,
    0,
    2.5
  );

  return {
    ...item,
    mastery: nextMastery,
    stability: nextStability,
    lastSeenPromptIndex: promptIndex,
    lastSeenTimestamp: nowMs,
    exposures: item.exposures + 1,
    correctCount:
      item.correctCount +
      (score >= 0.75 && !wasEliminationGuess && !isLowConfidenceGuess ? 1 : 0),
    errorCount: item.errorCount + (score < 0.75 ? 1 : 0),
    errorWeight: nextErrorWeight,
    hesitationScore: itemHesitation,
    confusionWeight: nextConfusionWeight,
    eliminationWeight: nextEliminationWeight,
    guessWeight: nextGuessWeight,
    recoveryPending: nextRecoveryPending,
    recoveryTargetPrompt: nextRecoveryTarget,
    lastScore: score,
    history: [
      ...item.history,
      {
        promptIndex,
        format,
        score,
        commitTimeMs,
        firstActionLatencyMs,
        stageChanges,
        hintUsed,
        wasImpulsive,
        wasEliminationGuess,
        confidence,
        isGuessMode: false,
        kGuessApplied: 0,
      },
    ],
  };
}

function determineAdaptiveRegime(
  items: ItemState[],
  k: SensitivityVector,
  softened: boolean
): AdaptiveRegime {
  if (softened || k.kHesitation > 1.42 || k.kPace > 1.45) {
    return AdaptiveRegime.SOFTENING_PACE;
  }
  const hasRecovery = items.some(
    (it) => it.recoveryPending || it.eliminationWeight >= 0.5 || it.guessWeight >= 0.4
  );
  if (k.kError > 1.32 || hasRecovery) {
    return AdaptiveRegime.REINFORCING_WEAK;
  }
  const avgMastery = items.reduce((acc, it) => acc + it.mastery, 0) / Math.max(1, items.length);
  if (avgMastery >= 0.42) {
    return AdaptiveRegime.RAMPING_DIFFICULTY;
  }
  return AdaptiveRegime.FLOW_STATE;
}

export function applyPromptOutcome(
  state: AdaptiveEngineState,
  question: ActiveQuestion,
  payload: CommitPayload
): { nextState: AdaptiveEngineState; evaluation: PromptEvaluation } {
  const nowMs = Date.now();
  const nextPromptIndex = state.promptIndex + 1;
  const {
    perItemScores,
    commitTimeMs,
    firstActionLatencyMs,
    stageChanges,
    hintsUsed,
    confidence,
    filteredSlips = 0,
    chosenDistractorItemId,
    eliminationSuspectIds = [],
    isGuessMode = false,
    guessMarks = [],
    boardItemIds = [],
  } = payload;

  if (isGuessMode) {
    const guessMarkMap = new Map<string, number>();
    guessMarks.forEach((gm) => {
      guessMarkMap.set(gm.itemId, (guessMarkMap.get(gm.itemId) ?? 0) + gm.kGuess);
    });

    const boardIdSet = new Set<string>([
      question.primaryItemId,
      ...boardItemIds,
      ...guessMarks.map((g) => g.itemId),
    ]);

    const itemById = new Map(state.items.map((it) => [it.id, it]));
    const formattedMarks = Array.from(guessMarkMap.entries()).map(([itemId, kGuess]) => ({
      itemId,
      term: itemById.get(itemId)?.term ?? itemId,
      kGuess: Number(kGuess.toFixed(2)),
    }));

    const updatedItems = state.items.map((item) => {
      if (!boardIdSet.has(item.id)) return item;
      const kGuess = guessMarkMap.get(item.id) ?? 0;
      const attentionAdd = 0.5 + kGuess * 1.1;

      return {
        ...item,
        lastSeenPromptIndex: nextPromptIndex,
        lastSeenTimestamp: nowMs,
        guessWeight: clamp(item.guessWeight + attentionAdd, 0, 3.0),
        guessMarksCount: item.guessMarksCount + (kGuess > 0 ? 1 : 0),
        hesitationScore: clamp(item.hesitationScore + 0.35 + kGuess * 0.4, 0, 2.5),
        recoveryPending: true,
        recoveryTargetPrompt:
          item.id === question.primaryItemId ? nextPromptIndex + 1 : nextPromptIndex,
        history: [
          ...item.history,
          {
            promptIndex: nextPromptIndex,
            format: question.format,
            score: 0,
            commitTimeMs,
            firstActionLatencyMs,
            stageChanges,
            hintUsed: false,
            wasImpulsive: false,
            wasEliminationGuess: false,
            confidence,
            isGuessMode: true,
            kGuessApplied: kGuess,
          },
        ],
      };
    });

    const nextK: SensitivityVector = {
      ...state.k,
      kHesitation: Number(clamp(state.k.kHesitation + 0.16, 0.75, 2.2).toFixed(2)),
      kRecovery: Number(clamp(state.k.kRecovery + 0.25, 0.7, 2.4).toFixed(2)),
    };

    const nextRegime = determineAdaptiveRegime(updatedItems, nextK, false);

    return {
      nextState: {
        ...state,
        items: updatedItems,
        k: nextK,
        promptIndex: nextPromptIndex,
        countedPrompts: state.countedPrompts,
        lastPrimaryItemId: question.primaryItemId,
        regime: nextRegime,
      },
      evaluation: {
        promptIndex: nextPromptIndex,
        format: question.format,
        score: 0,
        commitTimeMs,
        firstActionLatencyMs,
        stageChanges,
        filteredSlips,
        hintsUsed: 0,
        confidence,
        isGuessMode: true,
        guessMarks: formattedMarks,
        impulsiveDetected: false,
        eliminationDetected: false,
        confusableTrapDetected: false,
        outcomes: [],
        feedbackHeadline: 'Guess Mode Logged (Not Counted)',
        feedbackDetail:
          formattedMarks.length > 0
            ? `Prompt count unchanged · Marked ${formattedMarks.length} item${
                formattedMarks.length === 1 ? '' : 's'
              } for immediate reinforcement.`
            : 'Prompt count unchanged · Words from this prompt prioritized soon.',
      },
    };
  }

  const nextCountedPrompts = state.countedPrompts + 1;

  const aggregateScore =
    perItemScores.reduce((sum, entry) => sum + entry.score, 0) /
    Math.max(1, perItemScores.length);

  const impulsiveDetected = detectImpulsiveCommit(
    question,
    commitTimeMs,
    firstActionLatencyMs,
    state.baselineMedianMs
  );

  const updatedTimes = impulsiveDetected
    ? state.recentCommitTimesMs
    : [...state.recentCommitTimesMs, commitTimeMs].slice(-12);
  const baselineMedianMs =
    updatedTimes.length >= 3 ? median(updatedTimes) : state.baselineMedianMs;

  const updatedScores = [...state.recentScores, aggregateScore].slice(-8);

  const recentAvgTime =
    updatedTimes.length > 0
      ? updatedTimes.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, updatedTimes.length)
      : commitTimeMs;
  const rawPaceRatio = recentAvgTime / Math.max(1200, baselineMedianMs);
  const nextKPace = clamp(
    state.k.kPace * 0.45 + rawPaceRatio * 0.55 + (impulsiveDetected ? 0.12 : 0),
    0.65,
    2.0
  );

  const confidenceHesitationDelta =
    confidence === ConfidenceLevel.LOW
      ? 0.55
      : confidence === ConfidenceLevel.MEDIUM
      ? 0.18
      : 0;

  const postStageDwellMs = Math.max(0, commitTimeMs - firstActionLatencyMs);
  const hesitationSignal =
    1.0 +
    stageChanges * 0.22 +
    Math.max(0, (postStageDwellMs - 1800) / 3500) +
    confidenceHesitationDelta;
  const nextKHesitation = clamp(state.k.kHesitation * 0.55 + hesitationSignal * 0.45, 0.75, 2.2);

  const recentErrorRate =
    1 - updatedScores.reduce((a, b) => a + b, 0) / Math.max(1, updatedScores.length);
  const nextKError = clamp(
    0.85 + recentErrorRate * 1.65 + (impulsiveDetected && aggregateScore < 0.99 ? 0.2 : 0),
    0.8,
    2.5
  );

  const primaryItemBefore = state.items.find((it) => it.id === question.primaryItemId);
  let confusableTrapDetected = false;
  let confusedTwinId: string | null = null;

  if (
    question.format === QuestionFormat.MCQ &&
    aggregateScore < 0.99 &&
    chosenDistractorItemId &&
    primaryItemBefore
  ) {
    const chosenItem = state.items.find((it) => it.id === chosenDistractorItemId);
    if (chosenItem) {
      const sim = computeOrthographicSimilarity(primaryItemBefore.term, chosenItem.term);
      if (
        sim >= 0.44 ||
        primaryItemBefore.confusableItemIds.includes(chosenDistractorItemId)
      ) {
        confusableTrapDetected = true;
        confusedTwinId = chosenDistractorItemId;
      }
    }
  }

  const eliminationSet = new Set(eliminationSuspectIds);
  const eliminationDetected =
    question.format === QuestionFormat.COLUMNS && eliminationSet.size > 0;

  const scoreMap = new Map(perItemScores.map((s) => [s.itemId, s.score]));
  const outcomes: ItemOutcomeDetail[] = [];

  const updatedItems = state.items.map((item) => {
    if (confusedTwinId && item.id === confusedTwinId) {
      return {
        ...item,
        confusionWeight: clamp(item.confusionWeight + 0.65, 0, 2.0),
      };
    }

    const itemScore = scoreMap.get(item.id);
    if (itemScore === undefined) return item;

    const isConfusableHit = confusableTrapDetected && item.id === question.primaryItemId;
    const isEliminationGuess = eliminationSet.has(item.id);

    const updated = updateItemMasteryAndStability(
      item,
      itemScore,
      commitTimeMs,
      firstActionLatencyMs,
      stageChanges,
      hintsUsed > 0,
      question.format,
      nextPromptIndex,
      baselineMedianMs,
      nowMs,
      impulsiveDetected,
      isEliminationGuess,
      isConfusableHit,
      confidence
    );

    outcomes.push({
      itemId: item.id,
      term: item.term,
      def: item.def,
      score: itemScore,
      masteryBefore: item.mastery,
      masteryAfter: updated.mastery,
    });

    return updated;
  });

  const pendingRecoveryCount = updatedItems.filter(
    (it) => it.recoveryPending || it.eliminationWeight >= 0.5 || it.guessWeight >= 0.4
  ).length;
  const nextKRecovery = clamp(
    1.0 + pendingRecoveryCount * 0.22 + (aggregateScore < 0.75 ? 0.3 : -0.1),
    0.7,
    2.4
  );

  const nextK: SensitivityVector = {
    kPace: Number(nextKPace.toFixed(2)),
    kHesitation: Number(nextKHesitation.toFixed(2)),
    kError: Number(nextKError.toFixed(2)),
    kRecovery: Number(nextKRecovery.toFixed(2)),
  };

  const wasSoftened =
    question.format !== QuestionFormat.CLOZE && 'softened' in question && question.softened;

  const nextSofteningCooldown = wasSoftened
    ? 2
    : Math.max(0, state.softeningCooldown - 1);

  const nextColumnsCooldown =
    question.format === QuestionFormat.COLUMNS
      ? 2
      : Math.max(0, state.columnsCooldown - 1);

  const nextRegime = determineAdaptiveRegime(updatedItems, nextK, wasSoftened);

  const nextState: AdaptiveEngineState = {
    items: updatedItems,
    k: nextK,
    promptIndex: nextPromptIndex,
    countedPrompts: nextCountedPrompts,
    lastPrimaryItemId: question.primaryItemId,
    recentCommitTimesMs: updatedTimes,
    recentScores: updatedScores,
    baselineMedianMs,
    regime: nextRegime,
    softeningCooldown: nextSofteningCooldown,
    columnsCooldown: nextColumnsCooldown,
  };

  let feedbackHeadline = 'Locked In';
  let feedbackDetail = 'Clean recall — stability increased.';

  if (confusableTrapDetected && confusedTwinId) {
    const twinTerm = state.items.find((it) => it.id === confusedTwinId)?.term ?? 'lookalike';
    feedbackHeadline = 'Lookalike Confusion';
    feedbackDetail = `Confused with "${twinTerm}" — lookalike discrimination queued.`;
  } else if (confidence === ConfidenceLevel.LOW) {
    feedbackHeadline =
      aggregateScore >= 0.99 ? 'Flagged as Guessed' : 'Low Confidence Miss';
    feedbackDetail =
      'Marked as guessed — k_hesitation raised and item queued for confirmation.';
  } else if (impulsiveDetected) {
    feedbackHeadline =
      aggregateScore >= 0.99 ? 'Rushed Commit (Dampened)' : 'Impulsive Commit Detected';
    feedbackDetail =
      aggregateScore >= 0.99
        ? 'Too fast for verified recall — mastery gain capped until confirmed.'
        : 'Response below human reading floor — slowing cadence and re-queuing.';
  } else if (eliminationDetected && aggregateScore >= 0.75) {
    feedbackHeadline = 'Elimination Guess Flagged';
    feedbackDetail = 'Last-paired item queued for standalone verification soon.';
  } else if (aggregateScore >= 0.99) {
    feedbackHeadline = stageChanges > 1 ? 'Confirmed' : 'Clean Recall';
    feedbackDetail =
      hintsUsed > 0
        ? 'Correct with hint — slight stability dampening applied.'
        : confidence === ConfidenceLevel.MEDIUM
        ? 'Correct with medium confidence — moderate stability boost.'
        : 'Mastery and short-term spacing stability boosted.';
  } else if (aggregateScore >= 0.5) {
    feedbackHeadline = `Partial Recall (${Math.round(aggregateScore * 100)}%)`;
    feedbackDetail = 'Close — scheduled for focused follow-up soon.';
  } else {
    feedbackHeadline = 'Re-Queued for Recovery';
    feedbackDetail = 'Will resurface in 2–4 prompts to reinforce memory trace.';
  }

  return {
    nextState,
    evaluation: {
      promptIndex: nextPromptIndex,
      format: question.format,
      score: aggregateScore,
      commitTimeMs,
      firstActionLatencyMs,
      stageChanges,
      filteredSlips,
      hintsUsed,
      confidence,
      isGuessMode: false,
      guessMarks: [],
      impulsiveDetected,
      eliminationDetected,
      confusableTrapDetected,
      outcomes,
      feedbackHeadline,
      feedbackDetail,
    },
  };
}

export function buildSuggestedDrillPlan(
  items: ItemState[],
  previousConfig: SessionConfig,
  promptsCompleted: number
): SuggestedDrillPlan {
  const scored = items
    .map((item) => {
      const perf =
        item.mastery -
        0.18 * item.errorWeight -
        0.12 * item.hesitationScore -
        0.16 * item.guessWeight -
        0.1 * item.confusionWeight -
        0.1 * item.eliminationWeight;
      return { item, perf };
    })
    .sort((a, b) => a.perf - b.perf);

  const exposed = scored.filter((s) => s.item.exposures > 0 || s.item.guessMarksCount > 0);
  const pool = exposed.length >= 2 ? exposed : scored;

  const flagged = pool.filter(
    ({ item }) =>
      item.errorCount > 0 ||
      item.guessMarksCount > 0 ||
      item.mastery < 0.6 ||
      item.hesitationScore >= 0.45 ||
      item.confusionWeight >= 0.3
  );

  const prevCountCap = Math.max(
    2,
    promptsCompleted > 0
      ? Math.min(previousConfig.targetCount, promptsCompleted)
      : previousConfig.targetCount
  );

  const minWords = Math.min(2, items.length);
  const maxSuggestedWords = Math.max(
    minWords,
    Math.min(prevCountCap, items.length, Math.ceil(items.length * 0.55))
  );

  const selectedItems =
    flagged.length >= minWords
      ? flagged.slice(0, maxSuggestedWords).map((s) => s.item)
      : pool.slice(0, Math.min(maxSuggestedWords, Math.max(minWords, 4))).map((s) => s.item);

  const pairs: VocabPair[] = selectedItems.map((it) => ({
    id: it.id,
    term: it.term,
    def: it.def,
  }));

  // Satisfy BOTH: >= pairs.length (full coverage) AND <= prevCountCap (never larger than prior drill)
  const desiredCount = Math.round(pairs.length * 1.5);
  const targetCount = Math.max(pairs.length, Math.min(prevCountCap, desiredCount));

  const ratio = pairs.length / Math.max(1, items.length);
  const scaledMinutes = Math.round(
    previousConfig.targetMinutes * Math.max(0.5, Math.min(1, ratio + 0.15))
  );
  const targetMinutes = clamp(scaledMinutes, 1, previousConfig.targetMinutes);

  const rationale =
    previousConfig.mode === SessionMode.COUNT
      ? `${pairs.length} lowest-performing words · ${targetCount} prompts (≤ ${prevCountCap} prior)`
      : `${pairs.length} lowest-performing words · ${targetMinutes}m (≤ ${previousConfig.targetMinutes}m prior)`;

  return {
    pairs,
    targetCount,
    targetMinutes,
    rationale,
  };
}
