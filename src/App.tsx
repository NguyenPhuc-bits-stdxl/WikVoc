import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DECK_RAW } from '@/src/data/sampleDeck';
import {
  applyPromptOutcome,
  buildSuggestedDrillPlan,
  createAdaptiveEngineState,
  selectNextQuestion,
} from '@/src/engine/adaptiveEngine';
import {
  ActiveQuestion,
  AdaptiveEngineState,
  CommitPayload,
  DelimiterOption,
  DifficultyMode,
  DrillDirection,
  KeyMapConfig,
  PromptEvaluation,
  QuestionFormat,
  SessionConfig,
  SessionMode,
  SessionSummaryData,
  SuggestedDrillPlan,
  VocabPair,
} from '@/src/types/vocab';
import { parseDeckText } from '@/src/utils/deckParser';
import { loadKeyMap, saveKeyMap } from '@/src/utils/keymapStorage';
import { TopBar, AppView } from '@/src/components/TopBar';
import { DeckSetupView } from '@/src/components/DeckSetupView';
import { DrillStage } from '@/src/components/DrillStage';
import { SummaryView } from '@/src/components/SummaryView';
import { KeymapModal } from '@/src/components/KeymapModal';
import { CognitiveModelModal } from '@/src/components/CognitiveModelModal';

