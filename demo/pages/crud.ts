/**
 * Demo pages — CRUD.
 *
 * The chrome around a table that turns it into a working list/edit system: the
 * list page with its filters and bulk actions, the create/edit counterpart, and
 * the individual pieces (column manager, search dialog, filter chips, inline
 * edit, delete confirmation) that a bespoke page can use on its own.
 *
 * The list page is driven by a real {@link CrudController} over an in-memory
 * "API" with a deliberate 350 ms latency, so the loading state, the abort of a
 * superseded request and the paging round-trip are all genuine.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  CrudFetchParams,
  CrudFetchResult,
  DeleteEventDetail,
  FilterChip,
  FormValues,
  InlineSaveDetail,
  LiaColumnManager,
  LiaTableSearch,
  QuickFilter,
  TableColumn,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  clearColumnPrefs,
  columnPrefsKey,
  confirmDelete,
  createCrudController,
  defaultSearchField,
  defaultVisibleColumns,
  loadColumnPrefs,
  saveColumnPrefs,
  searchableColumns,
  toast,
  visibleColumns,
  type CrudController,
} from '@liasoft/lit-ui';
import {
  createMemberForm,
  createMemberRules,
  demoUsers,
  filterUsers,
  memberFormErrors,
  memberFormValues,
  someUsers,
  userBulkActions,
  userColumns,
  userPageActions,
  userRoleOptions,
  userRowActions,
  userStatusOptions,
  userTeamOptions,
  type DemoUser,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * A pretend API
 * ------------------------------------------------------------------ */

/**
 * The in-memory stand-in for a paged endpoint. Deliberately slow, and it
 * honours the abort signal so a superseded request cannot win a race.
 */
async function fetchMembers(params: CrudFetchParams): Promise<CrudFetchResult<DemoUser>> {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 350);
    params.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

  const rows = filterUsers(demoUsers, {
    text: params.search?.text,
    field: params.search?.field,
    role: typeof params.filters.role === 'string' ? params.filters.role : undefined,
    status: typeof params.filters.status === 'string' ? params.filters.status : undefined,
    team: typeof params.filters.team === 'string' ? params.filters.team : undefined,
  });

  const sort = params.sort;
  const sorted =
    sort && sort.field !== ''
      ? [...rows].sort((a, b) => {
          const left = String((a as unknown as Record<string, unknown>)[sort.field] ?? '');
          const right = String((b as unknown as Record<string, unknown>)[sort.field] ?? '');
          return (sort.order === 'desc' ? -1 : 1) * left.localeCompare(right, undefined, { numeric: true });
        })
      : rows;

  const start = (params.page - 1) * params.perPage;
  return {
    rows: sorted.slice(start, start + params.perPage),
    total: sorted.length,
    lastPage: Math.max(1, Math.ceil(sorted.length / params.perPage)),
  };
}

const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'role',
    label: 'Role',
    placeholder: 'Any role',
    options: userRoleOptions,
  },
  {
    id: 'status',
    label: 'Status',
    placeholder: 'Any status',
    options: userStatusOptions,
  },
  {
    id: 'team',
    label: 'Team',
    placeholder: 'Any team',
    options: userTeamOptions,
  },
];

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * A complete list page: heading, toolbar, quick filters, filter chips, search,
 * column manager, table, bulk actions and pagination — all state owned by a
 * {@link CrudController}.
 *
 * @example
 * ```ts
 * html`<demo-crud-page></demo-crud-page>`;
 * ```
 */
