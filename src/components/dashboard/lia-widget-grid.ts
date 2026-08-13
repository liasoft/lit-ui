import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';

/** One cell of a {@link LiaWidgetGrid}. */
export interface DashboardWidget {
  /** Stable identifier; also used as the cell's DOM id. */
  id?: string;
  /** Width in Bootstrap columns (1–12) from the `lg` breakpoint up. */
  span?: number;
  /** Width from the `md` breakpoint up. Derived from {@link span} when unset. */
  spanMd?: number;
  /** Anything renderable: a template, a DOM node, a string, a number. */
  content?: unknown;
  /** Trusted HTML alternative to {@link content}. */
  html?: string;
  /** Extra classes on the cell. */
  class?: string;
  /** Hide the widget without removing it from the definition. */
  visible?: boolean;
}

function clampSpan(span: number | undefined, fallback = 12): number {
  const value = span ?? fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(12, Math.max(1, Math.round(value)));
}

/** Column classes for a widget: full width on phones, halved on tablets. */
export function widgetColumnClasses(span?: number, spanMd?: number): string {
  const lg = clampSpan(span);
  const md = clampSpan(spanMd, lg <= 4 ? 6 : 12);
  return cx('col-12', `col-md-${md}`, `col-lg-${lg}`);
}

/**
 * A declarative dashboard layout: widgets in, Bootstrap grid out.
 *
 * Each widget states how many of the twelve columns it wants at `lg`; below
 * that the grid degrades on its own — narrow widgets pair up on tablets, and
 * everything stacks on phones. Nothing about the widgets' content is assumed,
 * so the same grid holds meter cards, charts and detail panels.
 *
 * Markup written inside the element is laid out too: each element child becomes
 * a cell, sized by its `data-span` (and optionally `data-span-md`) attribute.
 * That makes a dashboard expressible in plain HTML, without a build step.
 *
 * @example
 * ```ts
 * html`<lia-widget-grid
 *   .widgets=${[
 *     { id: 'traffic', span: 8, content: html`<lia-chart .data=${traffic}></lia-chart>` },
 *     { id: 'jobs', span: 4, content: html`<lia-activity-list .items=${jobs} flush></lia-activity-list>` },
 *   ]}
 * ></lia-widget-grid>`;
 * ```
 *
 * @example
 * ```html
 * <lia-widget-grid gutter="3">
 *   <lia-info-card data-span="6" title="System"></lia-info-card>
 *   <lia-info-card data-span="6" title="Account"></lia-info-card>
 * </lia-widget-grid>
 * ```
 */
@customElement('lia-widget-grid')
export class LiaWidgetGrid extends LiaElement {
  /** The widgets to lay out. */
  @property({ attribute: false }) widgets: DashboardWidget[] = [];

  /** Bootstrap gutter step between the cells (0–5). */
  @property({ type: Number }) gutter = 3;

  /** Default span for projected children without a `data-span`. */
  @property({ type: Number, attribute: 'default-span' }) defaultSpan = 12;

  /** Accessible name of the layout region. */
  @property({ type: String }) label = '';

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    this.wrapProjected();
    super.connectedCallback();
  }

  /** Wrap every projected child in a grid column, honouring `data-span`. */
  private wrapProjected(): void {
    for (const child of Array.from(this.lightSlot.node.children)) {
      const existing = child.getAttribute('class') ?? '';
      if (/(^|\s)col(-|\s|$)/.test(existing)) continue; // already a column
      const span = Number(child.getAttribute('data-span')) || this.defaultSpan;
      const spanMd = Number(child.getAttribute('data-span-md')) || undefined;
      const column = document.createElement('div');
      column.className = widgetColumnClasses(span, spanMd);
      this.lightSlot.node.insertBefore(column, child);
      column.appendChild(child);
    }
  }

  private get gutterStep(): number {
    return Math.min(5, Math.max(0, Math.round(this.gutter)));
  }

  override willUpdate(): void {
    // The slot wrapper is `display: contents` — invisible to layout, but still
    // a DOM parent, so Bootstrap's `.row > *` gutter rule would not reach the
    // projected cells. Mirroring the row classes onto it fixes that without
    // adding a box (the inline `display` wins over `.row`'s flex).
    this.lightSlot.node.className = cx('row', `g-${this.gutterStep}`);
  }

  override render(): TemplateResult {
    const gutter = this.gutterStep;
    return html`<div
      class=${cx('row', `g-${gutter}`)}
      role=${this.label ? 'group' : nothing}
      aria-label=${this.label || nothing}
    >
      ${this.widgets
        .filter((widget) => widget.visible !== false)
        .map(
          (widget) => html`<div
            class=${cx(widgetColumnClasses(widget.span, widget.spanMd), widget.class)}
            id=${widget.id || nothing}
          >
            ${widget.html ? renderRich(widget.html) : (widget.content ?? nothing)}
          </div>`
        )}
      ${this.lightSlot.node}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-widget-grid': LiaWidgetGrid;
  }
}
