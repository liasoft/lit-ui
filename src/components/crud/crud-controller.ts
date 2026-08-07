import type {
  ActionDescriptor,
  PaginationState,
  SortState,
  TableColumn,
  TableListing,
  TableSearchState,
} from '../../core/types.js';
import {
  clearColumnPrefs,
  defaultVisibleColumns,
  loadColumnPrefs,
  saveColumnPrefs,
  visibleColumns,
  type ColumnPrefsOptions,
} from './column-prefs.js';
import type { FilterChip, FilterChangeDetail, FilterRemoveDetail } from './filter-bar.js';

/** Chip id used for the search term, so it can be dropped like any filter. */
export const SEARCH_FILTER_ID = '__search';

/** What the controller asks your data source for. */
export interface CrudFetchParams {
  /** 1-based page number. */
  page: number;
  perPage: number;
  sort?: SortState;
  /** Only present when the user typed something. */
  search?: TableSearchState;
  /** Active filters, empty values already removed. */
  filters: Record<string, unknown>;
  /**
   * Aborted when a newer request supersedes this one — pass it straight to
   * `fetch()` and stale responses stop costing you bandwidth.
   */
  signal: AbortSignal;
}

/** What your data source gives back. A bare array is accepted too. */
export interface CrudFetchResult<Row> {
  rows: Row[];
  /** Total number of matching rows across all pages. */
  total?: number;
  /** Last page number. Derived from `total` and `perPage` when omitted. */
  lastPage?: number;
}

/** Describes a filter so the controller can render a chip for it. */
export interface CrudFilterDefinition {
  id: string;
  label: string;
  /** Render the raw value for the chip. Defaults to `String(value)`. */
  format?: (value: unknown) => string;
  /** Set to `false` for a filter the user may not clear. */
  removable?: boolean;
}

/** Everything {@link createCrudController} needs. */
export interface CrudControllerOptions<Row> {
  /** Listing id — also the column-preference storage key. */
  id: string;
  /** Every column the listing could show. */
  columns: TableColumn<Row>[];
  /** Loads a page of rows. Rejections land in `state.error`. */
  fetch: (params: CrudFetchParams) => Promise<CrudFetchResult<Row> | Row[]>;
  /** Called after every state change, so a host can re-render. */
  onChange?: (controller: CrudController<Row>) => void;

  perPage?: number;
  /** Initial sort. */
  sort?: SortState;
  /** Initial search. */
  search?: TableSearchState;
  /** Initial filter values. */
  filters?: Record<string, unknown>;
  /** Labels and formatting for the filter chips. */
  filterDefinitions?: CrudFilterDefinition[];

  // Passed straight through to the listing.
  rowKey?: (row: Row) => string | number;
  rowActions?: (row: Row) => ActionDescriptor[];
  rowClass?: (row: Row) => string | undefined;
  bulkActions?: ActionDescriptor[];
  selectable?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;

  /** Remember the column selection in storage. Defaults to `true`. */
  persistColumns?: boolean;
  /** Storage backend / prefix for the column selection. */
  columnStorage?: ColumnPrefsOptions;
  /** Chip label for the active search term. */
  searchChipLabel?: string;
  /** Load the first page as soon as the controller is created. */
  autoLoad?: boolean;
}

/** The controller's observable state. Treat it as read-only. */
export interface CrudState<Row> {
  page: number;
  perPage: number;
  sort?: SortState;
  search?: TableSearchState;
  filters: Record<string, unknown>;
  rows: Row[];
  total?: number;
  lastPage: number;
  loading: boolean;
  /** Message of the last failed load, cleared on the next successful one. */
  error?: string;
  /** Keys of the selected rows. */
  selection: Array<string | number>;
  /** Visible column keys. */
  columns: string[];
}

/** A value that does not narrow anything down and so needs no chip. */
function isEmptyFilterValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The request failed.';
}

