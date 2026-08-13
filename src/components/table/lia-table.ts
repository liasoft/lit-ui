import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  ModalDescriptor,
  SortOrder,
  SortState,
  TableColumn,
  TableListing,
  TableSearchState,
} from '../../core/types.js';
import { cx, uid } from '../../core/utils.js';
import { renderActions } from '../primitives/render-action.js';
import { flag } from '../layout/flag.js';
import '../primitives/lia-empty-state.js';
import '../feedback/modal.js';
import { renderCell, type CellFormatOptions } from './cell-renderers.js';
import { formatLabel } from './lia-pagination.js';
import './lia-pagination.js';

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

/**
 * Every string `<lia-table>` renders on its own behalf.
 *
 * Column labels, cell content and action titles come from the listing; this is
 * the chrome around them. Override individual entries through the `labels`
 * property — nothing here is hardcoded into the markup.
 */
export interface TableLabels {
  /** Accessible name of the `<table>` when no `caption` is set. */
  table: string;
  /** Title of the search affordance in the tab strip. */
  search: string;
  searchTitle: string;
  searchDescription: string;
  searchField: string;
  searchText: string;
  searchPlaceholder: string;
  /** Submit button of the search dialog. */
  apply: string;
  /** Prefix of the active-filter chip. */
  filter: string;
  clearFilter: string;
  /** Title of the scope toggle while sorting and searching happen on the rows on screen. */
  scopePage: string;
  /** Title of the scope toggle while the server is doing the sorting and searching. */
  scopeAll: string;
  /** Title of the column-manager affordance. */
  columns: string;
  columnsTitle: string;
  columnsDescription: string;
  /** Title of the help affordance in the tab strip. */
  help: string;
  helpTitle: string;
  /** Heading above the per-column explanations. */
  helpColumns: string;
  /** Heading above the free-standing notes. */
  helpNotes: string;
  selectAllColumns: string;
  clearColumns: string;
  resetColumns: string;
  cancel: string;
  save: string;
  /** Footer button of a dialog opened by a row action. */
  close: string;
  /** Header of the trailing row-actions column. */
  actions: string;
  /** Accessible name of a row checkbox; `{row}` is substituted. */
  select: string;
  /** Accessible name of the header checkbox. */
  selectAll: string;
  /** Bulk-bar counter; `{count}` is substituted. */
  selection: string;
  clearSelection: string;
  /** Accessible name of the bulk-action group. */
  bulkActions: string;
  /** Title of a sortable header that will sort ascending next. */
  sortAscending: string;
  /** Title of a sortable header that will sort descending next. */
  sortDescending: string;
  /** Title of a sortable header that will drop the sorting next. */
  clearSorting: string;
  /** Announced while the loading overlay is up. */
  loading: string;
  emptyTitle: string;
  emptyMessage: string;
}

/** The English defaults, merged under whatever `labels` supplies. */
export const DEFAULT_TABLE_LABELS: Readonly<TableLabels> = Object.freeze({
  table: 'Data table',
  search: 'Search',
  searchTitle: 'Search',
  searchDescription: 'Pick the column to search in and enter a term.',
  searchField: 'Column',
  searchText: 'Search term',
  searchPlaceholder: 'Search…',
  apply: 'Search',
  filter: 'Filter',
  clearFilter: 'Clear filter',
  scopePage: 'Sorting and searching the rows on this page. Click to ask the server instead.',
  scopeAll: 'Sorting and searching the whole result on the server. Click to work on this page instead.',
  columns: 'Choose columns',
  columnsTitle: 'Choose columns',
  columnsDescription: 'Select which columns are shown in the table.',
  help: 'About this table',
  helpTitle: 'About this table',
  helpColumns: 'What the columns mean',
  helpNotes: 'Reading the table',
  selectAllColumns: 'Select all',
  clearColumns: 'Clear all',
  resetColumns: 'Reset',
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',
  actions: 'Actions',
  select: 'Select row {row}',
  selectAll: 'Select all rows on this page',
  selection: '{count} selected',
  clearSelection: 'Clear selection',
  bulkActions: 'Bulk actions',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSorting: 'Clear sorting',
  loading: 'Loading…',
  emptyTitle: 'Nothing here yet',
  emptyMessage: 'There are no entries to show.',
});

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

/**
 * The next state of a three-way sort cycle: unsorted → ascending → descending
 * → unsorted. With `allowUnsorted: false` the cycle is a two-way toggle.
 */
export function nextSortOrder(
  current: SortOrder | undefined,
  allowUnsorted = true
): SortOrder | undefined {
  if (current === 'asc') return 'desc';
  if (current === 'desc') return allowUnsorted ? undefined : 'asc';
  return 'asc';
}

/**
 * The columns a listing shows before the user touches the column manager:
 * every column whose `checked` is not explicitly `false`, plus every `locked`
 * column.
 *
 * Deliberately the same rule as the CRUD family's `defaultVisibleColumns()`,
 * so a listing looks identical whether it is driven by `<lia-table>` alone or
 * through the CRUD controller. The name differs only to keep the package's
 * root barrel unambiguous.
 */
export function defaultTableColumns<Row>(columns: readonly TableColumn<Row>[]): string[] {
  return columns
    .filter((column) => column.locked === true || column.checked !== false)
    .map((column) => column.key);
}

