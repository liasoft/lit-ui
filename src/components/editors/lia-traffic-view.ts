import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, formatBytes, uid } from '../../core/utils.js';
import type { IconName } from '../../core/types.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderSpinner } from '../primitives/lia-spinner.js';
import '../primitives/lia-empty-state.js';
import '../dashboard/lia-chart.js';
import type { ChartData, ChartOptions } from '../dashboard/lia-chart.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** One bucket on the time axis — a day, a month, a year, a release. */
export interface UsageSeriesPoint {
  /** Axis label for the bucket. */
  label: string;
  /** Metric key -> value in this bucket. Missing keys count as zero. */
  values: Record<string, number>;
}

/** One measured quantity, drawn as one series. */
export interface UsageMetric {
  /** Key into {@link UsageSeriesPoint.values}. */
  key: string;
  /** Human-readable name, used in the legend, the table and the tooltip. */
  label: string;
  /** Override the palette colour for the light theme. */
  color?: string;
  /** Override the palette colour for the dark theme. */
  darkColor?: string;
}

/** One entry of the period selector. */
export interface UsagePeriod {
  value: string;
  label: string;
}

/** How values are turned into text. */
export type UsageFormat = 'number' | 'bytes';

/**
 * Categorical palette for the light theme, in fixed slot order.
 *
 * Series colours are assigned by position and never cycled: a filter that
 * removes a metric must not repaint the survivors. The order is the validated
 * default — every adjacent pair clears the colour-vision-deficiency and
 * normal-vision separation floors on a light surface. Three of these slots sit
 * below 3:1 contrast against a light background, which is why this component
 * always ships a legend *and* the summary table: identity never rests on
 * colour alone.
 */
export const USAGE_PALETTE_LIGHT: readonly string[] = Object.freeze([
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
]);

/** The same six hues, re-stepped for a dark surface (all ≥ 3:1 there). */
export const USAGE_PALETTE_DARK: readonly string[] = Object.freeze([
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
]);

/** The default period selector: three granularities, no domain wording. */
export const DEFAULT_USAGE_PERIODS: readonly UsagePeriod[] = Object.freeze([
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]);

/** Every string `<lia-traffic-view>` renders on its own behalf. */
export interface UsageViewLabels {
  period: string;
  total: string;
  periodColumn: string;
  chart: string;
  table: string;
  empty: string;
  emptyTitle: string;
  loading: string;
  /** `{total}` and `{periods}` are replaced; the chart's text alternative. */
  summary: string;
}

/** The defaults behind {@link LiaTrafficView.labels}. */
export const DEFAULT_USAGE_VIEW_LABELS: Readonly<UsageViewLabels> = Object.freeze({
  period: 'Period',
  total: 'Total',
  periodColumn: 'Period',
  chart: 'Usage over time',
  table: 'Usage per period',
  empty: 'There is nothing recorded for this period yet.',
  emptyTitle: 'No data',
  loading: 'Loading…',
  summary: '{total} in total across {periods} periods.',
});

/** Detail of `lia-period-change`. */
export interface UsagePeriodDetail {
  period: string;
}

declare global {
  interface HTMLElementEventMap {
    'lia-period-change': CustomEvent<UsagePeriodDetail>;
  }
}

