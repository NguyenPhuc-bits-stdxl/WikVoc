export enum DelimiterOption {
  TAB = 'tab',
  COMMA = 'comma',
  SEMICOLON = 'semicolon',
  CUSTOM = 'custom',
}

export enum SessionMode {
  COUNT = 'count',
  TIME = 'time',
}

export enum DrillDirection {
  DEF_TO_TERM = 'def_to_term',
  TERM_TO_DEF = 'term_to_def',
  MIXED = 'mixed',
}

export enum DifficultyMode {
  ADAPTIVE = 'adaptive',
  LAZY = 'lazy',
  EXTREME = 'extreme',
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum QuestionFormat {
  MCQ = 'MCQ',
  COLUMNS = 'COLUMNS',
  CLOZE = 'CLOZE',
}

export enum AdaptiveRegime {
  FLOW_STATE = 'Flow State',
  RAMPING_DIFFICULTY = 'Ramping Difficulty',
  REINFORCING_WEAK = 'Reinforcing Weak Items',
  SOFTENING_PACE = 'Softening Pace',
}

export interface VocabPair {
  id: string;
  term: string;
  def: string;
}

export interface ParsedDeckResult {
  pairs: VocabPair[];
  skippedLines: { lineNumber: number; raw: string; reason: string }[];
  totalLines: number;
}

export interface SessionConfig {
  mode: SessionMode;
  targetCount: number;
  targetMinutes: number;
  direction: DrillDirection;
  difficulty: DifficultyMode;
}

export interface ItemAttemptLog {
  promptIndex: number;
  format: QuestionFormat;
  score: number;
  commitTimeMs: number;
  firstActionLatencyMs: number;
  stageChanges: number;
  hintUsed: boolean;
  wasImpulsive: boolean;
  wasEliminationGuess: boolean;
  confidence: ConfidenceLevel;
  isGuessMode: boolean;
  kGuessApplied: number;
}

export interface ItemState {
  id: string;
  term: string;
  def: string;
  mastery: number;
  stability: number;
  lastSeenPromptIndex: number | null;
  lastSeenTimestamp: number | null;
  exposures: number;
  correctCount: number;
  errorCount: number;
  errorWeight: number;
  hesitationScore: number;
  confusionWeight: number;
  confusableItemIds: string[];
  eliminationWeight: number;
  guessWeight: number;
  guessMarksCount: number;
  recoveryPending: boolean;
  recoveryTargetPrompt: number | null;
  lastScore: number | null;
  history: ItemAttemptLog[];
}

export interface SensitivityVector {
  kPace: number;
  kHesitation: number;
  kError: number;
  kRecovery: number;
}

export interface AdaptiveEngineState {
  items: ItemState[];
  k: SensitivityVector;
  promptIndex: number;
  countedPrompts: number;
  lastPrimaryItemId: string | null;
  recentCommitTimesMs: number[];
  recentScores: number[];
  baselineMedianMs: number;
  regime: AdaptiveRegime;
  softeningCooldown: number;
  columnsCooldown: number;
}

export interface MCQOption {
  id: string;
  label: string;
  itemId: string;
  isCorrect: boolean;
  isConfusableDistractor?: boolean;
}

export interface MCQQuestion {
  format: QuestionFormat.MCQ;
  primaryItemId: string;
  promptDirection: DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF;
  promptText: string;
  promptSublabel: string;
  targetAnswer: string;
  options: MCQOption[];
  softened: boolean;
  masteryBefore: number;
  hasConfusableTrap: boolean;
}

export interface ColumnsLeftItem {
  itemId: string;
  text: string;
}

export interface ColumnsRightItem {
  itemId: string;
  text: string;
}

export interface ColumnsQuestion {
  format: QuestionFormat.COLUMNS;
  primaryItemId: string;
  itemIds: string[];
  promptDirection: DrillDirection.DEF_TO_TERM | DrillDirection.TERM_TO_DEF;
  leftItems: ColumnsLeftItem[];
  rightItems: ColumnsRightItem[];
  softened: boolean;
  masteryBefore: number;
}

export interface ClozeSlot {
  index: number;
  char: string;
  isBlank: boolean;
  isSeparator: boolean;
}

export interface ClozeQuestion {
  format: QuestionFormat.CLOZE;
  primaryItemId: string;
  promptDirection: DrillDirection.DEF_TO_TERM;
  promptDef: string;
  targetTerm: string;
  level: 1 | 2 | 3;
  slots: ClozeSlot[];
  blankIndices: number[];
  masteryBefore: number;
}

export type ActiveQuestion = MCQQuestion | ColumnsQuestion | ClozeQuestion;

export interface CommitPayload {
  perItemScores: { itemId: string; score: number }[];
  commitTimeMs: number;
  firstActionLatencyMs: number;
  stageChanges: number;
  hintsUsed: number;
  confidence: ConfidenceLevel;
  filteredSlips?: number;
  chosenDistractorItemId?: string;
  eliminationSuspectIds?: string[];
  isGuessMode?: boolean;
  guessMarks?: { itemId: string; kGuess: number }[];
  boardItemIds?: string[];
}

export interface ItemOutcomeDetail {
  itemId: string;
  term: string;
  def: string;
  score: number;
  masteryBefore: number;
  masteryAfter: number;
}

export interface PromptEvaluation {
  promptIndex: number;
  format: QuestionFormat;
  score: number;
  commitTimeMs: number;
  firstActionLatencyMs: number;
  stageChanges: number;
  filteredSlips: number;
  hintsUsed: number;
  confidence: ConfidenceLevel;
  isGuessMode: boolean;
  guessMarks: { itemId: string; term: string; kGuess: number }[];
  impulsiveDetected: boolean;
  eliminationDetected: boolean;
  confusableTrapDetected: boolean;
  outcomes: ItemOutcomeDetail[];
  feedbackHeadline: string;
  feedbackDetail: string;
}

export interface KeyMapConfig {
  opt1: string;
  opt2: string;
  opt3: string;
  opt4: string;
  right1: string;
  right2: string;
  right3: string;
  right4: string;
  commit: string;
  next: string;
  hint: string;
}

export interface SuggestedDrillPlan {
  pairs: VocabPair[];
  targetCount: number;
  targetMinutes: number;
  below50Count: number;
  rationale: string;
}

export interface SessionSummaryData {
  promptsCompleted: number;
  overallAccuracy: number;
  avgCommitTimeMs: number;
  hesitationIndex: number;
  durationMs: number;
  finalItems: ItemState[];
  weakestItems: ItemState[];
  finalK: SensitivityVector;
  formatBreakdown: Record<QuestionFormat, number>;
  previousConfig: SessionConfig;
  suggestedPlan: SuggestedDrillPlan;
}

export enum PaletteId {
  CYAN = 'cyan',
  EMERALD = 'emerald',
  INDIGO = 'indigo',
  AMBER = 'amber',
  ROSE = 'rose',
}

export enum BackgroundMode {
  NONE = 'none',
  STATIC = 'static',
  SLIDESHOW = 'slideshow',
}

export enum ScrimStrength {
  LIGHT = 'light',
  BALANCED = 'balanced',
  DEEP = 'deep',
}

export interface SavedWallpaperItem {
  id: string;
  name: string;
  src: string;
  isBuiltin: boolean;
  createdAt: number;
}

export interface AppearanceConfig {
  isDark: boolean;
  palette: PaletteId;
  bgMode: BackgroundMode;
  staticWallpaperId: string;
  slideshowWallpaperIds: string[];
  slideshowIntervalSec: number;
  scrimStrength: ScrimStrength;
}

export interface SavedDeckRecord {
  id: string;
  name: string;
  rawText: string;
  delimiterOption: DelimiterOption;
  customDelimiter: string;
  pairCount: number;
  createdAt: number;
  updatedAt: number;
}

export enum FlashcardRating {
  AGAIN = 'again',
  HARD = 'hard',
  GOOD = 'good',
  EASY = 'easy',
}

export enum FlashcardCardStatus {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEW = 'review',
  RELEARNING = 'relearning',
}

export interface FlashcardState {
  id: string;
  term: string;
  def: string;
  status: FlashcardCardStatus;
  reps: number;
  lapses: number;
  easeFactor: number;
  intervalDays: number;
  dueAt: number;
  lastReviewedAt: number | null;
}