/**
 * Framework-free listing state: page, sort, search, filters, selection and
 * column choice, plus the loading it all implies.
 *
 * It exists because every list page re-implements the same twelve lines of
 * bookkeeping, badly — usually forgetting that a slow page 1 can land *after*
 * a fast page 2 and overwrite it. The controller keeps one request token, so
 * only the newest response is ever applied, and aborts the ones it discards.
 *
 * {@link listing} returns a ready `TableListing` and {@link connect} subscribes
 * to the `lia-*` events a `<lia-crud-page>` emits, which is the whole wiring.
 *
 * @example
 * ```ts
 * const crud = createCrudController<User>({
 *   id: 'users',
 *   columns,
 *   fetch: async ({ page, perPage, search, signal }) => {
 *     const res = await fetch(linker('/api/users', { page, perPage, q: search?.text }), { signal });
 *     const body = await res.json();
 *     return { rows: body.data, total: body.total };
 *   },
 *   onChange: () => host.requestUpdate(),
 * });
 *
 * const page = document.querySelector('lia-crud-page')!;
 * crud.connect(page);
 * // …and in render(): .listing=${crud.listing} .filters=${crud.filterChips} .loading=${crud.state.loading}
 * ```
 */
export class CrudController<Row = Record<string, unknown>> {
  readonly options: CrudControllerOptions<Row>;

  private current: CrudState<Row>;
  private requestToken = 0;
  private inFlight?: AbortController;
  private listeners: Array<() => void> = [];

  constructor(options: CrudControllerOptions<Row>) {
    this.options = options;
    this.current = {
      page: 1,
      perPage: options.perPage ?? 25,
      sort: options.sort,
      search: options.search,
      filters: { ...(options.filters ?? {}) },
      rows: [],
      lastPage: 1,
      loading: false,
      selection: [],
      columns: this.initialColumns(),
    };
    if (options.autoLoad) void this.load();
  }

  /** The current state. A new object is produced on every change. */
  get state(): CrudState<Row> {
    return this.current;
  }

  /** Rows that are currently selected, resolved from {@link CrudState.selection}. */
  get selectedRows(): Row[] {
    const keys = new Set(this.current.selection.map(String));
    return this.current.rows.filter((row, index) => keys.has(String(this.keyOf(row, index))));
  }

  /** Pagination as `<lia-table>` wants it. */
  get pagination(): PaginationState {
    return {
      currentPage: this.current.page,
      lastPage: this.current.lastPage,
      perPage: this.current.perPage,
      total: this.current.total,
    };
  }

  /**
   * The listing, ready to hand to `<lia-crud-page>` or `<lia-table>`: columns
   * narrowed to the user's selection, rows, pagination and row behaviour.
   */
  get listing(): TableListing<Row> {
    const options = this.options;
    return {
      id: options.id,
      columns: visibleColumns(options.columns, this.current.columns),
      rows: this.current.rows,
      rowActions: options.rowActions,
      rowClass: options.rowClass,
      rowKey: options.rowKey,
      selectable: options.selectable,
      bulkActions: options.bulkActions,
      emptyTitle: options.emptyTitle,
      emptyMessage: options.emptyMessage,
      pagination: this.pagination,
      sort: this.current.sort,
    };
  }

  /** Every column the listing could show — feed this to the column manager. */
  get allColumns(): TableColumn<Row>[] {
    return this.options.columns;
  }

  /**
   * Chips for the active filters plus, when set, the search term — so the user
   * can always see (and undo) why they are looking at a subset.
   */
  get filterChips(): FilterChip[] {
    const definitions = new Map(
      (this.options.filterDefinitions ?? []).map((definition) => [definition.id, definition])
    );
    const chips: FilterChip[] = [];

    const search = this.current.search;
    if (search && search.text !== '') {
      chips.push({
        id: SEARCH_FILTER_ID,
        label: this.options.searchChipLabel ?? 'Search',
        value: search.text,
        icon: 'fa-solid fa-magnifying-glass',
      });
    }

    for (const [id, value] of Object.entries(this.current.filters)) {
      if (isEmptyFilterValue(value)) continue;
      const definition = definitions.get(id);
      chips.push({
        id,
        label: definition?.label ?? id,
        value: definition?.format ? definition.format(value) : String(value),
        removable: definition?.removable,
      });
    }

    return chips;
  }

