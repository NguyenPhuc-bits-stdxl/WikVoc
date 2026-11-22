import { KeyMapConfig } from '@/src/types/vocab';

const KEYMAP_STORAGE_KEY = 'cadence_vocab_keymap_v1';

export const DEFAULT_KEYMAP: KeyMapConfig = {
  opt1: '1',
  opt2: '2',
  opt3: '3',
  opt4: '4',
  right1: 'q',
  right2: 'w',
  right3: 'e',
  right4: 'r',
  commit: 'Enter',
  next: 'Enter',
  hint: 'Tab',
};

export function loadKeyMap(): KeyMapConfig {
  try {
    const raw = window.localStorage.getItem(KEYMAP_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYMAP };
    const parsed = JSON.parse(raw) as Partial<KeyMapConfig>;
    return {
      opt1: typeof parsed.opt1 === 'string' && parsed.opt1 ? parsed.opt1 : DEFAULT_KEYMAP.opt1,
      opt2: typeof parsed.opt2 === 'string' && parsed.opt2 ? parsed.opt2 : DEFAULT_KEYMAP.opt2,
      opt3: typeof parsed.opt3 === 'string' && parsed.opt3 ? parsed.opt3 : DEFAULT_KEYMAP.opt3,
      opt4: typeof parsed.opt4 === 'string' && parsed.opt4 ? parsed.opt4 : DEFAULT_KEYMAP.opt4,
      right1: typeof parsed.right1 === 'string' && parsed.right1 ? parsed.right1 : DEFAULT_KEYMAP.right1,
      right2: typeof parsed.right2 === 'string' && parsed.right2 ? parsed.right2 : DEFAULT_KEYMAP.right2,
      right3: typeof parsed.right3 === 'string' && parsed.right3 ? parsed.right3 : DEFAULT_KEYMAP.right3,
      right4: typeof parsed.right4 === 'string' && parsed.right4 ? parsed.right4 : DEFAULT_KEYMAP.right4,
      commit: typeof parsed.commit === 'string' && parsed.commit ? parsed.commit : DEFAULT_KEYMAP.commit,
      next: typeof parsed.next === 'string' && parsed.next ? parsed.next : DEFAULT_KEYMAP.next,
      hint: typeof parsed.hint === 'string' && parsed.hint ? parsed.hint : DEFAULT_KEYMAP.hint,
    };
  } catch {
    return { ...DEFAULT_KEYMAP };
  }
}

export function saveKeyMap(config: KeyMapConfig): void {
  try {
    window.localStorage.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}

export function normalizeEventKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toLowerCase();
  return key;
}

export function formatKeyLabel(key: string): string {
  if (key === 'Space' || key === ' ') return 'Space';
  if (key === 'Enter') return 'Enter';
  if (key === 'Tab') return 'Tab';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function matchesMappedKey(eventKey: string, mappedKey: string): boolean {
  return normalizeEventKey(eventKey) === normalizeEventKey(mappedKey);
}
