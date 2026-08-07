/**
 * Demo pages — Dashboard.
 *
 * The landing-page family: the welcome panel, KPI cards, resource meters,
 * key/value panels, activity lists, a news panel, charts, and the grid that
 * arranges all of it.
 *
 * Charts are the one place the kit reaches for a peer dependency. `<lia-chart>`
 * loads Chart.js lazily, re-themes itself on `lia-theme-change`, and falls back
 * to a readable message if the library is absent — so a dashboard never breaks
 * because a chart could not draw.
 */

import { html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ActionDescriptor,
  ActivityItem,
  ChartKind,
  DashboardWidget,
  NewsfeedItem,
  ResourceItem,
  StatCardData,
} from '@liasoft/lit-ui';
import { LiaElement, formatBytes } from '@liasoft/lit-ui';
import {
  accountInfo,
  newsItems,
  pendingTasks,
  recentActivity,
  resourceItems,
  resourceItemsCompact,
  scheduledJobs,
  statCards,
  storageBreakdownChart,
  systemInfo,
  transferChart,
  transferLineChart,
  welcomeCopy,
} from '../data/index.js';
import type { DemoRoute } from '../router.js';
import { cluster, dedent, example, grid, note, propTable, section, split } from './_kit.js';
import { eventLog, logEvent, tryIt, type LoggedEvent } from './_playground.js';

/* ------------------------------------------------------------------ *
 * Interactive demos
 * ------------------------------------------------------------------ */

/** The meters, with the limits editable so the thresholds can be seen firing. */
@customElement('demo-resource-grid')
export class DemoResourceGrid extends LiaElement {
  @state() private columns = 4;
  @state() private pressure = 1;

