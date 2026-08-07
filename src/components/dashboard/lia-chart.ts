import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LiaElement } from '../../core/base-element.js';
import { renderSpinner } from '../primitives/lia-spinner.js';

/** The chart kinds Chart.js registers by default in its `auto` bundle. */
export type ChartKind =
  | 'line'
  | 'bar'
  | 'pie'
  | 'doughnut'
  | 'polarArea'
  | 'radar'
  | 'bubble'
  | 'scatter';

/** One series. Extra keys are handed to the chart library untouched. */
export interface ChartDataset {
  label?: string;
  data: readonly unknown[];
  [key: string]: unknown;
}

/** Chart data in the shape the chart library expects. */
export interface ChartData {
  labels?: readonly unknown[];
  datasets: readonly ChartDataset[];
}

/** Chart options, passed through verbatim. */
export type ChartOptions = Record<string, unknown>;

/**
 * The slice of the chart library this wrapper touches. Declaring it locally
 * keeps `chart.js` out of the kit's public type surface, so consumers who
 * never draw a chart never need the dependency.
 */
interface ChartInstance {
  data: ChartData;
  options: ChartOptions;
  update(mode?: string): void;
  resize(): void;
  destroy(): void;
}

interface ChartConstructor {
  new (
    canvas: HTMLCanvasElement,
    config: { type: string; data: ChartData; options?: ChartOptions }
  ): ChartInstance;
  defaults: Record<string, unknown>;
}

let pending: Promise<ChartConstructor> | undefined;

/**
 * Load `chart.js/auto` once, lazily. The import is dynamic and the dependency
 * is external in the library build: nothing is downloaded until the first
 * chart is actually rendered.
 */
async function loadChartLibrary(): Promise<ChartConstructor> {
  if (!pending) {
    pending = import('chart.js/auto')
      .then((module) => (module as unknown as { default: ChartConstructor }).default)
      .catch((error: unknown) => {
        pending = undefined; // allow a later retry
        throw error;
      });
  }
  return pending;
}

/** Read a Bootstrap CSS custom property off the document. */
function themeToken(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/**
 * A chart, drawn with Chart.js — loaded lazily, only when a chart is on screen.
 *
 * The library is a peer concern: it is imported dynamically, kept external in
 * the library build, and its types never leak into the kit's own. If the import
 * fails, the element degrades to a plain message instead of an empty box.
 *
 * The canvas fills a wrapper of fixed `height`, with `responsive` and
 * `maintainAspectRatio: false` pre-set, so the chart follows the width of its
 * grid cell. Text and grid colours are taken from the active Bootstrap theme
 * and the chart is rebuilt when `lia-theme-change` fires, so dark mode is not
 * an afterthought.
 *
 * A canvas is opaque to assistive technology: always give it a `label`, and
 * a `summary` when the shape of the data carries the message.
 *
 * @example
 * ```ts
 * html`<lia-chart
 *   type="line"
 *   height="280"
 *   label="Traffic over the last 30 days"
 *   .data=${{
 *     labels: days,
 *     datasets: [{ label: 'HTTP', data: http }, { label: 'Mail', data: mail }],
 *   }}
 *   .options=${{ scales: { y: { stacked: true } } }}
 * ></lia-chart>`;
 * ```
 *
 * @example
 * ```html
 * <lia-chart type="doughnut" height="220" label="Traffic by protocol"></lia-chart>
 * ```
 */
@customElement('lia-chart')
export class LiaChart extends LiaElement {
  /** Chart kind. Changing it rebuilds the chart. */
  @property({ type: String }) type: ChartKind = 'line';

  /** Labels and datasets. */
  @property({ attribute: false }) data: ChartData = { datasets: [] };

  /** Chart options, merged over the responsive defaults. */
  @property({ attribute: false }) options: ChartOptions = {};

  /** Height of the canvas wrapper, in pixels. */
  @property({ type: Number }) height = 260;

  /** Accessible name of the chart. */
  @property({ type: String }) label = 'Chart';

  /** Text alternative describing the data, announced but not shown. */
  @property({ type: String }) summary = '';

  /** Status text while the library loads. */
  @property({ type: String, attribute: 'loading-label' }) loadingLabel = 'Loading chart…';

  /** Message shown when the chart library is unavailable. */
  @property({ type: String, attribute: 'error-message' }) errorMessage =
    'The chart could not be displayed.';

  /** Do not rebuild the chart when the colour scheme changes. */
  @property({ type: Boolean, attribute: 'no-theme-sync' }) noThemeSync = false;

  @state() private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

  private chart?: ChartInstance;

  private readonly onThemeChange = (): void => {
    if (!this.noThemeSync) void this.redraw();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('lia-theme-change', this.onThemeChange);
    // Re-entering the document after a move: the canvas is still ours.
    if (this.hasUpdated && !this.chart) void this.create();
  }

  override disconnectedCallback(): void {
    window.removeEventListener('lia-theme-change', this.onThemeChange);
    this.destroyChart();
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    void this.create();
  }

  override updated(changed: PropertyValues<this>): void {
    if (!this.chart) return;
    if (changed.has('type')) {
      void this.redraw();
      return;
    }
    if (changed.has('data') || changed.has('options')) {
      this.chart.data = this.data;
      this.chart.options = this.mergedOptions();
      this.chart.update();
    }
  }

  /** Throw the chart away and build it again — used for theme changes. */
  async redraw(): Promise<void> {
    this.destroyChart();
    await this.create();
  }

  /** The live chart instance, once the library has loaded. */
  get instance(): unknown {
    return this.chart;
  }

  private mergedOptions(): ChartOptions {
    return { responsive: true, maintainAspectRatio: false, ...this.options };
  }

  private applyThemeDefaults(ctor: ChartConstructor): void {
    const color = themeToken('--bs-body-color');
    const border = themeToken('--bs-border-color');
    if (color) ctor.defaults.color = color;
    if (border) ctor.defaults.borderColor = border;
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private async create(): Promise<void> {
    if (this.chart) return;
    if (!this.querySelector('canvas')) return;

    this.status = 'loading';
    try {
      const ctor = await loadChartLibrary();
      const canvas = this.querySelector('canvas');
      if (!this.isConnected || !canvas || this.chart) return;
      this.applyThemeDefaults(ctor);
      this.chart = new ctor(canvas, {
        type: this.type,
        data: this.data,
        options: this.mergedOptions(),
      });
      this.status = 'ready';
    } catch {
      this.status = 'error';
    }
  }

  override render(): TemplateResult {
    return html`
      <div
        class="lia-chart-canvas position-relative"
        style=${styleMap({ height: `${this.height}px` })}
      >
        <canvas role="img" aria-label=${this.label}></canvas>
        ${this.status === 'loading'
          ? html`<div
              class="position-absolute top-50 start-50 translate-middle"
              aria-hidden="true"
            >
              ${renderSpinner(this.loadingLabel, { size: 'sm' })}
            </div>`
          : nothing}
        ${this.status === 'error'
          ? html`<div class="alert alert-warning mb-0 h-100 d-flex align-items-center justify-content-center text-center" role="alert">
              ${this.errorMessage}
            </div>`
          : nothing}
      </div>
      ${this.summary ? html`<p class="visually-hidden">${this.summary}</p>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-chart': LiaChart;
  }
}
