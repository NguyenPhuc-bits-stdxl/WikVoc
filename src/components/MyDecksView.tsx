import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit3,
  FolderOpen,
  Layers,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DelimiterOption,
  FlashcardState,
  SavedDeckRecord,
} from '@/src/types/vocab';
import { parseDeckText } from '@/src/utils/deckParser';
import { summarizeFlashcardDeck } from '@/src/engine/flashcardEngine';
import { buildDeckSignatureKey } from '@/src/utils/deckStorage';

interface MyDecksViewProps {
  decks: SavedDeckRecord[];
  flashcardsByDeckKey: Record<string, FlashcardState[]>;
  currentRawText: string;
  currentDelimiterOption: DelimiterOption;
  currentCustomDelimiter: string;
  currentPairCount: number;
  onSaveCurrentDeck: (name: string) => Promise<void>;
  onImportDeckFile: (name: string, rawText: string) => Promise<void>;
  onLoadDeckToEditor: (deck: SavedDeckRecord) => void;
  onStartDrillFromDeck: (deck: SavedDeckRecord) => void;
  onStartFlashcardsFromDeck: (deck: SavedDeckRecord) => void;
  onRenameDeck: (id: string, newName: string) => Promise<void>;
  onDeleteDeck: (id: string) => Promise<void>;
}

function formatDelimiterLabel(opt: DelimiterOption, custom: string): string {
  if (opt === DelimiterOption.TAB) return 'Tab';
  if (opt === DelimiterOption.COMMA) return 'Comma';
  if (opt === DelimiterOption.SEMICOLON) return 'Semicolon';
  return `Custom (${custom || '?'})`;
}

function formatUpdatedDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export const MyDecksView: React.FC<MyDecksViewProps> = ({
  decks,
  flashcardsByDeckKey,
  currentRawText,
  currentDelimiterOption,
  currentCustomDelimiter,
  currentPairCount,
  onSaveCurrentDeck,
  onImportDeckFile,
  onLoadDeckToEditor,
  onStartDrillFromDeck,
  onStartFlashcardsFromDeck,
  onRenameDeck,
  onDeleteDeck,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPairCount < 2) return;
    const trimmed = newDeckName.trim() || `Deck (${currentPairCount} words)`;
    await onSaveCurrentDeck(trimmed);
    setNewDeckName('');
    setSaveNotice(`Saved "${trimmed}" locally.`);
    window.setTimeout(() => setSaveNotice(null), 2600);
  };

  const handleImportTxt = async (file: File) => {
    try {
      const content = await file.text();
      const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Imported Deck';
      await onImportDeckFile(baseName, content);
      setSaveNotice(`Imported "${baseName}" into My Decks.`);
      window.setTimeout(() => setSaveNotice(null), 2600);
    } catch {
      setSaveNotice('Could not read the selected file.');
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Decks
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Stored locally in your browser (IndexedDB &amp; localStorage) for instant reload into Adaptive Drills or Spaced Repetition Flashcards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          <span>Import .txt to Library</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportTxt(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Save Current Editor Deck Bar */}
      <form
        onSubmit={(e) => void handleSaveEditor(e)}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-0.5">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Save Current Setup Deck
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {currentPairCount >= 2
              ? `${currentPairCount} pairs currently loaded · ${formatDelimiterLabel(
                  currentDelimiterOption,
                  currentCustomDelimiter
                )}`
              : 'Paste at least 2 valid pairs in Deck Setup to save'}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:w-auto w-full">
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="Name this deck (e.g. GRE Core 20)"
            disabled={currentPairCount < 2 || !currentRawText.trim()}
            className="flex-1 sm:w-64 px-3.5 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={currentPairCount < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold wv-btn-primary transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Save Deck</span>
          </button>
        </div>
      </form>

      {saveNotice && (
        <div className="px-4 py-2.5 rounded-lg border wv-border-accent wv-bg-accent-soft text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Check className="w-4 h-4 wv-text-accent shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Saved Decks List */}
      {decks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 mx-auto text-slate-400" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              No saved decks yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Save the current vocabulary set above or import a .txt file so you can jump straight into Drills or Flashcards anytime.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {decks.map((deck) => {
            const parsed = parseDeckText(
              deck.rawText,
              deck.delimiterOption,
              deck.customDelimiter
            );
            const sigKey = buildDeckSignatureKey(parsed.pairs, deck.id);
            const fallbackSigKey = buildDeckSignatureKey(parsed.pairs, null);
            const savedCards =
              flashcardsByDeckKey[sigKey] ?? flashcardsByDeckKey[fallbackSigKey] ?? null;
            const srsStats = savedCards
              ? summarizeFlashcardDeck(savedCards)
              : null;

            const isEditing = editingId === deck.id;
            const isConfirmingDelete = confirmDeleteId === deck.id;

            return (
              <article
                key={deck.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 flex flex-col justify-between gap-5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editingName.trim()) {
                            void onRenameDeck(deck.id, editingName.trim());
                          }
                          setEditingId(null);
                        }}
                        className="flex-1 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded-md text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded-md text-xs font-semibold wv-btn-primary cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded-md text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {deck.name}
                      </h3>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(deck.id);
                            setEditingName(deck.name);
                          }}
                          aria-label={`Rename ${deck.name}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void onDeleteDeck(deck.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-1 rounded-md text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(deck.id)}
                            aria-label={`Delete ${deck.name}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Unboxed zero-pill metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{parsed.pairs.length} words</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDelimiterLabel(deck.delimiterOption, deck.customDelimiter)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Updated {formatUpdatedDate(deck.updatedAt)}</span>
                  </div>

                  {srsStats && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                      SRS Flashcards: {srsStats.dueCount} due · {srsStats.masteredCount}/{srsStats.total} mature
                    </p>
                  )}

                  {/* Quick 3-word preview */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {parsed.pairs
                      .slice(0, 4)
                      .map((p) => p.term)
                      .join(', ')}
                    {parsed.pairs.length > 4 ? '…' : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    disabled={parsed.pairs.length < 2}
                    onClick={() => onStartDrillFromDeck(deck)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold wv-btn-primary transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Drill</span>
                  </button>

                  <button
                    type="button"
                    disabled={parsed.pairs.length < 1}
                    onClick={() => onStartFlashcardsFromDeck(deck)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border wv-border-accent wv-bg-accent-soft text-slate-900 dark:text-slate-100 hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 wv-text-accent" />
                    <span>Flashcards</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLoadDeckToEditor(deck)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer ml-auto"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Load in Setup</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
};
