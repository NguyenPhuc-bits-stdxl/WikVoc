import {
  AppearanceConfig,
  BackgroundMode,
  PaletteId,
  SavedWallpaperItem,
  ScrimStrength,
} from '@/src/types/vocab';

const APPEARANCE_STORAGE_KEY = 'wikvoc_appearance_v1';

export const BUILTIN_WALLPAPERS: SavedWallpaperItem[] = [
  {
    id: 'builtin_mist_peaks',
    name: 'Mist Peaks',
    src: '/src/assets/images/wallpaper_mist_peaks_1795396243321.jpg',
    isBuiltin: true,
    createdAt: 1,
  },
  {
    id: 'builtin_botanical_dusk',
    name: 'Botanical Dusk',
    src: '/src/assets/images/wallpaper_botanical_dusk_1795396243959.jpg',
    isBuiltin: true,
    createdAt: 2,
  },
  {
    id: 'builtin_architectural_light',
    name: 'Architectural Light',
    src: '/src/assets/images/wallpaper_architectural_light_1795396243547.jpg',
    isBuiltin: true,
    createdAt: 3,
  },
];

export const PALETTE_META: {
  id: PaletteId;
  label: string;
  swatchHex: string;
  darkSwatchHex: string;
}[] = [
  { id: PaletteId.CYAN, label: 'Cyan Focus', swatchHex: '#0891b2', darkSwatchHex: '#22d3ee' },
  { id: PaletteId.EMERALD, label: 'Emerald Sage', swatchHex: '#059669', darkSwatchHex: '#34d399' },
  { id: PaletteId.INDIGO, label: 'Indigo Night', swatchHex: '#4f46e5', darkSwatchHex: '#818cf8' },
  { id: PaletteId.AMBER, label: 'Warm Amber', swatchHex: '#d97706', darkSwatchHex: '#fbbf24' },
  { id: PaletteId.ROSE, label: 'Crimson Rose', swatchHex: '#e11d48', darkSwatchHex: '#fb7185' },
];

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  isDark: true,
  palette: PaletteId.CYAN,
  bgMode: BackgroundMode.NONE,
  staticWallpaperId: BUILTIN_WALLPAPERS[0].id,
  slideshowWallpaperIds: BUILTIN_WALLPAPERS.map((w) => w.id),
  slideshowIntervalSec: 12,
  scrimStrength: ScrimStrength.BALANCED,
};

export function loadAppearanceConfig(): AppearanceConfig {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw) as Partial<AppearanceConfig>;

    const validPalettes = Object.values(PaletteId);
    const validModes = Object.values(BackgroundMode);
    const validScrims = Object.values(ScrimStrength);

    return {
      isDark: typeof parsed.isDark === 'boolean' ? parsed.isDark : DEFAULT_APPEARANCE.isDark,
      palette:
        parsed.palette && validPalettes.includes(parsed.palette)
          ? parsed.palette
          : DEFAULT_APPEARANCE.palette,
      bgMode:
        parsed.bgMode && validModes.includes(parsed.bgMode)
          ? parsed.bgMode
          : DEFAULT_APPEARANCE.bgMode,
      staticWallpaperId:
        typeof parsed.staticWallpaperId === 'string' && parsed.staticWallpaperId
          ? parsed.staticWallpaperId
          : DEFAULT_APPEARANCE.staticWallpaperId,
      slideshowWallpaperIds:
        Array.isArray(parsed.slideshowWallpaperIds) && parsed.slideshowWallpaperIds.length > 0
          ? parsed.slideshowWallpaperIds.filter((id) => typeof id === 'string')
          : [...DEFAULT_APPEARANCE.slideshowWallpaperIds],
      slideshowIntervalSec:
        typeof parsed.slideshowIntervalSec === 'number' &&
        parsed.slideshowIntervalSec >= 3 &&
        parsed.slideshowIntervalSec <= 120
          ? parsed.slideshowIntervalSec
          : DEFAULT_APPEARANCE.slideshowIntervalSec,
      scrimStrength:
        parsed.scrimStrength && validScrims.includes(parsed.scrimStrength)
          ? parsed.scrimStrength
          : DEFAULT_APPEARANCE.scrimStrength,
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearanceConfig(config: AppearanceConfig): void {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or private mode issues
  }
}