  private get items(): ResourceItem[] {
    return resourceItems.map((item) => ({
      ...item,
      used:
        item.available < 0
          ? Math.round(item.used * this.pressure)
          : Math.min(Math.round(item.used * this.pressure), Math.round(item.available * 1.2)),
    }));
  }

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Turn the pressure up: bars cross 75% and 90% and pick up their own colours.')}
      <div class="d-flex flex-wrap gap-4 align-items-end mb-3">
        <div style="min-width: 16rem;">
          <label class="form-label small" for="demo-resource-pressure"
            >Load factor: <strong>${this.pressure.toFixed(2)}×</strong></label
          >
          <input
            id="demo-resource-pressure"
            class="form-range"
            type="range"
            min="0.2"
            max="1.6"
            step="0.05"
            .value=${String(this.pressure)}
            @input=${(event: Event) => {
              this.pressure = Number((event.target as HTMLInputElement).value);
            }}
          />
        </div>
        <div>
          <label class="form-label small" for="demo-resource-columns">Columns</label>
          <select
            id="demo-resource-columns"
            class="form-select form-select-sm"
            @change=${(event: Event) => {
              this.columns = Number((event.target as HTMLSelectElement).value);
            }}
          >
            ${[2, 3, 4, 5, 6].map(
              (value) =>
                html`<option value=${value} ?selected=${value === this.columns}>${value}</option>`
            )}
          </select>
        </div>
      </div>
      <lia-dashboard-grid
        .items=${this.items}
        columns=${this.columns}
        label="Resource usage"
      ></lia-dashboard-grid>
    `;
  }
}

/** Charts, with the mark type switchable over the same figures. */
@customElement('demo-charts')
export class DemoCharts extends LiaElement {
  @state() private kind: ChartKind = 'bar';

  protected override render(): TemplateResult {
    return html`
      ${tryIt('Switch the mark — the data never changes, only how it is drawn.')}
      <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Chart type">
        ${(['bar', 'line', 'doughnut'] as ChartKind[]).map(
          (kind) => html`<button
            type="button"
            class="btn btn-outline-secondary ${this.kind === kind ? 'active' : ''}"
            aria-pressed=${this.kind === kind}
            @click=${() => {
              this.kind = kind;
            }}
          >
            ${kind}
          </button>`
        )}
      </div>
      <lia-chart
        type=${this.kind}
        height="300"
        label="Transfer per month, inbound and outbound, in tebibytes"
        summary="Outbound transfer grew from 5.4 TiB in August to 10.2 TiB in July; inbound roughly doubled over the same period."
        .data=${this.kind === 'doughnut'
          ? storageBreakdownChart
          : this.kind === 'line'
            ? transferLineChart
            : transferChart}
      ></lia-chart>
    `;
  }
}

/** The activity list in its interactive form, plus the events it raises. */
@customElement('demo-activity')
export class DemoActivity extends LiaElement {
  @state() private events: readonly LoggedEvent[] = [];
  @state() private items: ActivityItem[] = recentActivity;

  protected override render(): TemplateResult {
    return html`
      ${split(
        html`<lia-activity-list
          title="Recent activity"
          icon="fa-solid fa-clock-rotate-left"
          card
          flush
          interactive
          .items=${this.items}
          @lia-activity-select=${(event: CustomEvent<{ item: ActivityItem }>) => {
            this.events = logEvent(this.events, 'lia-activity-select', {
              id: event.detail.item.id,
              text: event.detail.item.text,
            });
          }}
        ></lia-activity-list>`,
        html`<lia-activity-list
          title="Outstanding"
          icon="fa-solid fa-list-check"
          card
          flush
          .items=${pendingTasks}
        ></lia-activity-list>`
      )}
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => {
            this.items = this.items.length === 0 ? recentActivity : [];
          }}
        >
          ${this.items.length === 0 ? 'Restore the entries' : 'Show the empty state'}
        </button>
      </div>
      ${eventLog(this.events, { placeholder: 'Click a row in the left-hand list.' })}
    `;
  }
}

/** A newsfeed fed from a data: URL, so the loading path is real. */
@customElement('demo-newsfeed')
export class DemoNewsfeed extends LiaElement {
  @state() private src = '';
  @state() private events: readonly LoggedEvent[] = [];

  private get feedUrl(): string {
    const payload: NewsfeedItem[] = newsItems;
    return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => {
            this.src = this.feedUrl;
          }}
        >
          <i class="fa-solid fa-cloud-arrow-down me-2" aria-hidden="true"></i>Load from a URL
        </button>
        <button
          class="btn btn-sm btn-outline-danger"
          type="button"
          @click=${() => {
            this.src = 'data:application/json,not-json-at-all';
          }}
        >
          <i class="fa-solid fa-plug-circle-xmark me-2" aria-hidden="true"></i>Load something broken
        </button>
        <button
          class="btn btn-sm btn-outline-secondary"
          type="button"
          @click=${() => {
            this.src = '';
          }}
        >
          Back to inline items
        </button>
      </div>
      <lia-newsfeed
        title="Product news"
        src=${this.src}
        max-items="4"
        flush
        .items=${this.src === '' ? newsItems : []}
        @lia-newsfeed-load=${(event: CustomEvent<{ items?: NewsfeedItem[]; error?: string }>) => {
          this.events = logEvent(this.events, 'lia-newsfeed-load', {
            items: event.detail.items?.length,
            error: event.detail.error,
          });
        }}
      ></lia-newsfeed>
      ${eventLog(this.events)}
    `;
  }
}

/** A whole dashboard, assembled from the widget grid. */
@customElement('demo-dashboard-grid')
export class DemoDashboardGrid extends LiaElement {
  @state() private dismissed = false;

  private get widgets(): DashboardWidget[] {
    return [
      {
        id: 'meters',
        span: 12,
        content: html`<lia-dashboard-grid
          .items=${resourceItemsCompact}
          columns="4"
        ></lia-dashboard-grid>`,
      },
      {
        id: 'transfer',
        span: 8,
        content: html`<div class="card h-100">
          <div class="card-header bg-body-tertiary fw-semibold">Transfer per month</div>
          <div class="card-body">
            <lia-chart
              type="bar"
              height="240"
              label="Transfer per month"
              .data=${transferChart}
            ></lia-chart>
          </div>
        </div>`,
      },
      {
        id: 'news',
        span: 4,
        content: html`<lia-newsfeed .items=${newsItems} max-items="3" flush></lia-newsfeed>`,
      },
      {
        id: 'system',
        span: 6,
        content: html`<lia-info-card
          title="Environment"
          icon="fa-solid fa-server"
          copyable
          flush
          .entries=${systemInfo}
        ></lia-info-card>`,
      },
      {
        id: 'jobs',
        span: 6,
        content: html`<lia-activity-list
          title="Scheduled jobs"
          icon="fa-solid fa-clock"
          card
          flush
          .items=${scheduledJobs}
        ></lia-activity-list>`,
      },
      {
        id: 'hidden',
        span: 12,
        visible: false,
        content: html`<p>Never rendered.</p>`,
      },
    ];
  }

