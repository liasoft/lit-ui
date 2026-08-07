import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  IconName,
  InfoEntry,
  StatCardData,
  TableListing,
  Variant,
} from '../../core/types.js';
import { cx, formatBytes, renderRich, usagePercent, usageVariant } from '../../core/utils.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderSpinner } from '../primitives/lia-spinner.js';
import { renderActions } from '../primitives/render-action.js';
import type { ProgressVariant } from '../primitives/lia-progress.js';
import { infoEntriesToText } from '../dashboard/lia-info-card.js';
import '../primitives/lia-progress.js';
import '../primitives/lia-copy-button.js';
import '../primitives/lia-empty-state.js';
import '../dashboard/lia-info-card.js';
import '../dashboard/lia-stat-row.js';
import '../table/lia-table.js';

/* ------------------------------------------------------------------ *
 * Data contracts
 * ------------------------------------------------------------------ */

/**
 * One "x of y" bar: memory in use against memory available, keys against key
 * slots, hits against hits-plus-misses.
 *
 * The bar's colour is derived from the usage thresholds in `core/utils`
 * ({@link usageVariant}), which is right for a *consumption* gauge — the
 * fuller it gets the more alarming it looks. A gauge where a high reading is
 * *good* (a hit rate) should say so with an explicit {@link variant}.
 */
export interface ReportGauge {
  /** Caption above the bar, e.g. `Shared memory`. */
  label: string;
  /** The filled quantity. */
  used: number;
  /** The whole quantity. `0` or less means "no limit" and fills the bar. */
  total: number;
  /** Print `used` and `total` as byte sizes instead of grouped integers. */
  formatBytes?: boolean;
  /** Extra detail behind an info icon next to the caption line. Trusted HTML. */
  infotext?: string;
  /** Override the derived bar colour, e.g. `success` for a hit rate. */
  variant?: ProgressVariant;
}

/**
 * One headline figure of a report — a `<lia-stat-card>` in everything but
 * name.
 *
 * `value` is printed verbatim, so pre-format anything that needs it; `unit` is
 * appended after a hair space, which keeps `412 ms` from wrapping badly.
 */
export interface ReportMetric {
  label: string;
  value: string | number;
  /** Appended to {@link value}, e.g. `ms`, `req/s`, `%`. */
  unit?: string;
  /** Short change indicator, e.g. `+3.1 %`. */
  delta?: string;
  /** Contextual colour of the icon chip (and of {@link delta}). */
  variant?: Variant;
  /** Muted line under the value. */
  description?: string;
  /** Icon-font class string for the chip. */
  icon?: IconName;
}

/**
 * A titled block of key/value detail — the "general information" and "runtime
 * configuration" panels a cache report ends with.
 *
 * Named `ReportInfoSection` rather than `ReportSection` because the settings
 * family already exports that name for `<lia-phpinfo-view>`'s row-table shape,
 * which is a different thing.
 */
export interface ReportInfoSection {
  /** Heading of the card. */
  title: string;
  /** Icon before the heading. */
  icon?: IconName;
  /** The rows of the card. */
  entries: InfoEntry[];
}

/** Detail of `lia-report-refresh`, fired when the reader asks for fresh figures. */
export interface ReportRefreshDetail {
  /** The `id` of the report element, so one listener can serve several reports. */
  id: string;
}