export default function App() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const [keymap, setKeymap] = useState<KeyMapConfig>(() => loadKeyMap());
  const handleUpdateKeymap = (next: KeyMapConfig) => {
    setKeymap(next);
    saveKeyMap(next);
  };

  const [isKeymapOpen, setIsKeymapOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const isModalOpen = isKeymapOpen || isModelModalOpen;

  const [rawText, setRawText] = useState<string>(SAMPLE_DECK_RAW);
  const [delimiterOption, setDelimiterOption] = useState<DelimiterOption>(DelimiterOption.TAB);
  const [customDelimiter, setCustomDelimiter] = useState<string>('::');

  const parsedDeck = useMemo(
    () => parseDeckText(rawText, delimiterOption, customDelimiter),
    [rawText, delimiterOption, customDelimiter]
  );

  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(() => ({
    mode: SessionMode.COUNT,
    targetCount: Math.max(2, Math.round(20 * 1.5)),
    targetMinutes: 3,
    direction: DrillDirection.DEF_TO_TERM,
    difficulty: DifficultyMode.ADAPTIVE,
  }));

  // Automatically default targetCount to 1.5x the inserted vocabulary count whenever deck size changes
  const prevDeckSizeRef = useRef<number>(parsedDeck.pairs.length);
  useEffect(() => {
    const nextSize = parsedDeck.pairs.length;
    if (nextSize !== prevDeckSizeRef.current) {
      prevDeckSizeRef.current = nextSize;
      if (nextSize >= 2) {
        setSessionConfig((prev) => ({
          ...prev,
          targetCount: Math.max(nextSize, Math.round(nextSize * 1.5)),
        }));
      }
    }
  }, [parsedDeck.pairs.length]);

  const [activeView, setActiveView] = useState<AppView>('setup');
  const [activeDeckPairs, setActiveDeckPairs] = useState<VocabPair[]>([]);
  const [engineState, setEngineState] = useState<AdaptiveEngineState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(null);
  const [evaluation, setEvaluation] = useState<PromptEvaluation | null>(null);
  const [evaluationsLog, setEvaluationsLog] = useState<PromptEvaluation[]>([]);
  const [summaryData, setSummaryData] = useState<SessionSummaryData | null>(null);

  const sessionStartRef = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const timeLimitMs = sessionConfig.targetMinutes * 60 * 1000;
  const timeExpired =
    sessionConfig.mode === SessionMode.TIME && elapsedMs >= timeLimitMs;

  useEffect(() => {
    if (activeView !== 'drill') return;
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - sessionStartRef.current);
    }, 500);
    return () => window.clearInterval(interval);
  }, [activeView]);

  const launchDrill = useCallback(
    (pairs: VocabPair[], configOverride?: SessionConfig) => {
      if (pairs.length < 2) return;
      const baseConfig = configOverride ?? sessionConfig;
      const safeTargetCount = Math.max(pairs.length, baseConfig.targetCount);
      const effectiveConfig: SessionConfig = {
        ...baseConfig,
        targetCount: safeTargetCount,
      };

      const initialEngine = createAdaptiveEngineState(pairs);
      const remaining =
        effectiveConfig.mode === SessionMode.COUNT ? effectiveConfig.targetCount : undefined;
      const firstQuestion = selectNextQuestion(
        initialEngine,
        effectiveConfig.direction,
        effectiveConfig.difficulty,
        remaining
      );

      setSessionConfig(effectiveConfig);
      setActiveDeckPairs(pairs);
      setEngineState(initialEngine);
      setCurrentQuestion(firstQuestion);
      setEvaluation(null);
      setEvaluationsLog([]);
      setSummaryData(null);
      sessionStartRef.current = Date.now();
      setElapsedMs(0);
      setActiveView('drill');
    },
    [sessionConfig]
  );

  const finishDrill = useCallback(
    (finalEngine: AdaptiveEngineState, logs: PromptEvaluation[]) => {
      const durationMs = Math.max(1000, Date.now() - sessionStartRef.current);
      const countedLogs = logs.filter((l) => !l.isGuessMode);
      const promptsCompleted = countedLogs.length;

      const overallAccuracy =
        promptsCompleted > 0
          ? countedLogs.reduce((sum, l) => sum + l.score, 0) / promptsCompleted
          : 0;

      const avgCommitTimeMs =
        promptsCompleted > 0
          ? countedLogs.reduce((sum, l) => sum + l.commitTimeMs, 0) / promptsCompleted
          : 0;

      const avgSwitches =
        promptsCompleted > 0
          ? countedLogs.reduce((sum, l) => sum + l.stageChanges, 0) / promptsCompleted
          : 0;
      const hesitationIndex = Number(
        (finalEngine.k.kHesitation * 0.65 + avgSwitches * 0.35).toFixed(2)
      );

      const formatBreakdown: Record<QuestionFormat, number> = {
        [QuestionFormat.MCQ]: 0,
        [QuestionFormat.COLUMNS]: 0,
        [QuestionFormat.CLOZE]: 0,
      };
      countedLogs.forEach((l) => {
        formatBreakdown[l.format] += 1;
      });

      const weakestItems = [...finalEngine.items].sort((a, b) => {
        if (Math.abs(a.mastery - b.mastery) > 0.001) {
          return a.mastery - b.mastery;
        }
        return b.errorCount - a.errorCount;
      });

      const suggestedPlan = buildSuggestedDrillPlan(
        finalEngine.items,
        sessionConfig,
        promptsCompleted
      );

      setSummaryData({
        promptsCompleted,
        overallAccuracy,
        avgCommitTimeMs,
        hesitationIndex,
        durationMs,
        finalItems: finalEngine.items,
        weakestItems,
        finalK: finalEngine.k,
        formatBreakdown,
        previousConfig: sessionConfig,
        suggestedPlan,
      });
      setActiveView('summary');
    },
    [sessionConfig]
  );

  const handleCommitAnswer = useCallback(
    (payload: CommitPayload) => {
      if (!engineState || !currentQuestion || evaluation) return;

      const { nextState, evaluation: nextEval } = applyPromptOutcome(
        engineState,
        currentQuestion,
        payload
      );

      setEngineState(nextState);
      setEvaluation(nextEval);
      setEvaluationsLog((prev) => [...prev, nextEval]);
    },
    [engineState, currentQuestion, evaluation]
  );

  const isFinalPrompt =
    engineState !== null &&
    ((sessionConfig.mode === SessionMode.COUNT &&
      engineState.countedPrompts >= sessionConfig.targetCount) ||
      (sessionConfig.mode === SessionMode.TIME &&
        Date.now() - sessionStartRef.current >= timeLimitMs));

  const handleNextPrompt = useCallback(() => {
    if (!engineState) return;

    const shouldEnd =
      (sessionConfig.mode === SessionMode.COUNT &&
        engineState.countedPrompts >= sessionConfig.targetCount) ||
      (sessionConfig.mode === SessionMode.TIME &&
        Date.now() - sessionStartRef.current >= timeLimitMs);

    if (shouldEnd) {
      finishDrill(engineState, evaluationsLog);
      return;
    }

    const remainingCounted =
      sessionConfig.mode === SessionMode.COUNT
        ? Math.max(1, sessionConfig.targetCount - engineState.countedPrompts)
        : undefined;

    const nextQuestion = selectNextQuestion(
      engineState,
      sessionConfig.direction,
      sessionConfig.difficulty,
      remainingCounted
    );
    setCurrentQuestion(nextQuestion);
    setEvaluation(null);
  }, [
    engineState,
    sessionConfig.mode,
    sessionConfig.targetCount,
    sessionConfig.direction,
    sessionConfig.difficulty,
    timeLimitMs,
    evaluationsLog,
    finishDrill,
  ]);

  const handleRestartBySuggestion = useCallback(
    (plan: SuggestedDrillPlan) => {
      const nextConfig: SessionConfig = {
        ...sessionConfig,
        targetCount: plan.targetCount,
        targetMinutes: plan.targetMinutes,
      };
      launchDrill(plan.pairs, nextConfig);
    },
    [sessionConfig, launchDrill]
  );

  const handleDrillWeakWords = useCallback(
    (weakPairs: VocabPair[]) => {
      const nextConfig: SessionConfig = {
        ...sessionConfig,
        targetCount: Math.max(weakPairs.length, Math.round(weakPairs.length * 1.5)),
      };
      launchDrill(weakPairs, nextConfig);
    },
    [sessionConfig, launchDrill]
  );

  const handleRestartFullDeck = useCallback(() => {
    const deck = activeDeckPairs.length >= 2 ? activeDeckPairs : parsedDeck.pairs;
    const nextConfig: SessionConfig = {
      ...sessionConfig,
      targetCount: Math.max(deck.length, Math.round(deck.length * 1.5)),
    };
    launchDrill(deck, nextConfig);
  }, [activeDeckPairs, parsedDeck.pairs, sessionConfig, launchDrill]);

  const canStartDrill =
    parsedDeck.pairs.length >= 2 &&
    (sessionConfig.mode === SessionMode.TIME ||
      sessionConfig.targetCount >= parsedDeck.pairs.length);

  const handlePrimaryHeaderAction = () => {
    if (activeView === 'setup') {
      if (canStartDrill) {
        launchDrill(parsedDeck.pairs);
      }
    } else if (activeView === 'drill' && engineState) {
      finishDrill(engineState, evaluationsLog);
    } else {
      setActiveView('setup');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <TopBar
        activeView={activeView}
        isDark={isDark}
        canStartDrill={canStartDrill}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenKeymap={() => setIsKeymapOpen(true)}
        onOpenModelInfo={() => setIsModelModalOpen(true)}
        onNavigateSetup={() => setActiveView('setup')}
        onPrimaryAction={handlePrimaryHeaderAction}
      />

      {activeView === 'setup' && (
        <DeckSetupView
          rawText={rawText}
          delimiterOption={delimiterOption}
          customDelimiter={customDelimiter}
          parsedDeck={parsedDeck}
          sessionConfig={sessionConfig}
          onChangeRawText={setRawText}
          onChangeDelimiter={setDelimiterOption}
          onChangeCustomDelimiter={setCustomDelimiter}
          onLoadSampleDeck={() => {
            setDelimiterOption(DelimiterOption.TAB);
            setRawText(SAMPLE_DECK_RAW);
          }}
          onUpdateSessionConfig={setSessionConfig}
          onStartDrill={() => {
            if (canStartDrill) launchDrill(parsedDeck.pairs);
          }}
        />
      )}

      {activeView === 'drill' && engineState && currentQuestion && (
        <DrillStage
          engineState={engineState}
          currentQuestion={currentQuestion}
          evaluation={evaluation}
          sessionConfig={sessionConfig}
          elapsedMs={elapsedMs}
          timeExpired={timeExpired}
          isFinalPrompt={isFinalPrompt}
          keymap={keymap}
          isModalOpen={isModalOpen}
          onCommitAnswer={handleCommitAnswer}
          onNextPrompt={handleNextPrompt}
        />
      )}

      {activeView === 'summary' && summaryData && (
        <SummaryView
          summary={summaryData}
          onDrillWeakWords={handleDrillWeakWords}
          onRestartBySuggestion={handleRestartBySuggestion}
          onRestartFullDeck={handleRestartFullDeck}
          onLoadNewDeck={() => setActiveView('setup')}
        />
      )}

      <KeymapModal
        isOpen={isKeymapOpen}
        keymap={keymap}
        onUpdateKeymap={handleUpdateKeymap}
        onClose={() => setIsKeymapOpen(false)}
      />

      <CognitiveModelModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
      />
    </div>
  );
}