  /* ---------------------------------------------------------------- *
   * Mutations
   * ---------------------------------------------------------------- */

  /** Jump to a page (1-based) and reload. */
  setPage(page: number): void {
    const clamped = Math.max(1, Math.round(page));
    if (clamped === this.current.page) return;
    this.patch({ page: clamped });
    void this.load();
  }

  /** Change the page size, returning to page 1. */
  setPerPage(perPage: number): void {
    const size = Math.max(1, Math.round(perPage));
    if (size === this.current.perPage) return;
    this.patch({ perPage: size, page: 1 });
    void this.load();
  }

  /** Sort by a field. Sorting resets to page 1 — page 7 of a new order is meaningless. */
  setSort(sort: SortState | undefined): void {
    this.patch({ sort, page: 1 });
    void this.load();
  }

  /** Apply a search. An empty text clears it. */
  setSearch(search: TableSearchState | undefined): void {
    const next = search && search.text !== '' ? search : undefined;
    this.patch({ search: next, page: 1 });
    void this.load();
  }

  /** Set one filter. An empty value removes it. */
  setFilter(id: string, value: unknown): void {
    const filters = { ...this.current.filters };
    if (isEmptyFilterValue(value)) delete filters[id];
    else filters[id] = value;
    this.patch({ filters, page: 1 });
    void this.load();
  }

  /** Drop one filter. The search chip id clears the search instead. */
  removeFilter(id: string): void {
    if (id === SEARCH_FILTER_ID) {
      this.setSearch(undefined);
      return;
    }
    this.setFilter(id, undefined);
  }

  /** Drop every filter and the search term. */
  clearFilters(): void {
    this.patch({ filters: {}, search: undefined, page: 1 });
    void this.load();
  }

  /**
   * Record the visible columns and persist them, unless `persistColumns` is
   * off. Purely presentational: no reload is triggered.
   */
  setColumns(columns: string[]): void {
    this.patch({ columns });
    if (this.options.persistColumns === false) return;
    saveColumnPrefs(this.options.id, columns, this.options.columnStorage ?? {});
  }

  /** Forget the stored column choice and go back to the definition's defaults. */
  resetColumns(): void {
    clearColumnPrefs(this.options.id, this.options.columnStorage ?? {});
    this.patch({ columns: defaultVisibleColumns(this.options.columns) });
  }

  /** Replace the selection. */
  setSelection(keys: Array<string | number>): void {
    this.patch({ selection: [...keys] });
  }

  /** Empty the selection — call this after a bulk action succeeded. */
  clearSelection(): void {
    if (this.current.selection.length === 0) return;
    this.patch({ selection: [] });
  }

  /* ---------------------------------------------------------------- *
   * Loading
   * ---------------------------------------------------------------- */

  /**
   * Load the current page. Any request still in flight is aborted, and a
   * response that arrives after a newer request started is discarded.
   */
  async load(): Promise<void> {
    const token = ++this.requestToken;
    this.inFlight?.abort();
    const controller = new AbortController();
    this.inFlight = controller;
    this.patch({ loading: true });

    const params: CrudFetchParams = {
      page: this.current.page,
      perPage: this.current.perPage,
      sort: this.current.sort,
      search: this.current.search,
      filters: { ...this.current.filters },
      signal: controller.signal,
    };

    try {
      const result = await this.options.fetch(params);
      if (token !== this.requestToken) return;
      const normalised: CrudFetchResult<Row> = Array.isArray(result) ? { rows: result } : result;
      const total = normalised.total;
      const lastPage =
        normalised.lastPage ??
        (total === undefined ? 1 : Math.max(1, Math.ceil(total / this.current.perPage)));
      this.patch({
        rows: normalised.rows,
        total,
        lastPage,
        loading: false,
        error: undefined,
        // A selection can only refer to rows that are on screen.
        selection: [],
      });
    } catch (error) {
      if (token !== this.requestToken) return;
      if (controller.signal.aborted) return;
      this.patch({ loading: false, error: toMessage(error) });
    } finally {
      if (this.inFlight === controller) this.inFlight = undefined;
    }
  }

