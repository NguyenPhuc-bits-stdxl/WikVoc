import { DelimiterOption, ParsedDeckResult, VocabPair } from '@/src/types/vocab';

export function resolveDelimiter(option: DelimiterOption, customString: string): string {
  switch (option) {
    case DelimiterOption.TAB:
      return '\t';
    case DelimiterOption.COMMA:
      return ',';
    case DelimiterOption.SEMICOLON:
      return ';';
    case DelimiterOption.CUSTOM:
      return customString;
  }
}

export function parseDeckText(
  rawText: string,
  delimiterOption: DelimiterOption,
  customDelimiter: string
): ParsedDeckResult {
  const delimiter = resolveDelimiter(delimiterOption, customDelimiter);
  const lines = rawText.split(/\r?\n/);
  const pairs: VocabPair[] = [];
  const skippedLines: { lineNumber: number; raw: string; reason: string }[] = [];
  const seenTerms = new Set<string>();

  if (!delimiter) {
    return {
      pairs: [],
      skippedLines: [{ lineNumber: 1, raw: '', reason: 'Enter a custom delimiter string.' }],
      totalLines: lines.length,
    };
  }

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    const delimIndex = trimmed.indexOf(delimiter);
    if (delimIndex === -1) {
      skippedLines.push({
        lineNumber: idx + 1,
        raw: trimmed,
        reason: 'Missing delimiter',
      });
      return;
    }

    const term = trimmed.slice(0, delimIndex).trim();
    const def = trimmed.slice(delimIndex + delimiter.length).trim();

    if (!term || !def) {
      skippedLines.push({
        lineNumber: idx + 1,
        raw: trimmed,
        reason: !term ? 'Empty term' : 'Empty definition',
      });
      return;
    }

    const normalizedKey = term.toLowerCase();
    if (seenTerms.has(normalizedKey)) {
      skippedLines.push({
        lineNumber: idx + 1,
        raw: trimmed,
        reason: 'Duplicate term',
      });
      return;
    }

    seenTerms.add(normalizedKey);
    pairs.push({
      id: `item_${idx + 1}_${normalizedKey.replace(/[^a-z0-9]/g, '').slice(0, 12)}`,
      term,
      def,
    });
  });

  return {
    pairs,
    skippedLines,
    totalLines: lines.length,
  };
}
