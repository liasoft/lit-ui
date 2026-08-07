import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, IconName, TableListing, Variant } from '../../core/types.js';
import { renderRich } from '../../core/utils.js';
import { renderActions } from '../primitives/render-action.js';
import { flag } from '../layout/flag.js';
import { applyColumnPrefs, loadColumnPrefs, type ColumnPrefsOptions } from './column-prefs.js';
import type { FilterChip, QuickFilter } from './filter-bar.js';
import './column-manager.js';
import './filter-bar.js';
import './table-search.js';
// Registers `<lia-table>`, which renders the listing itself.
import '../table/index.js';

/** How `<lia-crud-page>` offers searching. */
export type CrudSearchMode = 'inline' | 'modal' | 'none';

/**
 * A complete list page in one element: heading, toolbar, filter chips, search,
 * the column manager and the table with its pagination.
 *
 * This is the piece that makes the kit a CRUD system rather than a widget bag.
 * Hand it a `TableListing` and a few labels and you have a working overview —
 * the same shape every listing in the reference panel has, minus the
 * copy-pasted template.
 *
 * It owns no data. Sorting, paging, searching and filtering are all announced
 * as events (`lia-sort`, `lia-page-change`, `lia-search`, `lia-filter-*`,
 * `lia-columns-change`, `lia-selection-change`, `lia-action`) and bubble out of
 * the element, so one listener on the page — or a {@link CrudController} — can
 * serve the lot.
 *
 * The one thing it does keep is the **column selection**, because that is a
 * user preference rather than application state: it is read from storage on
 * first render and re-applied to the listing you pass in. Set `persist="false"`
 * to take that over yourself.
 *
 * @example
 * ```ts
 * html`<lia-crud-page
 *   title="Users"
 *   icon="fa-solid fa-users"
 *   description="Everyone with access to this workspace"
 *   .listing=${listing}
 *   .actions=${[{ id: 'add', label: 'Add user', icon: 'fa-solid fa-plus-circle', variant: 'primary' }]}
 *   .filters=${chips}
 *   .loading=${loading}
 *   @lia-action=${(e: CustomEvent) => this.run(e.detail.id)}
 *   @lia-search=${(e: CustomEvent) => this.search(e.detail)}
 * ></lia-crud-page>`;
 * ```
 *
 * @example
 * ```ts
 * // With the controller, a whole list page is roughly ten lines.
 * const crud = createCrudController({ id: 'users', columns, fetch: loadUsers,
 *   onChange: () => this.requestUpdate(), autoLoad: true });
 * // firstUpdated: crud.connect(this.querySelector('lia-crud-page')!);
 * html`<lia-crud-page
 *   title="Users"
 *   .listing=${crud.listing}
 *   .allColumns=${crud.allColumns}
 *   .filters=${crud.filterChips}
 *   .loading=${crud.state.loading}
 *   .error=${crud.state.error ?? ''}
 * ></lia-crud-page>`;
 * ```
 */
@customElement('lia-crud-page')
export class LiaCrudPage extends LiaElement {
  /**
   * Page title.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute. Authoring it *as* an
   * attribute still works, but the browser will then also show it as a
   * tooltip — bind the property (`.title=${…}`) if that bothers you.
   */
  @property({ type: String }) override title = '';

  @property({ type: String }) icon: IconName = '';

  /** Secondary line under the title. Trusted HTML is allowed. */
  @property({ type: String }) description = '';

  /** The listing to render. */
  @property({ attribute: false }) listing?: TableListing;

  /**
   * Every column the listing *could* show, for the column manager. Defaults to
   * `listing.columns` — set it explicitly when you already narrow the listing
   * down yourself (as {@link CrudController} does).
   */
  @property({ attribute: false }) allColumns?: TableListing['columns'];

  /** Toolbar next to the heading, e.g. an "Add" button. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Active filters, rendered as removable chips. */
  @property({ attribute: false }) filters: FilterChip[] = [];

  /** Selects rendered before the chips. */
  @property({ attribute: false }) quickFilters: QuickFilter[] = [];

  /** Dim the table and show a spinner while a request is in flight. */
  @property({ type: Boolean }) loading = false;

  /** Error message shown above the table. Empty hides the alert. */
  @property({ type: String }) error = '';

  /** Prepends a "back to overview" action to the toolbar. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Counter pill after the title. Defaults to the listing's total row count. */
  @property({ attribute: false }) badge?: { text: string | number; variant?: Variant };

  /** Render the heading block. Turn it off inside a `<lia-page>`. */
  @property({ converter: flag, attribute: 'show-heading' }) showHeading = true;

  /** How the search affordance is presented. */
  @property({ type: String, attribute: 'search-mode' }) searchMode: CrudSearchMode = 'inline';