/** Whether two column selections say the same thing, `undefined` (unset) included. */
function sameColumns(left: string[] | undefined, right: string[] | undefined): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

/** Classes that make the sort trigger look exactly like a static header. */
const SORT_BUTTON_CLASS =
  'lia-table-sort btn btn-link btn-sm p-0 fw-bold text-reset text-decoration-none ' +
  'd-inline-flex align-items-center gap-1';

/** Classes for the full-card busy overlay. */
const OVERLAY_CLASS =
  'lia-table-loading position-absolute top-0 start-0 w-100 h-100 ' +
  'd-flex align-items-center justify-content-center';

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * The listing renderer: a card-wrapped, responsive table driven by a single
 * {@link TableListing} object.
 *
 * It carries everything a real listing page needs — the small rounded tab
 * above the card with the search and column-manager affordances and the
 * active-filter chip, sortable headers, optional row selection with a bulk
 * bar, per-row actions with their dialogs, an empty state, a loading overlay
 * and pagination in the footer.
 *
 * **Sorting, searching and paging are events, not behaviour.** The table tells
 * you what the user asked for (`lia-sort`, `lia-search`, `lia-page-change`) and
 * re-renders when you hand back a new listing — which is what a server-side
 * endpoint needs. For a plain in-memory array use `<lia-data-table>`, which
 * does the same work locally and looks identical.
 *
 * @example
 * ```ts
 * html`<lia-table
 *   .listing=${{
 *     id: 'volumes',
 *     columns: [
 *       { key: 'name', label: 'Name', sortable: true, searchable: true },
 *       { key: 'size', label: 'Size', renderer: 'bytes', sortable: true },
 *       { key: 'active', label: 'Active', renderer: 'boolean', class: 'text-center' },
 *     ],
 *     rows,
 *     pagination: { currentPage: 1, lastPage: 4, perPage: 20, total: 73 },
 *     sort: { field: 'name', order: 'asc' },
 *     rowActions: (row) => [
 *       { id: 'edit', icon: 'fa-solid fa-pen', title: 'Edit', data: { id: row.id } },
 *     ],
 *   }}
 *   @lia-sort=${(e: CustomEvent) => load({ sort: e.detail })}
 *   @lia-page-change=${(e: CustomEvent) => load({ page: e.detail.page })}
 *   @lia-action=${(e: CustomEvent) => run(e.detail)}
 * ></lia-table>`;
 * ```
 *
 * @example
 * ```html
 * <!-- selection and bulk actions -->
 * <lia-table id="hosts"></lia-table>
 * <script type="module">
 *   const table = document.querySelector('lia-table');
 *   table.listing = { id: 'hosts', columns, rows, selectable: true,
 *                     bulkActions: [{ id: 'delete', label: 'Delete', variant: 'danger' }] };
 *   table.addEventListener('lia-selection-change', (e) => console.log(e.detail.keys));
 * </script>
 * ```
 */
@customElement('lia-table')
export class LiaTable<Row = Record<string, unknown>> extends LiaElement {
  /** The listing to render. */
  @property({ attribute: false }) listing: TableListing<Row> = { id: '', columns: [], rows: [] };

  /**
   * Offer the scope toggle in the tool strip.
   *
   * Only a consumer that can actually re-query knows whether this makes sense, so it is opt-in: a
   * listing whose rows are already the whole truth has nothing to toggle between.
   */
  @property({ type: Boolean, attribute: 'server-toggle' }) serverToggle = false;

  /**
   * Whether sorting and searching are the server's job rather than this table's.
   *
   * The table does not act on this - it is the consumer's state, shown here and reported back as
   * `lia-scope-change` so the two stay in step. What it changes is what the reader is told the
   * controls will do.
   */
  @property({ type: Boolean }) server = false;

  /** Show the busy overlay (or skeleton rows, while there is nothing to dim). */
  @property({ type: Boolean }) loading = false;

  /** Tighter row padding — Bootstrap's `table-sm`. */
  @property({ type: Boolean }) compact = false;

  /** Zebra striping. Switch it off with `striped="false"`. */
  @property({ converter: flag }) striped = true;

  /** Highlight the row under the pointer. */
  @property({ type: Boolean }) hover = false;

  /** Visible caption above the table. Also becomes its accessible name. */
  @property({ type: String }) caption = '';

  /** Render the caption for assistive technology only. */
  @property({ converter: flag, attribute: 'caption-hidden' }) captionHidden = true;

  /**
   * Render as the content of the card around it: no card of its own, and the tab strip's affordances
   * handed to that card's header.
   *
   * Left unset it detects the case - a table inside a `.card-body` is nested in a card by definition -
   * so a consumer who puts a listing in a `<lia-card>` gets the right thing without knowing this
   * exists. Set it explicitly to force either behaviour.
   */
  @property({ converter: flag }) attached?: boolean;

  /** The filter currently in force, shown as a chip in the tab strip. */
  @property({ attribute: false }) search?: TableSearchState;

  /**
   * Controlled column visibility. Leave unset to let the table manage it
   * itself (seeded from {@link defaultTableColumns}).
   */
  @property({ attribute: false }) visibleColumns?: string[];

  /** Controlled row selection. Leave unset to let the table manage it itself. */
  @property({ attribute: false }) selectedKeys?: Array<string | number>;

