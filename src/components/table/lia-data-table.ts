import { html, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  SortState,
  TableColumn,
  TableHelp,
  TableListing,
  TableSearchState,
} from '../../core/types.js';
import { uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { cellValue, toCellNumber, type CellFormatOptions } from './cell-renderers.js';
import type { PerPageChangeDetail } from './lia-pagination.js';
import { LiaTable, type TableLabels } from './lia-table.js';

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Default ordering for two cell values.
 *
 * Numbers (including numeric strings), booleans and dates compare naturally;
 * everything else is compared with a locale-aware, numeric-aware string
 * collation, so `item-2` sorts before `item-10`. Blank values always sink to
 * the bottom, whichever direction is active.
 *
 * That last guarantee is **the caller's to keep**: this returns ±1 for a blank
 * like any other comparison, so a caller that negates the result for a
 * descending sort must decide blankness first. {@link LiaDataTable.processedRows}
 * does; anything else reusing this should too.
 *
 * @example
 * ```ts
 * rows.sort((a, b) => compareCellValues(a.size, b.size));
 * ```
 */
export function compareCellValues(a: unknown, b: unknown): number {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  if (a instanceof Date || b instanceof Date) {
    const aTime = a instanceof Date ? a.getTime() : Number(a);
    const bTime = b instanceof Date ? b.getTime() : Number(b);
    return aTime - bTime;
  }
  const aNumber = toCellNumber(a);
  const bNumber = toCellNumber(b);
  if (aNumber !== undefined && bNumber !== undefined) return aNumber - bNumber;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * `<lia-table>` for data you already hold in memory.
 *
 * Same card, same tab strip, same sortable headers, same pager — but sorting,
 * searching and paging happen locally over a plain row array instead of going
 * back to a server. Hand it `columns` and `rows` and it does the rest; the
 * events still fire, so a consumer can observe (or take over) any step.
 *
 * @example
 * ```ts
 * html`<lia-data-table
 *   listing-id="services"
 *   per-page="10"
 *   show-summary
 *   .columns=${[
 *     { key: 'name', label: 'Name', sortable: true, searchable: true, defaultSearchField: true },
 *     { key: 'size', label: 'Size', renderer: 'bytes', sortable: true },
 *     { key: 'updated', label: 'Updated', renderer: 'datetime', sortable: true },
 *   ]}
 *   .rows=${services}
 *   .rowActions=${(row) => [{ id: 'open', icon: 'fa-solid fa-eye', title: 'Open', data: row }]}
 *   @lia-action=${(e: CustomEvent) => open(e.detail.action.data)}
 * ></lia-data-table>`;
 * ```
 *
 * @example
 * ```html
 * <!-- attribute-only usage; rows and columns are set from script -->
 * <lia-data-table listing-id="hosts" per-page="25" show-per-page></lia-data-table>
 * ```
 */
@customElement('lia-data-table')
export class LiaDataTable<Row = Record<string, unknown>> extends LiaElement {
  /** Column definitions, exactly as `<lia-table>` takes them. */
  @property({ attribute: false }) columns: TableColumn<Row>[] = [];

  /** The complete, unpaged, unsorted row set. */
  @property({ attribute: false }) rows: Row[] = [];

  /** Identity of the listing; used for dialog ids and stored column choices. */
  @property({ type: String, attribute: 'listing-id' }) listingId = '';

  /** Rows per page. `0` (or less) shows everything on a single page. */
  @property({ type: Number, attribute: 'per-page' }) perPage = 20;

  /** Reference material behind the `?` in the tab strip. Absent hides the affordance. */
  @property({ attribute: false }) help?: TableHelp;

  /** Trailing per-row action buttons. */
  @property({ attribute: false }) rowActions?: (row: Row) => ActionDescriptor[];

  /** Extra classes for a whole row. */
  @property({ attribute: false }) rowClass?: (row: Row) => string | undefined;

  /** Stable row identity for selection; defaults to the row's position. */
  @property({ attribute: false }) rowKey?: (row: Row) => string | number;

  /**
   * Content for a row's expanded detail region. See {@link TableListing.rowDetail}.
   *
   * A detail region is an annotation on a row, so it is deliberately outside everything this element
   * does to rows: `processedRows` never sees it, so it is not sorted, not searched and not counted
   * towards a page. It is keyed on {@link rowKey}, so it follows its row through a re-sort.
   */
  @property({ attribute: false }) rowDetail?: (row: Row) => unknown;

  /** Which rows are expanded, by {@link rowKey}. Controlled, like {@link selectedKeys}. */
  @property({ attribute: false }) expandedKeys?: Array<string | number>;

  /**
   * The row that must be on screen, by {@link rowKey}.
   *
   * This element owns the ordering, the filter and the per-page, so it alone knows which page a row
   * is on: the consumer names a key and this element answers with a page. Requires {@link rowKey} —
   * without one, keys are positional and revealing is meaningless.
   *
   * A key the current result does not contain leaves the page exactly where it is. The reveal yields
   * the moment the reader pages themselves, and only then: a sort or a search moves the *row*, not
   * the reader's wish to see it, and nothing pulls the reader back until the consumer names a
   * different key.
   */
  @property({ attribute: false }) revealKey?: string | number;

  /** Enable row checkboxes and the bulk-action bar. */
  @property({ type: Boolean }) selectable = false;

  /** Buttons shown in the bulk bar while a selection exists. */
  @property({ attribute: false }) bulkActions?: ActionDescriptor[];

  /** Initial (or controlled) sorting. */
  @property({ attribute: false }) sort?: SortState;

  /** Initial (or controlled) filter. */
  @property({ attribute: false }) search?: TableSearchState;

  /** Show the busy indicator. */
  @property({ type: Boolean }) loading = false;

  /** Tighter row padding. */
  @property({ type: Boolean }) compact = false;

  /** Zebra striping. Switch it off with `striped="false"`. */
  @property({ converter: flag }) striped = true;

  /** Highlight the row under the pointer. */
  @property({ type: Boolean }) hover = false;

  /** Visible or screen-reader caption for the table. */
  @property({ type: String }) caption = '';

  /** Heading of the empty state. */
  @property({ type: String, attribute: 'empty-title' }) emptyTitle = '';

  /** Body of the empty state. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = '';

  /** Buttons offered inside the empty state. */
  @property({ attribute: false }) emptyActions: ActionDescriptor[] = [];

  /**
   * Offer the scope toggle, and act on it.
   *
   * With `server` set this table stops sorting and filtering its own rows: they are already the
   * answer, and re-ordering a page the server chose would quietly disagree with it. Everything else -
   * the chrome, the events, the pager - is unchanged, so a consumer switches behaviour without
   * switching elements.
   */
  @property({ type: Boolean, attribute: 'server-toggle' }) serverToggle = false;

  @property({ type: Boolean }) server = false;

  /** Hide the search affordance. */
  @property({ type: Boolean, attribute: 'no-search' }) noSearch = false;

  /** Hide the column manager. */
  @property({ type: Boolean, attribute: 'no-column-manager' }) noColumnManager = false;

  /** Persist the column choice under this `localStorage` key. */
  @property({ type: String, attribute: 'storage-key' }) storageKey = '';

  /**
   * Controlled column visibility, forwarded to the inner listing.
   *
   * Unlike {@link storageKey}, this lets the consumer own the choice — read `lia-columns-change` and
   * hand the list back here, e.g. to keep it in a URL or a query. Leave it unset and the table
   * manages the choice itself.
   */
  @property({ attribute: false }) visibleColumns?: string[];

  /** Show the "1–20 of 73" summary next to the pager. */
  @property({ converter: flag, attribute: 'show-summary' }) showSummary = true;

  /** Show the rows-per-page selector next to the pager. */
  @property({ type: Boolean, attribute: 'show-per-page' }) showPerPage = false;

  /** Overrides for the table chrome's strings. */
  @property({ attribute: false }) labels: Partial<TableLabels> = {};

  /** Overrides for the cell renderers' strings and formats. */
  @property({ attribute: false }) format?: CellFormatOptions;

  /**
   * The value a column contributes to sorting and filtering. Defaults to the
   * cell value behind `column.key` — override it when what you *display* is
   * not what you want to *order by*.
   */
  @property({ attribute: false }) cellValueFor?: (row: Row, column: TableColumn<Row>) => unknown;

  /** Full replacement for the default row ordering. */
  @property({ attribute: false }) compare?: (a: Row, b: Row, column: TableColumn<Row>) => number;

  /** Full replacement for the default filtering. */
  @property({ attribute: false }) match?: (row: Row, search: TableSearchState) => boolean;

  @state() private page = 1;
  @state() private sortState?: SortState;
  @state() private searchState: TableSearchState = { field: '', text: '' };

  private readonly autoId = uid('lia-data-table');

  /** Whether the reader has paged this table themselves since {@link revealKey} last changed. */
  private readerMoved = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('sort')) this.sortState = this.sort;
    if (changed.has('search') && this.search) this.searchState = this.search;

    // A new key is a new instruction, so it re-arms the reveal a previous page turn suppressed.
    if (changed.has('revealKey')) this.readerMoved = false;

    this.reveal();
  }

  /**
   * Put the page {@link revealKey} names in front of the reader.
   *
   * Here rather than in `updated`, and the lines above are why: the ordering and the filter this
   * render will paginate are settled by them, so the page is knowable now — and moving it now folds it
   * into this render instead of scheduling a second one and warning about it in dev mode.
   *
   * The `page !== currentPage` guard makes it a no-op for the row a reader clicked, which is by
   * definition on the page they are already looking at.
   */
  private reveal(): void {
    if (this.revealKey === undefined || this.revealKey === '' || this.readerMoved) return;

    const page = this.pageForKey(this.revealKey);
    if (page !== null && page !== this.currentPage) this.setPage(page);
  }

  /* ---------------- pipeline ---------------- */

  private valueFor(row: Row, column: TableColumn<Row>): unknown {
    return this.cellValueFor ? this.cellValueFor(row, column) : cellValue(row, column);
  }

  private rowMatches(row: Row, search: TableSearchState): boolean {
    if (this.match) return this.match(row, search);
    const needle = search.text.trim().toLowerCase();
    if (needle === '') return true;
    const targets = search.field
      ? this.columns.filter((column) => column.key === search.field)
      : this.columns.filter((column) => column.searchable !== false);
    return targets.some((column) => {
      const value = this.valueFor(row, column);
      if (isBlank(value)) return false;
      return String(value).toLowerCase().includes(needle);
    });
  }

  /** The rows left after filtering, in sorted order. */
  get processedRows(): Row[] {
    // The server already applied both, over the whole result rather than over this slice of it.
    if (this.server) return [...this.rows];

    const filtered = this.searchState.text
      ? this.rows.filter((row) => this.rowMatches(row, this.searchState))
      : [...this.rows];

    const sort = this.sortState;
    if (!sort || !sort.field) return filtered;
    const column = this.columns.find((entry) => entry.key === sort.field);
    if (!column) return filtered;

    const direction = sort.order === 'desc' ? -1 : 1;
    const compare = this.compare;
    return filtered.sort((a, b) => {
      if (compare) return compare(a, b, column) * direction;

      const aValue = this.valueFor(a, column);
      const bValue = this.valueFor(b, column);
      const aBlank = isBlank(aValue);
      const bBlank = isBlank(bValue);

      // Blank sinks in *both* directions, which is what `compareCellValues` documents - so it has to
      // be decided before the direction is applied. Multiplying its ±1 by -1 inverted it, floating
      // every unreported row to the top of a descending sort: a table ranked by "most failures"
      // would open with the rows that had none. A custom `compare` is left alone; its consumer owns
      // the whole ordering, blanks included.
      if (aBlank || bBlank) return aBlank && bBlank ? 0 : aBlank ? 1 : -1;

      return compareCellValues(aValue, bValue) * direction;
    });
  }

  /** Number of pages the current result set spans. */
  get pageCount(): number {
    if (this.perPage <= 0) return 1;
    return Math.max(1, Math.ceil(this.processedRows.length / this.perPage));
  }

  /**
   * Whether a listing event came from *this* table rather than one nested inside it.
   *
   * These components render into the light DOM, so a table inside a row's detail region is a genuine
   * descendant of the table that owns the row — and its `lia-page-change` bubbles straight into this
   * element's handlers. Without this guard, paging the inner table paged the outer one, which then
   * moved the pinned row off screen and took the expansion with it: the nested table's own pager was
   * unreachable past its first page.
   *
   * The test is the nearest enclosing `lia-data-table`, not `target === currentTarget`: paging and
   * per-page events are emitted by `lia-pagination`, so this element's *own* events do not come from
   * its `lia-table` either.
   */
  private own(event: Event): boolean {
    const source = event.target as Element | null;
    return source?.closest?.('lia-data-table') === this;
  }

  /** The current page, clamped into range. */
  get currentPage(): number {
    return Math.min(Math.max(1, this.page), this.pageCount);
  }

  /** The inner listing element, for imperative access. */
  get table(): LiaTable<Row> | null {
    const element = this.querySelector('lia-table');
    return element instanceof LiaTable ? (element as LiaTable<Row>) : null;
  }

  /* ---------------- imperative API ---------------- */

  /** Jump to a page (1-based, clamped). */
  setPage(page: number): void {
    this.page = Math.max(1, Math.floor(page));
  }

  /**
   * Which page a row is on, or `null` when this table cannot say — no {@link rowKey}, or a key no
   * row carries. Public because it is the answer a consumer needs to say anything about a row that
   * is elsewhere, and it makes {@link revealKey} testable without reaching into private state.
   *
   * It reads {@link processedRows} live: correct from the moment `willUpdate` has copied
   * `sort`/`search` (which is why {@link reveal} runs last there), but one update stale for anyone
   * reading it from outside while those properties are changing.
   */
  pageForKey(key: string | number): number | null {
    if (!this.rowKey) return null;

    const index = this.processedRows.findIndex((row) => this.rowKey!(row) === key);
    if (index < 0) return null;

    return this.perPage > 0 ? Math.floor(index / this.perPage) + 1 : 1;
  }

  /** Apply a sort state; pass `undefined` (or an empty field) to clear it. */
  setSort(sort: SortState | undefined): void {
    this.sortState = sort && sort.field ? sort : undefined;
    this.page = 1;
  }

  /** Apply a filter. */
  setSearch(search: TableSearchState): void {
    this.searchState = search;
    this.page = 1;
  }

  /* ---------------- rendering ---------------- */

  override render(): TemplateResult {
    const processed = this.processedRows;
    const total = processed.length;
    const perPage = this.perPage > 0 ? this.perPage : Math.max(total, 1);
    const lastPage = this.perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
    const current = Math.min(Math.max(1, this.page), lastPage);
    const rows =
      this.perPage > 0 ? processed.slice((current - 1) * perPage, current * perPage) : processed;

    const listing: TableListing<Row> = {
      id: this.listingId || this.autoId,
      columns: this.columns,
      rows,
      rowActions: this.rowActions,
      rowClass: this.rowClass,
      rowKey: this.rowKey,
      rowDetail: this.rowDetail,
      pagination: { currentPage: current, lastPage, perPage, total },
      sort: this.sortState,
      emptyTitle: this.emptyTitle || undefined,
      emptyMessage: this.emptyMessage || undefined,
      noSearch: this.noSearch,
      noColumnManager: this.noColumnManager,
      help: this.help,
      selectable: this.selectable,
      bulkActions: this.bulkActions,
    };

    return html`<lia-table
      .expandedKeys=${this.expandedKeys}
      ?server-toggle=${this.serverToggle}
      ?server=${this.server}
      .listing=${listing}
      .search=${this.searchState.text ? this.searchState : undefined}
      .labels=${this.labels}
      .format=${this.format}
      .emptyActions=${this.emptyActions}
      .striped=${this.striped}
      ?loading=${this.loading}
      ?compact=${this.compact}
      ?hover=${this.hover}
      caption=${this.caption}
      storage-key=${this.storageKey}
      .visibleColumns=${this.visibleColumns}
      ?show-summary=${this.showSummary}
      ?show-per-page=${this.showPerPage}
      @lia-sort=${(event: CustomEvent<SortState>) => this.own(event) && this.setSort(event.detail)}
      @lia-search=${(event: CustomEvent<TableSearchState>) =>
        this.own(event) && this.setSearch(event.detail)}
      @lia-page-change=${(event: CustomEvent<{ page: number }>) => {
        if (!this.own(event)) return;
        this.readerMoved = true;
        this.setPage(event.detail.page);
      }}
      @lia-per-page-change=${(event: CustomEvent<PerPageChangeDetail>) => {
        if (!this.own(event)) return;
        this.readerMoved = true;
        this.perPage = event.detail.perPage;
        this.page = 1;
      }}
    ></lia-table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-data-table': LiaDataTable;
  }
}