  /** Search as the user types (inline mode only). */
  @property({ type: Boolean, attribute: 'live-search' }) liveSearch = false;

  /** Current search term, so it survives a re-render. */
  @property({ type: String, attribute: 'search-text' }) searchText = '';

  /** Currently selected search column. */
  @property({ type: String, attribute: 'search-field' }) searchField = '';

  /** Offer the column manager. */
  @property({ converter: flag, attribute: 'show-columns' }) showColumns = true;

  /** Store the column selection in `localStorage`, keyed by the listing id. */
  @property({ type: Boolean }) persist = true;

  /** Storage backend / key prefix for the column selection. */
  @property({ attribute: false }) storageOptions?: ColumnPrefsOptions;

  @property({ type: String, attribute: 'columns-label' }) columnsLabel = 'Manage table columns';

  @property({ type: String, attribute: 'search-label' }) searchLabel = 'Search';

  @property({ type: String, attribute: 'loading-label' }) loadingLabel = 'Loading…';

  /** Heading level of the title, for pages that need a different outline. */
  @property({ type: Number }) level: 1 | 2 | 3 | 4 | 5 | 6 = 5;

  /** Visible column keys. `undefined` means "not resolved yet". */
  @state() private columnSelection?: string[];

  @state() private columnsOpen = false;

  @state() private searchOpen = false;

  /** The listing id, or a stable fallback for a page without one. */
  private get listingId(): string {
    return this.listing?.id ?? 'listing';
  }

  /** Columns offered in the column manager. */
  get managedColumns(): TableListing['columns'] {
    return this.allColumns ?? this.listing?.columns ?? [];
  }

  /** The listing as handed to `<lia-table>`: columns narrowed, chrome disabled. */
  get resolvedListing(): TableListing | undefined {
    if (!this.listing) return undefined;
    // Applying the selection is idempotent: a listing that was already
    // narrowed (by a controller, say) passes through untouched, while an
    // unnarrowed one updates the moment the user closes the column manager.
    const narrowed = applyColumnPrefs(this.listing, this.columnSelection);
    // The page owns the search and column affordances, so the table must not
    // render its own or the user gets two of each.
    return { ...narrowed, noSearch: true, noColumnManager: true };
  }

  /** Open the column manager. */
  openColumnManager(): void {
    this.columnsOpen = true;
  }

  /** Open the search dialog (`search-mode="modal"`). */
  openSearch(): void {
    this.searchOpen = true;
  }

