export type ColorScheme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'lia-color-scheme';

/** The scheme the user picked (may be `auto`). */
export function getPreferredScheme(): ColorScheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

/** The scheme actually in effect, resolving `auto` against the OS setting. */
export function getEffectiveScheme(): Exclude<ColorScheme, 'auto'> {
  const preferred = getPreferredScheme();
  if (preferred !== 'auto') return preferred;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply a scheme by stamping `data-bs-theme` on `<html>` — the attribute
 * Bootstrap 5.3's colour-mode system reads. Persists the choice and notifies
 * listeners via a `lia-theme-change` event on `window`.
 */
export function applyScheme(scheme: ColorScheme): void {
  localStorage.setItem(STORAGE_KEY, scheme);
  const effective = getEffectiveScheme();
  document.documentElement.setAttribute('data-bs-theme', effective);
  window.dispatchEvent(
    new CustomEvent<{ scheme: ColorScheme; effective: 'light' | 'dark' }>('lia-theme-change', {
      detail: { scheme, effective },
    })
  );
}

/**
 * Install the theme system: apply the stored preference and keep `auto` in
 * sync with the OS. Call once at application start-up.
 */
export function initTheme(): void {
  applyScheme(getPreferredScheme());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getPreferredScheme() === 'auto') applyScheme('auto');
  });
}
