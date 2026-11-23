import React from 'react';
import { Palette } from 'lucide-react';

export type AppView = 'setup' | 'decks' | 'drill' | 'flashcards' | 'summary';

interface TopBarProps {
  activeView: AppView;
  canStartDrill: boolean;
  canStartFlashcards: boolean;
  savedDecksCount: number;
  onOpenAppearance: () => void;
  onOpenKeymap: () => void;
  onNavigateSetup: () => void;
  onNavigateDecks: () => void;
  onNavigateFlashcards: () => void;
  onPrimaryAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  canStartDrill,
  canStartFlashcards,
  savedDecksCount,
  onOpenAppearance,
  onOpenKeymap,
  onNavigateSetup,
  onNavigateDecks,
  onNavigateFlashcards,
  onPrimaryAction,
}) => {
  const primaryLabel =
    activeView === 'setup' || activeView === 'decks'
      ? 'Start Drill'
      : activeView === 'drill'
      ? 'Finish Drill'
      : activeView === 'flashcards'
      ? 'Back to Setup'
      : 'New Deck';

  const isPrimaryDisabled =
    (activeView === 'setup' || activeView === 'decks') && !canStartDrill;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/90 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={onNavigateSetup}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
        >
          WikVoc
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={onNavigateSetup}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeView === 'setup'
                ? 'wv-border-accent text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Setup
          </button>
          <button
            type="button"
            onClick={onNavigateDecks}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeView === 'decks'
                ? 'wv-border-accent text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            My Decks{savedDecksCount > 0 ? ` (${savedDecksCount})` : ''}
          </button>
          <button
            type="button"
            disabled={!canStartFlashcards}
            onClick={onNavigateFlashcards}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeView === 'flashcards'
                ? 'wv-border-accent text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Flashcards
          </button>
          <button
            type="button"
            onClick={onOpenAppearance}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 wv-text-accent" />
            <span>Appearance</span>
          </button>
          <button
            type="button"
            onClick={onOpenKeymap}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            Keybinds
          </button>
        </nav>

        {/* Zone 3: Single primary action (+ compact mobile shortcuts) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateDecks}
            className="md:hidden px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Decks
          </button>
          <button
            type="button"
            disabled={!canStartFlashcards}
            onClick={onNavigateFlashcards}
            className="md:hidden px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
          >
            Cards
          </button>
          <button
            type="button"
            onClick={onOpenAppearance}
            aria-label="Appearance settings"
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 shrink-0 cursor-pointer"
          >
            <Palette className="w-4 h-4 wv-text-accent" />
          </button>
          <button
            type="button"
            disabled={isPrimaryDisabled}
            onClick={onPrimaryAction}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed wv-btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
