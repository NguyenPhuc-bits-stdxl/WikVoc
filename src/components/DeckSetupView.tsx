import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  Play,
  ArrowRight,
  BookmarkPlus,
  Check,
  Layers,
  Brain,
} from 'lucide-react';
import {
  DelimiterOption,
  DifficultyMode,
  DrillDirection,
  ParsedDeckResult,
  SessionConfig,
  SessionMode,
} from '@/src/types/vocab';

interface DeckSetupViewProps {
  rawText: string;
  delimiterOption: DelimiterOption;
  customDelimiter: string;
  parsedDeck: ParsedDeckResult;
  sessionConfig: SessionConfig;
  activeDeckName: string | null;
  onChangeRawText: (text: string) => void;
  onChangeDelimiter: (option: DelimiterOption) => void;
  onChangeCustomDelimiter: (delim: string) => void;
  onLoadSampleDeck: () => void;
  onSaveDeckToLibrary: (name: string) => Promise<void>;
  onUpdateSessionConfig: (next: SessionConfig) => void;
  onStartDrill: () => void;
  onStartFlashcards: () => void;
  onOpenModelInfo: () => void;
}

const DELIMITER_OPTIONS: { id: DelimiterOption; label: string }[] = [
  { id: DelimiterOption.TAB, label: 'Tab (\\t)' },
  { id: DelimiterOption.COMMA, label: 'Comma (,)' },
  { id: DelimiterOption.SEMICOLON, label: 'Semicolon (;)' },
  { id: DelimiterOption.CUSTOM, label: 'Custom' },
];

const TIME_PRESETS = [2, 3, 5, 10];

