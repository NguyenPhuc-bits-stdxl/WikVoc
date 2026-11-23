import {
  FlashcardState,
  SavedDeckRecord,
  SavedWallpaperItem,
} from '@/src/types/vocab';

const DB_NAME = 'wikvoc_db';
const DB_VERSION = 1;
const STORE_DECKS = 'decks';
const STORE_WALLPAPERS = 'wallpapers';
const STORE_FLASHCARDS = 'flashcards';

const LS_DECKS_KEY = 'wikvoc_decks_v1';
const LS_FLASHCARDS_KEY = 'wikvoc_flashcards_v1';

function openWikVocDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_DECKS)) {
          db.createObjectStore(STORE_DECKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_WALLPAPERS)) {
          db.createObjectStore(STORE_WALLPAPERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FLASHCARDS)) {
          db.createObjectStore(STORE_FLASHCARDS, { keyPath: 'deckKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readDecksFromLocalStorage(): SavedDeckRecord[] {
  try {
    const raw = window.localStorage.getItem(LS_DECKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDeckRecord[]) : [];
  } catch {
    return [];
  }
}

function writeDecksToLocalStorage(decks: SavedDeckRecord[]): void {
  try {
    window.localStorage.setItem(LS_DECKS_KEY, JSON.stringify(decks));
  } catch {
    // Ignore storage quota / private mode issues
  }
}

export async function loadSavedDecks(): Promise<SavedDeckRecord[]> {
  const lsDecks = readDecksFromLocalStorage();
  const db = await openWikVocDB();
  if (!db) {
    return [...lsDecks].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DECKS, 'readonly');
      const store = tx.objectStore(STORE_DECKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const idbDecks = Array.isArray(req.result)
          ? (req.result as SavedDeckRecord[])
          : [];
        const merged = new Map<string, SavedDeckRecord>();
        lsDecks.forEach((d) => merged.set(d.id, d));
        idbDecks.forEach((d) => {
          const existing = merged.get(d.id);
          if (!existing || d.updatedAt >= existing.updatedAt) {
            merged.set(d.id, d);
          }
        });
        const sorted = Array.from(merged.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        writeDecksToLocalStorage(sorted);
        resolve(sorted);
      };
      req.onerror = () => resolve([...lsDecks].sort((a, b) => b.updatedAt - a.updatedAt));
    } catch {
      resolve([...lsDecks].sort((a, b) => b.updatedAt - a.updatedAt));
    }
  });
}

export async function saveDeckRecord(
  record: SavedDeckRecord
): Promise<SavedDeckRecord[]> {
  const current = await loadSavedDecks();
  const nextList = [
    record,
    ...current.filter((d) => d.id !== record.id),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  writeDecksToLocalStorage(nextList);

  const db = await openWikVocDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_DECKS, 'readwrite');
        tx.objectStore(STORE_DECKS).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return nextList;
}

export async function renameSavedDeck(
  id: string,
  newName: string
): Promise<SavedDeckRecord[]> {
  const trimmed = newName.trim();
  const current = await loadSavedDecks();
  const target = current.find((d) => d.id === id);
  if (!target || !trimmed) return current;

  const updated: SavedDeckRecord = {
    ...target,
    name: trimmed,
    updatedAt: Date.now(),
  };
  return saveDeckRecord(updated);
}

export async function deleteSavedDeck(id: string): Promise<SavedDeckRecord[]> {
  const current = await loadSavedDecks();
  const nextList = current.filter((d) => d.id !== id);
  writeDecksToLocalStorage(nextList);

  const db = await openWikVocDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_DECKS, 'readwrite');
        tx.objectStore(STORE_DECKS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return nextList;
}

/* ---------------- Flashcard Spaced Repetition Progress ---------------- */

interface FlashcardDeckRecord {
  deckKey: string;
  cards: FlashcardState[];
  updatedAt: number;
}

