import type { TableColumn, TableListing } from '../../core/types.js';

/**
 * Prefix of every key `@liasoft/lit-ui` writes into `localStorage` for column
 * preferences. Namespaced so a listing called `users` cannot collide with an
 * unrelated application key.
 */
export const COLUMN_PREFS_PREFIX = 'lia-ui:columns:';

/** Where and under which name column preferences are stored. */
export interface ColumnPrefsOptions {
  /**
   * Storage backend. Defaults to `window.localStorage`; pass
   * `window.sessionStorage` for per-tab preferences, or `null` to disable
   * persistence entirely.
   */
  storage?: Storage | null;
  /** Key prefix. Defaults to {@link COLUMN_PREFS_PREFIX}. */
  prefix?: string;
}

/** The storage key a listing's preferences live under. */
export function columnPrefsKey(listingId: string, options: ColumnPrefsOptions = {}): string {
  return `${options.prefix ?? COLUMN_PREFS_PREFIX}${listingId}`;
}

/**
 * Resolve the storage backend, tolerating environments where it is missing or
 * blocked (server-side rendering, Safari private mode, hardened browsers).
 */
function resolveStorage(options: ColumnPrefsOptions): Storage | null {
  if (options.storage !== undefined) return options.storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the column keys a user picked for a listing.
 *
 * The reference panel stores this selection server-side, per user; the kit
 * defaults to `localStorage` so a listing keeps its shape without a backend.
 * Point {@link ColumnPrefsOptions.storage} at your own `Storage` shim to move
 * it somewhere else.
 *
 * @returns the stored keys, or `undefined` when nothing was ever saved.
 *
 * @example
 * ```ts
 * const chosen = loadColumnPrefs('users') ?? defaultVisibleColumns(columns);
 * ```
 */
export function loadColumnPrefs(
  listingId: string,
  options: ColumnPrefsOptions = {}
): string[] | undefined {
  const storage = resolveStorage(options);
  if (!storage) return undefined;
  let raw: string | null;
  try {
    raw = storage.getItem(columnPrefsKey(listingId, options));
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const keys = parsed.filter((entry): entry is string => typeof entry === 'string');
    return keys.length > 0 ? keys : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persist the column keys a user picked. Returns `false` when no storage was
 * available, so a caller can fall back to its own mechanism.
 */
export function saveColumnPrefs(
  listingId: string,
  columns: readonly string[],
  options: ColumnPrefsOptions = {}
): boolean {
  const storage = resolveStorage(options);
  if (!storage) return false;
  try {
    storage.setItem(columnPrefsKey(listingId, options), JSON.stringify([...columns]));
    return true;
  } catch {
    return false;
  }
}

/**
 * Forget a listing's stored preferences, so it falls back to the definition's
 * defaults again. This is what the column manager's "Default" button does.
 */
export function clearColumnPrefs(listingId: string, options: ColumnPrefsOptions = {}): boolean {
  const storage = resolveStorage(options);
  if (!storage) return false;
  try {
    storage.removeItem(columnPrefsKey(listingId, options));
    return true;
  } catch {
    return false;
  }
}

/**
 * The keys a listing shows when the user has never touched the column manager:
 * every column whose `checked` is not explicitly `false`, plus every `locked`
 * column.
 */
export function defaultVisibleColumns<Row>(columns: readonly TableColumn<Row>[]): string[] {
  return columns
    .filter((column) => column.locked === true || column.checked !== false)
    .map((column) => column.key);
}

/**
 * Narrow a column list down to the user's selection.
 *
 * Order follows the *definition*, not the selection, so a listing never
 * reshuffles its columns behind the user's back. `locked` columns survive a
 * selection that omits them.
 */
export function visibleColumns<Row>(
  columns: readonly TableColumn<Row>[],
  selected: readonly string[] | undefined
): TableColumn<Row>[] {
  if (!selected) return columns.filter((column) => column.locked === true || column.checked !== false);
  const wanted = new Set(selected);
  return columns.filter((column) => column.locked === true || wanted.has(column.key));
}

/**
 * Return a copy of a listing with its columns reduced to `selected`.
 *
 * Rows, actions and pagination are shared with the original object — only the
 * `columns` array is new, which is exactly what a lit property binding needs
 * to notice the change.
 *
 * @example
 * ```ts
 * const shown = applyColumnPrefs(listing, loadColumnPrefs(listing.id));
 * html`<lia-table .listing=${shown}></lia-table>`;
 * ```
 */
export function applyColumnPrefs<Row>(
  listing: TableListing<Row>,
  selected: readonly string[] | undefined
): TableListing<Row> {
  return { ...listing, columns: visibleColumns(listing.columns, selected) };
}