export const DeckSetupView: React.FC<DeckSetupViewProps> = ({
  rawText,
  delimiterOption,
  customDelimiter,
  parsedDeck,
  sessionConfig,
  activeDeckName,
  onChangeRawText,
  onChangeDelimiter,
  onChangeCustomDelimiter,
  onLoadSampleDeck,
  onSaveDeckToLibrary,
  onUpdateSessionConfig,
  onStartDrill,
  onStartFlashcards,
  onOpenModelInfo,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const validCount = parsedDeck.pairs.length;
  const minPromptCount = Math.max(2, validCount);
  const defaultPromptCount = Math.max(minPromptCount, Math.round(validCount * 1.5));
  const isCountInvalid =
    sessionConfig.mode === SessionMode.COUNT &&
    validCount >= 2 &&
    sessionConfig.targetCount < minPromptCount;
  const canStart = validCount >= 2 && !isCountInvalid;

  const dynamicCountPresets = Array.from(
    new Set([minPromptCount, defaultPromptCount, minPromptCount * 2])
  ).sort((a, b) => a - b);

  const handleFile = async (file: File) => {
    setFileError(null);
    if (!file.name.endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
      setFileError('Please upload a plain .txt vocabulary file.');
      return;
    }
    try {
      const content = await file.text();
      onChangeRawText(content);
    } catch {
      setFileError('Could not read the selected file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleSaveCurrentDeck = async () => {
    if (validCount < 2) return;
    const chosenName =
      saveNameInput.trim() || activeDeckName || `Deck (${validCount} words)`;
    await onSaveDeckToLibrary(chosenName);
    setSaveNameInput('');
    setSavedNotice(`Saved "${chosenName}" to My Decks`);
    window.setTimeout(() => setSavedNotice(null), 2600);
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
          Fast-paced vocabulary drills calibrated to your focus
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Paste two columns from Excel or Quizlet, load a saved deck, or study with spaced repetition flashcards at your own pace.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Zone: Data Input & Live Preview */}
        <section className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Vocabulary Source
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeDeckName ? `Editing: ${activeDeckName} · ` : ''}Two columns per line: Term and Definition
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLoadSampleDeck}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500/70 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Load Sample Deck (20 words)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500/70 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .txt</span>
                </button>
                {rawText.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeRawText('')}
                    aria-label="Clear deck text"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* Delimiter Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Delimiter
              </span>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {DELIMITER_OPTIONS.map((opt) => {
                  const active = delimiterOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeDelimiter(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {delimiterOption === DelimiterOption.CUSTOM && (
                <input
                  type="text"
                  value={customDelimiter}
                  onChange={(e) => onChangeCustomDelimiter(e.target.value)}
                  placeholder="e.g. :: or  - "
                  aria-label="Custom delimiter string"
                  className="w-32 px-3 py-1.5 rounded-lg font-mono text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              )}
            </div>

            {fileError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Textarea with drag-and-drop support */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-lg transition-colors ${
                isDragging ? 'ring-2 ring-cyan-500 bg-cyan-500/5' : ''
              }`}
            >
              <textarea
                value={rawText}
                onChange={(e) => onChangeRawText(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={`Paste Term and Definition pairs here (or drop a .txt file)...\nephemeral\tlasting for a very short time\nubiquitous\tpresent, appearing, or found everywhere`}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-3 font-mono text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y leading-relaxed"
              />
            </div>

            {/* Live Validation Summary Line (Zero-pill clean text) */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <div className="flex items-center gap-2 tabular-nums">
                <span
                  className={
                    validCount >= 2
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'font-medium text-amber-600 dark:text-amber-400'
                  }
                >
                  {validCount} {validCount === 1 ? 'pair' : 'pairs'} ready
                </span>
                {parsedDeck.skippedLines.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setShowSkipped((prev) => !prev)}
                      className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {parsedDeck.skippedLines.length} skipped (view)
                    </button>
                  </>
                )}
              </div>
              <span>
                {validCount > 0 && validCount < 3
                  ? 'Add at least 3 pairs to unlock Columns matching'
                  : 'Empty lines are ignored automatically'}
              </span>
            </div>

            {showSkipped && parsedDeck.skippedLines.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1 max-h-36 overflow-y-auto text-xs">
                {parsedDeck.skippedLines.map((item) => (
                  <div
                    key={`${item.lineNumber}_${item.raw}`}
                    className="flex items-center justify-between gap-3 text-amber-700 dark:text-amber-300 font-mono"
                  >
                    <span className="truncate">
                      Line {item.lineNumber}: {item.raw || '(empty)'}
                    </span>
                    <span className="shrink-0 text-amber-600 dark:text-amber-400">
                      {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Save to My Decks */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                type="text"
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder={activeDeckName || 'Deck name to save in My Decks...'}
                disabled={validCount < 2}
                className="flex-1 px-3 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={validCount < 2}
                onClick={() => void handleSaveCurrentDeck()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{savedNotice}</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5 wv-text-accent" />
                    <span>Save to My Decks</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Preview Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Parsed Preview
              </h3>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {validCount} items
              </span>
            </div>
            {validCount === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No valid Term / Definition pairs parsed yet. Paste lines above or load the 20-word sample deck.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 pl-5 pr-3 font-medium w-12">#</th>
                      <th className="py-2.5 px-3 font-medium w-1/3">Term</th>
                      <th className="py-2.5 pl-3 pr-5 font-medium">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {parsedDeck.pairs.map((pair, idx) => (
                      <tr
                        key={pair.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 pl-5 pr-3 font-mono text-xs text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {pair.term}
                        </td>
                        <td className="py-2.5 pl-3 pr-5 text-slate-600 dark:text-slate-300">
                          {pair.def}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right Zone: Drill Configuration */}
        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Session Pacing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Low-pressure cadence — finish at your own rhythm
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="space-y-2.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Session Mode
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSessionConfig({ ...sessionConfig, mode: SessionMode.COUNT })
                  }
                  className={`py-2 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sessionConfig.mode === SessionMode.COUNT
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Prompt Count
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSessionConfig({ ...sessionConfig, mode: SessionMode.TIME })
                  }
                  className={`py-2 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sessionConfig.mode === SessionMode.TIME
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Calm Timer
                </button>
              </div>
            </div>

            {/* Target Value Selector */}
            {sessionConfig.mode === SessionMode.COUNT ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="target-count-input"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Target Prompts
                  </label>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    Min {minPromptCount} (1×) · Default {defaultPromptCount} (1.5×)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {dynamicCountPresets.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          onUpdateSessionConfig({ ...sessionConfig, targetCount: n })
                        }
                        className={`px-3 py-1.5 rounded-md font-mono text-xs font-medium transition-colors cursor-pointer ${
                          sessionConfig.targetCount === n
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    id="target-count-input"
                    type="number"
                    min={minPromptCount}
                    max={500}
                    value={sessionConfig.targetCount || ''}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const val = Number.isFinite(raw) ? Math.min(500, Math.max(0, Math.floor(raw))) : minPromptCount;
                      onUpdateSessionConfig({ ...sessionConfig, targetCount: val });
                    }}
                    onBlur={() => {
                      if (sessionConfig.targetCount < minPromptCount) {
                        onUpdateSessionConfig({
                          ...sessionConfig,
                          targetCount: minPromptCount,
                        });
                      }
                    }}
                    className={`w-20 px-3 py-2 rounded-lg font-mono text-xs border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 tabular-nums ${
                      isCountInvalid
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-cyan-500'
                    }`}
                  />
                </div>
                {isCountInvalid && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    Must be at least {minPromptCount} prompts so every word in the deck can be covered.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="target-minutes-input"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Target Duration (minutes)
                  </label>
                  <span className="text-xs text-slate-400">
                    Finish active prompt cleanly on expiry
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {TIME_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          onUpdateSessionConfig({ ...sessionConfig, targetMinutes: m })
                        }
                        className={`px-3 py-1.5 rounded-md font-mono text-xs font-medium transition-colors cursor-pointer ${
                          sessionConfig.targetMinutes === m
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <input
                    id="target-minutes-input"
                    type="number"
                    min={1}
                    max={60}
                    value={sessionConfig.targetMinutes}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(60, Number(e.target.value) || 3));
                      onUpdateSessionConfig({ ...sessionConfig, targetMinutes: val });
                    }}
                    className="w-20 px-3 py-2 rounded-lg font-mono text-xs border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Direction Toggle */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Prompt Direction
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {[
                  { id: DrillDirection.DEF_TO_TERM, label: 'Def → Term' },
                  { id: DrillDirection.TERM_TO_DEF, label: 'Term → Def' },
                  { id: DrillDirection.MIXED, label: 'Mixed' },
                ].map((dir) => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() =>
                      onUpdateSessionConfig({ ...sessionConfig, direction: dir.id })
                    }
                    className={`py-2 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      sessionConfig.direction === dir.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sessionConfig.direction === DrillDirection.DEF_TO_TERM
                  ? 'Recommended: unlocks Progressive Cloze recall as mastery grows.'
                  : sessionConfig.direction === DrillDirection.MIXED
                  ? 'Alternates recognition directions and activates Cloze for Term recall.'
                  : 'Focuses on rapid Term-to-Definition recognition via MCQ & Columns.'}
              </p>
            </div>

            {/* Difficulty Mode Toggle */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Difficulty Mode
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {[
                  { id: DifficultyMode.ADAPTIVE, label: 'Adaptive' },
                  { id: DifficultyMode.LAZY, label: 'Lazy (MCQ)' },
                  { id: DifficultyMode.EXTREME, label: 'Extreme' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      onUpdateSessionConfig({ ...sessionConfig, difficulty: mode.id })
                    }
                    className={`py-2 px-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      sessionConfig.difficulty === mode.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sessionConfig.difficulty === DifficultyMode.ADAPTIVE
                  ? 'Balanced progression from MCQ & Columns into Cloze with fatigue softening.'
                  : sessionConfig.difficulty === DifficultyMode.LAZY
                  ? 'MCQ-only recognition mode with adaptive spacing & lookalike traps.'
                  : 'Mixes MCQ & Columns initially, then escalates correct words straight into heavy-blank Cloze.'}
              </p>
            </div>

            {/* How Progression Works (compact) */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              {sessionConfig.difficulty === DifficultyMode.LAZY ? (
                <div className="flex items-center justify-between">
                  <span>All Mastery Levels</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">MCQ Only</span>
                </div>
              ) : sessionConfig.difficulty === DifficultyMode.EXTREME ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Unseen / Missed</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">MCQ / Columns</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>After First Clean Recall</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      1st-Letter / Blind Cloze
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span>Low Mastery (M &lt; 0.40)</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">MCQ / Columns</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mid Mastery (0.40 – 0.69)</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">Cloze Level 1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>High Mastery (M ≥ 0.70)</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">Cloze Level 2–3</span>
                  </div>
                </>
              )}
            </div>

            {/* Primary Actions: Adaptive Drill & Spaced Repetition Flashcards */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={!canStart}
                onClick={onStartDrill}
                className="w-full py-3 px-5 rounded-xl font-display text-sm font-semibold inline-flex items-center justify-center gap-2 wv-btn-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Adaptive Drill</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={validCount < 1}
                onClick={onStartFlashcards}
                className="w-full py-2.5 px-5 rounded-xl font-display text-sm font-semibold inline-flex items-center justify-center gap-2 border wv-border-accent wv-bg-accent-soft text-slate-900 dark:text-slate-100 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Layers className="w-4 h-4 wv-text-accent" />
                <span>Study with Flashcards (Spaced Repetition)</span>
              </button>
            </div>

            {validCount < 2 && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                Load or paste at least 2 valid pairs to start an Adaptive Drill.
              </p>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <button
                type="button"
                onClick={onOpenModelInfo}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 wv-text-accent" />
                <span>How Adaptive Model &amp; k-Vector Work</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};
