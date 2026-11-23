import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DECK_RAW } from '@/src/data/sampleDeck';
import {
  applyPromptOutcome,
  buildSuggestedDrillPlan,
  createAdaptiveEngineState,
  selectNextQuestion,
} from '@/src/engine/adaptiveEngine';
import { initFlashcardDeck } from '@/src/engine/flashcardEngine';
import {
  ActiveQuestion,
  AdaptiveEngineState,
  AppearanceConfig,
  BackgroundMode,
  CommitPayload,
  DelimiterOption,
  DifficultyMode,
  DrillDirection,
  FlashcardState,
  KeyMapConfig,
  PromptEvaluation,
  QuestionFormat,
  SavedDeckRecord,
  SavedWallpaperItem,
  ScrimStrength,
  SessionConfig,
  SessionMode,
  SessionSummaryData,
  SuggestedDrillPlan,
  VocabPair,
} from '@/src/types/vocab';
import { parseDeckText } from '@/src/utils/deckParser';
import { loadKeyMap, saveKeyMap } from '@/src/utils/keymapStorage';
import {
  BUILTIN_WALLPAPERS,
  loadAppearanceConfig,
  saveAppearanceConfig,
} from '@/src/utils/appearanceStorage';
import {
  buildDeckSignatureKey,
  deleteCustomWallpaper,
  deleteSavedDeck,
  loadAllFlashcardProgressSummary,
  loadCustomWallpapers,
  loadFlashcardDeckProgress,
  loadSavedDecks,
  renameSavedDeck,
  saveCustomWallpaper,
  saveDeckRecord,
  saveFlashcardDeckProgress,
} from '@/src/utils/deckStorage';
import { TopBar, AppView } from '@/src/components/TopBar';
import { DeckSetupView } from '@/src/components/DeckSetupView';
import { MyDecksView } from '@/src/components/MyDecksView';
import { DrillStage } from '@/src/components/DrillStage';
import { FlashcardStage } from '@/src/components/FlashcardStage';
import { SummaryView } from '@/src/components/SummaryView';
import { KeymapModal } from '@/src/components/KeymapModal';
import { CognitiveModelModal } from '@/src/components/CognitiveModelModal';
import { AppearanceModal } from '@/src/components/AppearanceModal';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [appearance, setAppearance] = useState<AppearanceConfig>(() =>
    loadAppearanceConfig()
  );

  const handleUpdateAppearance = useCallback((next: AppearanceConfig) => {
    setAppearance(next);
    saveAppearanceConfig(next);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (appearance.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-palette', appearance.palette);
  }, [appearance.isDark, appearance.palette]);

  const [customWallpapers, setCustomWallpapers] = useState<SavedWallpaperItem[]>([]);
  const allWallpapers = useMemo(
    () => [...BUILTIN_WALLPAPERS, ...customWallpapers],
    [customWallpapers]
  );

  const [savedDecks, setSavedDecks] = useState<SavedDeckRecord[]>([]);
  const [flashcardsByDeckKey, setFlashcardsByDeckKey] = useState<
    Record<string, FlashcardState[]>
  >({});

  useEffect(() => {
    void (async () => {
      const [decks, wallpapers, fcSummary] = await Promise.all([
        loadSavedDecks(),
        loadCustomWallpapers(),
        loadAllFlashcardProgressSummary(),
      ]);
      setSavedDecks(decks);
      setCustomWallpapers(wallpapers);
      setFlashcardsByDeckKey(fcSummary);
    })();
  }, []);

  const [keymap, setKeymap] = useState<KeyMapConfig>(() => loadKeyMap());
  const handleUpdateKeymap = (next: KeyMapConfig) => {
    setKeymap(next);
    saveKeyMap(next);
  };

  const [isKeymapOpen, setIsKeymapOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const isModalOpen = isKeymapOpen || isModelModalOpen || isAppearanceOpen;

  const [rawText, setRawText] = useState<string>(SAMPLE_DECK_RAW);
  const [delimiterOption, setDelimiterOption] = useState<DelimiterOption>(
    DelimiterOption.TAB
  );
  const [customDelimiter, setCustomDelimiter] = useState<string>('::');
  const [activeSavedDeckId, setActiveSavedDeckId] = useState<string | null>(null);
  const [activeDeckName, setActiveDeckName] = useState<string | null>(null);

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

  // Default targetCount to 1.5x the inserted vocabulary count whenever deck size changes
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

  // Flashcard session state
  const [flashcardDeckKey, setFlashcardDeckKey] = useState<string>('');
  const [flashcardDeckTitle, setFlashcardDeckTitle] = useState<string>('Current Deck');
  const [flashcardPairsSource, setFlashcardPairsSource] = useState<VocabPair[]>([]);
  const [flashcardCards, setFlashcardCards] = useState<FlashcardState[]>([]);

  // Slideshow timer for homepage wallpaper
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const activeSlideshowWallpapers = useMemo(() => {
    const ids = new Set(appearance.slideshowWallpaperIds);
    const matched = allWallpapers.filter((w) => ids.has(w.id));
    return matched.length > 0 ? matched : [BUILTIN_WALLPAPERS[0]];
  }, [allWallpapers, appearance.slideshowWallpaperIds]);

  useEffect(() => {
    if (
      appearance.bgMode !== BackgroundMode.SLIDESHOW ||
      activeSlideshowWallpapers.length <= 1
    ) {
      setSlideshowIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSlideshowIndex((prev) => (prev + 1) % activeSlideshowWallpapers.length);
    }, appearance.slideshowIntervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [
    appearance.bgMode,
    appearance.slideshowIntervalSec,
    activeSlideshowWallpapers.length,
  ]);

  const activeWallpaper: SavedWallpaperItem | null = useMemo(() => {
    if (appearance.bgMode === BackgroundMode.NONE) return null;
    if (appearance.bgMode === BackgroundMode.STATIC) {
      return (
        allWallpapers.find((w) => w.id === appearance.staticWallpaperId) ??
        BUILTIN_WALLPAPERS[0]
      );
    }
    return (
      activeSlideshowWallpapers[
        slideshowIndex % Math.max(1, activeSlideshowWallpapers.length)
      ] ?? BUILTIN_WALLPAPERS[0]
    );
  }, [
    appearance.bgMode,
    appearance.staticWallpaperId,
    allWallpapers,
    activeSlideshowWallpapers,
    slideshowIndex,
  ]);

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
        effectiveConfig.mode === SessionMode.COUNT
          ? effectiveConfig.targetCount
          : undefined;
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

  const launchFlashcards = useCallback(
    async (pairs: VocabPair[], title: string, deckId?: string | null) => {
      if (pairs.length < 1) return;
      const sigKey = buildDeckSignatureKey(pairs, deckId);
      const saved = await loadFlashcardDeckProgress(sigKey);
      const initialized = initFlashcardDeck(pairs, saved);
      setFlashcardDeckKey(sigKey);
      setFlashcardDeckTitle(title);
      setFlashcardPairsSource(pairs);
      setFlashcardCards(initialized);
      setActiveView('flashcards');
    },
    []
  );

  const handleUpdateFlashcards = useCallback(
    (nextCards: FlashcardState[]) => {
      setFlashcardCards(nextCards);
      if (flashcardDeckKey) {
        setFlashcardsByDeckKey((prev) => ({
          ...prev,
          [flashcardDeckKey]: nextCards,
        }));
        void saveFlashcardDeckProgress(flashcardDeckKey, nextCards);
      }
    },
    [flashcardDeckKey]
  );

  const handleResetFlashcardProgress = useCallback(() => {
    if (flashcardPairsSource.length < 1) return;
    const fresh = initFlashcardDeck(flashcardPairsSource, null);
    handleUpdateFlashcards(fresh);
  }, [flashcardPairsSource, handleUpdateFlashcards]);

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

  /* ---------------- My Decks Library Actions ---------------- */
  const handleSaveCurrentDeckToLibrary = useCallback(
    async (name: string) => {
      if (parsedDeck.pairs.length < 2) return;
      const now = Date.now();
      const existing = activeSavedDeckId
        ? savedDecks.find((d) => d.id === activeSavedDeckId)
        : null;
      const id =
        existing && existing.name.toLowerCase() === name.trim().toLowerCase()
          ? existing.id
          : `deck_${now}_${Math.random().toString(36).slice(2, 7)}`;

      const record: SavedDeckRecord = {
        id,
        name: name.trim(),
        rawText,
        delimiterOption,
        customDelimiter,
        pairCount: parsedDeck.pairs.length,
        createdAt: existing?.id === id ? existing.createdAt : now,
        updatedAt: now,
      };

      const updatedList = await saveDeckRecord(record);
      setSavedDecks(updatedList);
      setActiveSavedDeckId(record.id);
      setActiveDeckName(record.name);
    },
    [
      parsedDeck.pairs.length,
      activeSavedDeckId,
      savedDecks,
      rawText,
      delimiterOption,
      customDelimiter,
    ]
  );

  const handleImportDeckFileToLibrary = useCallback(
    async (name: string, importedRawText: string) => {
      const detectedDelimiter = importedRawText.includes('\t')
        ? DelimiterOption.TAB
        : importedRawText.includes(';')
        ? DelimiterOption.SEMICOLON
        : DelimiterOption.COMMA;
      const parsed = parseDeckText(importedRawText, detectedDelimiter, '::');
      const now = Date.now();
      const record: SavedDeckRecord = {
        id: `deck_${now}_${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim() || 'Imported Deck',
        rawText: importedRawText,
        delimiterOption: detectedDelimiter,
        customDelimiter: '::',
        pairCount: parsed.pairs.length,
        createdAt: now,
        updatedAt: now,
      };
      const updatedList = await saveDeckRecord(record);
      setSavedDecks(updatedList);
    },
    []
  );

  const handleLoadDeckToEditor = useCallback((deck: SavedDeckRecord) => {
    setDelimiterOption(deck.delimiterOption);
    setCustomDelimiter(deck.customDelimiter);
    setRawText(deck.rawText);
    setActiveSavedDeckId(deck.id);
    setActiveDeckName(deck.name);
    setActiveView('setup');
  }, []);

  const handleStartDrillFromSavedDeck = useCallback(
    (deck: SavedDeckRecord) => {
      const parsed = parseDeckText(
        deck.rawText,
        deck.delimiterOption,
        deck.customDelimiter
      );
      if (parsed.pairs.length < 2) return;
      setDelimiterOption(deck.delimiterOption);
      setCustomDelimiter(deck.customDelimiter);
      setRawText(deck.rawText);
      setActiveSavedDeckId(deck.id);
      setActiveDeckName(deck.name);

      const nextConfig: SessionConfig = {
        ...sessionConfig,
        targetCount: Math.max(
          parsed.pairs.length,
          Math.round(parsed.pairs.length * 1.5)
        ),
      };
      launchDrill(parsed.pairs, nextConfig);
    },
    [sessionConfig, launchDrill]
  );

  const handleStartFlashcardsFromSavedDeck = useCallback(
    (deck: SavedDeckRecord) => {
      const parsed = parseDeckText(
        deck.rawText,
        deck.delimiterOption,
        deck.customDelimiter
      );
      if (parsed.pairs.length < 1) return;
      void launchFlashcards(parsed.pairs, deck.name, deck.id);
    },
    [launchFlashcards]
  );

  const handleRenameSavedDeck = useCallback(
    async (id: string, newName: string) => {
      const updated = await renameSavedDeck(id, newName);
      setSavedDecks(updated);
      if (activeSavedDeckId === id) {
        setActiveDeckName(newName);
      }
    },
    [activeSavedDeckId]
  );

  const handleDeleteSavedDeck = useCallback(
    async (id: string) => {
      const updated = await deleteSavedDeck(id);
      setSavedDecks(updated);
      if (activeSavedDeckId === id) {
        setActiveSavedDeckId(null);
        setActiveDeckName(null);
      }
    },
    [activeSavedDeckId]
  );

  /* ---------------- Wallpaper Actions ---------------- */
  const handleUploadWallpaper = useCallback(
    async (file: File) => {
      const dataUrl = await readFileAsDataUrl(file);
      const item: SavedWallpaperItem = {
        id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || 'Custom Image',
        src: dataUrl,
        isBuiltin: false,
        createdAt: Date.now(),
      };
      await saveCustomWallpaper(item);
      setCustomWallpapers((prev) => [item, ...prev]);

      const nextAppearance: AppearanceConfig =
        appearance.bgMode === BackgroundMode.SLIDESHOW
          ? {
              ...appearance,
              slideshowWallpaperIds: [...appearance.slideshowWallpaperIds, item.id],
            }
          : {
              ...appearance,
              bgMode: BackgroundMode.STATIC,
              staticWallpaperId: item.id,
            };
      handleUpdateAppearance(nextAppearance);
    },
    [appearance, handleUpdateAppearance]
  );

  const handleDeleteWallpaper = useCallback(
    async (id: string) => {
      await deleteCustomWallpaper(id);
      setCustomWallpapers((prev) => prev.filter((w) => w.id !== id));

      const filteredSlides = appearance.slideshowWallpaperIds.filter((x) => x !== id);
      handleUpdateAppearance({
        ...appearance,
        staticWallpaperId:
          appearance.staticWallpaperId === id
            ? BUILTIN_WALLPAPERS[0].id
            : appearance.staticWallpaperId,
        slideshowWallpaperIds:
          filteredSlides.length > 0 ? filteredSlides : [BUILTIN_WALLPAPERS[0].id],
      });
    },
    [appearance, handleUpdateAppearance]
  );

  const canStartDrill =
    parsedDeck.pairs.length >= 2 &&
    (sessionConfig.mode === SessionMode.TIME ||
      sessionConfig.targetCount >= parsedDeck.pairs.length);

  const canStartFlashcards = parsedDeck.pairs.length >= 1;

  const handlePrimaryHeaderAction = () => {
    if (activeView === 'setup' || activeView === 'decks') {
      if (canStartDrill) {
        launchDrill(parsedDeck.pairs);
      }
    } else if (activeView === 'drill' && engineState) {
      finishDrill(engineState, evaluationsLog);
    } else {
      setActiveView('setup');
    }
  };

  const showHomepageWallpaper =
    (activeView === 'setup' || activeView === 'decks') && activeWallpaper !== null;

  const scrimClass =
    appearance.scrimStrength === ScrimStrength.LIGHT
      ? 'bg-slate-50/60 dark:bg-slate-950/60'
      : appearance.scrimStrength === ScrimStrength.DEEP
      ? 'bg-slate-50/90 dark:bg-slate-950/88'
      : 'bg-slate-50/78 dark:bg-slate-950/78';

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* Calm Homepage Background Layer (Static or Slideshow) */}
      {showHomepageWallpaper && activeWallpaper && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        >
          <img
            key={activeWallpaper.id}
            src={activeWallpaper.src}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          />
          <div className={`absolute inset-0 backdrop-blur-[2px] ${scrimClass}`} />
        </div>
      )}

      <div className="relative z-10 min-h-screen flex flex-col">
        <TopBar
          activeView={activeView}
          canStartDrill={canStartDrill}
          canStartFlashcards={canStartFlashcards}
          savedDecksCount={savedDecks.length}
          onOpenAppearance={() => setIsAppearanceOpen(true)}
          onOpenKeymap={() => setIsKeymapOpen(true)}
          onNavigateSetup={() => setActiveView('setup')}
          onNavigateDecks={() => setActiveView('decks')}
          onNavigateFlashcards={() => {
            if (canStartFlashcards) {
              void launchFlashcards(
                parsedDeck.pairs,
                activeDeckName ?? 'Current Deck',
                activeSavedDeckId
              );
            }
          }}
          onPrimaryAction={handlePrimaryHeaderAction}
        />

        {activeView === 'setup' && (
          <DeckSetupView
            rawText={rawText}
            delimiterOption={delimiterOption}
            customDelimiter={customDelimiter}
            parsedDeck={parsedDeck}
            sessionConfig={sessionConfig}
            activeDeckName={activeDeckName}
            onChangeRawText={(text) => {
              setRawText(text);
            }}
            onChangeDelimiter={setDelimiterOption}
            onChangeCustomDelimiter={setCustomDelimiter}
            onLoadSampleDeck={() => {
              setDelimiterOption(DelimiterOption.TAB);
              setRawText(SAMPLE_DECK_RAW);
              setActiveSavedDeckId(null);
              setActiveDeckName('Sample Core 20');
            }}
            onSaveDeckToLibrary={handleSaveCurrentDeckToLibrary}
            onUpdateSessionConfig={setSessionConfig}
            onStartDrill={() => {
              if (canStartDrill) launchDrill(parsedDeck.pairs);
            }}
            onStartFlashcards={() => {
              if (canStartFlashcards) {
                void launchFlashcards(
                  parsedDeck.pairs,
                  activeDeckName ?? 'Current Deck',
                  activeSavedDeckId
                );
              }
            }}
            onOpenModelInfo={() => setIsModelModalOpen(true)}
          />
        )}

        {activeView === 'decks' && (
          <MyDecksView
            decks={savedDecks}
            flashcardsByDeckKey={flashcardsByDeckKey}
            currentRawText={rawText}
            currentDelimiterOption={delimiterOption}
            currentCustomDelimiter={customDelimiter}
            currentPairCount={parsedDeck.pairs.length}
            onSaveCurrentDeck={handleSaveCurrentDeckToLibrary}
            onImportDeckFile={handleImportDeckFileToLibrary}
            onLoadDeckToEditor={handleLoadDeckToEditor}
            onStartDrillFromDeck={handleStartDrillFromSavedDeck}
            onStartFlashcardsFromDeck={handleStartFlashcardsFromSavedDeck}
            onRenameDeck={handleRenameSavedDeck}
            onDeleteDeck={handleDeleteSavedDeck}
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

        {activeView === 'flashcards' && (
          <FlashcardStage
            deckTitle={flashcardDeckTitle}
            cards={flashcardCards}
            isModalOpen={isModalOpen}
            onUpdateCards={handleUpdateFlashcards}
            onResetProgress={handleResetFlashcardProgress}
            onDrillLapsedWords={(pairs) => handleDrillWeakWords(pairs)}
            onBackToSetup={() => setActiveView('setup')}
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
      </div>

      <AppearanceModal
        isOpen={isAppearanceOpen}
        config={appearance}
        wallpapers={allWallpapers}
        onUpdateConfig={handleUpdateAppearance}
        onUploadWallpaper={handleUploadWallpaper}
        onDeleteWallpaper={handleDeleteWallpaper}
        onClose={() => setIsAppearanceOpen(false)}
      />

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