  /** Listing id the stored preferences were read for, so we read them once. */
  private columnsLoadedFor?: string;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('listing') && !changed.has('persist') && !changed.has('storageOptions')) {
      return;
    }
    const id = this.listingId;
    // Re-read only when the listing identity (or the storage config) changed —
    // otherwise every data refresh would undo the user's current choice.
    if (this.columnsLoadedFor === id && !changed.has('persist') && !changed.has('storageOptions')) {
      return;
    }
    this.columnsLoadedFor = id;
    // `undefined` means "not chosen": the definition's own defaults apply.
    this.columnSelection = this.persist
      ? loadColumnPrefs(id, this.storageOptions ?? {})
      : undefined;
  }

  private handleColumnsChange(event: CustomEvent<{ columns: string[] }>): void {
    // The event continues on to the host; we only mirror it locally so the
    // table updates without a round trip through the application.
    this.columnSelection = event.detail.columns;
  }

  private handleSearch(event: CustomEvent<{ field: string; text: string }>): void {
    // Same idea: mirror the request so a re-render cannot reset the input to
    // a stale value, while the event still reaches the host untouched.
    this.searchField = event.detail.field;
    this.searchText = event.detail.text;
  }

  private renderHeading(): TemplateResult | typeof nothing {
    if (!this.showHeading) return nothing;
    const actions = [...this.actions];
    if (this.backUrl) {
      actions.unshift({
        id: 'back',
        label: this.backLabel,
        icon: 'fa-solid fa-reply',
        href: this.backUrl,
        variant: 'outline-secondary',
      });
    }
    const total = this.listing?.pagination?.total;
    const badge = this.badge ?? (total ? { text: total } : undefined);
    const heading = html`${this.icon
      ? html`<i class="${this.icon} me-1" aria-hidden="true"></i>`
      : nothing}${this.title}${badge
      ? html` <small
          ><span class="badge rounded-pill text-bg-${badge.variant ?? 'secondary'}"
            >${badge.text}</span
          ></small
        >`
      : nothing}`;

    if (this.title === '' && this.description === '' && actions.length === 0) return nothing;

    return html`<div
      class="lia-crud-heading d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3"
    >
      <div class="min-w-0">
        ${this.title ? this.renderTitleTag(heading) : nothing}
        ${this.description
          ? html`<span class="text-body-secondary">${renderRich(this.description)}</span>`
          : nothing}
      </div>
      ${actions.length
        ? html`<div class="d-flex flex-wrap gap-1" role="group" aria-label=${this.title || 'Actions'}>
            ${renderActions(actions, {
              host: this,
              variant: 'outline-primary',
              labelResponsive: true,
            })}
          </div>`
        : nothing}
    </div>`;
  }

  private renderTitleTag(inner: unknown): TemplateResult {
    switch (this.level) {
      case 1:
        return html`<h1 class="h5 mb-1">${inner}</h1>`;
      case 2:
        return html`<h2 class="h5 mb-1">${inner}</h2>`;
      case 3:
        return html`<h3 class="h5 mb-1">${inner}</h3>`;
      case 4:
        return html`<h4 class="h5 mb-1">${inner}</h4>`;
      case 6:
        return html`<h6 class="h5 mb-1">${inner}</h6>`;
      default:
        return html`<h5 class="mb-1">${inner}</h5>`;
    }
  }

  private renderToolbar(): TemplateResult | typeof nothing {
    const columns = this.managedColumns;
    const hasFilters = this.filters.length > 0 || this.quickFilters.length > 0;
    const hasSearch = this.searchMode !== 'none' && columns.length > 0;
    const hasColumnManager = this.showColumns && columns.length > 0;
    if (!hasFilters && !hasSearch && !hasColumnManager) return nothing;

    return html`<div
      class="lia-crud-toolbar d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"
    >
      <lia-filter-bar
        .filters=${this.filters}
        .quickFilters=${this.quickFilters}
        ?disabled=${this.loading}
      ></lia-filter-bar>
      <div class="d-flex align-items-center gap-2 ms-auto">
        ${hasSearch && this.searchMode === 'inline'
          ? html`<lia-table-search
              inline
              ?live=${this.liveSearch}
              ?disabled=${this.loading}
              listing-id=${this.listingId}
              .columns=${columns}
              .field=${this.searchField}
              .text=${this.searchText}
              @lia-search=${(event: CustomEvent<{ field: string; text: string }>) =>
                this.handleSearch(event)}
            ></lia-table-search>`
          : nothing}
        ${hasSearch && this.searchMode === 'modal'
          ? html`<button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              title=${this.searchLabel}
              aria-label=${this.searchLabel}
              @click=${() => this.openSearch()}
            >
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            </button>`
          : nothing}
        ${hasColumnManager
          ? html`<button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              title=${this.columnsLabel}
              aria-label=${this.columnsLabel}
              @click=${() => this.openColumnManager()}
            >
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
            </button>`
          : nothing}
      </div>
    </div>`;
  }

  private renderTable(): TemplateResult {
    const listing = this.resolvedListing;
    return html`<div class="lia-crud-body position-relative">
      ${listing
        ? html`<lia-table
            class=${this.loading ? 'lia-crud-dimmed' : nothing}
            aria-busy=${this.loading ? 'true' : nothing}
            .listing=${listing}
          ></lia-table>`
        : nothing}
      ${this.loading
        ? html`<div
            class="lia-crud-spinner position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            role="status"
          >
            <span class="spinner-border text-primary" aria-hidden="true"></span>
            <span class="visually-hidden">${this.loadingLabel}</span>
          </div>`
        : nothing}
    </div>`;
  }

  protected override render(): TemplateResult {
    const columns = this.managedColumns;
    return html`${this.renderHeading()} ${this.renderToolbar()}
    ${this.error
      ? html`<div class="alert alert-danger" role="alert">${this.error}</div>`
      : nothing}
    ${this.renderTable()}
    ${this.showColumns && columns.length > 0
      ? html`<lia-column-manager
          listing-id=${this.listingId}
          .columns=${columns}
          .selected=${this.columnSelection}
          .open=${this.columnsOpen}
          ?persist=${this.persist}
          .storageOptions=${this.storageOptions}
          heading=${this.columnsLabel}
          @lia-columns-change=${(event: CustomEvent<{ columns: string[] }>) =>
            this.handleColumnsChange(event)}
          @lia-modal-hide=${() => (this.columnsOpen = false)}
        ></lia-column-manager>`
      : nothing}
    ${this.searchMode === 'modal' && columns.length > 0
      ? html`<lia-table-search
          listing-id=${this.listingId}
          heading=${this.searchLabel}
          .columns=${columns}
          .field=${this.searchField}
          .text=${this.searchText}
          .open=${this.searchOpen}
          @lia-search=${(event: CustomEvent<{ field: string; text: string }>) =>
            this.handleSearch(event)}
          @lia-modal-hide=${() => (this.searchOpen = false)}
        ></lia-table-search>`
      : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-crud-page': LiaCrudPage;
  }
}
