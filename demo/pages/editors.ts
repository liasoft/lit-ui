/**
 * Demo pages — Editors.
 *
 * The specialised views: the repeatable-record table, the log pane, code and
 * diffs, the usage view, credentials, the hierarchical tree and the problem
 * report.
 *
 * These are the screens that were never generic. Each one is ported as the
 * *interaction pattern* it really is — a record editor is not a DNS zone
 * editor, it is "repeatable rows edited in place with a save bar" — so the same
 * element serves three former pages.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  CredentialEntry,
  FormDefinition,
  LogLine,
  NewCredential,
  RecordRow,
  RecordsSaveDetail,
  ReportSubmitDetail,
  TreeNode,
  UsageSeriesPoint,
} from '@liasoft/lit-ui';
import {
  LiaElement,
  collapseDiff,
  diffLines,
  diffStats,
  guessLogLevel,
  splitLines,
  toast,
} from '@liasoft/lit-ui';
import {
  codeSample,
  configBefore,
  configAfter,
  configTree,
  demoCredentials,
  demoLogLines,
  demoLogText,
  demoStackTrace,
  environmentColumns,
  environmentRecords,
  freshCredential,
  projectTree,
  requestMetrics,
  requestsByDay,
  routeColumns,
  routeRecords,
  storageGrowth,
  storageMetrics,
  usageByDay,
  usageEmpty,
  usageFor,
  usageMetrics,
  usageMetricsExtended,
  usagePeriods,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { dedent, example, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, valueDump, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const CREDENTIAL_FORM: FormDefinition = {
  sections: {
    main: {
      fields: {
        label: { type: 'text', label: 'Label', mandatory: true, placeholder: 'CI pipeline' },
        scopes: {
          type: 'checkbox',
          label: 'Scopes',
          values: [
            { value: 'read', label: 'Read' },
            { value: 'write', label: 'Write' },
            { value: 'deploy', label: 'Deploy' },
          ],
          selected: ['read'],
        },
        allowedFrom: {
          type: 'text',
          label: 'Allowed from',
          placeholder: '203.0.113.0/24',
          note: 'Comma-separated CIDR ranges. Empty means anywhere.',
        },
        expires: { type: 'date', label: 'Expires on' },
      },
    },
  },
};

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/**
 * The record editor over two different schemas, with a real dirty/save cycle.
 *
 * @example
 * ```ts
 * html`<demo-records></demo-records>`;
 * ```
 */
@customElement('demo-records')
export class DemoRecords extends LiaElement {
  @state() private routes: RecordRow[] = routeRecords.map((row) => ({ ...row }));
  @state() private saving = false;
  @state() private saved?: RecordRow[];
  @state() private events: readonly LoggedEvent[] = [];

  private async onSave(event: CustomEvent<RecordsSaveDetail>): Promise<void> {
    this.events = logEvent(this.events, 'lia-records-save', {
      records: event.detail.records.length,
    });
    this.saving = true;
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.saving = false;
    this.routes = event.detail.records;
    this.saved = event.detail.records;
    toast({ variant: 'success', message: `Saved ${event.detail.records.length} records.` });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Change a value, add a row, remove one — the save bar appears as soon as anything is dirty. The row named “bad name” fails its own validator.'
      )}
      <lia-record-editor
        title="Routing table"
        icon="fa-solid fa-route"
        description="Each row is one record. Names may not contain spaces."
        max-height="26rem"
        .columns=${routeColumns}
        .records=${this.routes}
        .saving=${this.saving}
        @lia-records-change=${(event: CustomEvent<{ records: RecordRow[] }>) => {
          this.events = logEvent(this.events, 'lia-records-change', {
            records: event.detail.records.length,
          });
        }}
        @lia-records-save=${this.onSave}
      ></lia-record-editor>
      ${valueDump(this.saved, {
        title: 'Saved records',
        empty: 'Change something and press Save.',
        maxHeight: '18rem',
      })}
      ${eventLog(this.events)}
    `;
  }
}

/** The log pane, with a synthetic tail so `follow` has something to follow. */
@customElement('demo-log-viewer')
export class DemoLogViewer extends LiaElement {
  @state() private lines: LogLine[] = demoLogLines;
  @state() private tailing = false;
  @state() private events: readonly LoggedEvent[] = [];

  private timer?: ReturnType<typeof setInterval>;
  private counter = 0;

  override disconnectedCallback(): void {
    this.stop();
    super.disconnectedCallback();
  }

  private start(): void {
    if (this.timer) return;
    this.tailing = true;
    this.timer = setInterval(() => {
      this.counter += 1;
      const level =
        this.counter % 13 === 0 ? 'error' : this.counter % 5 === 0 ? 'warning' : 'info';
      this.lines = [
        ...this.lines,
        {
          ts: Date.now(),
          level,
          source: 'edge',
          text:
            level === 'error'
              ? `upstream 10.0.4.${18 + (this.counter % 3)}:8443 returned 502 for GET /v2/checkout/session`
              : level === 'warning'
                ? `request queue depth ${40 + this.counter} on host-eu-central-0${1 + (this.counter % 9)}`
                : `GET /v2/services 200 in ${20 + (this.counter % 60)}ms`,
        },
      ];
    }, 900);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.tailing = false;
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Filter by level, search for “502”, then start the tail and watch it stick to the bottom.'
      )}
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm ${this.tailing ? 'btn-danger' : 'btn-outline-primary'}"
          type="button"
          @click=${() => (this.tailing ? this.stop() : this.start())}
        >
          <i
            class="fa-solid ${this.tailing ? 'fa-stop' : 'fa-play'} me-2"
            aria-hidden="true"
          ></i>${this.tailing ? 'Stop the tail' : 'Start a live tail'}
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => {
            this.lines = demoLogLines;
            this.counter = 0;
          }}
        >
          Reset
        </button>
        <span class="align-self-center small text-body-secondary"
          >${this.lines.length} lines</span
        >
      </div>
      <lia-log-viewer
        filename="orbit-agent.log"
        download-name="orbit-agent.log"
        max-height="26rem"
        .lines=${this.lines}
        .follow=${this.tailing}
        @lia-log-filter-change=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-log-filter-change', event.detail);
        }}
        @lia-log-follow-change=${(event: CustomEvent) => {
          this.events = logEvent(this.events, 'lia-log-follow-change', event.detail);
        }}
      ></lia-log-viewer>
      ${eventLog(this.events)}
    `;
  }
}