function readAllFlashcardProgressFromLS(): Record<string, FlashcardDeckRecord> {
  try {
    const raw = window.localStorage.getItem(LS_FLASHCARDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, FlashcardDeckRecord>)
      : {};
  } catch {
    return {};
  }
}

export async function loadAllFlashcardProgressSummary(): Promise<
  Record<string, FlashcardState[]>
> {
  const lsAll = readAllFlashcardProgressFromLS();
  const map: Record<string, FlashcardState[]> = {};
  Object.entries(lsAll).forEach(([k, v]) => {
    if (Array.isArray(v?.cards)) map[k] = v.cards;
  });

  const db = await openWikVocDB();
  if (!db) return map;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_FLASHCARDS, 'readonly');
      const req = tx.objectStore(STORE_FLASHCARDS).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result)
          ? (req.result as FlashcardDeckRecord[])
          : [];
        rows.forEach((row) => {
          if (row?.deckKey && Array.isArray(row.cards)) {
            map[row.deckKey] = row.cards;
          }
        });
        resolve(map);
      };
      req.onerror = () => resolve(map);
    } catch {
      resolve(map);
    }
  });
}

export async function loadFlashcardDeckProgress(
  deckKey: string
): Promise<FlashcardState[] | null> {
  const lsAll = readAllFlashcardProgressFromLS();
  const lsRecord = lsAll[deckKey];

  const db = await openWikVocDB();
  if (!db) {
    return lsRecord?.cards ?? null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_FLASHCARDS, 'readonly');
      const req = tx.objectStore(STORE_FLASHCARDS).get(deckKey);
      req.onsuccess = () => {
        const idbRecord = req.result as FlashcardDeckRecord | undefined;
        if (idbRecord && (!lsRecord || idbRecord.updatedAt >= lsRecord.updatedAt)) {
          resolve(idbRecord.cards);
        } else {
          resolve(lsRecord?.cards ?? null);
        }
      };
      req.onerror = () => resolve(lsRecord?.cards ?? null);
    } catch {
      resolve(lsRecord?.cards ?? null);
    }
  });
}

export async function saveFlashcardDeckProgress(
  deckKey: string,
  cards: FlashcardState[]
): Promise<void> {
  const record: FlashcardDeckRecord = {
    deckKey,
    cards,
    updatedAt: Date.now(),
  };

  try {
    const lsAll = readAllFlashcardProgressFromLS();
    lsAll[deckKey] = record;
    window.localStorage.setItem(LS_FLASHCARDS_KEY, JSON.stringify(lsAll));
  } catch {
    // Ignore storage quota / private mode issues
  }

  const db = await openWikVocDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_FLASHCARDS, 'readwrite');
        tx.objectStore(STORE_FLASHCARDS).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/* ---------------- Custom Wallpapers in IndexedDB ---------------- */

export async function loadCustomWallpapers(): Promise<SavedWallpaperItem[]> {
  const db = await openWikVocDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_WALLPAPERS, 'readonly');
      const req = tx.objectStore(STORE_WALLPAPERS).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result)
          ? (req.result as SavedWallpaperItem[])
          : [];
        resolve(rows.sort((a, b) => b.createdAt - a.createdAt));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveCustomWallpaper(
  item: SavedWallpaperItem
): Promise<void> {
  const db = await openWikVocDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_WALLPAPERS, 'readwrite');
      tx.objectStore(STORE_WALLPAPERS).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCustomWallpaper(id: string): Promise<void> {
  const db = await openWikVocDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_WALLPAPERS, 'readwrite');
      tx.objectStore(STORE_WALLPAPERS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function buildDeckSignatureKey(
  pairs: { term: string; def: string }[],
  explicitDeckId?: string | null
): string {
  if (explicitDeckId) return `deck_${explicitDeckId}`;
  const sample = pairs
    .slice(0, 12)
    .map((p) => `${p.term.trim().toLowerCase()}=${p.def.trim().toLowerCase()}`)
    .join('|');
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = (hash * 31 + sample.charCodeAt(i)) | 0;
  }
  return `inline_${pairs.length}_${Math.abs(hash)}`;
}