  /**
   * Which rows are expanded, by {@link TableListing.rowKey}.
   *
   * Controlled throughout — the table renders the detail region and reports a toggle through
   * `lia-row-toggle`, and never opens or closes a row itself. That is deliberate and matches
   * `selectedKeys`: the consumer usually has to *fetch* what goes in the region, so it owns whether
   * the region is open.
   */
  @property({ attribute: false }) expandedKeys?: Array<string | number>;

  /** Persist the column choice under this `localStorage` key. */
  @property({ type: String, attribute: 'storage-key' }) storageKey = '';

  /** Allow the sort cycle to return to "unsorted". */
  @property({ converter: flag, attribute: 'allow-unsorted' }) allowUnsorted = true;

  /** Number of skeleton rows drawn while loading an empty table. */
  @property({ type: Number, attribute: 'skeleton-rows' }) skeletonRows = 5;

  /** Overrides for the cell renderers' strings, glyphs and date formats. */
  @property({ attribute: false }) format?: CellFormatOptions;

  /** Every string the table chrome renders. */
  @property({ attribute: false }) labels: Partial<TableLabels> = {};

  /** Buttons offered inside the empty state. */
  @property({ attribute: false }) emptyActions: ActionDescriptor[] = [];

  /** Icon shown in the empty state. */
  @property({ type: String, attribute: 'empty-icon' }) emptyIcon = 'fa-solid fa-inbox';

  /** Show pagination in the card footer when the listing carries it. */
  @property({ type: Boolean, attribute: 'hide-pagination' }) hidePagination = false;

  /** Show the rows-per-page selector next to the pager. */
  @property({ type: Boolean, attribute: 'show-per-page' }) showPerPage = false;

  /** Show the "1–20 of 73" summary next to the pager. */
  @property({ type: Boolean, attribute: 'show-summary' }) showSummary = false;

  @state() private selection: Array<string | number> = [];
  @state() private columnSelection?: string[];
  @state() private internalSearch?: TableSearchState;
  @state() private searchOpen = false;
  @state() private columnsOpen = false;
  @state() private helpOpen = false;
  @state() private searchDraft: TableSearchState = { field: '', text: '' };
  @state() private columnDraft: string[] = [];

  private readonly instanceId = uid('lia-table');
  private restoredStorageKey = '';