declare global {
  interface HTMLElementEventMap {
    'lia-report-refresh': CustomEvent<ReportRefreshDetail>;
  }
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/**
 * Group the integer part of a number in threes with a narrow no-break space —
 * `1284991` → `1 284 991`.
 *
 * Deliberately locale-independent: a report is read next to server output, and
 * a separator that changes with the browser's language makes two figures on
 * the same screen impossible to compare.
 */
export function groupDigits(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const [integer, fraction] = Math.abs(value).toString().split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${value < 0 ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** One side of a gauge, as text: a byte size or a grouped integer. */
export function formatGaugeValue(gauge: ReportGauge, value: number): string {
  return gauge.formatBytes ? formatBytes(value) : groupDigits(value);
}

/** A gauge's fill, 0–100, using the kit's shared usage maths. */
export function gaugePercent(gauge: ReportGauge): number {
  return usagePercent(gauge.used, gauge.total);
}

/** `12 MiB / 64 MiB · 19 %` — the line printed under a gauge's bar. */
export function gaugeCaption(gauge: ReportGauge): string {
  const used = formatGaugeValue(gauge, gauge.used);
  const percent = gaugePercent(gauge);
  if (gauge.total <= 0) return used;
  return `${used} / ${formatGaugeValue(gauge, gauge.total)} · ${percent} %`;
}

/** The whole report as plain text, for the clipboard. */
export function systemReportToText(report: {
  title?: string;
  gauges?: readonly ReportGauge[];
  metrics?: readonly ReportMetric[];
  sections?: readonly ReportInfoSection[];
}): string {
  const blocks: string[] = [];
  if (report.title) blocks.push(report.title);

  const gauges = report.gauges ?? [];
  if (gauges.length > 0) {
    blocks.push(gauges.map((gauge) => `- ${gauge.label}: ${gaugeCaption(gauge)}`).join('\n'));
  }

  const metrics = report.metrics ?? [];
  if (metrics.length > 0) {
    blocks.push(
      metrics
        .map((metric) => {
          const unit = metric.unit ? ` ${metric.unit}` : '';
          const delta = metric.delta ? ` (${metric.delta})` : '';
          return `- ${metric.label}: ${metric.value}${unit}${delta}`;
        })
        .join('\n')
    );
  }

  for (const section of report.sections ?? []) {
    blocks.push(`${section.title}\n${infoEntriesToText(section.entries)}`);
  }

  return blocks.join('\n\n');
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

function clampColumns(columns: number): number {
  if (!Number.isFinite(columns)) return 2;
  return Math.min(4, Math.max(1, Math.round(columns)));
}

/**
 * The statistics dashboard of a running subsystem: a band of gauges, a row of
 * headline figures, the configuration behind them, and — when the subsystem
 * keeps a list — a table of what it currently holds.
 *
 * This is the *dashboard* half of a runtime report. Its sibling
 * `<lia-phpinfo-view>` prints the thousand-directive dump; this one answers
 * "is it healthy?" at a glance: how full the memory is, how the hits compare
 * to the misses, how many slots are left, how long it has been up.
 *
 * Nothing here knows what it is measuring. Gauges are `used`/`total` pairs
 * coloured by the kit's shared usage thresholds, metrics are stat cards,
 * sections are detail panels, and `entries` is an ordinary
 * {@link TableListing} — so the same element renders an object cache, an
 * opcode cache, a connection pool or a job queue.
 *
 * The header carries the report's own affordances: your `actions` (a "clear
 * the cache" button belongs there), a refresh button that emits
 * `lia-report-refresh`, and a copy button that puts the whole report on the
 * clipboard as plain text — the shape a support ticket wants.
 *
 * @example
 * ```ts
 * html`<lia-system-report
 *   title="Object cache"
 *   icon="fa-solid fa-hard-drive"
 *   description="Shared-memory cache in front of the primary database."
 *   .gauges=${[
 *     { label: 'Memory', used: 2_147_483_648, total: 4_294_967_296, formatBytes: true },
 *     { label: 'Hit rate', used: 1_284_991, total: 1_318_402, variant: 'success' },
 *   ]}
 *   .metrics=${[
 *     { label: 'Keys', value: '18 402', icon: 'fa-solid fa-key', variant: 'primary' },
 *     { label: 'Uptime', value: '6 d 4 h', icon: 'fa-solid fa-clock', variant: 'info' },
 *   ]}
 *   .sections=${[
 *     { title: 'General', icon: 'fa-solid fa-circle-info', entries: [{ label: 'Version', value: '8.1.2' }] },
 *   ]}
 *   .entries=${topKeysListing}
 *   .actions=${[{ id: 'flush', label: 'Clear cache', icon: 'fa-solid fa-trash-can', variant: 'warning' }]}
 *   @lia-report-refresh=${() => reload()}
 *   @lia-action=${(e: CustomEvent) => e.detail.id === 'flush' && flush()}
 * ></lia-system-report>`
 * ```
 *
 * @example
 * ```html
 * <!-- While the first request is in flight, and after it failed. -->
 * <lia-system-report title="Object cache" loading></lia-system-report>
 * <lia-system-report title="Object cache" error="The cache did not answer."></lia-system-report>
 * ```
 */
@customElement('lia-system-report')
export class LiaSystemReport extends LiaElement {
  /**
   * Heading of the report.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = '';

  /** Icon before the heading. */
  @property({ type: String }) icon: IconName = '';

  /** Line under the heading. Trusted HTML. */
  @property({ type: String }) description = '';

  /** The headline figures, rendered as a `<lia-stat-row>`. */
  @property({ attribute: false }) metrics: ReportMetric[] = [];

  /** The "x of y" bars, rendered as cards with a `<lia-progress>` each. */
  @property({ attribute: false }) gauges: ReportGauge[] = [];

  /** Detail panels, rendered as `<lia-info-card>`s in a responsive grid. */
  @property({ attribute: false }) sections: ReportInfoSection[] = [];

  /** What the subsystem currently holds — the cached-entries table. */
  @property({ attribute: false }) entries?: TableListing;

  /** Toolbar next to the heading, e.g. a "clear the cache" button. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Replace the body with a spinner while the figures are being fetched. */
  @property({ type: Boolean }) loading = false;

  /** Error message shown above the body. Empty hides the alert. Trusted HTML. */
  @property({ type: String }) error = '';

  /** Shown when there is nothing at all to report. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage =
    'No statistics are available for this subsystem.';

  /** Gauge cards per row from the `lg` breakpoint up (1–4). */
  @property({ type: Number, attribute: 'gauge-columns' }) gaugeColumns = 4;

  /** Stat cards per row from the `lg` breakpoint up (1–6). */
  @property({ type: Number, attribute: 'metric-columns' }) metricColumns = 4;

  /** Detail panels per row from the `lg` breakpoint up (1–4). */
  @property({ type: Number, attribute: 'section-columns' }) sectionColumns = 2;

  /** Hide the refresh button. */
  @property({ type: Boolean, attribute: 'no-refresh' }) noRefresh = false;

  /** Hide the copy button. */
  @property({ type: Boolean, attribute: 'no-copy' }) noCopy = false;

  /* -- overridable strings ---------------------------------------------- */

  @property({ type: String, attribute: 'refresh-label' }) refreshLabel = 'Refresh the figures';

  @property({ type: String, attribute: 'copy-label' }) copyLabel = 'Copy the report as text';

  @property({ type: String, attribute: 'copied-label' }) copiedLabel = 'Report copied';

  @property({ type: String, attribute: 'loading-label' }) loadingLabel = 'Loading the figures…';

  @property({ type: String, attribute: 'error-title' }) errorTitle = 'The report is incomplete';

  @property({ type: String, attribute: 'empty-title' }) emptyTitle = 'Nothing to report';

  /** Accessible name of the gauge band. */
  @property({ type: String, attribute: 'gauges-label' }) gaugesLabel = 'Utilisation';

  /** Accessible name of the metric band. */
  @property({ type: String, attribute: 'metrics-label' }) metricsLabel = 'Key figures';

  /** Heading above the entries table. Empty hides the heading. */
  @property({ type: String, attribute: 'entries-title' }) entriesTitle = 'Cached entries';

  /** Icon before the entries heading. */
  @property({ type: String, attribute: 'entries-icon' }) entriesIcon: IconName =
    'fa-solid fa-list-ul';

  /** Text put on the clipboard; defaults to the rendered report. */
  @property({ type: String, attribute: 'copy-text' }) copyText = '';

  /** The plain-text representation used by the copy button. */
  get text(): string {
    return (
      this.copyText ||
      systemReportToText({
        title: this.title,
        gauges: this.gauges,
        metrics: this.metrics,
        sections: this.sections,
      })
    );
  }

  /** `true` when there is not a single figure, panel or row to show. */
  get isEmpty(): boolean {
    return (
      this.gauges.length === 0 &&
      this.metrics.length === 0 &&
      this.sections.length === 0 &&
      (this.entries?.rows.length ?? 0) === 0
    );
  }

  /** The metrics as `<lia-stat-card>` descriptors. */
  get statCards(): StatCardData[] {
    return this.metrics.map((metric) => ({
      label: metric.label,
      value: metric.unit ? `${metric.value} ${metric.unit}` : metric.value,
      icon: metric.icon,
      variant: metric.variant ?? 'primary',
      delta: metric.delta,
      deltaVariant: metric.variant,
      description: metric.description,
    }));
  }

  /** Ask the host for fresh figures. */
  refresh(): void {
    this.emit<ReportRefreshDetail>('lia-report-refresh', { id: this.id });
  }

  private renderGauge(gauge: ReportGauge): TemplateResult {
    const percent = gaugePercent(gauge);
    return html`<div class="col" role="listitem">
      <div class="card h-100">
        <div class="card-body">
          <h3 class="h6 card-title text-body-secondary">${gauge.label}</h3>
          <lia-progress
            .percent=${percent}
            variant=${gauge.variant ?? usageVariant(percent)}
            .valueNow=${gauge.used}
            .valueMax=${gauge.total > 0 ? gauge.total : 100}
            bar-label=${gauge.label}
            .text=${gaugeCaption(gauge)}
            .infotext=${gauge.infotext ?? ''}
          ></lia-progress>
        </div>
      </div>
    </div>`;
  }

  private renderGauges(): TemplateResult | typeof nothing {
    if (this.gauges.length === 0) return nothing;
    return html`<div
      class=${cx(
        'row',
        'row-cols-1',
        'row-cols-md-2',
        `row-cols-lg-${clampColumns(this.gaugeColumns)}`,
        'g-3',
        'mb-4'
      )}
      role="list"
      aria-label=${this.gaugesLabel}
    >
      ${this.gauges.map((gauge) => this.renderGauge(gauge))}
    </div>`;
  }

  private renderMetrics(): TemplateResult | typeof nothing {
    if (this.metrics.length === 0) return nothing;
    return html`<lia-stat-row
      .items=${this.statCards}
      .columns=${this.metricColumns}
      label=${this.metricsLabel}
    ></lia-stat-row>`;
  }

  private renderSections(): TemplateResult | typeof nothing {
    if (this.sections.length === 0) return nothing;
    return html`<div
      class=${cx('row', 'row-cols-1', `row-cols-lg-${clampColumns(this.sectionColumns)}`, 'g-3', 'mb-4')}
    >
      ${this.sections.map(
        (section) => html`<div class="col">
          <lia-info-card
            flush
            .title=${section.title}
            .icon=${section.icon ?? ''}
            .entries=${section.entries}
          ></lia-info-card>
        </div>`
      )}
    </div>`;
  }

  private renderEntries(): TemplateResult | typeof nothing {
    const listing = this.entries;
    if (!listing) return nothing;
    return html`<div class="lia-system-report-entries">
      ${this.entriesTitle
        ? html`<h3 class="h6 d-flex align-items-center gap-1 mb-2">
            ${renderIcon(this.entriesIcon)}${this.entriesTitle}
          </h3>`
        : nothing}
      <lia-table .listing=${listing}></lia-table>
    </div>`;
  }

  private renderHeader(): TemplateResult | typeof nothing {
    const tools = !this.noRefresh || !this.noCopy || this.actions.length > 0;
    if (!this.title && !this.description && !tools) return nothing;

    return html`<div
      class="lia-system-report-head d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3"
    >
      <div class="min-w-0">
        ${this.title
          ? html`<h2 class="h5 mb-1">${renderIcon(this.icon, { class: 'me-2' })}${this.title}</h2>`
          : nothing}
        ${this.description
          ? html`<p class="text-body-secondary mb-0">${renderRich(this.description)}</p>`
          : nothing}
      </div>
      ${tools
        ? html`<div
            class="d-flex flex-wrap align-items-center gap-2"
            role="group"
            aria-label=${this.title || this.metricsLabel}
          >
            ${renderActions(this.actions, {
              host: this,
              size: 'sm',
              variant: 'outline-primary',
              labelResponsive: true,
            })}
            ${this.noCopy
              ? nothing
              : html`<lia-copy-button
                  .text=${this.text}
                  .title=${this.copyLabel}
                  copied-title=${this.copiedLabel}
                ></lia-copy-button>`}
            ${this.noRefresh
              ? nothing
              : html`<button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  title=${this.refreshLabel}
                  aria-label=${this.refreshLabel}
                  ?disabled=${this.loading}
                  @click=${() => this.refresh()}
                >
                  <i
                    class=${cx('fa-solid fa-arrows-rotate', this.loading && 'fa-spin')}
                    aria-hidden="true"
                  ></i>
                </button>`}
          </div>`
        : nothing}
    </div>`;
  }

  private renderBody(): TemplateResult | typeof nothing {
    // A failed request has nothing to draw and the alert already said so —
    // stacking an empty state under it would only repeat the bad news.
    if (this.error && this.isEmpty && !this.loading) return nothing;

    if (this.loading) {
      return html`<div class="card">
        <div
          class="card-body d-flex align-items-center justify-content-center gap-2 py-5 text-body-secondary"
          role="status"
          aria-live="polite"
        >
          ${renderSpinner(this.loadingLabel)}<span>${this.loadingLabel}</span>
        </div>
      </div>`;
    }

    if (this.isEmpty) {
      return html`<lia-empty-state
        .title=${this.emptyTitle}
        message=${this.emptyMessage}
        icon="fa-solid fa-gauge-high"
      ></lia-empty-state>`;
    }

    return html`${this.renderGauges()}${this.renderMetrics()}${this.renderSections()}${this.renderEntries()}`;
  }

  protected override render(): TemplateResult {
    return html`<div class="lia-system-report" aria-busy=${this.loading ? 'true' : nothing}>
      ${this.renderHeader()}
      ${this.error
        ? html`<div class="alert alert-danger d-flex gap-2 align-items-baseline" role="alert">
            <i class="fa-solid fa-triangle-exclamation flex-shrink-0" aria-hidden="true"></i>
            <span
              >${this.errorTitle
                ? html`<strong class="d-block">${this.errorTitle}</strong>`
                : nothing}${renderRich(this.error)}</span
            >
          </div>`
        : nothing}
      ${this.renderBody()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-system-report': LiaSystemReport;
  }
}
