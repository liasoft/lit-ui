/**
 * Demo pages — Tables.
 *
 * Two elements do the work, and the difference between them is the whole
 * design of the family:
 *
 * - `<lia-table>` is **controlled**. It renders exactly the rows it is given
 *   and reports what the user asked for (`lia-sort`, `lia-search`,
 *   `lia-page-change`). That is the shape a paged API wants.
 * - `<lia-data-table>` is **uncontrolled**. Hand it a whole array and it sorts,
 *   filters and pages it itself. That is the shape a fully loaded list wants.
 *
 * The first page below implements the controlled loop for real — sorting,
 * paging, searching, selection and column preferences all work.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  PaginationState,
  SortState,
  TableColumn,
  TableListing,
  TableSearchState,
} from '@liasoft/lit-ui';
import {
  ELLIPSIS,
  LiaElement,
  cellValue,
  compareCellValues,
  nextSortOrder,
  paginationRange,
  renderCell,
} from '@liasoft/lit-ui';
import {
  demoProjects,
  demoUsers,
  filterUsers,
  projectColumns,
  projectListing,
  projectRowActions,
  someUsers,
  userBulkActions,
  userColumns,
  userColumnsCompact,
  userListing,
  userRowActions,
  type DemoUser,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * The controlled loop, implemented: `<lia-table>` asks, this element answers.
 *
 * @example
 * ```ts
 * html`<demo-table-listing></demo-table-listing>`;
 * ```
 */
@customElement('demo-table-listing')
export class DemoTableListing extends LiaElement {
  @state() private page = 1;
  @state() private perPage = 8;
  @state() private sort: SortState | undefined = { field: 'name', order: 'asc' };
  @state() private search: TableSearchState = { field: 'name', text: '' };
  @state() private selection: Array<string | number> = [];
  @state() private events: readonly LoggedEvent[] = [];
  @state() private loading = false;

  /** Rows after searching and sorting — what a server would have returned. */
  private get matched(): DemoUser[] {
    const rows = filterUsers(demoUsers, { text: this.search.text, field: this.search.field });
    const sort = this.sort;
    if (!sort || sort.field === '') return rows;
    const column = userColumns.find((entry) => entry.key === sort.field);
    if (!column) return rows;
    const direction = sort.order === 'desc' ? -1 : 1;
    return [...rows].sort(
      (a, b) => direction * compareCellValues(cellValue(a, column), cellValue(b, column))
    );
  }

  private get listing(): TableListing<DemoUser> {
    const rows = this.matched;
    const lastPage = Math.max(1, Math.ceil(rows.length / this.perPage));
    const page = Math.min(this.page, lastPage);
    const pagination: PaginationState = {
      currentPage: page,
      lastPage,
      perPage: this.perPage,
      total: rows.length,
    };

    return {
      id: 'members',
      columns: userColumns,
      rows: rows.slice((page - 1) * this.perPage, page * this.perPage),
      rowKey: (row) => row.id,
      rowClass: (row) => (row.active ? undefined : 'deactivated'),
      rowActions: userRowActions,
      selectable: true,
      bulkActions: userBulkActions,
      pagination,
      sort: this.sort,
      emptyTitle: 'Nothing matches',
      emptyMessage: 'Clear the search to see all 60 members again.',
    };
  }

  private log(type: string, detail?: unknown): void {
    this.events = logEvent(this.events, type, detail);
  }

  /** Every handler pretends to round-trip, so the loading skeleton is real. */
  private async reload(): Promise<void> {
    this.loading = true;
    await new Promise((resolve) => setTimeout(resolve, 250));
    this.loading = false;
  }

  private onSort(event: CustomEvent<SortState>): void {
    const next = event.detail;
    this.log('lia-sort', next);
    this.sort = next.field === '' ? undefined : next;
    this.page = 1;
    void this.reload();
  }

  private onPage(event: CustomEvent<{ page: number }>): void {
    this.log('lia-page-change', event.detail);
    this.page = event.detail.page;
    void this.reload();
  }

  private onSearch(event: CustomEvent<TableSearchState>): void {
    this.log('lia-search', event.detail);
    this.search = event.detail;
    this.page = 1;
    void this.reload();
  }

  private onSelection(event: CustomEvent<{ keys: Array<string | number> }>): void {
    this.log('lia-selection-change', { count: event.detail.keys.length });
    this.selection = event.detail.keys;
  }

  private onColumns(event: CustomEvent<{ columns: string[] }>): void {
    this.log('lia-columns-change', { count: event.detail.columns.length });
  }