  /* ---------------- lifecycle ---------------- */

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('selectedKeys') && this.selectedKeys) {
      this.selection = [...this.selectedKeys];
    }
    // Compared by content, and honouring `undefined`. By content because a consumer that recomputes
    // its column list every render hands over a new array every time, and copying it into state would
    // schedule a second update per render for ever. Honouring `undefined` because a controlled
    // consumer has to be able to say "back to the declared default" as well as "these columns" — the
    // list it last set would otherwise stay in force after the column manager's Reset, so Reset would
    // reach the consumer, come back as "nothing chosen", and change nothing on screen.
    if (changed.has('visibleColumns') && !sameColumns(this.columnSelection, this.visibleColumns)) {
      this.columnSelection = this.visibleColumns ? [...this.visibleColumns] : undefined;
    }
    if (changed.has('storageKey') || changed.has('listing')) this.restoreColumns();
  }

  /* ---------------- derived state ---------------- */

  private get text(): TableLabels {
    return { ...DEFAULT_TABLE_LABELS, ...this.labels };
  }

  /** The listing id, falling back to a generated one so modal ids stay unique. */
  get listingId(): string {
    return this.listing.id || this.instanceId;
  }

  /** The filter in force — the `search` property, or the one applied in the dialog. */
  get activeSearch(): TableSearchState | undefined {
    const current = this.search ?? this.internalSearch;
    return current && current.text !== '' ? current : undefined;
  }

  /** Keys of the currently selected rows. */
  get selectedRowKeys(): Array<string | number> {
    return [...this.selection];
  }

  /** The selected rows that are on the current page. */
  get selectedRows(): Row[] {
    const selected = new Set(this.selection);
    return this.listing.rows.filter((row, index) => selected.has(this.rowKey(row, index)));
  }

  /** The columns actually rendered, in listing order. */
  get columns(): TableColumn<Row>[] {
    const visible = this.columnSelection ?? defaultTableColumns(this.listing.columns);
    const allowed = new Set(visible);
    return this.listing.columns.filter(
      (column) => column.locked === true || allowed.has(column.key)
    );
  }

  private get searchableColumns(): TableColumn<Row>[] {
    return this.listing.columns.filter((column) => column.searchable !== false);
  }

  private get selectable(): boolean {
    return this.listing.selectable === true;
  }

  private get hasRowActions(): boolean {
    return typeof this.listing.rowActions === 'function';
  }

  private rowKey(row: Row, index: number): string | number {
    return this.listing.rowKey?.(row) ?? index;
  }

  /* ---------------- column persistence ---------------- */

  private get storageId(): string {
    return this.storageKey ? `${this.storageKey}:${this.listingId}` : '';
  }

  private restoreColumns(): void {
    const key = this.storageId;
    if (!key || key === this.restoredStorageKey || this.visibleColumns) return;
    this.restoredStorageKey = key;
    try {
      const stored = globalThis.localStorage?.getItem(key);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        this.columnSelection = parsed.filter((entry): entry is string => typeof entry === 'string');
      }
    } catch {
      /* a corrupt or unavailable store must never break the listing */
    }
  }

  private persistColumns(columns: string[] | undefined): void {
    const key = this.storageId;
    if (!key) return;
    try {
      if (columns) globalThis.localStorage?.setItem(key, JSON.stringify(columns));
      else globalThis.localStorage?.removeItem(key);
    } catch {
      /* storage may be full or blocked — the choice simply is not remembered */
    }
  }

  /* ---------------- interaction ---------------- */

  private handleSort(column: TableColumn<Row>): void {
    const sort = this.listing.sort;
    const current = sort && sort.field === column.key ? sort.order : undefined;
    const next = nextSortOrder(current, this.allowUnsorted);
    // An empty `field` is how the table reports "no sorting at all".
    this.emit<SortState>(
      'lia-sort',
      next ? { field: column.key, order: next } : { field: '', order: 'asc' }
    );
  }

  private setSelection(keys: Array<string | number>): void {
    this.selection = keys;
    const selected = new Set(keys);
    const rows = this.listing.rows.filter((row, index) => selected.has(this.rowKey(row, index)));
    this.emit<{ rows: unknown[]; keys: Array<string | number> }>('lia-selection-change', {
      rows,
      keys: [...keys],
    });
  }

  private toggleRow(key: string | number, checked: boolean): void {
    const next = this.selection.filter((entry) => entry !== key);
    if (checked) next.push(key);
    this.setSelection(next);
  }

  private toggleAll(checked: boolean): void {
    const pageKeys = this.listing.rows.map((row, index) => this.rowKey(row, index));
    if (!checked) {
      const onPage = new Set(pageKeys);
      this.setSelection(this.selection.filter((key) => !onPage.has(key)));
      return;
    }
    const merged = new Set(this.selection);
    for (const key of pageKeys) merged.add(key);
    this.setSelection([...merged]);
  }

  /** Drop the whole selection and announce it. */
  clearSelection(): void {
    this.setSelection([]);
  }

  private openSearch(): void {
    const current = this.activeSearch;
    const preferred =
      this.searchableColumns.find((column) => column.defaultSearchField)?.key ??
      this.searchableColumns[0]?.key ??
      '';
    this.searchDraft = { field: current?.field || preferred, text: current?.text ?? '' };
    this.searchOpen = true;
  }

  private applySearch(): void {
    const next: TableSearchState = { ...this.searchDraft };
    this.internalSearch = next;
    this.searchOpen = false;
    this.emit<TableSearchState>('lia-search', next);
  }

  private clearFilter(): void {
    const next: TableSearchState = { field: this.activeSearch?.field ?? '', text: '' };
    this.internalSearch = next;
    this.emit<TableSearchState>('lia-search', next);
  }

  private openColumns(): void {
    this.columnDraft = this.columns.map((column) => column.key);
    this.columnsOpen = true;
  }

  /** True once the listing has anything to explain — an empty `help` object shows no affordance. */
  private get hasHelp(): boolean {
    const help = this.listing.help;
    if (!help) return false;
    return Boolean(
      help.description || (help.columns?.length ?? 0) > 0 || (help.notes?.length ?? 0) > 0
    );
  }

  private openHelp(): void {
    this.helpOpen = true;
  }

  /** True when this table is the content of a card and should not draw a second one inside it. */
  private get isAttached(): boolean {
    return this.attached ?? this.closest('.card-body') !== null;
  }

  private applyColumns(columns: string[]): void {
    this.columnSelection = columns;
    this.columnsOpen = false;
    this.persistColumns(columns);
    this.emit<{ columns: string[] }>('lia-columns-change', { columns: [...columns] });
  }

  private resetColumns(): void {
    this.columnSelection = undefined;
    this.columnsOpen = false;
    this.persistColumns(undefined);
    const columns = defaultTableColumns(this.listing.columns);
    this.emit<{ columns: string[] }>('lia-columns-change', { columns });
  }

  /* ---------------- rendering: chrome ---------------- */

  /** The tab strip above the card, for a table that is not inside one. */
  private renderTools(): unknown {
    const buttons = this.renderToolButtons();
    if (buttons === nothing) return nothing;

    return html`<div class="d-flex justify-content-end mt-n2">
      <div class="lia-table-tools small me-3 px-2 py-1 d-inline-flex align-items-center gap-2">
        ${buttons}
      </div>
    </div>`;
  }

  /**
   * The same affordances, bare, for a card header to place among its own.
   *
   * Attached mode renders these through the card rather than here, so a listing inside a card has one
   * header rather than a header and a tab strip a few pixels below it.
   */
  private renderToolStrip(): unknown {
    const buttons = this.renderToolButtons();
    if (buttons === nothing) return nothing;

    return html`<span class="small d-inline-flex align-items-center gap-2">${buttons}</span>`;
  }

  private renderToolButtons(): unknown {
    const text = this.text;
    const filter = this.activeSearch;
    const showSearch = this.listing.noSearch !== true && this.searchableColumns.length > 0;
    const showColumns = this.listing.noColumnManager !== true && this.listing.columns.length > 1;
    const showHelp = this.hasHelp;
    if (!showSearch && !showColumns && !showHelp && !filter) return nothing;

    const fieldLabel = filter
      ? (this.listing.columns.find((column) => column.key === filter.field)?.label ?? '')
      : '';

    return html`
        ${filter
          ? html`<span class="d-inline-flex align-items-center gap-1">
              <span class="text-body-secondary"
                >${text.filter}${fieldLabel ? html` (${fieldLabel})` : nothing}:</span
              >
              <strong>${filter.text}</strong>
              <button
                type="button"
                class="btn btn-link btn-sm p-0 lh-1 text-reset"
                title=${text.clearFilter}
                aria-label=${text.clearFilter}
                @click=${() => this.clearFilter()}
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </span>`
          : nothing}
        ${showSearch
          ? html`<button
              type="button"
              class="btn btn-link btn-sm p-0 lh-1 text-reset"
              title=${text.search}
              aria-label=${text.search}
              aria-haspopup="dialog"
              @click=${() => this.openSearch()}
            >
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            </button>`
          : nothing}
        ${showColumns
          ? html`<button
              type="button"
              class="btn btn-link btn-sm p-0 lh-1 text-reset"
              title=${text.columns}
              aria-label=${text.columns}
              aria-haspopup="dialog"
              @click=${() => this.openColumns()}
            >
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
            </button>`
          : nothing}
        ${this.serverToggle
          ? html`<button
              type="button"
              class=${cx('btn btn-link btn-sm p-0 lh-1', this.server ? 'text-primary' : 'text-reset')}
              title=${this.server ? text.scopeAll : text.scopePage}
              aria-label=${this.server ? text.scopeAll : text.scopePage}
              aria-pressed=${this.server ? 'true' : 'false'}
              @click=${() => this.toggleServer()}
            >
              <i
                class=${this.server ? 'fa-solid fa-database' : 'fa-solid fa-table-list'}
                aria-hidden="true"
              ></i>
            </button>`
          : nothing}
        ${showHelp
          ? html`<button
              type="button"
              class="btn btn-link btn-sm p-0 lh-1 text-reset"
              title=${text.help}
              aria-label=${text.help}
              aria-haspopup="dialog"
              @click=${() => this.openHelp()}
            >
              <i class="fa-solid fa-circle-question" aria-hidden="true"></i>
            </button>`
          : nothing}`;
  }

  /**
   * Flip between sorting and searching the rows on screen and asking the server for the answer.
   *
   * The table only reports the choice; the consumer owns it, because only the consumer can re-issue
   * the query - and because the choice usually belongs in the URL, so a shared link reproduces the
   * ordering the sender was looking at.
   */
  private toggleServer(): void {
    this.emit<{ server: boolean }>('lia-scope-change', { server: !this.server });
  }

  private renderBulkBar(): unknown {
    if (!this.selectable) return nothing;
    const count = this.selection.length;
    if (count === 0) return nothing;
    const text = this.text;

    return html`<div
      class="card-header d-flex flex-wrap align-items-center gap-2 bg-body-tertiary"
      role="group"
      aria-label=${text.bulkActions}
    >
      <span class="fw-semibold" aria-live="polite"
        >${formatLabel(text.selection, { count })}</span
      >
      <button type="button" class="btn btn-link btn-sm p-0" @click=${() => this.clearSelection()}>
        ${text.clearSelection}
      </button>
      <div class="ms-auto d-flex flex-wrap align-items-center gap-1">
        ${renderActions(this.listing.bulkActions, {
          host: this,
          size: 'sm',
          // The event detail is built by `renderAction` and dispatched right
          // after this hook, so attaching the selection here is what turns a
          // plain action into a bulk action.
          onAction: (detail: ActionEventDetail<Row>) => {
            detail.rows = this.selectedRows;
          },
        })}
      </div>
    </div>`;
  }

  /* ---------------- rendering: table ---------------- */

  private renderHeaderCell(column: TableColumn<Row>): TemplateResult {
    const text = this.text;
    const classes = cx('p-3', column.class);
    if (column.sortable !== true) {
      return html`<th scope="col" class=${classes}>${column.label}</th>`;
    }

    const sort = this.listing.sort;
    const active = sort && sort.field === column.key ? sort.order : undefined;
    const next = nextSortOrder(active, this.allowUnsorted);
    const title =
      next === 'asc' ? text.sortAscending : next === 'desc' ? text.sortDescending : text.clearSorting;
    const icon =
      active === 'asc'
        ? 'fa-solid fa-arrow-up-short-wide'
        : active === 'desc'
          ? 'fa-solid fa-arrow-down-wide-short'
          : 'fa-solid fa-sort';

    return html`<th
      scope="col"
      class=${classes}
      aria-sort=${active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        class=${SORT_BUTTON_CLASS}
        title=${title}
        @click=${() => this.handleSort(column)}
      >
        <span>${column.label}</span>
        <i class=${cx(icon, !active && 'opacity-50')} aria-hidden="true"></i>
        <span class="visually-hidden">${title}</span>
      </button>
    </th>`;
  }

  private renderHead(): TemplateResult {
    const text = this.text;
    const rows = this.listing.rows;
    const pageKeys = rows.map((row, index) => this.rowKey(row, index));
    const selected = new Set(this.selection);
    const onPage = pageKeys.filter((key) => selected.has(key)).length;
    const allSelected = pageKeys.length > 0 && onPage === pageKeys.length;

    return html`<thead>
      <tr>
        ${this.selectable
          ? html`<th scope="col" class="p-3 lia-table-select">
              <input
                class="form-check-input mt-0"
                type="checkbox"
                aria-label=${text.selectAll}
                .checked=${allSelected}
                .indeterminate=${onPage > 0 && !allSelected}
                @change=${(event: Event) =>
                  this.toggleAll((event.currentTarget as HTMLInputElement).checked)}
              />
            </th>`
          : nothing}
        ${this.columns.map((column) => this.renderHeaderCell(column))}
        ${this.hasRowActions
          ? html`<th scope="col" class="p-3 text-end">${text.actions}</th>`
          : nothing}
      </tr>
    </thead>`;
  }

  /** Whether the consumer gave this table expandable rows at all. */
  private get expandable(): boolean {
    return typeof this.listing.rowDetail === 'function';
  }

  /** The column count a full-width cell has to span. */
  private get columnCount(): number {
    return this.columns.length + (this.selectable ? 1 : 0) + (this.hasRowActions ? 1 : 0);
  }

  /** Whether a row is currently expanded. Controlled by the consumer, like `selectedKeys`. */
  private isExpanded(key: string | number): boolean {
    return this.expandedKeys?.includes(key) ?? false;
  }

  /**
   * The id of a row's detail region.
   *
   * Deterministic and **documented as a contract**, so a consumer's trigger can point
   * `aria-controls` at it without having to ask the table for anything.
   */
  private detailId(key: string | number): string {
    return `${this.listingId}-detail-${key}`;
  }

  /**
   * The expanded region under a row, when the consumer has one for it.
   *
   * It is an annotation on a row rather than a row of the result, which is the whole of why it is
   * rendered here and not passed in as data: `lia-data-table` must never sort, search or paginate it,
   * and keying on `rowKey` is what makes it follow its row through a re-sort instead of staying
   * behind at whatever position it opened in.
   */
  private renderDetail(row: Row, key: string | number): TemplateResult | typeof nothing {
    if (!this.listing.rowDetail || !this.isExpanded(key)) return nothing;

    return html`<tr class="lia-table-detail">
      <td class="px-3" colspan=${Math.max(1, this.columnCount)} id=${this.detailId(key)}>
        ${this.listing.rowDetail(row)}
      </td>
    </tr>`;
  }

  private renderRow(row: Row, index: number): TemplateResult {
    const text = this.text;
    const key = this.rowKey(row, index);
    const isSelected = this.selection.includes(key);
    const actions = this.listing.rowActions?.(row) ?? [];
    const expandable = this.expandable;

    const rowClass = cx(
      this.listing.rowClass?.(row),
      isSelected && 'table-active',

      // `table-striped` stripes `tr:nth-of-type(odd)`, and a detail `<tr>` in the flow puts every
      // stripe below an open row out of phase. So a table that can expand stripes its *data* rows
      // by index here instead, which counts what a reader counts.
      this.striped && this.expandable && index % 2 === 1 && 'lia-table-stripe'
    );

    return html`<tr
      class=${ifDefined(rowClass || undefined)}
      aria-expanded=${ifDefined(expandable ? String(this.isExpanded(key)) : undefined)}
      aria-controls=${ifDefined(expandable && this.isExpanded(key) ? this.detailId(key) : undefined)}
    >
      ${this.selectable
        ? html`<td class="px-3 lia-table-select">
            <input
              class="form-check-input mt-0"
              type="checkbox"
              aria-label=${formatLabel(text.select, { row: typeof key === 'number' ? index + 1 : key })}
              .checked=${isSelected}
              @change=${(event: Event) =>
                this.toggleRow(key, (event.currentTarget as HTMLInputElement).checked)}
            />
          </td>`
        : nothing}
      ${this.columns.map(
        (column) => html`<td class=${cx('px-3', column.class)}>
          ${renderCell(row, column, { index, host: this, format: this.format })}
        </td>`
      )}
      ${this.hasRowActions
        ? html`<td class="px-3 text-end text-nowrap">
            ${renderActions(actions, { host: this, size: 'sm', row, index })}
          </td>`
        : nothing}
    </tr>
    ${this.renderDetail(row, key)}`;
  }

  private renderSkeleton(): TemplateResult {
    const columnCount = this.columnCount;
    const rows = Math.max(1, this.skeletonRows);
    return html`<tbody aria-hidden="true">
      ${Array.from(
        { length: rows },
        () => html`<tr class="placeholder-glow">
          ${Array.from(
            { length: Math.max(1, columnCount) },
            () => html`<td class="px-3"><span class="placeholder col-8"></span></td>`
          )}
        </tr>`
      )}
    </tbody>`;
  }

  private renderTable(): TemplateResult {
    const text = this.text;
    const caption = this.caption;
    const skeleton = this.loading && this.listing.rows.length === 0;

    return html`<div class="table-responsive">
      <table
        class=${cx(
          'table',
          'table-borderless',
          this.striped && !this.expandable && 'table-striped',
          this.hover && 'table-hover',
          this.compact && 'table-sm',
          'align-middle',
          'mb-0'
        )}
        aria-label=${ifDefined(caption ? undefined : text.table)}
        aria-busy=${this.loading ? 'true' : 'false'}
      >
        ${caption
          ? html`<caption class=${cx(this.captionHidden ? 'visually-hidden' : 'caption-top')}>
              ${caption}
            </caption>`
          : nothing}
        ${this.renderHead()}
        ${skeleton
          ? this.renderSkeleton()
          : html`<tbody>
              ${this.listing.rows.map((row, index) => this.renderRow(row, index))}
            </tbody>`}
      </table>
    </div>`;
  }

  private renderFooter(): unknown {
    const pagination = this.listing.pagination;
    if (this.hidePagination || !pagination) return nothing;
    const multiPage = pagination.lastPage > 1;
    if (!multiPage && !this.showPerPage && !this.showSummary) return nothing;

    return html`<div class="card-footer border-top">
      <lia-pagination
        .state=${pagination}
        ?show-per-page=${this.showPerPage}
        ?show-summary=${this.showSummary}
        ?always-visible=${this.showSummary || this.showPerPage}
      ></lia-pagination>
    </div>`;
  }

  private renderEmpty(): TemplateResult {
    const text = this.text;
    return html`<lia-empty-state
      .title=${this.listing.emptyTitle ?? text.emptyTitle}
      .message=${this.listing.emptyMessage ?? text.emptyMessage}
      icon=${this.emptyIcon}
      .actions=${this.emptyActions}
    ></lia-empty-state>`;
  }

  private renderOverlay(): unknown {
    if (!this.loading || this.listing.rows.length === 0) return nothing;
    return html`<div
      class=${OVERLAY_CLASS}
      role="status"
    >
      <span class="spinner-border text-primary" aria-hidden="true"></span>
      <span class="visually-hidden">${this.text.loading}</span>
    </div>`;
  }

  /* ---------------- rendering: dialogs ---------------- */

  private stopInternal(event: Event): void {
    // Dialog chrome must not look like a listing action to the consumer.
    event.stopPropagation();
  }

  private renderSearchDialog(): unknown {
    if (this.listing.noSearch === true) return nothing;
    const text = this.text;
    const fieldId = `${this.instanceId}-search-field`;
    const textId = `${this.instanceId}-search-text`;
    const columns = this.searchableColumns;
    if (columns.length === 0) return nothing;

    const content = html`<p>${text.searchDescription}</p>
      <div class="mb-3">
        <label class="form-label" for=${fieldId}>${text.searchField}</label>
        <select
          class="form-select"
          id=${fieldId}
          .value=${this.searchDraft.field}
          @change=${(event: Event) => {
            this.searchDraft = {
              ...this.searchDraft,
              field: (event.currentTarget as HTMLSelectElement).value,
            };
          }}
        >
          ${columns.map(
            (column) =>
              html`<option value=${column.key} ?selected=${column.key === this.searchDraft.field}>
                ${column.label}
              </option>`
          )}
        </select>
      </div>
      <div>
        <label class="form-label" for=${textId}>${text.searchText}</label>
        <input
          class="form-control"
          id=${textId}
          type="search"
          placeholder=${text.searchPlaceholder}
          .value=${this.searchDraft.text}
          @input=${(event: Event) => {
            this.searchDraft = {
              ...this.searchDraft,
              text: (event.currentTarget as HTMLInputElement).value,
            };
          }}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              this.applySearch();
            }
          }}
        />
      </div>`;

    return html`<lia-modal
      modal-id=${`${this.listingId}-search`}
      heading=${text.searchTitle}
      .open=${this.searchOpen}
      .content=${content}
      .footerActions=${[
        { id: 'cancel', label: text.cancel, variant: 'secondary' },
        { id: 'apply', label: text.apply, variant: 'primary' },
      ] satisfies ActionDescriptor[]}
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        this.stopInternal(event);
        if (event.detail.id === 'apply') this.applySearch();
        else this.searchOpen = false;
      }}
      @lia-modal-hide=${(event: Event) => {
        this.stopInternal(event);
        this.searchOpen = false;
      }}
      @lia-modal-show=${(event: Event) => this.stopInternal(event)}
    ></lia-modal>`;
  }

  /**
   * The `?` dialog: what the columns mean, and how to read the table.
   *
   * Column explanations are matched to the listing's own columns and rendered in listing order, so
   * the dialog reads top to bottom in the same order as the header row. An explanation for a column
   * that does not exist is dropped rather than shown detached from anything.
   */
  private renderHelpDialog(): unknown {
    if (!this.hasHelp) return nothing;
    const text = this.text;
    const help = this.listing.help!;

    const explained = (help.columns ?? [])
      .map((entry) => ({
        label: this.listing.columns.find((column) => column.key === entry.column)?.label,
        text: entry.text,
      }))
      .filter((entry) => entry.label !== undefined);

    const content = html`
      ${help.description ? html`<p>${help.description}</p>` : nothing}
      ${explained.length > 0
        ? html`<h6 class="mt-3">${text.helpColumns}</h6>
            <dl class="row mb-0 small">
              ${explained.map(
                (entry) => html`<dt class="col-sm-4 text-truncate">${entry.label}</dt>
                  <dd class="col-sm-8">${entry.text}</dd>`
              )}
            </dl>`
        : nothing}
      ${(help.notes?.length ?? 0) > 0
        ? html`<h6 class="mt-3">${text.helpNotes}</h6>
            ${help.notes!.map(
              (note) => html`<p class="small mb-2">
                ${note.title ? html`<strong>${note.title}</strong> ` : nothing}${note.text}
              </p>`
            )}`
        : nothing}
    `;

    return html`<lia-modal
      modal-id=${`${this.listingId}-help`}
      heading=${help.title ?? text.helpTitle}
      .open=${this.helpOpen}
      .content=${content}
      .footerActions=${[{ id: 'close', label: text.close, variant: 'secondary' }] satisfies ActionDescriptor[]}
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        this.stopInternal(event);
        this.helpOpen = false;
      }}
      @lia-modal-hide=${(event: Event) => {
        this.stopInternal(event);
        this.helpOpen = false;
      }}
      @lia-modal-show=${(event: Event) => this.stopInternal(event)}
    ></lia-modal>`;
  }

  private renderColumnsDialog(): unknown {
    if (this.listing.noColumnManager === true) return nothing;
    const text = this.text;
    const columns = this.listing.columns;
    if (columns.length < 2) return nothing;
    const draft = new Set(this.columnDraft);

    const content = html`<p>${text.columnsDescription}</p>
      ${columns.map((column) => {
        const id = `${this.instanceId}-column-${column.key.replace(/[^\w-]/g, '_')}`;
        const locked = column.locked === true;
        return html`<div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            id=${id}
            value=${column.key}
            ?disabled=${locked}
            .checked=${locked || draft.has(column.key)}
            @change=${(event: Event) => {
              const checked = (event.currentTarget as HTMLInputElement).checked;
              const next = this.columnDraft.filter((key) => key !== column.key);
              if (checked) next.push(column.key);
              this.columnDraft = next;
            }}
          />
          <label class="form-check-label" for=${id}>${column.label}</label>
        </div>`;
      })}`;

    return html`<lia-modal
      modal-id=${`${this.listingId}-columns`}
      heading=${text.columnsTitle}
      .open=${this.columnsOpen}
      .content=${content}
      .footerActions=${[
        { id: 'select-all', label: text.selectAllColumns, variant: 'outline-secondary' },
        { id: 'clear-all', label: text.clearColumns, variant: 'outline-secondary' },
        { id: 'reset', label: text.resetColumns, variant: 'outline-secondary' },
        { id: 'cancel', label: text.cancel, variant: 'secondary' },
        { id: 'save', label: text.save, variant: 'primary' },
      ] satisfies ActionDescriptor[]}
      @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
        this.stopInternal(event);
        switch (event.detail.id) {
          case 'select-all':
            this.columnDraft = columns.map((column) => column.key);
            break;
          case 'clear-all':
            this.columnDraft = columns.filter((column) => column.locked === true).map((c) => c.key);
            break;
          case 'reset':
            this.resetColumns();
            break;
          case 'save':
            this.applyColumns([...this.columnDraft]);
            break;
          default:
            this.columnsOpen = false;
        }
      }}
      @lia-modal-hide=${(event: Event) => {
        this.stopInternal(event);
        this.columnsOpen = false;
      }}
      @lia-modal-show=${(event: Event) => this.stopInternal(event)}
    ></lia-modal>`;
  }

  /** Dialogs declared by row actions, deduplicated by id. */
  private renderActionDialogs(): unknown {
    if (!this.hasRowActions) return nothing;
    const dialogs = new Map<string, ModalDescriptor>();
    for (const row of this.listing.rows) {
      for (const action of this.listing.rowActions?.(row) ?? []) {
        if (action.modal && action.visible !== false) dialogs.set(action.modal.id, action.modal);
      }
    }
    if (dialogs.size === 0) return nothing;
    return html`${[...dialogs.values()].map(
      (descriptor) =>
        html`<lia-modal
          .descriptor=${descriptor}
          modal-id=${descriptor.id}
          .closeLabel=${this.text.close}
        ></lia-modal>`
    )}`;
  }

  /* ---------------- render ---------------- */

  /**
   * Hands the tab strip to the surrounding card, or takes it back.
   *
   * Done here rather than in `render()` because it writes to another element: setting a property on
   * the card schedules the card's own update, and doing that from inside this element's render would
   * be a write during another component's read. The card renders whatever it is given, so the
   * handlers below stay bound to this table.
   */
  protected override updated(changed: PropertyValues): void {
    super.updated?.(changed);

    const card = this.closest('lia-card');
    if (!card) return;

    const attached = this.isAttached;
    if (attached) card.headerTools = this.renderToolStrip();
    else if (card.headerTools !== undefined) card.headerTools = undefined;
  }

  override render(): TemplateResult {
    const empty = this.listing.rows.length === 0 && !this.loading;
    const attached = this.isAttached;

    return html`
      ${attached ? nothing : this.renderTools()}
      ${empty
        ? this.renderEmpty()
        : html`<div class=${attached ? 'position-relative' : 'card position-relative'}>
            ${this.renderBulkBar()}${this.renderTable()}${this.renderFooter()}${this.renderOverlay()}
          </div>`}
      ${this.renderSearchDialog()}${this.renderColumnsDialog()}${this.renderHelpDialog()}${this.renderActionDialogs()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-table': LiaTable;
  }
}
