import React from 'react';
import { Moon, Sun } from 'lucide-react';

export type AppView = 'setup' | 'drill' | 'summary';

interface TopBarProps {
  activeView: AppView;
  isDark: boolean;
  canStartDrill: boolean;
  onToggleTheme: () => void;
  onOpenKeymap: () => void;
  onOpenModelInfo: () => void;
  onNavigateSetup: () => void;
  onPrimaryAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  isDark,
  canStartDrill,
  onToggleTheme,
  onOpenKeymap,
  onOpenModelInfo,
  onNavigateSetup,
  onPrimaryAction,
}) => {
  const primaryLabel =
    activeView === 'setup'
      ? 'Start Drill'
      : activeView === 'drill'
      ? 'Finish Drill'
      : 'New Deck';

  const isPrimaryDisabled = activeView === 'setup' && !canStartDrill;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/90 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={onNavigateSetup}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
        >
          Cadence Vocab
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={onNavigateSetup}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              activeView === 'setup'
                ? 'border-cyan-600 dark:border-cyan-400 text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Deck Setup
          </button>
          <button
            type="button"
            onClick={onOpenKeymap}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
          >
            Keybinds
          </button>
          <button
            type="button"
            onClick={onOpenModelInfo}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
          >
            Adaptive Model
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </nav>

        {/* Zone 3: Single primary action (+ compact mobile controls) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenKeymap}
            className="md:hidden px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Keys
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 shrink-0 cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            disabled={isPrimaryDisabled}
            onClick={onPrimaryAction}
            className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