  private onAction(event: CustomEvent<ActionEventDetail<DemoUser>>): void {
    this.log('lia-action', {
      id: event.detail?.id,
      row: event.detail?.row?.name,
      rows: event.detail?.rows?.length,
    });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Sort a column (three states), search, page, tick some rows, then open the column manager — all of it is this element answering events.'
      )}
      <lia-table
        .listing=${this.listing}
        .loading=${this.loading}
        .search=${this.search}
        .selectedKeys=${this.selection}
        show-summary
        show-per-page
        hover
        caption="Members of the fictional Orbit console"
        storage-key="demo-members"
        @lia-sort=${this.onSort}
        @lia-page-change=${this.onPage}
        @lia-search=${this.onSearch}
        @lia-selection-change=${this.onSelection}
        @lia-columns-change=${this.onColumns}
        @lia-per-page-change=${(event: CustomEvent<{ perPage: number }>) => {
          this.log('lia-per-page-change', event.detail);
          this.perPage = event.detail.perPage;
          this.page = 1;
        }}
        @lia-action=${this.onAction}
      ></lia-table>
      <div class="px-3 pb-3">
        ${eventLog(this.events, { title: 'What the table asked for' })}
      </div>
    `;
  }
}

/**
 * Stable references for the uncontrolled table.
 *
 * `<lia-data-table>` treats `sort` as a *controlled* property: whenever the
 * property changes identity it adopts the new value and forgets what the user
 * clicked. A fresh object literal in `render()` would therefore reset the sort
 * on every re-render — so the initial order lives here, next to the callbacks,
 * where its identity is stable.
 */
const PROJECT_SORT: SortState = { field: 'due', order: 'asc' };
const PROJECT_KEY = (row: (typeof demoProjects)[number]): string => row.id;
const PROJECT_CLASS = (row: (typeof demoProjects)[number]): string | undefined =>
  row.archived ? 'deactivated' : undefined;
const PROJECT_BULK: ActionDescriptor[] = [
  { id: 'export', label: 'Export', icon: 'fa-solid fa-file-arrow-down', variant: 'outline-secondary', size: 'sm' },
  { id: 'archive', label: 'Archive', icon: 'fa-solid fa-box-archive', variant: 'outline-secondary', size: 'sm' },
];
const PROJECT_EMPTY_ACTIONS: ActionDescriptor[] = [
  { id: 'create', label: 'Start a project', icon: 'fa-solid fa-plus', variant: 'primary' },
];

/** The uncontrolled counterpart: one array in, everything handled inside. */
@customElement('demo-data-table')
export class DemoDataTable extends LiaElement {
  @state() private loading = false;
  @state() private empty = false;
  @state() private events: readonly LoggedEvent[] = [];

  protected override render(): TemplateResult {
    return html`
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          aria-pressed=${this.loading}
          @click=${() => {
            this.loading = !this.loading;
          }}
        >
          <i class="fa-solid fa-spinner me-2" aria-hidden="true"></i>${this.loading
            ? 'Stop loading'
            : 'Show the loading skeleton'}
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          aria-pressed=${this.empty}
          @click=${() => {
            this.empty = !this.empty;
          }}
        >
          <i class="fa-solid fa-inbox me-2" aria-hidden="true"></i>${this.empty
            ? 'Restore the rows'
            : 'Show the empty state'}
        </button>
      </div>
      <lia-data-table
        listing-id="projects"
        per-page="8"
        hover
        show-per-page
        selectable
        caption="Projects, sorted and paged inside the element"
        empty-title="No projects"
        empty-message="Nothing is being delivered in this portfolio yet."
        .columns=${projectColumns}
        .rows=${this.empty ? [] : demoProjects}
        .rowKey=${PROJECT_KEY}
        .rowClass=${PROJECT_CLASS}
        .rowActions=${projectRowActions}
        .bulkActions=${PROJECT_BULK}
        .sort=${PROJECT_SORT}
        .loading=${this.loading}
        .emptyActions=${PROJECT_EMPTY_ACTIONS}
        @lia-sort=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-sort', event.detail);
        }}
        @lia-search=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-search', event.detail);
        }}
        @lia-action=${(event: CustomEvent<ActionEventDetail>) => {
          this.events = logEvent(this.events, 'lia-action', { id: event.detail?.id });
        }}
      ></lia-data-table>
      <div class="px-3 pb-3">
        ${eventLog(this.events, {
          title: 'Still announced, even though it handled them itself',
          placeholder: 'Sort or search — the element acts and tells you anyway.',
        })}
      </div>
    `;
  }
}

/** Pagination on its own, wired to a page number. */
@customElement('demo-pagination')
export class DemoPagination extends LiaElement {
  @state() private page = 7;
  @state() private perPage = 25;

  private get state(): PaginationState {
    return { currentPage: this.page, lastPage: 24, perPage: this.perPage, total: 587 };
  }

  protected override render(): TemplateResult {
    const range = paginationRange(this.page, 24, 1);
    return html`
      <div class="vstack gap-4">
        <div>
          <p class="small text-body-secondary mb-2">
            Numbered, with edges, a summary and a per-page selector.
          </p>
          <lia-pagination
            .state=${this.state}
            show-summary
            show-per-page
            @lia-page-change=${(event: CustomEvent<{ page: number }>) => {
              this.page = event.detail.page;
            }}
            @lia-per-page-change=${(event: CustomEvent<{ perPage: number }>) => {
              this.perPage = event.detail.perPage;
              this.page = 1;
            }}
          ></lia-pagination>
        </div>

        <div>
          <p class="small text-body-secondary mb-2">
            <code>siblings="2"</code>, small, no edge buttons.
          </p>
          <lia-pagination
            .state=${this.state}
            siblings="2"
            size="sm"
            show-edges="false"
            @lia-page-change=${(event: CustomEvent<{ page: number }>) => {
              this.page = event.detail.page;
            }}
          ></lia-pagination>
        </div>

        <div>
          <p class="small text-body-secondary mb-2">
            <code>numbered="false"</code> — previous and next only.
          </p>
          <lia-pagination
            .state=${this.state}
            numbered="false"
            show-summary
            @lia-page-change=${(event: CustomEvent<{ page: number }>) => {
              this.page = event.detail.page;
            }}
          ></lia-pagination>
        </div>

        <div>
          <p class="small text-body-secondary mb-2">
            As links, for a router that puts the page in the URL.
          </p>
          <lia-pagination
            .state=${this.state}
            .pageHref=${(page: number) => `#/table/pagination?page=${page}`}
          ></lia-pagination>
        </div>

        <div class="bg-body-tertiary rounded-3 p-3">
          <p class="small text-uppercase fw-semibold text-body-secondary mb-2">
            paginationRange(${this.page}, 24, 1)
          </p>
          <p class="font-monospace small mb-0">
            [${range.map((item) => (item === ELLIPSIS ? '…' : item)).join(', ')}]
          </p>
        </div>
      </div>
    `;
  }
}

/** A single cell, with the renderer picked from a select. */
@customElement('demo-cell-playground')
export class DemoCellPlayground extends LiaElement {
  @state() private index = 0;

  private get row(): DemoUser {
    return demoUsers[this.index];
  }

  protected override render(): TemplateResult {
    const row = this.row;
    return html`
      <div class="mb-3" style="max-width: 22rem;">
        <label class="form-label small" for="demo-cell-row">Row</label>
        <select
          id="demo-cell-row"
          class="form-select form-select-sm"
          @change=${(event: Event) => {
            this.index = Number((event.target as HTMLSelectElement).value);
          }}
        >
          ${someUsers(10).map(
            (user, index) =>
              html`<option value=${index} ?selected=${index === this.index}>${user.name}</option>`
          )}
        </select>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <caption class="visually-hidden">Every cell renderer applied to one row</caption>
          <thead>
            <tr>
              <th scope="col" style="width: 10rem;">Renderer</th>
              <th scope="col" style="width: 8rem;">Key</th>
              <th scope="col">Rendered</th>
            </tr>
          </thead>
          <tbody>
            ${userColumns.map(
              (column: TableColumn<DemoUser>) => html`<tr>
                <th scope="row" class="fw-normal">
                  <code>${column.renderer ?? 'text'}</code>
                </th>
                <td class="text-body-secondary"><code>${column.key}</code></td>
                <td class=${column.class ?? ''}>${renderCell(row, column)}</td>
              </tr>`
            )}
          </tbody>
        </table>
      </div>
      ${valueDump(row, { title: 'The row object', maxHeight: '20rem' })}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const LISTING_CODE = dedent`
  // The whole listing is one value.
  const listing: TableListing<Member> = {
    id: 'members',
    columns,                                  // TableColumn<Member>[]
    rows,                                     // just this page
    rowKey: (row) => row.id,                  // stable identity for selection
    rowClass: (row) => (row.active ? undefined : 'deactivated'),
    rowActions: (row) => [ … ],               // the trailing toolbar column
    selectable: true,
    bulkActions,                              // shown once rows are ticked
    pagination: { currentPage, lastPage, perPage, total },
    sort: { field: 'name', order: 'asc' },
    emptyTitle: 'Nothing matches',
    emptyMessage: 'Clear the search to see all members again.',
  };

  // …and the element is controlled: it asks, you answer.
  html\`<lia-table
    .listing=\${listing}
    .loading=\${this.loading}
    show-summary
    show-per-page
    hover
    storage-key="members"                     // remembers the column choice
    @lia-sort=\${(e: CustomEvent<SortState>) => this.load({ sort: e.detail })}
    @lia-page-change=\${(e: CustomEvent) => this.load({ page: e.detail.page })}
    @lia-search=\${(e: CustomEvent<TableSearchState>) => this.load({ search: e.detail })}
    @lia-selection-change=\${(e: CustomEvent) => (this.selection = e.detail.keys)}
    @lia-action=\${(e: CustomEvent<ActionEventDetail<Member>>) => run(e.detail.id, e.detail.row)}
  ></lia-table>\`;
`;