@customElement('demo-crud-page')
export class DemoCrudPage extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];

  private readonly crud: CrudController<DemoUser> = createCrudController<DemoUser>({
    id: 'members',
    columns: userColumns,
    perPage: 8,
    sort: { field: 'name', order: 'asc' },
    filterDefinitions: [
      { id: 'role', label: 'Role' },
      { id: 'status', label: 'Status' },
      { id: 'team', label: 'Team' },
    ],
    rowKey: (row) => row.id,
    rowClass: (row) => (row.active ? undefined : 'deactivated'),
    rowActions: userRowActions,
    selectable: true,
    bulkActions: userBulkActions,
    emptyTitle: 'Nothing matches these filters',
    emptyMessage: 'Clear a chip above to widen the search.',
    persistColumns: false,
    searchChipLabel: 'Contains',
    fetch: fetchMembers,
    onChange: () => this.requestUpdate(),
  });

  private disconnect?: () => void;

  override firstUpdated(): void {
    // One call subscribes the controller to every event the page raises.
    this.disconnect = this.crud.connect(this);
    void this.crud.load();
  }

  override disconnectedCallback(): void {
    this.disconnect?.();
    this.crud.destroy();
    super.disconnectedCallback();
  }

  private onAction(event: CustomEvent<ActionEventDetail<DemoUser>>): void {
    const detail = event.detail;
    this.events = logEvent(this.events, 'lia-action', {
      id: detail?.id,
      row: detail?.row?.name,
      selected: this.crud.state.selection.length,
    });
    if (detail?.id === 'create') {
      toast({ variant: 'info', message: 'This would open the create form.' });
    }
  }

  protected override render(): TemplateResult {
    const state = this.crud.state;
    return html`
      ${tryIt(
        'Pick a quick filter, search, sort, page. Every change is a fresh 350 ms request — a superseded one is aborted, never rendered.'
      )}
      <lia-crud-page
        title="Members"
        icon="fa-solid fa-users"
        description="Everyone who can sign in to the console."
        search-mode="inline"
        live-search
        .badge=${{ text: state.total ?? 0, variant: 'secondary' }}
        .listing=${this.crud.listing}
        .allColumns=${this.crud.allColumns}
        .actions=${userPageActions}
        .filters=${this.crud.filterChips}
        .quickFilters=${QUICK_FILTERS.map((filter) => ({
          ...filter,
          value: (state.filters[filter.id] as string | undefined) ?? '',
        }))}
        .loading=${state.loading}
        .error=${state.error ?? ''}
        persist="false"
        @lia-action=${this.onAction}
      ></lia-crud-page>
      ${eventLog(this.events, {
        title: 'Page-level actions',
        placeholder: 'Press a toolbar button, a row button, or select rows and use the bulk bar.',
      })}
    `;
  }
}

/** The filter bar on its own, with chips a host adds and removes. */
@customElement('demo-filter-bar')
export class DemoFilterBar extends LiaElement {
  @state() private values: Record<string, string> = { role: 'operator', status: 'active' };
  @state() private events: readonly LoggedEvent[] = [];