/** The diff, with the two texts editable so the algorithm can be watched. */
@customElement('demo-diff')
export class DemoDiff extends LiaElement {
  @state() private original = configBefore;
  @state() private modified = configAfter;

  protected override render(): TemplateResult {
    const stats = diffStats(diffLines(splitLines(this.original), splitLines(this.modified)));
    return html`
      ${tryIt('Edit either side — the diff, the statistics and the collapsed context all follow.')}
      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-6">
          <label class="form-label small" for="demo-diff-a">Original</label>
          <textarea
            id="demo-diff-a"
            class="form-control font-monospace"
            style="font-size: 0.8rem;"
            rows="6"
            .value=${this.original}
            @input=${(event: Event) => {
              this.original = (event.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </div>
        <div class="col-12 col-lg-6">
          <label class="form-label small" for="demo-diff-b">Modified</label>
          <textarea
            id="demo-diff-b"
            class="form-control font-monospace"
            style="font-size: 0.8rem;"
            rows="6"
            .value=${this.modified}
            @input=${(event: Event) => {
              this.modified = (event.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </div>
      </div>
      <p class="small text-body-secondary">
        <span class="badge text-bg-success me-1">+${stats.added}</span>
        <span class="badge text-bg-danger me-1">−${stats.removed}</span>
        <span class="badge text-bg-secondary">${stats.unchanged} unchanged</span>
      </p>
      <lia-diff-view
        original-label="agent.toml (deployed)"
        modified-label="agent.toml (proposed)"
        mode-toggle
        wrap-toggle
        context="2"
        .original=${this.original}
        .modified=${this.modified}
      ></lia-diff-view>
    `;
  }
}

/** The usage view, with a period selector that really changes the series. */
@customElement('demo-usage')
export class DemoUsage extends LiaElement {
  @state() private period = 'month';
  @state() private loading = false;
  @state() private events: readonly LoggedEvent[] = [];

  private async change(period: string): Promise<void> {
    this.events = logEvent(this.events, 'lia-period-change', { period });
    this.loading = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    this.period = period;
    this.loading = false;
  }