const DATA_TABLE_CODE = dedent`
  // No listing object, no event plumbing: the element owns the state.
  html\`<lia-data-table
    listing-id="projects"
    per-page="8"
    hover
    selectable
    show-per-page
    .columns=\${projectColumns}
    .rows=\${projects}                         // the whole array
    .rowKey=\${(row) => row.id}
    .rowActions=\${projectRowActions}
    .sort=\${INITIAL_SORT}                     // initial order only — keep the identity stable,
                                              // a fresh literal every render resets the user's click
    empty-title="No projects"
  ></lia-data-table>\`;

  // Override the comparison or the search predicate when the defaults are wrong:
  //   .compare=\${(a, b, column) => …}
  //   .match=\${(row, search) => …}
`;

const COLUMN_CODE = dedent`
  const columns: TableColumn<Member>[] = [
    // Sorting, searching and the column manager are per-column opt-ins.
    { key: 'name', label: 'Name', sortable: true, searchable: true, defaultSearchField: true, locked: true },

    // The renderer decides how the value is drawn.
    { key: 'role', label: 'Role', renderer: 'badge' },        // BadgeCellValue
    { key: 'tags', label: 'Tags', renderer: 'badges' },       // BadgeCellValue[]
    { key: 'storage', label: 'Storage', renderer: 'progressbar' },  // ProgressCellValue
    { key: 'quota', label: 'Quota', renderer: 'bytes', class: 'text-end' },
    { key: 'lastSeen', label: 'Last seen', renderer: 'datetime' },

    // A dotted key reads a nested value.
    { key: 'lead.name', label: 'Lead', sortable: true },

    // \`render\` wins over \`renderer\` — full control, still typed.
    {
      key: 'budget',
      label: 'Budget',
      render: (row) => html\`<span>\${money.format(row.spent)}</span>\`,
    },

    // Hidden by default, revealed from the column manager.
    { key: 'note', label: 'Note', renderer: 'html', checked: false },
  ];
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderListing(): TemplateResult {
  return html`
    ${section(
      'A controlled listing',
      'Sorting, searching, paging, selection and column preferences — all of them round-trip through this page, exactly as they would through an API.',
      example('Live', html`<demo-table-listing></demo-table-listing>`, LISTING_CODE, {
        bodyClass: 'p-0',
      })
    )}
    ${section('Variations', 'The same element, dressed differently.', [
      example(
        'Compact, striped off, no chrome',
        html`<lia-table
          .listing=${{
            id: 'compact',
            columns: userColumnsCompact,
            rows: someUsers(6),
            noSearch: true,
            noColumnManager: true,
          } as TableListing<DemoUser>}
          compact
          striped="false"
          hide-pagination
        ></lia-table>`,
        dedent`
          html\`<lia-table
            compact
            striped="false"
            hide-pagination
            .listing=\${{ id: 'compact', columns, rows, noSearch: true, noColumnManager: true }}
          ></lia-table>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'Loading and empty',
        html`<div class="vstack gap-4">
          <lia-table
            loading
            skeleton-rows="4"
            .listing=${{ id: 'loading', columns: userColumnsCompact, rows: [] } as TableListing<DemoUser>}
          ></lia-table>
          <lia-table
            .listing=${{
              id: 'empty',
              columns: userColumnsCompact,
              rows: [],
              emptyTitle: 'No members yet',
              emptyMessage: 'Invite someone and they will appear here.',
            } as TableListing<DemoUser>}
            .emptyActions=${[
              { id: 'invite', label: 'Invite a member', icon: 'fa-solid fa-envelope', variant: 'primary' },
            ]}
            empty-icon="fa-solid fa-user-plus"
          ></lia-table>
        </div>`,
        dedent`
          html\`<lia-table loading skeleton-rows="4" .listing=\${listing}></lia-table>\`;
          html\`<lia-table
            .listing=\${{ ...listing, rows: [], emptyTitle: 'No members yet' }}
            .emptyActions=\${[{ id: 'invite', label: 'Invite a member', variant: 'primary' }]}
          ></lia-table>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'A ready-made listing from the demo data',
        html`<lia-table .listing=${userListing({ perPage: 5, selectable: true })}></lia-table>`,
        dedent`
          // demo/data/users.ts
          export function userListing(options = {}): TableListing<DemoUser> { … }

          html\`<lia-table .listing=\${userListing({ perPage: 5, selectable: true })}></lia-table>\`;
        `,
        { bodyClass: 'p-0', description: 'Static — this one does not answer its own events' }
      ),
    ])}
    ${section('Labels', 'Every string the table renders itself is overridable, so the kit never forces English on your product.', [
      example(
        'Overriding',
        html`<lia-table
          .listing=${{ id: 'labels', columns: userColumnsCompact, rows: someUsers(3) } as TableListing<DemoUser>}
          .labels=${{
            search: 'Filtern',
            columns: 'Spalten wählen',
            actions: 'Aktionen',
            sortAscending: 'Aufsteigend sortieren',
            sortDescending: 'Absteigend sortieren',
            emptyTitle: 'Keine Einträge',
          }}
        ></lia-table>`,
        dedent`
          import { DEFAULT_TABLE_LABELS } from '@liasoft/lit-ui';

          html\`<lia-table .labels=\${{ ...DEFAULT_TABLE_LABELS, search: 'Filtern' }}></lia-table>\`;
        `,
        { bodyClass: 'p-0', description: 'A partial object is merged over the defaults' }
      ),
    ])}
  `;
}

function renderCells(): TemplateResult {
  return html`
    ${section(
      'Every renderer, one row',
      'The `renderer` on a column decides how its value is drawn. Change the row and watch all sixteen follow.',
      example('Playground', html`<demo-cell-playground></demo-cell-playground>`, COLUMN_CODE)
    )}
    ${section('The catalogue', 'What each renderer expects to be handed.', [
      example(
        'Renderers',
        propTable(
          [
            { name: 'text', type: 'unknown', default: 'default', description: 'Stringified and escaped.' },
            { name: 'html', type: 'string', description: 'Trusted markup, rendered as-is. Application-owned only.' },
            { name: 'boolean', type: 'boolean', description: 'A tick or a cross, with an accessible label.' },
            { name: 'booleanWithInfo', type: 'BooleanWithInfoCellValue', description: '`{ checked, info }` — the mark plus a small suffix.' },
            { name: 'progressbar', type: 'ProgressCellValue', description: '`{ percent, text, style, infotext }` — a meter with a caption and an info popover.' },
            { name: 'link', type: 'LinkCellValue', description: '`{ href, text, icon, title, target }`.' },
            { name: 'badge', type: 'BadgeCellValue', description: '`{ text, variant, icon }`.' },
            { name: 'badges', type: 'BadgeCellValue[]', description: 'A wrapping row of chips.' },
            { name: 'bytes', type: 'number', description: '`formatBytes()`; negative means unlimited.' },
            { name: 'date / datetime', type: 'string | number | Date', description: 'Locale formatted. `0` renders the "never" text.' },
            { name: 'code', type: 'string', description: 'Monospace, non-wrapping.' },
            { name: 'domainWithSan', type: 'DomainWithSanCellValue', description: '`{ domain, san }` — a name with its alternates underneath.' },
            { name: 'actions', type: 'ActionDescriptor[]', description: 'A toolbar inside the cell.' },
            { name: 'custom', type: '—', description: 'Use `column.render(row, column)` instead; it wins over `renderer`.' },
          ],
          'CellRenderer'
        )
      ),
      example(
        'One cell at a time',
        html`<div class="d-flex flex-wrap gap-4 align-items-start">
          <div>
            <p class="small text-body-secondary mb-1"><code>progressbar</code></p>
            <div style="width: 14rem;">
              <lia-table-cell
                renderer="progressbar"
                .value=${{
                  percent: 93,
                  text: '1.86 TiB / 2 TiB',
                  style: 'bg-danger',
                  infotext: 'Above the soft limit.',
                }}
              ></lia-table-cell>
            </div>
          </div>
          <div>
            <p class="small text-body-secondary mb-1"><code>badges</code></p>
            <lia-table-cell
              renderer="badges"
              .value=${[
                { text: 'on-call', variant: 'warning', icon: 'fa-solid fa-pager' },
                { text: 'billing', variant: 'success' },
              ]}
            ></lia-table-cell>
          </div>
          <div>
            <p class="small text-body-secondary mb-1"><code>domainWithSan</code></p>
            <lia-table-cell
              renderer="domainWithSan"
              .value=${{ domain: 'svc.example.net', san: 'alt.example.net, svc.example.com' }}
            ></lia-table-cell>
          </div>
          <div>
            <p class="small text-body-secondary mb-1"><code>bytes</code> · <code>datetime</code></p>
            <div class="d-flex gap-3">
              <lia-table-cell renderer="bytes" .value=${1_610_612_736}></lia-table-cell>
              <lia-table-cell renderer="datetime" .value=${0}></lia-table-cell>
            </div>
          </div>
        </div>`,
        dedent`
          // For a hand-written table, one cell at a time:
          html\`<lia-table-cell renderer="bytes" .value=\${1610612736}></lia-table-cell>\`;
          html\`<lia-table-cell .column=\${column} .row=\${row}></lia-table-cell>\`;

          // Or the pure function, which is what the table itself calls:
          import { renderCell } from '@liasoft/lit-ui';
          html\`<td>\${renderCell(row, column, { format })}</td>\`;
        `
      ),
      example(
        'Formatting options',
        html`<div class="table-responsive">
          <table class="table table-sm mb-0">
            <caption class="visually-hidden">The same values with different format options</caption>
            <thead>
              <tr>
                <th scope="col">Value</th>
                <th scope="col">Default</th>
                <th scope="col">Custom <code>format</code></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>true</code> / <code>false</code></td>
                <td>
                  <lia-table-cell renderer="boolean" .value=${true}></lia-table-cell>
                  <lia-table-cell renderer="boolean" .value=${false}></lia-table-cell>
                </td>
                <td>
                  <lia-table-cell
                    renderer="boolean"
                    .value=${true}
                    .format=${{ trueLabel: 'Ja', trueIcon: 'fa-solid fa-thumbs-up', trueVariant: 'primary' }}
                  ></lia-table-cell>
                  <lia-table-cell
                    renderer="boolean"
                    .value=${false}
                    .format=${{ falseLabel: 'Nein', falseIcon: 'fa-solid fa-thumbs-down' }}
                  ></lia-table-cell>
                </td>
              </tr>
              <tr>
                <td><code>0</code> (datetime)</td>
                <td><lia-table-cell renderer="datetime" .value=${0}></lia-table-cell></td>
                <td>
                  <lia-table-cell
                    renderer="datetime"
                    .value=${0}
                    .format=${{ neverText: 'noch nie' }}
                  ></lia-table-cell>
                </td>
              </tr>
              <tr>
                <td><code>null</code></td>
                <td><lia-table-cell renderer="text" .value=${null}></lia-table-cell></td>
                <td>
                  <lia-table-cell
                    renderer="text"
                    .value=${null}
                    .format=${{ emptyText: '(not set)' }}
                  ></lia-table-cell>
                </td>
              </tr>
            </tbody>
          </table>
        </div>`,
        dedent`
          import { DEFAULT_CELL_FORMAT } from '@liasoft/lit-ui';

          html\`<lia-table
            .format=\${{
              locale: 'de-DE',
              neverText: 'noch nie',
              trueLabel: 'Ja',
              falseLabel: 'Nein',
              byteDecimals: 1,
              dateOptions: { dateStyle: 'long' },
            }}
          ></lia-table>\`;
        `
      ),
    ])}
  `;
}

function renderDataTable(): TemplateResult {
  return html`
    ${section(
      'Everything handled inside',
      'One array in. The element sorts it, searches it, pages it and manages its own columns — and still announces what it did.',
      example('Live', html`<demo-data-table></demo-data-table>`, DATA_TABLE_CODE, {
        bodyClass: 'p-0',
      })
    )}
    ${section('Which one do I want?', 'The choice is about where the data lives, not about how it looks.', [
      example(
        'Comparison',
        propTable(
          [
            { name: 'lia-table', type: 'controlled', description: 'You own page, sort, search and rows. Right for a paged API, server-side search, or any list too big to hold.' },
            { name: 'lia-data-table', type: 'uncontrolled', description: 'It owns them. Right for a fully loaded array — settings, a fixed catalogue, a report.' },
          ],
          'lia-table vs. lia-data-table'
        )
      ),
      example(
        'Custom comparison and matching',
        html`<lia-data-table
          per-page="5"
          .columns=${[
            { key: 'name', label: 'Project', sortable: true, searchable: true, defaultSearchField: true },
            { key: 'stage', label: 'Stage', sortable: true },
            { key: 'comments', label: 'Comments', sortable: true, class: 'text-end' },
          ] as TableColumn<(typeof demoProjects)[number]>[]}
          .rows=${demoProjects}
          .compare=${(
            a: (typeof demoProjects)[number],
            b: (typeof demoProjects)[number],
            column: TableColumn<(typeof demoProjects)[number]>
          ) =>
            column.key === 'stage'
              ? ['discovery', 'building', 'review', 'live', 'paused'].indexOf(a.stage) -
                ['discovery', 'building', 'review', 'live', 'paused'].indexOf(b.stage)
              : compareCellValues(cellValue(a, column), cellValue(b, column))}
          .match=${(row: (typeof demoProjects)[number], search: TableSearchState) =>
            `${row.name} ${row.portfolio} ${row.lead.name}`
              .toLowerCase()
              .includes(search.text.toLowerCase())}
        ></lia-data-table>`,
        dedent`
          // "Stage" is a lifecycle, not a word — alphabetical order is wrong for it.
          html\`<lia-data-table
            .compare=\${(a, b, column) =>
              column.key === 'stage'
                ? STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)
                : compareCellValues(cellValue(a, column), cellValue(b, column))}
            .match=\${(row, search) =>
              \`\${row.name} \${row.lead.name}\`.toLowerCase().includes(search.text.toLowerCase())}
          ></lia-data-table>\`;
        `,
        { bodyClass: 'p-0', description: 'Sort by "Stage" — it follows the lifecycle, not the alphabet' }
      ),
    ])}
    ${section('Sort cycle', 'Clicking a header walks a three-state cycle, so a user can always get back to the unsorted order.', [
      example(
        'nextSortOrder',
        html`<div class="table-responsive">
          <table class="table table-sm mb-0 font-monospace">
            <caption class="visually-hidden">The sort cycle</caption>
            <thead>
              <tr>
                <th scope="col">current</th>
                <th scope="col">allowUnsorted = true</th>
                <th scope="col">allowUnsorted = false</th>
              </tr>
            </thead>
            <tbody>
              ${([undefined, 'asc', 'desc'] as const).map(
                (current) => html`<tr>
                  <td>${current === undefined ? 'undefined' : `'${current}'`}</td>
                  <td>${describeOrder(nextSortOrder(current, true))}</td>
                  <td>${describeOrder(nextSortOrder(current, false))}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`,
        dedent`
          import { nextSortOrder } from '@liasoft/lit-ui';

          nextSortOrder(undefined);        // → 'asc'
          nextSortOrder('asc');            // → 'desc'
          nextSortOrder('desc');           // → undefined  (back to unsorted)
          nextSortOrder('desc', false);    // → 'asc'      (two-state cycle)

          // The table reports "unsorted" as an empty field:
          // @lia-sort=\${(e) => (this.sort = e.detail.field === '' ? undefined : e.detail)}
        `
      ),
      note(
        html`Set <code>allow-unsorted="false"</code> on <code>&lt;lia-table&gt;</code> when your
          backend cannot return rows in insertion order.`,
        'info'
      ),
    ])}
  `;
}

function describeOrder(order: string | undefined): string {
  return order === undefined ? 'undefined' : `'${order}'`;
}

function renderPaginationPage(): TemplateResult {
  return html`
    ${section(
      'Pagination',
      'First, previous, a truncated run of numbers, next, last — plus an optional summary and per-page selector.',
      example('Live', html`<demo-pagination></demo-pagination>`, dedent`
        html\`<lia-pagination
          .state=\${{ currentPage: 7, lastPage: 24, perPage: 25, total: 587 }}
          siblings="1"
          size="sm"
          show-summary
          show-per-page
          .perPageOptions=\${[10, 25, 50, 100]}
          @lia-page-change=\${(e: CustomEvent) => this.load(e.detail.page)}
          @lia-per-page-change=\${(e: CustomEvent) => this.setPerPage(e.detail.perPage)}
        ></lia-pagination>\`;

        // Or hand it hrefs and let the browser navigate:
        html\`<lia-pagination .state=\${state} .pageHref=\${(page) => \`?page=\${page}\`}></lia-pagination>\`;
      `)
    )}
    ${section('Truncation', 'The numbered run collapses with ellipses, so the control never grows past a fixed width.', [
      example(
        'paginationRange',
        html`<div class="table-responsive">
          <table class="table table-sm mb-0 font-monospace">
            <caption class="visually-hidden">paginationRange output</caption>
            <thead>
              <tr>
                <th scope="col">current</th>
                <th scope="col">last</th>
                <th scope="col">siblings</th>
                <th scope="col">result</th>
              </tr>
            </thead>
            <tbody>
              ${(
                [
                  [1, 5, 1],
                  [1, 24, 1],
                  [7, 24, 1],
                  [7, 24, 2],
                  [24, 24, 1],
                  [3, 1, 1],
                ] as const
              ).map(
                ([current, last, siblings]) => html`<tr>
                  <td>${current}</td>
                  <td>${last}</td>
                  <td>${siblings}</td>
                  <td>
                    [${paginationRange(current, last, siblings)
                      .map((item) => (item === ELLIPSIS ? '…' : item))
                      .join(', ')}]
                  </td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`,
        dedent`
          import { ELLIPSIS, paginationRange } from '@liasoft/lit-ui';

          paginationRange(7, 24, 1);   // → [1, ELLIPSIS, 6, 7, 8, ELLIPSIS, 24]
          paginationRange(1, 5, 1);    // → [1, 2, 3, 4, 5]
          paginationRange(3, 1, 1);    // → [1]   (clamped)
        `
      ),
      example(
        'Always visible',
        html`<div class="vstack gap-3">
          <div>
            <p class="small text-body-secondary mb-1">
              One page — the control hides itself by default.
            </p>
            <lia-pagination .state=${{ currentPage: 1, lastPage: 1, total: 4 }}></lia-pagination>
          </div>
          <div>
            <p class="small text-body-secondary mb-1">
              <code>always-visible</code> with a summary, so the count stays on screen.
            </p>
            <lia-pagination
              always-visible
              show-summary
              .state=${{ currentPage: 1, lastPage: 1, perPage: 25, total: 4 }}
            ></lia-pagination>
          </div>
        </div>`,
        undefined
      ),
      example(
        'Localised',
        html`<lia-pagination
          show-summary
          .state=${{ currentPage: 2, lastPage: 9, perPage: 20, total: 174 }}
          .labels=${{
            nav: 'Seitennavigation',
            first: 'Erste Seite',
            previous: 'Zurück',
            next: 'Weiter',
            last: 'Letzte Seite',
            summary: '{from}–{to} von {total}',
            perPage: 'Pro Seite',
          }}
        ></lia-pagination>`,
        dedent`
          import { DEFAULT_PAGINATION_LABELS } from '@liasoft/lit-ui';

          html\`<lia-pagination
            .labels=\${{ ...DEFAULT_PAGINATION_LABELS, summary: '{from}–{to} von {total}' }}
          ></lia-pagination>\`;
        `
      ),
    ])}
    ${section('In place', 'A listing with the pagination it was born with — `projectListing()` from the demo data.', [
      example('Together', html`<lia-table .listing=${projectListing(demoProjects.slice(0, 6))}></lia-table>`, undefined, {
        bodyClass: 'p-0',
      }),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The table demos. */
export const tableRoutes: DemoRoute[] = [
  {
    path: '/table/listing',
    title: 'Listing',
    group: 'table',
    icon: 'fa-solid fa-table',
    description: 'The controlled table: one object in, sorting and paging out.',
    keywords: ['table', 'listing', 'sort', 'select', 'bulk', 'columns'],
    render: renderListing,
  },
  {
    path: '/table/cells',
    title: 'Cell renderers',
    group: 'table',
    icon: 'fa-solid fa-table-cells',
    description: 'Sixteen renderers, one row, and the formatting options.',
    keywords: ['cell', 'renderer', 'badge', 'bytes', 'progress', 'format'],
    render: renderCells,
  },
  {
    path: '/table/data-table',
    title: 'Local data table',
    group: 'table',
    icon: 'fa-solid fa-list',
    description: 'The uncontrolled variant: hand it an array and walk away.',
    keywords: ['data table', 'client side', 'sort', 'filter', 'compare'],
    render: renderDataTable,
  },
  {
    path: '/table/pagination',
    title: 'Pagination',
    group: 'table',
    icon: 'fa-solid fa-ellipsis',
    description: 'Numbers, edges, summary, per-page — and the truncation rule.',
    keywords: ['pagination', 'pager', 'pages', 'per page', 'ellipsis'],
    render: renderPaginationPage,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-table-listing': DemoTableListing;
    'demo-data-table': DemoDataTable;
    'demo-pagination': DemoPagination;
    'demo-cell-playground': DemoCellPlayground;
  }
}