  private get chips(): FilterChip[] {
    const label = (id: string): string =>
      QUICK_FILTERS.find((filter) => filter.id === id)?.label ?? id;
    const text = (id: string, value: string): string =>
      QUICK_FILTERS.find((filter) => filter.id === id)?.options.find(
        (option) => String(option.value) === value
      )?.label ?? value;

    return Object.entries(this.values)
      .filter(([, value]) => value !== '')
      .map(([id, value]) => ({ id, label: label(id), value: text(id, value) }));
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Change a select, then remove the chip it produced.')}
      <lia-filter-bar
        .quickFilters=${QUICK_FILTERS.map((filter) => ({
          ...filter,
          value: this.values[filter.id] ?? '',
        }))}
        .filters=${this.chips}
        @lia-filter-change=${(event: CustomEvent<{ id: string; value: string }>) => {
          this.events = logEvent(this.events, 'lia-filter-change', event.detail);
          this.values = { ...this.values, [event.detail.id]: event.detail.value };
        }}
        @lia-filter-remove=${(event: CustomEvent<{ id: string }>) => {
          this.events = logEvent(this.events, 'lia-filter-remove', event.detail);
          const next = { ...this.values };
          delete next[event.detail.id];
          this.values = next;
        }}
        @lia-filter-clear=${() => {
          this.events = logEvent(this.events, 'lia-filter-clear');
          this.values = {};
        }}
      ></lia-filter-bar>
      ${eventLog(this.events)}
    `;
  }
}

/** The search dialog and the inline input group, side by side. */
@customElement('demo-table-search')
export class DemoTableSearch extends LiaElement {
  @state() private field = defaultSearchField(userColumns);
  @state() private text = '';
  @state() private events: readonly LoggedEvent[] = [];

  @query('lia-table-search[modal-id="demo-search-modal"]')
  private dialog?: LiaTableSearch;

  private onSearch(event: CustomEvent<{ field: string; text: string }>): void {
    this.events = logEvent(this.events, 'lia-search', event.detail);
    this.field = event.detail.field;
    this.text = event.detail.text;
  }

  private get hits(): DemoUser[] {
    if (this.text === '') return [];
    return filterUsers(demoUsers, { text: this.text, field: this.field }).slice(0, 5);
  }

  protected override render(): TemplateResult {
    return html`
      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <p class="small text-body-secondary mb-2">
            <code>inline</code> — an input group for a toolbar.
          </p>
          <lia-table-search
            inline
            live
            listing-id="members"
            .columns=${userColumns}
            field=${this.field}
            text=${this.text}
            @lia-search=${this.onSearch}
          ></lia-table-search>
        </div>
        <div class="col-12 col-lg-6">
          <p class="small text-body-secondary mb-2">
            As a dialog — one button, a column picker and a term.
          </p>
          <button
            class="btn btn-outline-secondary"
            type="button"
            @click=${() => {
              if (this.dialog) this.dialog.open = true;
            }}
          >
            <i class="fa-solid fa-magnifying-glass me-2" aria-hidden="true"></i>Search members
          </button>
          <lia-table-search
            modal-id="demo-search-modal"
            listing-id="members"
            .columns=${userColumns}
            field=${this.field}
            text=${this.text}
            @lia-search=${this.onSearch}
          ></lia-table-search>
        </div>
      </div>
      ${this.text
        ? html`<div class="mt-3">
            <p class="small text-body-secondary mb-2">
              First matches for <code>${this.field}</code> containing “${this.text}”:
            </p>
            <ul class="list-group list-group-flush">
              ${this.hits.length === 0
                ? html`<li class="list-group-item text-body-secondary">Nothing matches.</li>`
                : this.hits.map(
                    (user) => html`<li class="list-group-item d-flex justify-content-between">
                      <span>${user.name}</span>
                      <span class="text-body-secondary small">${user.email}</span>
                    </li>`
                  )}
            </ul>
          </div>`
        : ''}
      ${eventLog(this.events)}
    `;
  }
}

/** The column manager, plus the storage helpers behind it. */
@customElement('demo-column-manager')
export class DemoColumnManager extends LiaElement {
  @state() private selected: string[] = defaultVisibleColumns(userColumns);
  @state() private events: readonly LoggedEvent[] = [];

  @query('lia-column-manager') private manager?: LiaColumnManager;

  private get columns(): TableColumn<DemoUser>[] {
    return visibleColumns(userColumns, this.selected);
  }

  protected override render(): TemplateResult {
    const key = columnPrefsKey('demo-members');
    return html`
      ${tryIt('Open the manager, untick a few columns and save — the table below narrows.')}
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => {
            if (this.manager) this.manager.open = true;
          }}
        >
          <i class="fa-solid fa-table-columns me-2" aria-hidden="true"></i>Manage table columns
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => {
            saveColumnPrefs('demo-members', this.selected);
            this.events = logEvent(this.events, 'saveColumnPrefs', { key, columns: this.selected.length });
          }}
        >
          Save to localStorage
        </button>
        <button
          class="btn btn-outline-secondary"
          type="button"
          @click=${() => {
            const stored = loadColumnPrefs('demo-members');
            this.events = logEvent(this.events, 'loadColumnPrefs', stored ?? null);
            if (stored) this.selected = stored;
          }}
        >
          Load from localStorage
        </button>
        <button
          class="btn btn-outline-danger"
          type="button"
          @click=${() => {
            clearColumnPrefs('demo-members');
            this.selected = defaultVisibleColumns(userColumns);
            this.events = logEvent(this.events, 'clearColumnPrefs', { key });
          }}
        >
          Forget
        </button>
      </div>

      <lia-column-manager
        listing-id="demo-members"
        persist="false"
        .columns=${userColumns}
        .selected=${this.selected}
        @lia-columns-change=${(event: CustomEvent<{ columns: string[] }>) => {
          this.events = logEvent(this.events, 'lia-columns-change', {
            count: event.detail.columns.length,
          });
          this.selected = event.detail.columns;
        }}
      ></lia-column-manager>

      <lia-table
        .listing=${{
          id: 'demo-columns',
          columns: this.columns,
          rows: someUsers(4),
          noSearch: true,
          noColumnManager: true,
        }}
        hide-pagination
        compact
      ></lia-table>

      ${eventLog(this.events, { title: 'Column preferences' })}
    `;
  }
}

/** Inline editing inside a table, saving into a local copy of the rows. */
@customElement('demo-inline-edit')
export class DemoInlineEdit extends LiaElement {
  @state() private rows: DemoUser[] = someUsers(5).map((row) => ({ ...row }));
  @state() private saving = '';
  @state() private errors: Record<string, string> = {};
  @state() private accepted = '';
  @state() private events: readonly LoggedEvent[] = [];

  private async save(event: CustomEvent<InlineSaveDetail>): Promise<void> {
    const { name, value } = event.detail;
    const [field, id] = name.split(':');
    this.events = logEvent(this.events, 'lia-inline-save', event.detail);
    this.saving = name;
    this.errors = { ...this.errors, [name]: '' };
    this.accepted = '';
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.saving = '';

    // A stand-in for a server that answers a debounced auto-save: anything
    // containing "nope" comes back rejected and the row keeps its old value.
    if (value.toLowerCase().includes('nope')) {
      this.errors = { ...this.errors, [name]: 'The server rejected that value.' };
      return;
    }

    this.rows = this.rows.map((row) =>
      String(row.id) === id ? { ...row, [field]: value } : row
    );
    this.accepted = name;
    toast({ variant: 'success', message: `Saved ${field} for #${id}.`, timeout: 2000 });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Click a value, change it, press Enter (or Escape to abandon it). Type a location containing “nope” to see the write come back rejected — the editor stays open and marks itself invalid.'
      )}
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <caption class="visually-hidden">Members with editable fields</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Team</th>
              <th scope="col">Location</th>
              <th scope="col" class="text-end">Open issues</th>
            </tr>
          </thead>
          <tbody
            @lia-inline-save=${this.save}
            @lia-inline-cancel=${(event: CustomEvent) => {
              this.events = logEvent(this.events, 'lia-inline-cancel', event.detail);
            }}
          >
            ${this.rows.map(
              (row) => html`<tr>
                <th scope="row" class="fw-normal">${row.name}</th>
                <td>
                  <lia-inline-edit
                    name="team:${row.id}"
                    type="select"
                    label="Team of ${row.name}"
                    .value=${row.team}
                    .options=${userTeamOptions}
                    .saving=${this.saving === `team:${row.id}`}
                    .error=${this.errors[`team:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `team:${row.id}`}
                  ></lia-inline-edit>
                </td>
                <td>
                  <lia-inline-edit
                    name="location:${row.id}"
                    label="Location of ${row.name}"
                    .value=${row.location}
                    required
                    maxlength="40"
                    auto-close="false"
                    .saving=${this.saving === `location:${row.id}`}
                    .error=${this.errors[`location:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `location:${row.id}`}
                  ></lia-inline-edit>
                </td>
                <td class="text-end">
                  <lia-inline-edit
                    name="openIssues:${row.id}"
                    type="number"
                    label="Open issues of ${row.name}"
                    .value=${String(row.openIssues)}
                    min="0"
                    max="99"
                    .saving=${this.saving === `openIssues:${row.id}`}
                    .error=${this.errors[`openIssues:${row.id}`] ?? ''}
                    .accepted=${this.accepted === `openIssues:${row.id}`}
                  ></lia-inline-edit>
                </td>
              </tr>`
            )}
          </tbody>
        </table>
      </div>
      ${eventLog(this.events)}
    `;
  }
}

/** The delete affordance, in every shape it ships with. */
@customElement('demo-delete-confirm')
export class DemoDeleteConfirm extends LiaElement {
  @state() private removed: string[] = [];
  @state() private events: readonly LoggedEvent[] = [];
  @state() private busy = '';

  private async onDelete(event: CustomEvent<DeleteEventDetail>): Promise<void> {
    const detail = event.detail;
    this.events = logEvent(this.events, 'lia-delete', detail);
    this.busy = detail.entity;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.busy = '';
    this.removed = [...this.removed, detail.entity];
  }

  private async askDirectly(): Promise<void> {
    const result = await confirmDelete({
      entity: 'vol-eu-central-041',
      entityType: 'volume',
      options: [{ name: 'snapshot', label: 'Take a final snapshot first', checked: true }],
    });
    this.events = logEvent(this.events, 'confirmDelete()', result);
  }

  protected override render(): TemplateResult {
    return html`
      <div
        class="vstack gap-3"
        @lia-delete=${this.onDelete}
        @lia-delete-cancel=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-delete-cancel', event.detail);
        }}
      >
        <div class="d-flex flex-wrap align-items-center gap-3">
          <lia-delete-confirm
            entity="Amara Okonkwo"
            entity-type="member"
            .busy=${this.busy === 'Amara Okonkwo'}
            .data=${{ id: 1000 }}
          ></lia-delete-confirm>
          <lia-delete-confirm
            entity="Payments"
            entity-type="team"
            label="Delete the team"
            .busy=${this.busy === 'Payments'}
          ></lia-delete-confirm>
          <lia-delete-confirm
            entity="key_9f21c7"
            entity-type="access key"
            label="Revoke"
            icon="fa-solid fa-ban"
            variant="outline-warning"
            size="md"
            .options=${[
              { name: 'audit', label: 'Write an entry to the audit trail', checked: true },
              { name: 'notify', label: 'Notify the key owner' },
            ]}
            .busy=${this.busy === 'key_9f21c7'}
          ></lia-delete-confirm>
          <lia-delete-confirm entity="Locked" entity-type="record" disabled></lia-delete-confirm>
        </div>
        <div>
          <button class="btn btn-outline-danger" type="button" @click=${this.askDirectly}>
            <i class="fa-solid fa-code me-2" aria-hidden="true"></i>confirmDelete() — no element at
            all
          </button>
        </div>
      </div>
      ${this.removed.length > 0
        ? html`<p class="mt-3 mb-0 small">
            <span class="badge text-bg-danger me-2">removed</span>
            ${this.removed.join(', ')}
          </p>`
        : ''}
      ${eventLog(this.events)}
    `;
  }
}

/** The create/edit page, with client-side rules and server-side errors. */
@customElement('demo-crud-form')
export class DemoCrudForm extends LiaElement {
  @state() private saving = false;
  @state() private serverErrors: Record<string, string> = {};
  @state() private submitted?: FormValues;

  private async onSubmit(event: CustomEvent<{ values: FormValues }>): Promise<void> {
    this.saving = true;
    this.serverErrors = {};
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.saving = false;

    const loginname = String(event.detail.values.loginname ?? '');
    if (loginname === 'a.okonkwo') {
      // What a rejected save looks like coming back from an API.
      this.serverErrors = memberFormErrors;
      toast({ variant: 'danger', message: 'The server rejected three fields.' });
      return;
    }
    this.submitted = event.detail.values;
    toast({ variant: 'success', message: `Created ${String(event.detail.values.name ?? '')}.` });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Submit it empty to see the client-side rules; then type "a.okonkwo" as the sign-in name to see server-side errors come back.'
      )}
      <lia-crud-form-page
        title="Add a member"
        icon="fa-solid fa-user-plus"
        description="They receive an invitation as soon as you save."
        back-url="#/crud/list"
        back-label="All members"
        save-label="Create member"
        sticky
        .form=${createMemberForm}
        .errors=${this.serverErrors}
        .saving=${this.saving}
        .actions=${[
          { id: 'template', label: 'Start from a template', icon: 'fa-solid fa-copy', variant: 'outline-secondary' },
        ] as ActionDescriptor[]}
        @lia-submit=${this.onSubmit}
        @lia-action=${(event: Event) => event.preventDefault()}
      ></lia-crud-form-page>
      ${valueDump(this.submitted, { title: 'Saved values', empty: 'Nothing saved yet.' })}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const CONTROLLER_CODE = dedent`
  // All the state a list page has — page, sort, search, filters, selection and
  // the visible columns — with the fetching it implies.
  const crud = createCrudController<Member>({
    id: 'members',
    columns,
    perPage: 8,
    sort: { field: 'name', order: 'asc' },
    filterDefinitions: [
      { id: 'role', label: 'Role' },
      { id: 'status', label: 'Status' },
    ],
    rowKey: (row) => row.id,
    rowActions,
    bulkActions,
    selectable: true,
    // The signal is aborted when a newer request supersedes this one.
    fetch: ({ page, perPage, sort, search, filters, signal }) =>
      api.members({ page, perPage, sort, q: search?.text, ...filters }, signal),
    onChange: () => this.requestUpdate(),
  });

  firstUpdated() {
    this.disconnect = crud.connect(this);   // subscribes to every lia-* event below
    void crud.load();
  }