  private get series(): UsageSeriesPoint[] {
    return usageFor(this.period);
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Switch the period — the chart, the totals and the table all re-derive from one array.')}
      <lia-traffic-view
        title="Transfer"
        icon="fa-solid fa-arrow-right-arrow-left"
        format="bytes"
        chart-type="bar"
        stacked
        period=${this.period}
        .periods=${usagePeriods}
        .metrics=${usageMetricsExtended}
        .series=${this.series}
        .loading=${this.loading}
        @lia-period-change=${(event: CustomEvent<{ period: string }>) => {
          void this.change(event.detail.period);
        }}
      ></lia-traffic-view>
      ${eventLog(this.events)}
    `;
  }
}

/** The credentials panel, with a create flow that reveals a secret exactly once. */
@customElement('demo-credentials')
export class DemoCredentials extends LiaElement {
  @state() private credentials: CredentialEntry[] = demoCredentials;
  @state() private secret?: NewCredential;
  @state() private creating = false;
  @state() private events: readonly LoggedEvent[] = [];

  private async onCreate(event: CustomEvent<{ values: Record<string, unknown> }>): Promise<void> {
    this.events = logEvent(this.events, 'lia-credential-create', event.detail.values);
    this.creating = true;
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.creating = false;

    const label = String(event.detail.values.label ?? 'New credential');
    const id = `key_${Math.random().toString(16).slice(2, 8)}`;
    this.secret = { ...freshCredential, id, label, identifier: `${id}…9d47` };
    this.credentials = [
      ...this.credentials,
      {
        id,
        label,
        identifier: `${id}…9d47`,
        created: new Date().toISOString(),
        lastUsed: 0,
        scopes: Array.isArray(event.detail.values.scopes)
          ? (event.detail.values.scopes as string[])
          : ['read'],
      },
    ];
  }

  private async onRevoke(event: CustomEvent<{ credential: CredentialEntry }>): Promise<void> {
    this.events = logEvent(this.events, 'lia-credential-revoke', { id: event.detail.credential.id });
    await new Promise((resolve) => setTimeout(resolve, 400));
    this.credentials = this.credentials.filter((entry) => entry.id !== event.detail.credential.id);
    toast({ variant: 'secondary', message: 'The credential was revoked.' });
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Create one: the secret is shown once, in a panel that will not come back.')}
      <lia-api-keys-panel
        title="Access credentials"
        description="Machine credentials for the API. Each one can be scoped and pinned to a network."
        max-credentials="8"
        .credentials=${this.credentials}
        .secret=${this.secret}
        .creating=${this.creating}
        .createForm=${CREDENTIAL_FORM}
        @lia-credential-create=${this.onCreate}
        @lia-credential-revoke=${this.onRevoke}
        @lia-credential-dismiss=${() => {
          this.events = logEvent(this.events, 'lia-credential-dismiss');
          this.secret = undefined;
        }}
      ></lia-api-keys-panel>
      ${eventLog(this.events)}
    `;
  }
}

/** The tree, with selection and lazy expansion. */
@customElement('demo-tree')
export class DemoTree extends LiaElement {
  @state() private nodes: TreeNode[] = configTree;
  @state() private selected = '/etc/orbit/agent.toml';
  @state() private events: readonly LoggedEvent[] = [];

  /** Pretend a branch marked `expandable` fetches its children on first open. */
  private async loadBranch(id: string): Promise<void> {
    if (id !== '/var') return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.nodes = this.nodes.map((node) =>
      node.id === '/var'
        ? {
            ...node,
            expandable: false,
            meta: undefined,
            children: [
              { id: '/var/log', label: 'log', meta: '412 MiB' },
              { id: '/var/lib', label: 'lib', expandable: true },
              { id: '/var/cache', label: 'cache', meta: '1.8 GiB' },
            ],
          }
        : node
    );
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt(
        'Use the arrow keys: right opens, left closes, up and down move. Open “var” and its children are fetched.'
      )}
      ${split(
        html`<div class="border rounded-3 p-2">
          <lia-file-tree
            label="Configuration files"
            filterable
            max-height="22rem"
            selected-id=${this.selected}
            .nodes=${this.nodes}
            @lia-tree-select=${(event: CustomEvent<{ node: TreeNode }>) => {
              this.selected = event.detail.node.id;
              this.events = logEvent(this.events, 'lia-tree-select', { id: event.detail.node.id });
            }}
            @lia-tree-toggle=${(event: CustomEvent<{ node: TreeNode; expanded: boolean }>) => {
              this.events = logEvent(this.events, 'lia-tree-toggle', {
                id: event.detail.node.id,
                expanded: event.detail.expanded,
              });
              if (event.detail.expanded) void this.loadBranch(event.detail.node.id);
            }}
          ></lia-file-tree>
        </div>`,
        html`<div class="border rounded-3 p-3 h-100">
          <p class="small text-uppercase fw-semibold text-body-secondary mb-2">Selected</p>
          <p class="font-monospace mb-3">${this.selected || '(nothing)'}</p>
          <lia-code-block
            .code=${this.selected.endsWith('.toml') ? configAfter : `# ${this.selected}\n`}
            language="toml"
            filename=${this.selected}
            max-height="16rem"
          ></lia-code-block>
        </div>`
      )}
      ${eventLog(this.events)}
    `;
  }
}

/** The problem report, with a submitted state. */
@customElement('demo-report')
export class DemoReport extends LiaElement {
  @state() private submitting = false;
  @state() private submitted = false;
  @state() private error = '';
  @state() private captured?: ReportSubmitDetail;

  private async onSubmit(event: CustomEvent<ReportSubmitDetail>): Promise<void> {
    this.submitting = true;
    this.error = '';
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.submitting = false;
    if (event.detail.message.trim().length < 10) {
      this.error = 'Tell us a little more — at least a sentence.';
      return;
    }
    this.captured = event.detail;
    this.submitted = true;
  }

