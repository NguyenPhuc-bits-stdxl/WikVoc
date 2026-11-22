import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, CornerDownLeft, Lightbulb, XCircle } from 'lucide-react';
import {
  ClozeQuestion,
  CommitPayload,
  ConfidenceLevel,
  KeyMapConfig,
  PromptEvaluation,
} from '@/src/types/vocab';
import { formatKeyLabel, matchesMappedKey } from '@/src/utils/keymapStorage';
import { ConfidenceSlider } from './ConfidenceSlider';

interface ClozePromptProps {
  question: ClozeQuestion;
  keymap: KeyMapConfig;
  evaluation: PromptEvaluation | null;
  isModalOpen: boolean;
  onCommit: (payload: CommitPayload) => void;
}

const TYPING_SLIP_THRESHOLD_MS = 260;

export const ClozePrompt: React.FC<ClozePromptProps> = ({
  question,
  keymap,
  evaluation,
  isModalOpen,
  onCommit,
}) => {
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [hintedIndices, setHintedIndices] = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState<ConfidenceLevel>(ConfidenceLevel.HIGH);
  const [activeBlankPos, setActiveBlankPos] = useState<number>(0);
  const [stageChanges, setStageChanges] = useState<number>(0);
  const [filteredSlips, setFilteredSlips] = useState<number>(0);
  const [incompleteWarning, setIncompleteWarning] = useState<boolean>(false);

  const revealedCursorRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const firstActionMsRef = useRef<number | null>(null);
  const lastCharTypedAtRef = useRef<number>(0);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFilled({});
    setHintedIndices(new Set());
    setConfidence(ConfidenceLevel.HIGH);
    setActiveBlankPos(0);
    setStageChanges(0);
    setFilteredSlips(0);
    setIncompleteWarning(false);
    revealedCursorRef.current = 0;
    startTimeRef.current = performance.now();
    firstActionMsRef.current = null;
    lastCharTypedAtRef.current = 0;
    if (!isModalOpen) {
      setTimeout(() => hiddenInputRef.current?.focus(), 20);
    }
  }, [question, isModalOpen]);

  const markFirstAction = () => {
    const now = performance.now();
    if (firstActionMsRef.current === null) {
      firstActionMsRef.current = Math.round(now - startTimeRef.current);
    }
    return now;
  };

  const findNextEditableBlankPos = (
    fromPos: number,
    nextFilled: Record<number, string>,
    nextHinted: Set<number>
  ): number => {
    for (let p = fromPos; p < question.blankIndices.length; p++) {
      const idx = question.blankIndices[p];
      if (!nextHinted.has(idx) && !nextFilled[idx]) {
        return p;
      }
    }
    for (let p = 0; p < fromPos; p++) {
      const idx = question.blankIndices[p];
      if (!nextHinted.has(idx) && !nextFilled[idx]) {
        return p;
      }
    }
    return question.blankIndices.length;
  };

  const handleCharInput = (rawChar: string) => {
    if (evaluation) return;
    if (!/^[a-zA-Z0-9]$/.test(rawChar)) return;

    const now = markFirstAction();
    setIncompleteWarning(false);
    const ch = rawChar;
    const chLower = ch.toLowerCase();

    while (
      revealedCursorRef.current < question.targetTerm.length &&
      !/[a-zA-Z0-9]/.test(question.targetTerm[revealedCursorRef.current])
    ) {
      revealedCursorRef.current += 1;
    }

    const currentBlankIdx =
      activeBlankPos < question.blankIndices.length
        ? question.blankIndices[activeBlankPos]
        : question.targetTerm.length;

    if (revealedCursorRef.current < currentBlankIdx) {
      const expectedRevealed = question.targetTerm[revealedCursorRef.current].toLowerCase();
      if (chLower === expectedRevealed) {
        revealedCursorRef.current += 1;
        lastCharTypedAtRef.current = now;
        return;
      }
    }

    if (activeBlankPos >= question.blankIndices.length) {
      if (
        revealedCursorRef.current < question.targetTerm.length &&
        chLower === question.targetTerm[revealedCursorRef.current].toLowerCase()
      ) {
        revealedCursorRef.current += 1;
      }
      return;
    }

    const targetBlankIdx = question.blankIndices[activeBlankPos];
    if (hintedIndices.has(targetBlankIdx)) {
      const nextPos = findNextEditableBlankPos(activeBlankPos + 1, filled, hintedIndices);
      setActiveBlankPos(nextPos);
      return;
    }

    if (filled[targetBlankIdx]) {
      setStageChanges((c) => c + 1);
    }

    const nextFilled = { ...filled, [targetBlankIdx]: ch };
    setFilled(nextFilled);
    lastCharTypedAtRef.current = now;
    revealedCursorRef.current = targetBlankIdx + 1;

    const nextPos = findNextEditableBlankPos(activeBlankPos + 1, nextFilled, hintedIndices);
    setActiveBlankPos(nextPos);
  };

  const handleBackspace = () => {
    if (evaluation) return;
    const now = markFirstAction();
    setIncompleteWarning(false);

    let posToClear = -1;
    if (
      activeBlankPos < question.blankIndices.length &&
      filled[question.blankIndices[activeBlankPos]] &&
      !hintedIndices.has(question.blankIndices[activeBlankPos])
    ) {
      posToClear = activeBlankPos;
    } else {
      for (let p = Math.min(activeBlankPos - 1, question.blankIndices.length - 1); p >= 0; p--) {
        const idx = question.blankIndices[p];
        if (!hintedIndices.has(idx) && filled[idx]) {
          posToClear = p;
          break;
        }
      }
    }

    if (posToClear === -1) return;

    const sinceLastChar = lastCharTypedAtRef.current > 0 ? now - lastCharTypedAtRef.current : 9999;
    if (sinceLastChar < TYPING_SLIP_THRESHOLD_MS) {
      setFilteredSlips((s) => s + 1);
    } else {
      setStageChanges((c) => c + 1);
    }
    lastCharTypedAtRef.current = 0;

    const idxToClear = question.blankIndices[posToClear];
    setFilled((prev) => {
      const next = { ...prev };
      delete next[idxToClear];
      return next;
    });
    setActiveBlankPos(posToClear);
    revealedCursorRef.current = idxToClear;
  };

  const handleRevealHint = () => {
    if (evaluation) return;
    markFirstAction();
    setIncompleteWarning(false);

    const candidatePos = question.blankIndices.findIndex((idx) => {
      if (hintedIndices.has(idx)) return false;
      const typed = filled[idx]?.toLowerCase();
      return !typed || typed !== question.targetTerm[idx].toLowerCase();
    });

    if (candidatePos === -1) return;

    const targetIdx = question.blankIndices[candidatePos];
    const nextHinted = new Set(hintedIndices);
    nextHinted.add(targetIdx);

    const nextFilled = { ...filled, [targetIdx]: question.targetTerm[targetIdx] };
    setHintedIndices(nextHinted);
    setFilled(nextFilled);
    setStageChanges((c) => c + 1);

    const nextPos = findNextEditableBlankPos(0, nextFilled, nextHinted);
    setActiveBlankPos(nextPos);
    revealedCursorRef.current = targetIdx + 1;
    hiddenInputRef.current?.focus();
  };

  const emptyBlankPositions = question.blankIndices
    .map((idx, pos) => ({ idx, pos }))
    .filter(({ idx }) => !filled[idx] || filled[idx].trim().length === 0);

  const allBlanksFilled = emptyBlankPositions.length === 0;

  const handleCommit = () => {
    if (evaluation) return;

    if (!allBlanksFilled) {
      setIncompleteWarning(true);
      const firstEmpty = emptyBlankPositions[0];
      if (firstEmpty) {
        setActiveBlankPos(firstEmpty.pos);
        revealedCursorRef.current = firstEmpty.idx;
      }
      hiddenInputRef.current?.focus();
      return;
    }

    const totalMs = Math.max(250, Math.round(performance.now() - startTimeRef.current));
    const firstMs = firstActionMsRef.current ?? totalMs;

    let correctCount = 0;
    for (const idx of question.blankIndices) {
      if (hintedIndices.has(idx)) continue;
      const typed = (filled[idx] ?? '').toLowerCase();
      if (typed === question.targetTerm[idx].toLowerCase()) {
        correctCount += 1;
      }
    }

    const score =
      question.blankIndices.length > 0 ? correctCount / question.blankIndices.length : 1.0;

    onCommit({
      perItemScores: [{ itemId: question.primaryItemId, score }],
      commitTimeMs: totalMs,
      firstActionLatencyMs: firstMs,
      stageChanges,
      filteredSlips,
      hintsUsed: hintedIndices.size,
      confidence,
    });
  };

  useEffect(() => {
    if (evaluation || isModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (matchesMappedKey(e.key, keymap.commit)) {
        e.preventDefault();
        handleCommit();
        return;
      }

      if (matchesMappedKey(e.key, keymap.hint) || e.key === '/') {
        e.preventDefault();
        handleRevealHint();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveBlankPos((prev) => Math.max(0, prev - 1));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveBlankPos((prev) => Math.min(question.blankIndices.length - 1, prev + 1));
        return;
      }

      if (
        document.activeElement !== hiddenInputRef.current &&
        e.key.length === 1 &&
        /^[a-zA-Z0-9]$/.test(e.key)
      ) {
        e.preventDefault();
        handleCharInput(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const blankPosLookup = new Map<number, number>();
  question.blankIndices.forEach((slotIdx, pos) => blankPosLookup.set(slotIdx, pos));

  const remainingHintsAvailable = question.blankIndices.some(
    (idx) =>
      !hintedIndices.has(idx) &&
      (!filled[idx] || filled[idx].toLowerCase() !== question.targetTerm[idx].toLowerCase())
  );

  const totalLetterSlots = question.slots.filter((s) => !s.isSeparator).length;
  const revealedAnchorCount = totalLetterSlots - question.blankIndices.length;
  const clozeVariantLabel =
    revealedAnchorCount === 0
      ? `Blind Cloze (0 anchors · ${question.blankIndices.length} blanks)`
      : revealedAnchorCount === 1 && question.blankIndices.length >= 2
      ? `1st-Letter Cloze (1 anchor · ${question.blankIndices.length} blanks)`
      : `Progressive Cloze · Level ${question.level} (${question.blankIndices.length} blanks)`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{clozeVariantLabel}</span>
          <span className="font-mono tabular-nums">
            Item Mastery {Math.round(question.masteryBefore * 100)}%
          </span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100 leading-snug text-balance">
          {question.promptDef}
        </h2>
      </div>

      {/* Character Slot Stage */}
      <div
        onClick={() => hiddenInputRef.current?.focus()}
        className={`relative rounded-xl border p-6 sm:p-8 cursor-text transition-colors ${
          incompleteWarning
            ? 'border-amber-500/60 bg-amber-500/5'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70'
        }`}
      >
        <input
          ref={hiddenInputRef}
          type="text"
          value=""
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Type missing letters or full term"
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              for (const ch of val) {
                handleCharInput(ch);
              }
            }
          }}
          className="sr-only"
        />

        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {question.slots.map((slot) => {
            if (slot.isSeparator) {
              return (
                <span
                  key={slot.index}
                  className="font-mono text-xl sm:text-2xl font-semibold text-slate-400 dark:text-slate-500 px-1"
                >
                  {slot.char === ' ' ? '\u00A0\u00A0' : slot.char}
                </span>
              );
            }

            if (!slot.isBlank) {
              return (
                <span
                  key={slot.index}
                  className="w-8 sm:w-10 h-11 sm:h-12 flex items-center justify-center font-mono text-xl sm:text-2xl font-semibold text-slate-800 dark:text-slate-200 select-none"
                >
                  {slot.char}
                </span>
              );
            }

            const blankPos = blankPosLookup.get(slot.index) ?? 0;
            const isActive = !evaluation && blankPos === activeBlankPos;
            const isHinted = hintedIndices.has(slot.index);
            const userChar = filled[slot.index] ?? '';
            const isCorrectChar =
              !isHinted && userChar.toLowerCase() === slot.char.toLowerCase();

            let slotClass =
              'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';

            if (!evaluation) {
              if (isHinted) {
                slotClass =
                  'border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-300';
              } else if (isActive) {
                slotClass =
                  'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 ring-2 ring-cyan-500/30';
              } else if (userChar) {
                slotClass =
                  'border-cyan-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';
              } else if (incompleteWarning) {
                slotClass =
                  'border-amber-500/70 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';
              }
            } else {
              if (isHinted) {
                slotClass =
                  'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300';
              } else if (isCorrectChar) {
                slotClass =
                  'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
              } else {
                slotClass =
                  'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300';
              }
            }

            return (
              <div key={slot.index} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={Boolean(evaluation) || isHinted}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveBlankPos(blankPos);
                    revealedCursorRef.current = slot.index;
                    hiddenInputRef.current?.focus();
                  }}
                  className={`w-9 sm:w-11 h-11 sm:h-12 rounded-lg border-2 font-mono text-xl sm:text-2xl font-semibold flex items-center justify-center transition-all cursor-pointer disabled:cursor-default ${slotClass}`}
                >
                  {userChar ? (
                    <span>{userChar}</span>
                  ) : isActive ? (
                    <span className="w-0.5 h-5 bg-cyan-500" />
                  ) : (
                    <span className="text-slate-300 dark:text-slate-700">_</span>
                  )}
                </button>
                {evaluation && !isCorrectChar && !isHinted && (
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {slot.char}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {incompleteWarning && !evaluation && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Fill all remaining blanks before submitting ({emptyBlankPositions.length} left)
            </span>
          </div>
        )}

        {evaluation && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-3 text-sm">
            {evaluation.score >= 0.99 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Exact match: {question.targetTerm}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>
                  Target term:{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {question.targetTerm}
                  </strong>
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer + Self-Report Confidence Slider */}
      {!evaluation && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!remainingHintsAvailable}
                onClick={handleRevealHint}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500/70 hover:text-amber-600 dark:hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Reveal 1 Letter</span>
                <span className="font-mono text-[11px] opacity-75">
                  {formatKeyLabel(keymap.hint)} / /
                </span>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                Type missing letters or the full word · All blanks required
              </span>
            </div>

            <button
              type="button"
              disabled={!allBlanksFilled}
              onClick={handleCommit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>
                {allBlanksFilled
                  ? 'Submit Recall'
                  : `Fill ${emptyBlankPositions.length} More`}
              </span>
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span className="font-mono text-xs opacity-80">
                {formatKeyLabel(keymap.commit)}
              </span>
            </button>
          </div>

          <ConfidenceSlider value={confidence} onChange={setConfidence} />
        </div>
      )}
    </div>
  );
};