/** The colour scheme actually in force, without depending on stored state. */
function activeScheme(): 'light' | 'dark' {
  const stamped = document.documentElement.getAttribute('data-bs-theme');
  if (stamped === 'dark' || stamped === 'light') return stamped;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * Usage over time: a period selector, a chart and the same numbers as a
 * summary table with per-metric totals.
 *
 * The data model is deliberately plain — a list of buckets, each with a label
 * and a `metric -> number` map — so the same component draws traffic, request
 * counts, storage growth, build minutes or anything else that accumulates. The
 * metrics are derived from the data unless you name and order them yourself.
 *
 * The table is not decoration: it is the accessible equivalent of the chart,
 * and the relief for readers who cannot separate the series by colour. Series
 * colours come from a fixed, validated palette with a light and a dark step,
 * and are reassigned when the theme changes.
 *
 * @example
 * ```ts
 * html`<lia-traffic-view
 *   period="month"
 *   format="bytes"
 *   .metrics=${[
 *     { key: 'web', label: 'Web' },
 *     { key: 'mail', label: 'Mail' },
 *     { key: 'files', label: 'Files' },
 *   ]}
 *   .series=${[
 *     { label: 'Jan', values: { web: 4.2e9, mail: 3.1e8, files: 9.8e8 } },
 *     { label: 'Feb', values: { web: 5.7e9, mail: 2.6e8, files: 1.4e9 } },
 *   ]}
 *   @lia-period-change=${(e: CustomEvent) => reload(e.detail.period)}
 * ></lia-traffic-view>`;
 * ```
 *
 * @example
 * ```html
 * <lia-traffic-view chart-type="bar" show-table="false"></lia-traffic-view>
 * ```
 */
@customElement('lia-traffic-view')
export class LiaTrafficView extends LiaElement {
  /** The buckets, in axis order. */
  @property({ attribute: false }) series: UsageSeriesPoint[] = [];

  /** The metrics to draw. Derived from the data when omitted. */
  @property({ attribute: false }) metrics?: UsageMetric[];

  /** Entries of the period selector. Set to `[]` to hide it. */
  @property({ attribute: false }) periods: UsagePeriod[] = [...DEFAULT_USAGE_PERIODS];

  /** The selected period. */
  @property({ type: String }) period = '';

  /** `line` for trends, `bar` for discrete buckets. */
  @property({ type: String, attribute: 'chart-type' }) chartType: 'line' | 'bar' = 'line';

  /** Stack the series — the right default for parts of a whole. */
  @property({ converter: flag }) stacked = true;

  /** How values are rendered as text. */
  @property({ type: String }) format: UsageFormat = 'number';

  /** Suffix appended to `number`-formatted values, e.g. `req`. */
  @property({ type: String }) unit = '';

  /** Fraction digits for formatted values. */
  @property({ type: Number }) decimals = 2;

  /** Locale for number formatting. Defaults to the browser's. */
  @property({ type: String }) locale?: string;

  /** Show the per-metric totals strip above the chart. */
  @property({ converter: flag, attribute: 'show-totals' }) showTotals = true;

  /** Show the summary table under the chart. */
  @property({ converter: flag, attribute: 'show-table' }) showTable = true;

  /** Height of the chart canvas, in pixels. */
  @property({ type: Number }) height = 280;

  /** Optional heading above the chart card. */
  @property({ type: String }) override title = '';

  /** Icon shown next to the heading. */
  @property({ type: String }) icon: IconName = '';

  /** The data is being fetched. */
  @property({ type: Boolean }) loading = false;

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<UsageViewLabels> = {};

  @state() private scheme: 'light' | 'dark' = 'light';

  private readonly instanceId = uid('lia-usage');

  private readonly onThemeChange = (): void => {
    this.scheme = activeScheme();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheme = activeScheme();
    window.addEventListener('lia-theme-change', this.onThemeChange);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('lia-theme-change', this.onThemeChange);
    super.disconnectedCallback();
  }

  /** The metrics in force — the `metrics` property, or the keys in the data. */
  get resolvedMetrics(): UsageMetric[] {
    if (this.metrics?.length) return this.metrics;
    const keys: string[] = [];
    for (const point of this.series) {
      for (const key of Object.keys(point.values)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
    return keys.map((key) => ({ key, label: key }));
  }

  /** Sum per metric across every bucket. */
  get totals(): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const metric of this.resolvedMetrics) {
      totals[metric.key] = this.series.reduce(
        (sum, point) => sum + (point.values[metric.key] ?? 0),
        0,
      );
    }
    return totals;
  }

  /** Sum of every metric across every bucket. */
  get grandTotal(): number {
    return Object.values(this.totals).reduce((sum, value) => sum + value, 0);
  }

  /** Render a raw value the way the table and tooltips do. */
  formatValue(value: number): string {
    if (this.format === 'bytes') return formatBytes(value, this.decimals);
    const text = new Intl.NumberFormat(this.locale, {
      maximumFractionDigits: this.decimals,
    }).format(value);
    return this.unit ? `${text} ${this.unit}` : text;
  }

  private get strings(): UsageViewLabels {
    return { ...DEFAULT_USAGE_VIEW_LABELS, ...this.labels };
  }

  /** Colour for slot `index`, honouring a metric's own override. */
  private colorFor(metric: UsageMetric, index: number): string {
    const dark = this.scheme === 'dark';
    const own = dark ? (metric.darkColor ?? metric.color) : metric.color;
    if (own) return own;
    const palette = dark ? USAGE_PALETTE_DARK : USAGE_PALETTE_LIGHT;
    return palette[index % palette.length];
  }

  /** The page background, used as the 2px separator between stacked fills. */
  private surfaceColor(): string {
    const token = getComputedStyle(this).getPropertyValue('--bs-body-bg').trim();
    return token || (this.scheme === 'dark' ? '#1a1a19' : '#ffffff');
  }

  private chartData(): ChartData {
    const metrics = this.resolvedMetrics;
    const surface = this.surfaceColor();
    return {
      labels: this.series.map((point) => point.label),
      datasets: metrics.map((metric, index) => {
        const color = this.colorFor(metric, index);
        const data = this.series.map((point) => point.values[metric.key] ?? 0);
        if (this.chartType === 'bar') {
          return {
            label: metric.label,
            data,
            backgroundColor: color,
            // A surface-coloured inset border is what puts a 2px gap between
            // stacked segments and between neighbouring bars.
            borderColor: surface,
            borderWidth: 2,
            borderRadius: 4,
            borderSkipped: false,
          };
        }
        return {
          label: metric.label,
          data,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: surface,
          pointBorderWidth: 2,
          fill: false,
        };
      }),
    };
  }

  private chartOptions(): ChartOptions {
    const format = (value: number): string => this.formatValue(value);
    return {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: this.stacked, grid: { display: false } },
        y: {
          stacked: this.stacked,
          beginAtZero: true,
          ticks: {
            callback: (value: number | string) => format(Number(value)),
          },
        },
      },
      plugins: {
        legend: {
          display: this.resolvedMetrics.length > 1,
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          usePointStyle: true,
          callbacks: {
            label: (context: { dataset?: { label?: string }; parsed?: { y?: number } }) => {
              const name = context.dataset?.label ?? '';
              const value = format(context.parsed?.y ?? 0);
              return name ? `${name}: ${value}` : value;
            },
          },
        },
      },
    };
  }

  private setPeriod(next: string): void {
    if (this.period === next) return;
    this.period = next;
    this.emit<UsagePeriodDetail>('lia-period-change', { period: next });
  }

  private renderPeriodSelector(): TemplateResult | typeof nothing {
    if (this.periods.length === 0) return nothing;
    const strings = this.strings;
    const id = `${this.instanceId}-period`;
    return html`<div class="d-flex justify-content-end align-items-center gap-2 mb-3">
      <label class="form-label mb-0 small text-body-secondary" for=${id}>${strings.period}</label>
      <select
        id=${id}
        class="form-select form-select-sm w-auto"
        @change=${(event: Event) => this.setPeriod((event.target as HTMLSelectElement).value)}
      >
        ${this.periods.map(
          (entry) =>
            html`<option value=${entry.value} ?selected=${entry.value === this.period}>
              ${entry.label}
            </option>`,
        )}
      </select>
    </div>`;
  }

  private renderTotals(metrics: UsageMetric[]): TemplateResult | typeof nothing {
    if (!this.showTotals) return nothing;
    const strings = this.strings;
    const totals = this.totals;
    return html`<div class="card mb-3">
      <div class="row row-cols-2 row-cols-md-4 g-0">
        <div class="col p-3 border-end">
          <div class="h4 mb-0">${this.formatValue(this.grandTotal)}</div>
          <span class="small text-body-secondary">${strings.total}</span>
        </div>
        ${metrics.map(
          (metric, index) =>
            html`<div class="col p-3 border-end">
              <div class="h4 mb-0">${this.formatValue(totals[metric.key] ?? 0)}</div>
              <span class="small text-body-secondary d-inline-flex align-items-center gap-1">
                <span
                  class="d-inline-block rounded-circle"
                  style="width:.5rem;height:.5rem;background:${this.colorFor(metric, index)}"
                  aria-hidden="true"
                ></span>
                ${metric.label}
              </span>
            </div>`,
        )}
      </div>
    </div>`;
  }

  private renderTable(metrics: UsageMetric[]): TemplateResult | typeof nothing {
    if (!this.showTable) return nothing;
    const strings = this.strings;
    const totals = this.totals;
    return html`<div class="card table-responsive">
      <table class="table table-striped align-middle mb-0">
        <caption class="visually-hidden">
          ${strings.table}
        </caption>
        <thead>
          <tr>
            <th scope="col">${strings.periodColumn}</th>
            ${metrics.map((metric) => html`<th scope="col" class="text-end">${metric.label}</th>`)}
            <th scope="col" class="text-end">${strings.total}</th>
          </tr>
        </thead>
        <tbody>
          ${this.series.map((point) => {
            const rowTotal = metrics.reduce(
              (sum, metric) => sum + (point.values[metric.key] ?? 0),
              0,
            );
            return html`<tr>
              <th scope="row" class="fw-normal">${point.label}</th>
              ${metrics.map(
                (metric) =>
                  html`<td class="text-end">
                    ${this.formatValue(point.values[metric.key] ?? 0)}
                  </td>`,
              )}
              <td class="text-end fw-semibold">${this.formatValue(rowTotal)}</td>
            </tr>`;
          })}
        </tbody>
        <tfoot class="table-group-divider">
          <tr>
            <th scope="row">${strings.total}</th>
            ${metrics.map(
              (metric) =>
                html`<td class="text-end fw-semibold">
                  ${this.formatValue(totals[metric.key] ?? 0)}
                </td>`,
            )}
            <td class="text-end fw-semibold">${this.formatValue(this.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    const metrics = this.resolvedMetrics;
    const empty = !this.loading && (this.series.length === 0 || metrics.length === 0);

    if (this.loading) {
      return html`<div class="lia-traffic-view">
        ${this.renderPeriodSelector()}
        <div class="card">
          <div
            class="card-body d-flex align-items-center justify-content-center gap-2 text-body-secondary"
            style=${`min-height:${this.height}px`}
            role="status"
            aria-live="polite"
          >
            ${renderSpinner(strings.loading)}<span>${strings.loading}</span>
          </div>
        </div>
      </div>`;
    }

    return html`<div class="lia-traffic-view">
      ${this.renderPeriodSelector()}
      ${
        empty
          ? html`<lia-empty-state
              title=${strings.emptyTitle}
              message=${strings.empty}
              icon="fa-solid fa-chart-area"
            ></lia-empty-state>`
          : html`
              ${this.renderTotals(metrics)}
              <div class=${cx('card', this.showTable && 'mb-3')}>
                ${
                  this.title
                    ? html`<div class="card-header d-flex align-items-center gap-1">
                        ${renderIcon(this.icon)}${this.title}
                      </div>`
                    : nothing
                }
                <div class="card-body">
                  <lia-chart
                    type=${this.chartType}
                    height=${this.height}
                    label=${this.title || strings.chart}
                    summary=${strings.summary
                      .replace('{total}', this.formatValue(this.grandTotal))
                      .replace('{periods}', String(this.series.length))}
                    loading-label=${strings.loading}
                    .data=${this.chartData()}
                    .options=${this.chartOptions()}
                  ></lia-chart>
                </div>
              </div>
              ${this.renderTable(metrics)}
            `
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-traffic-view': LiaTrafficView;
  }
}