  protected override render(): TemplateResult {
    return html`
      <lia-report-form
        show-contact
        require-consent
        show-cancel
        details-language="log"
        .details=${demoStackTrace}
        .entries=${[
          { label: 'Console', value: '4.12.0' },
          { label: 'Region', value: 'eu-central' },
          { label: 'Request id', value: 'req_01J9ZK4M2QF3XB' },
          { label: 'Route', value: 'POST /v2/checkout/confirm' },
          { label: 'Browser', value: navigator.userAgent.slice(0, 80) },
        ]}
        .submitting=${this.submitting}
        .submitted=${this.submitted}
        error-message=${this.error}
        @lia-report-submit=${this.onSubmit}
        @lia-report-cancel=${() => {
          this.submitted = false;
          this.captured = undefined;
        }}
      ></lia-report-form>
      ${valueDump(this.captured, { title: 'What would be sent', empty: 'Fill it in and submit.' })}
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const RECORD_CODE = dedent`
  const columns: RecordColumn[] = [
    {
      key: 'name',
      label: 'Name',
      required: true,
      placeholder: 'api',
      width: '22%',
      hint: 'Relative to the zone, or @ for the zone itself.',
      validate: (value) => (/\\s/.test(String(value)) ? 'Names may not contain spaces.' : undefined),
    },
    { key: 'type', label: 'Type', type: 'select', options: types, width: '9rem', defaultValue: 'A' },
    { key: 'ttl', label: 'TTL', type: 'number', min: 60, max: 86400, step: 60, defaultValue: 3600 },
    { key: 'proxied', label: 'Proxied', type: 'checkbox', width: '6rem', defaultValue: false },
  ];

  html\`<lia-record-editor
    title="Routing table"
    add-mode="form"                 // 'form' opens a row of empty inputs; 'append' adds directly
    .columns=\${columns}
    .records=\${records}
    .saving=\${this.saving}
    @lia-records-change=\${(e: CustomEvent) => this.markDirty(e.detail.records)}
    @lia-records-save=\${(e: CustomEvent<RecordsSaveDetail>) => persist(e.detail.records)}
  ></lia-record-editor>\`;
`;

const LOG_CODE = dedent`
  const lines: LogLine[] = [
    { ts: Date.now(), level: 'error', source: 'edge', text: 'upstream returned 502' },
    { ts: Date.now(), level: 'info', source: 'scheduler', text: 'reconciling 31 services' },
  ];

  html\`<lia-log-viewer
    filename="orbit-agent.log"
    download-name="orbit-agent.log"
    max-height="26rem"
    max-lines="2000"                 // the buffer cap; oldest lines fall off
    .lines=\${lines}                  // LogLine[] or plain strings
    .follow=\${this.tailing}          // stick to the bottom while new lines arrive
    .activeLevels=\${['error', 'warning']}
    filter="502"
    @lia-log-filter-change=\${(e: CustomEvent) => …}
    @lia-log-follow-change=\${(e: CustomEvent) => (this.tailing = e.detail.follow)}
  ></lia-log-viewer>\`;

  // Plain text works too — the level is guessed from the line:
  guessLogLevel('2026-07-01T04:25 ERROR edge upstream failed');   // → 'error'
  toLogLine('… WARN …');                                          // → { level: 'warning', text: … }
`;

const DIFF_CODE = dedent`
  import { collapseDiff, diffLines, diffStats, pairDiff, splitLines } from '@liasoft/lit-ui';

  const lines = diffLines(splitLines(before), splitLines(after));   // DiffLine[]
  diffStats(lines);                                // → { added, removed, unchanged }
  collapseDiff(lines, 3);                          // → DiffRow[] with gap markers
  pairDiff(collapseDiff(lines, 3));                // → DiffSplitRow[] for side-by-side

  html\`<lia-diff-view
    original-label="agent.toml (deployed)"
    modified-label="agent.toml (proposed)"
    mode="unified"                                 // 'unified' | 'split'
    mode-toggle
    wrap-toggle
    context="3"
    .original=\${before}
    .modified=\${after}
  ></lia-diff-view>\`;
`;

const USAGE_CODE = dedent`
  const metrics: UsageMetric[] = [
    { key: 'in', label: 'Inbound' },
    { key: 'out', label: 'Outbound' },
  ];

  const series: UsageSeriesPoint[] = [
    { label: 'Jan 26', values: { in: 3_113_851_453_440, out: 7_730_941_132_800 } },
    …
  ];

  html\`<lia-traffic-view
    title="Transfer"
    format="bytes"                    // 'bytes' | 'number'
    chart-type="bar"                  // 'bar' | 'line'
    stacked
    period=\${this.period}
    .periods=\${[{ value: 'day', label: 'Last 30 days' }, …]}
    .metrics=\${metrics}
    .series=\${series}
    @lia-period-change=\${(e: CustomEvent) => this.load(e.detail.period)}
  ></lia-traffic-view>\`;
`;

const CREDENTIALS_CODE = dedent`
  html\`<lia-api-keys-panel
    title="Access credentials"
    max-credentials="8"
    .credentials=\${entries}          // CredentialEntry[] — never carrying a secret
    .secret=\${this.justCreated}      // NewCredential — shown once, then dismissed
    .createForm=\${createForm}        // a FormDefinition for the create dialog
    .creating=\${this.creating}
    @lia-credential-create=\${(e: CustomEvent) => this.create(e.detail.values)}
    @lia-credential-revoke=\${(e: CustomEvent) => this.revoke(e.detail.credential)}
    @lia-credential-dismiss=\${() => (this.justCreated = undefined)}
  ></lia-api-keys-panel>\`;
`;

const TREE_CODE = dedent`
  const nodes: TreeNode[] = [
    {
      id: '/etc',
      label: 'etc',
      children: [
        { id: '/etc/hosts', label: 'hosts', meta: '318 B' },
        { id: '/etc/orbit', label: 'orbit', badge: { text: 'managed', variant: 'info' }, children: [ … ] },
      ],
    },
    { id: '/var', label: 'var', expandable: true, meta: 'not loaded' },   // lazy branch
  ];

  html\`<lia-file-tree
    filterable
    max-height="22rem"
    selected-id=\${this.selected}
    .nodes=\${nodes}
    @lia-tree-select=\${(e: CustomEvent<TreeSelectDetail>) => this.open(e.detail.node)}
    @lia-tree-toggle=\${(e: CustomEvent<TreeToggleDetail>) => this.maybeFetch(e.detail)}
  ></lia-file-tree>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderRecords(): TemplateResult {
  return html`
    ${section(
      'Repeatable records',
      'A flat schema, rows edited in place, per-cell validation and one save bar that only appears when something is dirty.',
      example('Live', html`<demo-records></demo-records>`, RECORD_CODE, { bodyClass: 'p-3' })
    )}
    ${section('One element, any schema', 'The point of the component: change the columns and it is a different editor.', [
      example(
        'Key/value environment',
        html`<lia-record-editor
          title="Environment variables"
          icon="fa-solid fa-terminal"
          description="Values marked secret are write-only once saved."
          add-mode="append"
          .columns=${environmentColumns}
          .records=${environmentRecords.map((row) => ({ ...row }))}
          @lia-records-save=${(event: CustomEvent<RecordsSaveDetail>) => {
            toast({
              variant: 'success',
              message: `Saved ${event.detail.records.length} variables.`,
            });
          }}
        ></lia-record-editor>`,
        dedent`
          const environmentColumns: RecordColumn[] = [
            {
              key: 'key',
              label: 'Variable',
              required: true,
              validate: (value) =>
                /^[A-Z_][A-Z0-9_]*$/.test(String(value)) ? undefined : 'Upper case, digits and underscores only.',
            },
            { key: 'value', label: 'Value', required: true },
            { key: 'secret', label: 'Secret', type: 'checkbox', width: '6rem', defaultValue: false },
          ];
        `,
        { bodyClass: 'p-3', description: '`add-mode="append"` — a new row appears straight away' }
      ),
      example(
        'Read-only, and empty',
        split(
          html`<lia-record-editor
            title="Deployed routes"
            readonly
            .columns=${routeColumns.slice(0, 4)}
            .records=${routeRecords.slice(0, 4)}
          ></lia-record-editor>`,
          html`<lia-record-editor
            title="No records yet"
            .columns=${environmentColumns}
            .records=${[]}
          ></lia-record-editor>`
        ),
        dedent`
          html\`<lia-record-editor readonly .columns=\${columns} .records=\${rows}></lia-record-editor>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Column options',
        propTable(
          [
            { name: 'type', type: "'text' | 'number' | 'select' | 'checkbox'", default: "'text'", description: 'What the cell renders.' },
            { name: 'required', type: 'boolean', description: 'Blocks the save bar while the cell is empty.' },
            { name: 'validate', type: '(value, record, index) => string | undefined', description: 'Per-cell rule; the message is shown under the cell.' },
            { name: 'defaultValue', type: 'RecordValue', description: 'What a newly added row starts with.' },
            { name: 'width', type: 'string', description: 'A CSS width for the column.' },
            { name: 'hint', type: 'string', description: 'Help text under the header.' },
            { name: 'min / max / step / maxlength / pattern', type: 'number | string', description: 'Passed through to the input.' },
          ],
          'RecordColumn'
        )
      ),
    ])}
  `;
}

function renderLogs(): TemplateResult {
  return html`
    ${section(
      'Log viewer',
      'A filterable, tailing pane over a line buffer. Levels are a toggle row, the search highlights in place, and following sticks to the bottom until the reader scrolls away.',
      example('Live', html`<demo-log-viewer></demo-log-viewer>`, LOG_CODE, { bodyClass: 'p-3' })
    )}
    ${section('Other inputs', 'Structured lines are best, but a blob of text works too.', [
      example(
        'Plain text',
        html`<lia-log-viewer
          filename="tail -n 7 /var/log/orbit/agent.log"
          max-height="14rem"
          .lines=${demoLogText.split('\n')}
        ></lia-log-viewer>`,
        dedent`
          // Strings are classified by \`guessLogLevel\`, so the level filter still works.
          html\`<lia-log-viewer .lines=\${text.split('\\n')}></lia-log-viewer>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Level guessing',
        html`<div class="table-responsive">
          <table class="table table-sm mb-0 font-monospace small">
            <caption class="visually-hidden">guessLogLevel samples</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">guessLogLevel</th>
              </tr>
            </thead>
            <tbody>
              ${demoLogText.split('\n').map(
                (line) => html`<tr>
                  <td class="text-break">${line}</td>
                  <td>${guessLogLevel(line) ?? '—'}</td>
                </tr>`
              )}
            </tbody>
          </table>
        </div>`,
        dedent`
          import { guessLogLevel, toLogLine, highlightLogMatches } from '@liasoft/lit-ui';

          guessLogLevel('… ERROR edge upstream failed');   // → 'error'
          toLogLine('… WARN …');                            // → LogLine
          highlightLogMatches(line.text, '502');            // → the line with <mark>s
        `
      ),
      example(
        'Loading and empty',
        split(
          html`<lia-log-viewer loading max-height="12rem" .lines=${[]}></lia-log-viewer>`,
          html`<lia-log-viewer max-height="12rem" .lines=${[]}></lia-log-viewer>`
        ),
        undefined,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderCode(): TemplateResult {
  return html`
    ${section('Code block', 'Monospace text with a gutter, a copy button, a download and a wrap toggle. Everything else in this family composes it.', [
      example(
        'Options',
        html`<div class="vstack gap-3">
          <lia-code-block
            .code=${codeSample}
            language="ts"
            filename="crud.ts"
            download-name="crud.ts"
            wrap-toggle
            .highlightLines=${[3, 4, 5]}
          ></lia-code-block>
          <lia-code-block
            .code=${'apt-get update && apt-get install -y orbit-agent'}
            language="bash"
            no-header
            line-numbers="false"
          ></lia-code-block>
          <lia-code-block
            .code=${demoStackTrace}
            language="log"
            filename="stack trace"
            max-height="10rem"
            copyable="false"
            .actions=${[
              { id: 'report', label: 'Report this', icon: 'fa-solid fa-bug', variant: 'outline-danger', size: 'sm' },
            ] as ActionDescriptor[]}
            @lia-action=${(event: Event) => event.preventDefault()}
          ></lia-code-block>
          <lia-code-block loading max-height="8rem"></lia-code-block>
        </div>`,
        dedent`
          html\`<lia-code-block
            .code=\${source}
            language="ts"
            filename="crud.ts"
            download-name="crud.ts"
            start-line="1"
            .highlightLines=\${[3, 4, 5]}
            max-height="24rem"
            wrap-toggle
            copyable
            no-header                     // drop the file-name bar entirely
            .actions=\${[{ id: 'report', label: 'Report this', variant: 'outline-danger' }]}
            @lia-code-download=\${(e: CustomEvent) => track(e.detail)}
          ></lia-code-block>\`;

          // Line-level control, when the lines are not just text:
          .lines=\${[{ text: 'ok', class: 'text-success', number: 1 }]}
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
    ${section('Diff', 'A dependency-free line diff, unified or side by side, with the unchanged middle collapsed away.', [
      example('Live', html`<demo-diff></demo-diff>`, DIFF_CODE, { bodyClass: 'p-3' }),
      example(
        'Split, and without collapsing',
        html`<div class="vstack gap-3">
          <lia-diff-view
            mode="split"
            original-label="deployed"
            modified-label="proposed"
            .original=${configBefore}
            .modified=${configAfter}
            max-height="20rem"
          ></lia-diff-view>
          <lia-diff-view
            collapse="false"
            show-stats="false"
            no-header
            .original=${configBefore}
            .modified=${configAfter}
            max-height="16rem"
          ></lia-diff-view>
        </div>`,
        dedent`
          html\`<lia-diff-view mode="split" .original=\${a} .modified=\${b}></lia-diff-view>\`;
          html\`<lia-diff-view collapse="false" no-header .original=\${a} .modified=\${b}></lia-diff-view>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'The algorithm, as data',
        html`<lia-code-block
          .code=${JSON.stringify(
            collapseDiff(diffLines(splitLines(configBefore), splitLines(configAfter)), 1).slice(0, 12),
            null,
            2
          )}
          language="json"
          filename="collapseDiff(diffLines(before, after), 1)"
          max-height="20rem"
        ></lia-code-block>`,
        dedent`
          diffLines(splitLines(before), splitLines(after));   // → [{ type: 'equal' | 'add' | 'remove', … }]
          collapseDiff(lines, 1);             // → the same, with { gap: n } markers between hunks
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderUsage(): TemplateResult {
  return html`
    ${section(
      'Usage over time',
      'A period picker, a stacked chart, per-metric totals and the same numbers as a table — because a chart alone is not an accessible answer.',
      example('Live', html`<demo-usage></demo-usage>`, USAGE_CODE, { bodyClass: 'p-3' })
    )}
    ${section('Formats', 'Bytes, counts, one metric or three — the element only cares about the shape.', [
      example(
        'Counts, not bytes',
        html`<lia-traffic-view
          title="Requests"
          icon="fa-solid fa-bolt"
          format="number"
          chart-type="line"
          stacked="false"
          period="day"
          .periods=${[{ value: 'day', label: 'Last 30 days' }]}
          .metrics=${requestMetrics}
          .series=${requestsByDay}
          height="240"
        ></lia-traffic-view>`,
        dedent`
          html\`<lia-traffic-view format="number" chart-type="line" stacked="false" …></lia-traffic-view>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'A single metric, no table',
        html`<lia-traffic-view
          title="Stored data"
          format="bytes"
          chart-type="line"
          show-table="false"
          .metrics=${storageMetrics}
          .series=${storageGrowth}
          .periods=${[]}
          height="200"
        ></lia-traffic-view>`,
        dedent`
          html\`<lia-traffic-view show-table="false" .metrics=\${[{ key: 'used', label: 'Stored' }]} …>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      example(
        'Loading and empty',
        split(
          html`<lia-traffic-view
            loading
            .metrics=${usageMetrics}
            .series=${usageByDay}
            .periods=${[]}
            height="180"
          ></lia-traffic-view>`,
          html`<lia-traffic-view
            .metrics=${usageMetrics}
            .series=${usageEmpty}
            .periods=${[]}
            height="180"
          ></lia-traffic-view>`
        ),
        undefined,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

function renderCredentials(): TemplateResult {
  return html`
    ${section(
      'Credentials',
      'Issue, list and revoke machine credentials — with the one rule that matters: the secret is shown once, and the panel says so.',
      example('Live', html`<demo-credentials></demo-credentials>`, CREDENTIALS_CODE, {
        bodyClass: 'p-3',
      })
    )}
    ${section('States', 'What the panel looks like before there is anything, and when it may not change anything.', [
      example(
        'Empty, read-only, loading',
        html`<div class="vstack gap-3">
          <lia-api-keys-panel
            title="No credentials yet"
            .credentials=${[]}
            .createForm=${CREDENTIAL_FORM}
          ></lia-api-keys-panel>
          <lia-api-keys-panel
            title="Read only"
            description="Your role can see credentials but not change them."
            can-create="false"
            can-revoke="false"
            masked
            .credentials=${demoCredentials}
          ></lia-api-keys-panel>
          <lia-api-keys-panel title="Loading" loading .credentials=${[]}></lia-api-keys-panel>
        </div>`,
        dedent`
          html\`<lia-api-keys-panel can-create="false" can-revoke="false" masked .credentials=\${entries}></lia-api-keys-panel>\`;
        `,
        { bodyClass: 'p-3' }
      ),
      note(
        html`<code>CredentialEntry</code> deliberately has no <code>secret</code> field. Only the
          separate <code>NewCredential</code> carries one, and only for as long as the reveal panel
          is on screen — so a component can never accidentally render a stored secret.`,
        'warning'
      ),
    ])}
  `;
}

function renderTree(): TemplateResult {
  return html`
    ${section(
      'File tree',
      'A keyboard-operable tree over any hierarchy: arrow keys move and expand, Home and End jump, typing filters.',
      example('Live', html`<demo-tree></demo-tree>`, TREE_CODE, { bodyClass: 'p-3' })
    )}
    ${section('Any hierarchy', 'It is not a file browser — it is a tree. The nodes here are projects grouped by portfolio.', [
      example(
        'Projects',
        html`<div class="border rounded-3 p-2" style="max-width: 32rem;">
          <lia-file-tree
            label="Projects by portfolio"
            filterable
            max-height="20rem"
            folder-icon="fa-solid fa-folder-tree"
            folder-open-icon="fa-solid fa-folder-open"
            leaf-icon="fa-regular fa-file-lines"
            .nodes=${projectTree}
          ></lia-file-tree>
        </div>`,
        dedent`
          // demo/data/projects.ts builds this from the same array the table uses.
          html\`<lia-file-tree .nodes=\${projectTree} filterable></lia-file-tree>\`;
        `
      ),
      example(
        'Without icons, and empty',
        split(
          html`<div class="border rounded-3 p-2">
            <lia-file-tree show-icons="false" .nodes=${configTree}></lia-file-tree>
          </div>`,
          html`<div class="border rounded-3 p-2">
            <lia-file-tree .nodes=${[]} filterable></lia-file-tree>
          </div>`
        ),
        undefined
      ),
    ])}
  `;
}

function renderReport(): TemplateResult {
  return html`
    ${section(
      'Report a problem',
      'The form that sends a bug report — with everything it will disclose shown in plain sight before it is sent.',
      example('Live', html`<demo-report></demo-report>`, dedent`
        html\`<lia-report-form
          show-contact
          require-consent
          details-language="log"
          .details=\${stackTrace}                      // the raw dump, in a code block
          .entries=\${[
            { label: 'Console', value: version },
            { label: 'Request id', value: requestId },
          ]}
          .submitting=\${this.busy}
          .submitted=\${this.done}
          error-message=\${this.error}
          @lia-report-submit=\${(e: CustomEvent<ReportSubmitDetail>) => send(e.detail)}
          @lia-report-cancel=\${() => this.close()}
        ></lia-report-form>\`;
      `, { bodyClass: 'p-3' })
    )}
    ${section('Why it looks like this', 'The disclosure is the feature.', [
      example(
        '',
        html`<ul class="list-group list-group-flush">
          <li class="list-group-item">
            <strong>Nothing is hidden.</strong> The technical details are rendered, not summarised
            — a reporter can read exactly what leaves their browser.
          </li>
          <li class="list-group-item">
            <strong>Consent is separate.</strong> <code>require-consent</code> adds an explicit
            tick, and the submit button stays disabled until it is ticked.
          </li>
          <li class="list-group-item">
            <strong>Contact is optional.</strong> <code>show-contact</code> asks for an address;
            without it the report is anonymous by construction.
          </li>
          <li class="list-group-item">
            <strong>The details can be optional too.</strong> <code>optional-details</code> lets
            the reporter leave them out entirely.
          </li>
        </ul>`,
        undefined,
        { bodyClass: 'p-0' }
      ),
      example(
        'Minimal',
        html`<lia-report-form
          title="Send feedback"
          icon="fa-solid fa-comment-dots"
          description="Tell us what you were expecting to happen."
          rows="4"
          .entries=${[]}
          .details=${''}
        ></lia-report-form>`,
        dedent`
          html\`<lia-report-form title="Send feedback" rows="4" .details=\${''}></lia-report-form>\`;
        `,
        { bodyClass: 'p-3' }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The editors demos. */
export const editorsRoutes: DemoRoute[] = [
  {
    path: '/editors/records',
    title: 'Record editor',
    group: 'editors',
    icon: 'fa-solid fa-table-list',
    description: 'Repeatable rows edited in place, with per-cell validation.',
    keywords: ['records', 'rows', 'editor', 'dns', 'environment', 'inline'],
    render: renderRecords,
  },
  {
    path: '/editors/logs',
    title: 'Log viewer',
    group: 'editors',
    icon: 'fa-solid fa-file-lines',
    description: 'A filterable, tailing pane with level toggles and search.',
    keywords: ['log', 'tail', 'follow', 'filter', 'level', 'console'],
    render: renderLogs,
  },
  {
    path: '/editors/code',
    title: 'Code & diff',
    group: 'editors',
    icon: 'fa-solid fa-code',
    description: 'The code block every other view composes, and a line diff.',
    keywords: ['code', 'diff', 'compare', 'unified', 'split', 'copy'],
    render: renderCode,
  },
  {
    path: '/editors/usage',
    title: 'Usage & traffic',
    group: 'editors',
    icon: 'fa-solid fa-chart-area',
    description: 'A period picker, a stacked chart, totals and a table.',
    keywords: ['usage', 'traffic', 'transfer', 'period', 'bytes', 'chart'],
    render: renderUsage,
  },
  {
    path: '/editors/credentials',
    title: 'Credentials',
    group: 'editors',
    icon: 'fa-solid fa-key',
    description: 'Issue and revoke machine credentials, with a one-time reveal.',
    keywords: ['api key', 'credential', 'token', 'secret', 'revoke', 'scopes'],
    render: renderCredentials,
  },
  {
    path: '/editors/tree',
    title: 'Tree',
    group: 'editors',
    icon: 'fa-solid fa-folder-tree',
    description: 'A keyboard-operable tree over any hierarchical data.',
    keywords: ['tree', 'hierarchy', 'files', 'folders', 'keyboard'],
    render: renderTree,
  },
  {
    path: '/editors/report',
    title: 'Problem report',
    group: 'editors',
    icon: 'fa-solid fa-bug',
    description: 'A bug report that shows exactly what it will disclose.',
    keywords: ['report', 'bug', 'feedback', 'diagnostics', 'consent'],
    render: renderReport,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-records': DemoRecords;
    'demo-log-viewer': DemoLogViewer;
    'demo-diff': DemoDiff;
    'demo-usage': DemoUsage;
    'demo-credentials': DemoCredentials;
    'demo-tree': DemoTree;
    'demo-report': DemoReport;
  }
}
