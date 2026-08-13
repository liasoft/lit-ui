import { nothing, type TemplateResult } from 'lit';
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

/** Monotonic counter used to mint unique DOM ids for a11y wiring. */
let uidCounter = 0;

/** Return a process-unique DOM id, e.g. `lia-field-7`. */
export function uid(prefix = 'lia'): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

/**
 * Human-readable byte size.
 * `-1` (and any negative value) means "unlimited".
 */
export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '-';
  if (bytes < 0) return '∞';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(i === 0 ? 0 : decimals))} ${units[i]}`;
}

/** Percentage of `used` against `total`, clamped to 0..100. `total <= 0` yields 100 (unlimited bar). */
export function usagePercent(used: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}

/**
 * Bootstrap contextual colour for a usage percentage:
 * under 75% neutral, 75–90% warning, above 90% danger.
 */
export function usageVariant(percent: number, unlimited = false): string {
  if (unlimited) return 'bg-secondary';
  if (percent >= 90) return 'bg-danger';
  if (percent >= 75) return 'bg-warning';
  return '';
}

/** Join truthy class names. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Render a value that may legitimately contain markup (labels, descriptions,
 * table cells). Kept in one place so every trust decision is auditable.
 *
 * Only pass values your application controls — never unescaped user input.
 */
export function renderRich(value: string | null | undefined): TemplateResult | typeof nothing {
  if (value === null || value === undefined || value === '') return nothing;
  return html`${unsafeHTML(value)}`;
}

/** Read a nested property with a dotted path, e.g. `get(row, 'customer.name')`. */
export function get(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

/** Trailing-edge debounce. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 250
): ((...args: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return wrapped;
}

/** Build a query-string URL from a params object, dropping empty values. */
export function linker(base: string, params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
}

/** Copy text to the clipboard, falling back to a hidden textarea. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  }
}
