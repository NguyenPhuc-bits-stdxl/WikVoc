import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Layers,
  Moon,
  Palette,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AppearanceConfig,
  BackgroundMode,
  SavedWallpaperItem,
  ScrimStrength,
} from '@/src/types/vocab';
import { PALETTE_META } from '@/src/utils/appearanceStorage';

interface AppearanceModalProps {
  isOpen: boolean;
  config: AppearanceConfig;
  wallpapers: SavedWallpaperItem[];
  onUpdateConfig: (next: AppearanceConfig) => void;
  onUploadWallpaper: (file: File) => Promise<void>;
  onDeleteWallpaper: (id: string) => Promise<void>;
  onClose: () => void;
}

const SLIDESHOW_INTERVALS = [5, 10, 15, 20, 30];

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  config,
  wallpapers,
  onUpdateConfig,
  onUploadWallpaper,
  onDeleteWallpaper,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP image file.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setUploadError('Image is over 6 MB. Please pick a smaller image.');
      return;
    }
    try {
      setIsUploading(true);
      await onUploadWallpaper(file);
    } catch {
      setUploadError('Failed to save wallpaper locally.');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSlideshowItem = (id: string) => {
    const exists = config.slideshowWallpaperIds.includes(id);
    if (exists && config.slideshowWallpaperIds.length <= 1) return;
    const nextIds = exists
      ? config.slideshowWallpaperIds.filter((item) => item !== id)
      : [...config.slideshowWallpaperIds, id];
    onUpdateConfig({
      ...config,
      slideshowWallpaperIds: nextIds,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appearance-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 wv-text-accent shrink-0" />
            <h2
              id="appearance-modal-title"
              className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Appearance &amp; Homepage Backdrop
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close appearance settings"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Theme Mode */}
          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Color Surface
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose dark slate focus or crisp daylight surface
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, isDark: false })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  !config.isDark
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, isDark: true })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  config.isDark
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </section>

          {/* Accent Color Palette */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Accent Palette
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Updates buttons, active states, and progress bars across WikVoc
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {PALETTE_META.map((pal) => {
                const active = config.palette === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, palette: pal.id })}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'wv-border-accent wv-bg-accent-soft text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-sm shrink-0 border border-black/10"
                      style={{
                        backgroundColor: config.isDark ? pal.darkSwatchHex : pal.swatchHex,
                      }}
                    />
                    <span className="text-xs truncate">{pal.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Homepage Background Mode */}
          <section className="space-y-4 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Homepage Background
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shown calmly behind Setup &amp; My Decks (hidden during active drills)
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {[
                  { id: BackgroundMode.NONE, label: 'None' },
                  { id: BackgroundMode.STATIC, label: 'Static Image' },
                  { id: BackgroundMode.SLIDESHOW, label: 'Slideshow' },
                ].map((mode) => {
                  const active = config.bgMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onUpdateConfig({ ...config, bgMode: mode.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {config.bgMode !== BackgroundMode.NONE && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {config.bgMode === BackgroundMode.STATIC
                      ? 'Select 1 wallpaper'
                      : `Select images for slideshow (${config.slideshowWallpaperIds.length} active)`}
                  </span>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Saving...' : 'Upload Custom Image'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFileChange(f);
                      e.target.value = '';
                    }}
                  />
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
                )}

                {/* Wallpaper Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {wallpapers.map((wp) => {
                    const isSelected =
                      config.bgMode === BackgroundMode.STATIC
                        ? config.staticWallpaperId === wp.id
                        : config.slideshowWallpaperIds.includes(wp.id);

                    return (
                      <div
                        key={wp.id}
                        className={`group relative rounded-lg overflow-hidden border transition-all ${
                          isSelected
                            ? 'wv-border-accent ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-current wv-text-accent'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (config.bgMode === BackgroundMode.STATIC) {
                              onUpdateConfig({ ...config, staticWallpaperId: wp.id });
                            } else {
                              toggleSlideshowItem(wp.id);
                            }
                          }}
                          className="w-full block text-left cursor-pointer"
                        >
                          <div className="aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
                            <img
                              src={wp.src}
                              alt={wp.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                              {wp.name}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 wv-text-accent shrink-0" />}
                          </div>
                        </button>

                        {!wp.isBuiltin && (
                          <button
                            type="button"
                            onClick={() => void onDeleteWallpaper(wp.id)}
                            aria-label={`Delete ${wp.name}`}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-950/75 text-slate-200 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Contrast Scrim & Slideshow Interval */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Backdrop Readability Scrim</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      {[
                        { id: ScrimStrength.LIGHT, label: 'Subtle' },
                        { id: ScrimStrength.BALANCED, label: 'Balanced' },
                        { id: ScrimStrength.DEEP, label: 'Deep' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onUpdateConfig({ ...config, scrimStrength: s.id })}
                          className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                            config.scrimStrength === s.id
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {config.bgMode === BackgroundMode.SLIDESHOW && (
                    <div className="space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Slideshow Interval</span>
                      </label>
                      <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        {SLIDESHOW_INTERVALS.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() =>
                              onUpdateConfig({ ...config, slideshowIntervalSec: sec })
                            }
                            className={`py-1.5 px-1 rounded-md font-mono text-xs font-medium transition-colors cursor-pointer ${
                              config.slideshowIntervalSec === sec
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold wv-btn-primary transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