`;

const CRUD_PAGE_CODE = dedent`
  html\`<lia-crud-page
    title="Members"
    icon="fa-solid fa-users"
    description="Everyone who can sign in to the console."
    search-mode="inline"           // 'inline' | 'modal' | 'none'
    live-search
    .listing=\${crud.listing}
    .allColumns=\${crud.allColumns}     // the column manager's full set
    .actions=\${pageActions}            // the heading toolbar
    .quickFilters=\${quickFilters}      // the selects above the table
    .filters=\${crud.filterChips}       // the removable chips
    .loading=\${crud.state.loading}
    .error=\${crud.state.error ?? ''}
    @lia-action=\${(e: CustomEvent<ActionEventDetail<Member>>) => run(e.detail)}
  ></lia-crud-page>\`;
`;

const FORM_PAGE_CODE = dedent`
  html\`<lia-crud-form-page
    title="Add a member"
    icon="fa-solid fa-user-plus"
    back-url="/members"
    save-label="Create member"
    sticky                                  // the button bar follows the scroll
    .form=\${createMemberForm}               // a FormDefinition
    .errors=\${this.serverErrors}            // FormErrors from the API
    .saving=\${this.saving}
    @lia-submit=\${(e: CustomEvent) => this.save(e.detail.values)}
  ></lia-crud-form-page>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderList(): TemplateResult {
  return html`
    ${section(
      'A list page, end to end',
      'Heading, toolbar, quick filters, chips, search, column manager, table, bulk actions, pagination — one element and one controller.',
      example('Live', html`<demo-crud-page></demo-crud-page>`, CRUD_PAGE_CODE, { bodyClass: 'p-0' })
    )}
    ${section('The controller', 'The state machine behind it. It is a plain class — usable with a bare `<lia-table>`, or with no element at all.', [
      example('Wiring', html`<lia-code-block .code=${CONTROLLER_CODE} language="ts" no-header></lia-code-block>`, undefined, {
        bodyClass: 'p-3',
      }),
      example(
        'What it exposes',
        propTable(
          [
            { name: 'state', type: 'CrudState<Row>', description: 'page, perPage, sort, search, filters, rows, total, lastPage, loading, error, selection, columns.' },
            { name: 'listing', type: 'TableListing<Row>', description: 'Ready for `<lia-table>` — columns already narrowed to the user\'s choice.' },
            { name: 'allColumns', type: 'TableColumn<Row>[]', description: 'The full set, for the column manager.' },
            { name: 'filterChips', type: 'FilterChip[]', description: 'Active filters plus the search term, as removable chips.' },
            { name: 'selectedRows', type: 'Row[]', description: 'Resolved from the selection keys.' },
            { name: 'connect(target)', type: '() => void', description: 'Subscribe to the page\'s events; returns the unsubscribe.' },
            { name: 'load / reload / refresh', type: 'Promise<void>', description: '`refresh()` also resets to page 1. In-flight requests are aborted.' },
            { name: 'setPage / setSort / setSearch / setFilter / setColumns / setSelection', type: 'void', description: 'Imperative equivalents of the events.' },
          ],
          'CrudController'
        )
      ),
      note(
        html`Every mutation aborts the request still in flight and bumps a token, so a slow
          response for page 2 can never overwrite the rows of page 3. That is the one piece of
          list-page plumbing that is genuinely hard to get right by hand.`,
        'info'
      ),
    ])}
    ${section('States', 'The page has to look right before the first response, and after a failed one.', [
      example(
        'Loading and error',
        html`<div class="vstack gap-4">
          <lia-crud-page
            title="Members"
            icon="fa-solid fa-users"
            loading
            show-columns="false"
            search-mode="none"
            .listing=${{ id: 'loading', columns: userColumns.slice(0, 5), rows: [] }}
          ></lia-crud-page>
          <lia-crud-page
            title="Members"
            icon="fa-solid fa-users"
            error="The control plane did not answer within 10 seconds."
            search-mode="none"
            show-columns="false"
            .listing=${{ id: 'error', columns: userColumns.slice(0, 5), rows: [] }}
          ></lia-crud-page>
        </div>`,
        dedent`
          html\`<lia-crud-page .loading=\${crud.state.loading} .error=\${crud.state.error ?? ''}></lia-crud-page>\`;
        `,
        { bodyClass: 'p-0' }
      ),
    ])}
  `;
}

function renderFilters(): TemplateResult {
  return html`
    ${section('Filter bar', 'Quick-filter selects on one side, the chips they produce on the other. The chips are the undo.', [
      example('Live', html`<demo-filter-bar></demo-filter-bar>`, dedent`
        html\`<lia-filter-bar
          .quickFilters=\${[
            { id: 'role', label: 'Role', placeholder: 'Any role', options: roleOptions, value: this.role },
          ]}
          .filters=\${[{ id: 'role', label: 'Role', value: 'Operator' }]}
          @lia-filter-change=\${(e: CustomEvent) => this.set(e.detail.id, e.detail.value)}
          @lia-filter-remove=\${(e: CustomEvent) => this.remove(e.detail.id)}
          @lia-filter-clear=\${() => this.clear()}
        ></lia-filter-bar>\`;
      `),
      example(
        'Chips only, and disabled',
        html`<div class="vstack gap-3">
          <lia-filter-bar
            .filters=${[
              { id: 'a', label: 'Role', value: 'Operator' },
              { id: 'b', label: 'Team', value: 'Platform', variant: 'info' },
              { id: 'c', label: 'Contains', value: 'okonkwo', icon: 'fa-solid fa-magnifying-glass' },
              { id: 'd', label: 'Region', value: 'eu-central', removable: false },
            ] as FilterChip[]}
          ></lia-filter-bar>
          <lia-filter-bar
            disabled
            .quickFilters=${QUICK_FILTERS.slice(0, 2)}
            .filters=${[{ id: 'a', label: 'Role', value: 'Owner' }] as FilterChip[]}
          ></lia-filter-bar>
        </div>`,
        dedent`
          // \`removable: false\` pins a chip — a scope the user may not drop.
          .filters=\${[{ id: 'region', label: 'Region', value: 'eu-central', removable: false }]}
        `
      ),
    ])}
    ${section('Search', 'Search *by column*: pick a field, type a term. Inline for a toolbar, or as a dialog when the toolbar is full.', [
      example('Both forms', html`<demo-table-search></demo-table-search>`, dedent`
        import { defaultSearchField, searchableColumns } from '@liasoft/lit-ui';

        // Only columns marked \`searchable\` appear in the picker; the one marked
        // \`defaultSearchField\` is pre-selected.
        searchableColumns(columns);        // → TableColumn[]
        defaultSearchField(columns);       // → 'name'

        html\`<lia-table-search
          inline
          live
          delay="300"
          .columns=\${columns}
          field=\${this.field}
          text=\${this.text}
          @lia-search=\${(e: CustomEvent) => this.load(e.detail)}
        ></lia-table-search>\`;
      `),
      example(
        'Which columns are searchable?',
        html`<div class="d-flex flex-wrap gap-2">
          ${searchableColumns(userColumns).map(
            (column) => html`<span class="badge text-bg-secondary"
              >${column.label}${column.defaultSearchField
                ? html` <i class="fa-solid fa-star ms-1" title="default" aria-hidden="true"></i>`
                : ''}</span
            >`
          )}
        </div>`,
        undefined,
        { description: '`searchable: true` on the column is the opt-in' }
      ),
    ])}
    ${section('Column manager', 'Which columns do I want? — with the answer remembered per listing.', [
      example('Live', html`<demo-column-manager></demo-column-manager>`, dedent`
        import {
          applyColumnPrefs, clearColumnPrefs, columnPrefsKey, defaultVisibleColumns,
          loadColumnPrefs, saveColumnPrefs, visibleColumns,
        } from '@liasoft/lit-ui';

        columnPrefsKey('members');                  // → 'lia-ui:columns:members'
        defaultVisibleColumns(columns);             // → keys where checked !== false
        loadColumnPrefs('members');                 // → string[] | undefined
        saveColumnPrefs('members', selected);
        visibleColumns(columns, selected);          // → TableColumn[], narrowed
        applyColumnPrefs(listing, selected);        // → the same, on a whole TableListing
        clearColumnPrefs('members');

        html\`<lia-column-manager
          listing-id="members"
          .columns=\${allColumns}
          .selected=\${selected}
          @lia-columns-change=\${(e: CustomEvent) => (this.selected = e.detail.columns)}
        ></lia-column-manager>\`;
      `),
      note(
        html`A column marked <code>locked: true</code> cannot be hidden — use it for the one column
          that identifies the row. A column marked <code>checked: false</code> starts hidden but is
          offered in the manager.`,
        'info'
      ),
    ])}
  `;
}

function renderInline(): TemplateResult {
  return html`
    ${section('Inline edit', 'Change one value where it already is. The element owns nothing but the draft.', [
      example('In a table', html`<demo-inline-edit></demo-inline-edit>`, dedent`
        html\`<lia-inline-edit
          name="team:\${row.id}"
          type="select"                      // text | number | email | url | tel | textarea | select
          label="Team of \${row.name}"
          .value=\${row.team}
          .options=\${teamOptions}
          .saving=\${this.saving === \`team:\${row.id}\`}
          .error=\${this.errors[name] ?? ''}   // "is-invalid" plus a message
          .accepted=\${this.accepted === name} // "is-valid" after a write lands
          required
          @lia-inline-save=\${(e: CustomEvent<InlineSaveDetail>) => this.save(e.detail)}
          @lia-inline-cancel=\${…}
        ></lia-inline-edit>\`;

        // Enter commits, Escape abandons; \`commit-on-blur\` also commits on blur.
      `),
      example(
        'States',
        html`<div class="d-flex flex-wrap gap-4">
          ${[
            ['idle', html`<lia-inline-edit label="Nickname" value="Amara"></lia-inline-edit>`],
            ['empty', html`<lia-inline-edit label="Nickname" value=""></lia-inline-edit>`],
            [
              'custom display',
              html`<lia-inline-edit
                label="Quota"
                value="40"
                type="number"
                display="40 GiB"
              ></lia-inline-edit>`,
            ],
            ['saving', html`<lia-inline-edit label="Nickname" value="Amara" saving></lia-inline-edit>`],
            ['disabled', html`<lia-inline-edit label="Nickname" value="Amara" disabled></lia-inline-edit>`],
            [
              'open',
              html`<lia-inline-edit
                label="Nickname"
                value="Amara"
                editing
                auto-close="false"
              ></lia-inline-edit>`,
            ],
          ].map(
            ([label, content]) => html`<div>
              <p class="small text-body-secondary font-monospace mb-1">${label}</p>
              ${content}
            </div>`
          )}
        </div>`,
        undefined
      ),
    ])}
    ${section('Delete confirmation', 'The one button that must never fire on the first click.', [
      example('Live', html`<demo-delete-confirm></demo-delete-confirm>`, dedent`
        html\`<lia-delete-confirm
          entity="Amara Okonkwo"
          entity-type="member"
          .options=\${[{ name: 'audit', label: 'Write an entry to the audit trail', checked: true }]}
          .data=\${{ id: 1000 }}
          .busy=\${this.busy}
          @lia-delete=\${(e: CustomEvent<DeleteEventDetail>) => this.remove(e.detail)}
          @lia-delete-cancel=\${…}
        ></lia-delete-confirm>\`;

        // The same prompt without any element:
        const result = await confirmDelete({ entity: 'vol-041', entityType: 'volume' });

        // Or as a descriptor, for a toolbar or a table row:
        const action: ActionDescriptor = { id: 'delete', confirm: deletePrompt({ entity: name }) };
      `),
      note(
        html`Only <code>lia-delete</code> means "go ahead". A dismissed dialog raises
          <code>lia-delete-cancel</code> instead, so a host can never mistake a cancel for a
          confirmation.`,
        'warning'
      ),
    ])}
  `;
}

function renderForm(): TemplateResult {
  return html`
    ${section(
      'Create & edit',
      'The counterpart of the list page: a heading, the form, an error summary and one save/reset/cancel bar.',
      example('Live', html`<demo-crud-form></demo-crud-form>`, FORM_PAGE_CODE, { bodyClass: 'p-0' })
    )}
    ${section('Variations', 'The same element, in the shapes an edit screen actually takes.', [
      example(
        'Editing an existing record',
        html`<lia-crud-form-page
          title="Edit Amara Okonkwo"
          icon="fa-solid fa-user-pen"
          description="Changes take effect at their next sign-in."
          back-url="#/crud/list"
          save-label="Save changes"
          .form=${{
            ...createMemberForm,
            title: undefined,
            description: undefined,
            sections: {
              ...createMemberForm.sections,
              identity: {
                ...createMemberForm.sections.identity,
                fields: Object.fromEntries(
                  Object.entries(createMemberForm.sections.identity.fields).map(([name, field]) => [
                    name,
                    { ...field, value: memberFormValues[name] },
                  ])
                ),
              },
            },
          }}
          @lia-submit=${(event: Event) => event.preventDefault()}
        ></lia-crud-form-page>`,
        dedent`
          // Prefill by folding the record into the definition's field values …
          // …or hand the values straight to <lia-form-page .values=\${record}>.
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'Saving, and rejected',
        split(
          html`<lia-crud-form-page
            title="Saving…"
            saving
            show-heading
            .form=${{ sections: { main: { fields: { name: { type: 'text', label: 'Name', value: 'Ada' } } } } }}
          ></lia-crud-form-page>`,
          html`<lia-crud-form-page
            title="Rejected"
            error="The organisation has reached its seat limit."
            .errors=${memberFormErrors}
            .form=${createMemberForm}
            show-buttons="false"
          ></lia-crud-form-page>`
        ),
        dedent`
          html\`<lia-crud-form-page .saving=\${true}></lia-crud-form-page>\`;
          html\`<lia-crud-form-page error="…" .errors=\${{ email: 'Already taken.' }}></lia-crud-form-page>\`;
        `,
        { bodyClass: 'p-0' }
      ),
      example(
        'Rules',
        html`<lia-code-block
          .code=${dedent`
            import { email, min, minLength, pattern, required, unlessUnlimited } from '@liasoft/lit-ui';

            export const createMemberRules: Record<string, FieldRules> = {
              name: [required('Give the member a name.'), minLength(2)],
              loginname: [
                required('A sign-in name is required.'),
                pattern(/^[a-z0-9._-]+$/, 'Lower-case letters, digits, dots and underscores only.'),
              ],
              email: [required(), email()],
              // \`textul\` fields carry an "unlimited" toggle; skip the rule when it is on.
              quota: unlessUnlimited(min(1, 'The quota must be at least 1 GiB.')),
            };
          `}
          language="ts"
          filename="rules.ts"
        ></lia-code-block>`,
        undefined,
        {
          bodyClass: 'p-3',
          description: `${Object.keys(createMemberRules).length} fields carry rules in this demo`,
        }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The CRUD demos. */
export const crudRoutes: DemoRoute[] = [
  {
    path: '/crud/list',
    title: 'List page',
    group: 'crud',
    icon: 'fa-solid fa-rectangle-list',
    description: 'A working list page over a controller and a pretend API.',
    keywords: ['crud', 'list', 'controller', 'fetch', 'bulk', 'pagination'],
    render: renderList,
  },
  {
    path: '/crud/filters',
    title: 'Filters, search & columns',
    group: 'crud',
    icon: 'fa-solid fa-filter',
    description: 'Quick filters, chips, search-by-column and column preferences.',
    keywords: ['filter', 'chip', 'search', 'column manager', 'preferences'],
    render: renderFilters,
  },
  {
    path: '/crud/inline',
    title: 'Inline edit & delete',
    group: 'crud',
    icon: 'fa-solid fa-pen',
    description: 'Editing a value in place, and the button that always asks first.',
    keywords: ['inline', 'edit', 'delete', 'confirm', 'row'],
    render: renderInline,
  },
  {
    path: '/crud/form',
    title: 'Create & edit page',
    group: 'crud',
    icon: 'fa-solid fa-file-pen',
    description: 'The form page with validation, server errors and a sticky save bar.',
    keywords: ['form', 'create', 'edit', 'save', 'validation', 'errors'],
    render: renderForm,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-crud-page': DemoCrudPage;
    'demo-filter-bar': DemoFilterBar;
    'demo-table-search': DemoTableSearch;
    'demo-column-manager': DemoColumnManager;
    'demo-inline-edit': DemoInlineEdit;
    'demo-delete-confirm': DemoDeleteConfirm;
    'demo-crud-form': DemoCrudForm;
  }
}