  protected override render(): TemplateResult {
    return html`
      ${this.dismissed
        ? ''
        : html`<lia-welcome-panel
            heading=${welcomeCopy.heading}
            text=${welcomeCopy.message}
            cta-label=${welcomeCopy.ctaLabel}
            cta-href=${welcomeCopy.ctaHref}
            cta-icon="fa-solid fa-fire"
            dismissible
            class="d-block mb-3"
            @lia-dismiss=${() => {
              this.dismissed = true;
            }}
          ></lia-welcome-panel>`}
      <lia-stat-row .items=${statCards} columns="5" class="d-block mb-3"></lia-stat-row>
      <lia-widget-grid .widgets=${this.widgets} gutter="3" label="Dashboard"></lia-widget-grid>
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Snippets
 * ------------------------------------------------------------------ */

const RESOURCE_CODE = dedent`
  const items: ResourceItem[] = [
    { label: 'Members', available: 80, used: 60, assigned: 72, href: '/members' },
    {
      label: 'Storage',
      available: 2048 * 1024 ** 3,
      used: 1655 * 1024 ** 3,
      assigned: 1900 * 1024 ** 3,
      formatBytes: true,                 // render the figures as byte sizes
      byteUsage: 1_612_398_121_144,      // the real number, appended to the label
    },
    { label: 'Scheduled jobs', available: -1, used: 18 },   // negative = unlimited
  ];

  html\`<lia-dashboard-grid .items=\${items} columns="5"></lia-dashboard-grid>\`;
`;

const WIDGET_CODE = dedent`
  // A dashboard is a list of spans over a 12-column grid.
  const widgets: DashboardWidget[] = [
    { id: 'meters', span: 12, content: html\`<lia-dashboard-grid .items=\${meters}></lia-dashboard-grid>\` },
    { id: 'transfer', span: 8, spanMd: 12, content: html\`<lia-chart type="bar" .data=\${data}></lia-chart>\` },
    { id: 'news', span: 4, content: html\`<lia-newsfeed src="/api/news.json" flush></lia-newsfeed>\` },
    { id: 'draft', span: 6, visible: false, content: … },   // kept, not rendered
  ];

  html\`<lia-widget-grid .widgets=\${widgets} gutter="3" label="Dashboard"></lia-widget-grid>\`;
`;

const CHART_CODE = dedent`
  const data: ChartData = {
    labels: monthLabels,
    datasets: [
      { label: 'Inbound (TiB)', data: inbound, backgroundColor: USAGE_PALETTE_LIGHT[0] },
      { label: 'Outbound (TiB)', data: outbound, backgroundColor: USAGE_PALETTE_LIGHT[1] },
    ],
  };

  html\`<lia-chart
    type="bar"                 // line | bar | doughnut | pie | radar | polarArea | bubble | scatter
    height="300"
    label="Transfer per month, inbound and outbound, in tebibytes"
    summary="Outbound grew from 5.4 TiB to 10.2 TiB over twelve months."
    .data=\${data}
    .options=\${{ scales: { y: { beginAtZero: true } } }}
  ></lia-chart>\`;
`;

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderOverview(): TemplateResult {
  return html`
    ${section('Welcome panel', 'The first thing on a landing page: who you are, what happened, and the one thing worth doing next.', [
      example(
        'Variants',
        html`<div class="vstack gap-3">
          <lia-welcome-panel
            heading=${welcomeCopy.heading}
            text=${welcomeCopy.message}
            cta-label=${welcomeCopy.ctaLabel}
            cta-href=${welcomeCopy.ctaHref}
            cta-icon="fa-solid fa-fire"
          ></lia-welcome-panel>
          <lia-welcome-panel
            variant="warning"
            icon="fa-solid fa-triangle-exclamation"
            heading="Finish setting up"
            text="Three steps remain before this installation is production ready."
            dismissible
            .actions=${[
              { id: 'wizard', label: 'Open the wizard', variant: 'light', icon: 'fa-solid fa-wand-magic-sparkles' },
              { id: 'later', label: 'Later', variant: 'light' },
            ] as ActionDescriptor[]}
            @lia-action=${(event: Event) => event.preventDefault()}
          ></lia-welcome-panel>
          <lia-welcome-panel
            variant="success"
            icon="fa-solid fa-circle-check"
            heading="Everything is green"
            text="No open incidents, no failed jobs, no expiring certificates in the next 30 days."
            html
          ></lia-welcome-panel>
        </div>`,
        dedent`
          html\`<lia-welcome-panel
            heading="Good morning, Amara"
            text="Everything is running. Two alerts fired overnight."
            cta-label="Review the incidents"
            cta-href="/incidents"
            dismissible
            @lia-dismiss=\${() => this.hideWelcome()}
          ></lia-welcome-panel>\`;
        `
      ),
    ])}
    ${section('KPI cards', 'A figure, a trend and a reason. One card, or a row of them.', [
      example(
        'The row',
        html`<lia-stat-row .items=${statCards} columns="5"></lia-stat-row>`,
        dedent`
          const items: StatCardData[] = [
            {
              label: 'Requests today',
              value: '4.18 M',
              icon: 'fa-solid fa-bolt',
              variant: 'primary',
              delta: '+6.2%',
              deltaVariant: 'success',
              description: 'vs. the same hour yesterday',
            },
            { label: 'Open incidents', value: 2, variant: 'danger', href: '/incidents' },
          ];

          html\`<lia-stat-row .items=\${items} columns="5" gutter="3"></lia-stat-row>\`;
        `
      ),
      example(
        'One card at a time',
        grid(
          3,
          ([
            { label: 'Minimal', value: 12 },
            { label: 'With an icon', value: '98.7%', icon: 'fa-solid fa-heart-pulse', variant: 'success' },
            {
              label: 'Falling',
              value: '184 ms',
              icon: 'fa-solid fa-stopwatch',
              variant: 'info',
              delta: '−12 ms',
              deltaVariant: 'success',
              description: 'p95 over the last hour',
            },
            {
              label: 'A link',
              value: 7,
              icon: 'fa-solid fa-key',
              variant: 'secondary',
              href: '#/editors/credentials',
              description: 'active access keys',
            },
          ] as StatCardData[]).map(
            (data) => html`<div class="col"><lia-stat-card .data=${data}></lia-stat-card></div>`
          )
        ),
        dedent`
          html\`<lia-stat-card .data=\${card}></lia-stat-card>\`;
          html\`<lia-stat-card label="Members" value="60" icon="fa-solid fa-users" flush></lia-stat-card>\`;
        `
      ),
    ])}
    ${section('Resource meters', 'A limit, what is used of it and — when capacity is handed down — what is already allocated.', [
      example('Live', html`<demo-resource-grid></demo-resource-grid>`, RESOURCE_CODE),
      example(
        'One tile',
        split(
          html`<lia-resource-item
            label="Storage"
            used=${1655 * 1024 ** 3}
            available=${2048 * 1024 ** 3}
            assigned=${1900 * 1024 ** 3}
            format-bytes
            byte-usage=${1_612_398_121_144}
            href="#/editors/usage"
          ></lia-resource-item>`,
          html`<lia-resource-item
            label="Access keys"
            used="7"
            available="-1"
            unlimited-label="No limit"
          ></lia-resource-item>`
        ),
        dedent`
          html\`<lia-resource-item
            label="Storage"
            used=\${used}
            available=\${limit}
            assigned=\${allocated}
            format-bytes
            byte-usage=\${actualBytesOnDisk}
          ></lia-resource-item>\`;

          // A negative limit means unlimited: the bar goes flat and the figure reads ∞.
          formatBytes(-1);   // → '∞'
        `,
        {
          description: `Used ${formatBytes(1655 * 1024 ** 3)} of ${formatBytes(2048 * 1024 ** 3)}`,
        }
      ),
      example(
        'Bare, and empty',
        split(
          html`<lia-dashboard-grid
            no-card
            columns="2"
            .items=${resourceItemsCompact.slice(0, 2)}
          ></lia-dashboard-grid>`,
          html`<lia-dashboard-grid
            .items=${[]}
            empty-message="This account has no metered resources."
          ></lia-dashboard-grid>`
        ),
        dedent`
          html\`<lia-dashboard-grid no-card columns="2" .items=\${items}></lia-dashboard-grid>\`;
        `
      ),
    ])}
  `;
}

function renderPanels(): TemplateResult {
  return html`
    ${section('Info card', 'Key/value facts in a card, with one button that copies the lot as plain text.', [
      example(
        'Two panels',
        split(
          html`<lia-info-card
            title="Environment"
            icon="fa-solid fa-server"
            copyable
            copy-title="Copy the environment details"
            flush
            .entries=${systemInfo}
          ></lia-info-card>`,
          html`<lia-info-card
            title="Account"
            icon="fa-solid fa-building"
            variant="primary"
            flush
            .entries=${accountInfo}
          ></lia-info-card>`
        ),
        dedent`
          const entries: InfoEntry[] = [
            { label: 'Console version', value: '4.12.0', icon: 'fa-solid fa-tag' },
            { label: 'Runtime', html: 'Node <code>22.14.0</code>' },          // trusted markup
            { label: 'Scheduler', value: 'running', badge: { text: 'healthy', variant: 'success' } },
            { label: 'Broker', value: 'degraded', variant: 'warning' },
            { label: 'Support bundle', value: 'Download', href: '/support/bundle' },
          ];

          html\`<lia-info-card title="Environment" copyable flush .entries=\${entries}></lia-info-card>\`;

          // The copy button uses the same serialisation you can call yourself:
          infoEntriesToText(entries);
        `
      ),
      example(
        'Empty',
        html`<lia-info-card
          title="Billing"
          icon="fa-solid fa-receipt"
          .entries=${[]}
          empty-message="This organisation is on an invoiced plan; there is nothing to show here."
        ></lia-info-card>`,
        undefined
      ),
    ])}
    ${section('Activity list', 'A stream of things that happened, or a list of things still to do.', [
      example('Live', html`<demo-activity></demo-activity>`, dedent`
        const items: ActivityItem[] = [
          {
            id: 'a1',
            icon: 'fa-solid fa-rocket',
            html: 'Released <strong>checkout</strong> v2.31.0 to production',
            text: 'Released checkout v2.31.0 to production',   // the accessible fallback
            meta: '3 min ago',
            metaVariant: 'success',
            description: 'by j.lindqvist · rollout 100%',
          },
          { id: 'a2', text: 'Alert "edge 5xx rate" fired', variant: 'danger', href: '/incidents/8814' },
        ];

        html\`<lia-activity-list
          title="Recent activity"
          card
          flush
          interactive
          .items=\${items}
          @lia-activity-select=\${(e: CustomEvent) => open(e.detail.item)}
        ></lia-activity-list>\`;
      `),
      example(
        'Bare, without a card',
        html`<div class="border rounded-3 p-3">
          <lia-activity-list .items=${scheduledJobs} label="Scheduled jobs"></lia-activity-list>
        </div>`,
        dedent`
          html\`<lia-activity-list .items=\${jobs} label="Scheduled jobs"></lia-activity-list>\`;
        `
      ),
    ])}
    ${section('Newsfeed', 'Announcements, either handed over directly or fetched from a URL.', [
      example('Live', html`<demo-newsfeed></demo-newsfeed>`, dedent`
        html\`<lia-newsfeed
          title="Product news"
          src="/api/news.json"          // fetched on connect; parsed by parseNewsfeed()
          max-items="4"
          new-tab
          flush
          @lia-newsfeed-load=\${(e: CustomEvent) => log(e.detail)}
        ></lia-newsfeed>\`;

        // …or feed it directly, when the host already has the data:
        html\`<lia-newsfeed .items=\${newsItems}></lia-newsfeed>\`;
      `),
      example(
        'States',
        html`<div class="row g-3">
          <div class="col-12 col-lg-4">
            <lia-newsfeed loading loading-label="Fetching announcements…"></lia-newsfeed>
          </div>
          <div class="col-12 col-lg-4">
            <lia-newsfeed error="The feed did not answer." error-label="News is unavailable"></lia-newsfeed>
          </div>
          <div class="col-12 col-lg-4">
            <lia-newsfeed .items=${[]} empty-message="Nothing new since your last visit."></lia-newsfeed>
          </div>
        </div>`,
        undefined
      ),
    ])}
  `;
}

function renderCharts(): TemplateResult {
  return html`
    ${section(
      'Chart',
      'A thin, theme-aware wrapper over Chart.js. It is loaded lazily, re-coloured whenever the colour scheme changes, and given an accessible summary so the figures are not colour-only.',
      example('Live', html`<demo-charts></demo-charts>`, CHART_CODE)
    )}
    ${section('Marks', 'The same family of data, in the shapes that suit it.', [
      example(
        'Line and composition',
        split(
          html`<lia-chart
            type="line"
            height="240"
            label="Transfer per month"
            summary="Both series rise steadily across the twelve months."
            .data=${transferLineChart}
          ></lia-chart>`,
          html`<lia-chart
            type="doughnut"
            height="240"
            label="Where the storage sits"
            summary="Volumes 780 GiB, object buckets 402 GiB, snapshots 291 GiB, backups 182 GiB, free 393 GiB."
            .data=${storageBreakdownChart}
          ></lia-chart>`
        ),
        dedent`
          html\`<lia-chart type="line" .data=\${series} height="240"></lia-chart>\`;
          html\`<lia-chart type="doughnut" .data=\${breakdown} height="240"></lia-chart>\`;
        `
      ),
      example(
        'Loading and failure',
        split(
          html`<lia-chart
            type="bar"
            height="180"
            loading-label="Loading the transfer chart…"
            .data=${{ datasets: [] }}
          ></lia-chart>`,
          html`<lia-chart
            type="bar"
            height="180"
            error-message="The chart library is not installed; the table below carries the same figures."
            .data=${{ datasets: [] }}
          ></lia-chart>`
        ),
        dedent`
          // Chart.js is an optional peer. When it is missing, the element renders
          // \`error-message\` instead of an empty box — always pair a chart with a table.
          html\`<lia-chart error-message="…" .data=\${{ datasets: [] }}></lia-chart>\`;
        `
      ),
      note(
        html`Series identity never rests on colour alone in this demo: every chart is paired with a
          legend and, on the usage pages, with a table of the same numbers. The palettes
          (<code>USAGE_PALETTE_LIGHT</code> / <code>USAGE_PALETTE_DARK</code>) are checked for
          adjacent-pair separation under normal and colour-deficient vision, in both themes.`,
        'info'
      ),
    ])}
  `;
}

function renderGrid(): TemplateResult {
  return html`
    ${section(
      'A whole dashboard',
      'The widget grid is nothing but spans over Bootstrap’s twelve columns — which is exactly enough to lay out a landing page.',
      example('Live', html`<demo-dashboard-grid></demo-dashboard-grid>`, WIDGET_CODE, {
        bodyClass: 'p-3',
      })
    )}
    ${section('Spans', 'How a span resolves at each breakpoint.', [
      example(
        'Widget properties',
        propTable(
          [
            { name: 'span', type: 'number (1–12)', default: '12', description: 'Columns from the `lg` breakpoint up.' },
            { name: 'spanMd', type: 'number (1–12)', description: 'Columns between `md` and `lg`. Defaults to a sensible widening of `span`.' },
            { name: 'content', type: 'unknown', description: 'Anything Lit can render.' },
            { name: 'html', type: 'string', description: 'Trusted markup, when the widget comes from a server.' },
            { name: 'class', type: 'string', description: 'Extra classes on the column.' },
            { name: 'visible', type: 'boolean', default: 'true', description: '`false` keeps the widget in the definition but off the page.' },
          ],
          'DashboardWidget'
        )
      ),
      example(
        'The grid itself',
        html`<lia-widget-grid
          gutter="2"
          .widgets=${([4, 4, 4, 6, 6, 8, 4, 12] as number[]).map((span, index) => ({
            id: `span-${index}`,
            span,
            content: html`<div
              class="border border-primary-subtle bg-primary-subtle rounded-3 p-3 text-center small font-monospace h-100"
            >
              span=${span}
            </div>`,
          }))}
        ></lia-widget-grid>`,
        dedent`
          html\`<lia-widget-grid
            gutter="2"
            default-span="12"
            .widgets=\${[{ span: 8, content: chart }, { span: 4, content: news }]}
          ></lia-widget-grid>\`;
        `
      ),
    ])}
    ${section('Composition rules', 'What the family agrees on so a dashboard reads as one page.', [
      example(
        '',
        html`<ul class="list-group list-group-flush">
          <li class="list-group-item">
            <strong>Every panel is flush-capable.</strong> <code>flush</code> removes the card body
            padding so a list touches the card edges — which is what the grid wants.
          </li>
          <li class="list-group-item">
            <strong>Nothing hard-codes a colour.</strong> Meters derive theirs from the usage
            percentage; badges and cards take a Bootstrap variant.
          </li>
          <li class="list-group-item">
            <strong>Every element has an empty state.</strong> A dashboard is mostly empty on day
            one, and that has to look deliberate.
          </li>
          <li class="list-group-item">
            <strong>Labels are properties.</strong> “Unlimited”, “allocated”, “No news right now” —
            all of them overridable, none of them baked in.
          </li>
        </ul>`,
        undefined,
        { bodyClass: 'p-0' }
      ),
      example(
        'Panel gallery',
        cluster(
          html`<span class="badge text-bg-secondary">lia-welcome-panel</span>`,
          html`<span class="badge text-bg-secondary">lia-stat-row</span>`,
          html`<span class="badge text-bg-secondary">lia-stat-card</span>`,
          html`<span class="badge text-bg-secondary">lia-dashboard-grid</span>`,
          html`<span class="badge text-bg-secondary">lia-resource-item</span>`,
          html`<span class="badge text-bg-secondary">lia-info-card</span>`,
          html`<span class="badge text-bg-secondary">lia-activity-list</span>`,
          html`<span class="badge text-bg-secondary">lia-newsfeed</span>`,
          html`<span class="badge text-bg-secondary">lia-chart</span>`,
          html`<span class="badge text-bg-secondary">lia-widget-grid</span>`
        ),
        undefined,
        { description: 'Ten elements — the whole family' }
      ),
    ])}
  `;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** The dashboard demos. */
export const dashboardRoutes: DemoRoute[] = [
  {
    path: '/dashboard/overview',
    title: 'Meters & figures',
    group: 'dashboard',
    icon: 'fa-solid fa-gauge-high',
    description: 'The welcome panel, KPI cards and the resource meters.',
    keywords: ['dashboard', 'kpi', 'stat', 'meter', 'resource', 'quota', 'welcome'],
    render: renderOverview,
  },
  {
    path: '/dashboard/activity',
    title: 'Panels & activity',
    group: 'dashboard',
    icon: 'fa-solid fa-clock-rotate-left',
    description: 'Key/value panels, activity streams and the news feed.',
    keywords: ['activity', 'info card', 'newsfeed', 'panel', 'timeline', 'jobs'],
    render: renderPanels,
  },
  {
    path: '/dashboard/charts',
    title: 'Charts',
    group: 'dashboard',
    icon: 'fa-solid fa-chart-column',
    description: 'A lazy, theme-aware Chart.js wrapper with an accessible summary.',
    keywords: ['chart', 'graph', 'bar', 'line', 'doughnut', 'chartjs'],
    render: renderCharts,
  },
  {
    path: '/dashboard/grid',
    title: 'Widget grid',
    group: 'dashboard',
    icon: 'fa-solid fa-table-cells-large',
    description: 'Spans over twelve columns — a whole landing page, as data.',
    keywords: ['grid', 'widget', 'layout', 'span', 'dashboard'],
    render: renderGrid,
  },
];

declare global {
  interface HTMLElementTagNameMap {
    'demo-resource-grid': DemoResourceGrid;
    'demo-charts': DemoCharts;
    'demo-activity': DemoActivity;
    'demo-newsfeed': DemoNewsfeed;
    'demo-dashboard-grid': DemoDashboardGrid;
  }
}