  /** Reload the current page, keeping every other bit of state. */
  reload(): Promise<void> {
    return this.load();
  }

  /** Go back to page 1 and reload — what you want after a create or delete. */
  refresh(): Promise<void> {
    this.patch({ page: 1 });
    return this.load();
  }

  /* ---------------------------------------------------------------- *
   * Wiring
   * ---------------------------------------------------------------- */

  /**
   * Subscribe to the events a `<lia-crud-page>` (or a bare `<lia-table>` plus
   * chrome) emits and keep the state in step. Returns an unsubscribe function;
   * {@link destroy} calls every one of them.
   *
   * @example
   * ```ts
   * firstUpdated() {
   *   this.crud.connect(this.renderRoot.querySelector('lia-crud-page')!);
   *   void this.crud.load();
   * }
   * ```
   */
  connect(target: EventTarget): () => void {
    const on = <T>(type: string, handler: (detail: T) => void): (() => void) => {
      const listener = (event: Event): void => handler((event as CustomEvent<T>).detail);
      target.addEventListener(type, listener);
      return () => target.removeEventListener(type, listener);
    };

    const offs = [
      on<{ page: number }>('lia-page-change', (detail) => this.setPage(detail.page)),
      on<SortState>('lia-sort', (detail) => this.setSort(detail)),
      on<TableSearchState>('lia-search', (detail) => this.setSearch(detail)),
      on<{ columns: string[] }>('lia-columns-change', (detail) => this.setColumns(detail.columns)),
      on<{ keys: Array<string | number> }>('lia-selection-change', (detail) =>
        this.setSelection(detail.keys)
      ),
      on<FilterRemoveDetail>('lia-filter-remove', (detail) => this.removeFilter(detail.id)),
      on<FilterChangeDetail>('lia-filter-change', (detail) =>
        this.setFilter(detail.id, detail.value)
      ),
      on<unknown>('lia-filter-clear', () => this.clearFilters()),
    ];

    const off = (): void => {
      for (const remove of offs) remove();
      this.listeners = this.listeners.filter((entry) => entry !== off);
    };
    this.listeners.push(off);
    return off;
  }

  /** Unsubscribe everything and abort any request still in flight. */
  destroy(): void {
    for (const off of [...this.listeners]) off();
    this.listeners = [];
    this.requestToken += 1;
    this.inFlight?.abort();
    this.inFlight = undefined;
  }

  /* ---------------------------------------------------------------- *
   * Internals
   * ---------------------------------------------------------------- */

  private initialColumns(): string[] {
    if (this.options.persistColumns !== false) {
      const stored = loadColumnPrefs(this.options.id, this.options.columnStorage ?? {});
      if (stored) return stored;
    }
    return defaultVisibleColumns(this.options.columns);
  }

  private keyOf(row: Row, index: number): string | number {
    return this.options.rowKey ? this.options.rowKey(row) : index;
  }

  private patch(changes: Partial<CrudState<Row>>): void {
    this.current = { ...this.current, ...changes };
    this.options.onChange?.(this);
  }
}

/**
 * Create a {@link CrudController}. The function form exists so consumers never
 * have to import the class, and so the row type can be inferred from `fetch`.
 *
 * @example
 * ```ts
 * const crud = createCrudController({
 *   id: 'servers',
 *   columns,
 *   fetch: () => api.listServers(),
 *   onChange: () => this.requestUpdate(),
 *   autoLoad: true,
 * });
 * ```
 */
export function createCrudController<Row = Record<string, unknown>>(
  options: CrudControllerOptions<Row>
): CrudController<Row> {
  return new CrudController<Row>(options);
}
