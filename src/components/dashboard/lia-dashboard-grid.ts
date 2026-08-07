import { html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { ResourceItem } from '../../core/types.js';
import './lia-resource-item.js';

/** Bootstrap only ships `row-cols-*` up to six columns. */
function clampColumns(columns: number): number {
  if (!Number.isFinite(columns)) return 4;
  return Math.min(6, Math.max(1, Math.round(columns)));
}

/**
 * The bordered card of resource meters that opens a dashboard.
 *
 * Lays {@link LiaResourceItem} tiles out in a gutterless grid — one column on
 * phones, two from `sm`, `columns` from `xl` — and separates them with hairline
 * cell borders. The trailing borders are pulled under the card's own edge, so
 * the grid ends flush instead of showing a double line.
 *
 * @example
 * ```ts
 * html`<lia-dashboard-grid
 *   .items=${[
 *     { label: 'Domains', used: 12, available: 25 },
 *     { label: 'Disk space', used: 8.5e9, available: 1.07e10, formatBytes: true },
 *     { label: 'Mailboxes', used: 4, available: -1 },
 *     { label: 'Databases', used: 3, available: 10, assigned: 6 },
 *   ]}
 *   columns="4"
 * ></lia-dashboard-grid>`;
 * ```
 *
 * @example
 * ```html
 * <!-- without the card chrome, e.g. inside an existing panel -->
 * <lia-dashboard-grid no-card columns="5"></lia-dashboard-grid>
 * ```
 */
@customElement('lia-dashboard-grid')
export class LiaDashboardGrid extends LiaElement {
  /** The meters to display. */
  @property({ attribute: false }) items: ResourceItem[] = [];

  /** Number of tiles per row from the `xl` breakpoint up (1–6). */
  @property({ type: Number }) columns = 4;

  /** Render the bare grid without the surrounding card. */
  @property({ type: Boolean, attribute: 'no-card' }) noCard = false;

  /** Drop the card's bottom margin and stretch it — for use inside a grid cell. */
  @property({ type: Boolean }) flush = false;

  /** Passed to every tile as its "no limit" wording. */
  @property({ type: String, attribute: 'unlimited-label' }) unlimitedLabel = 'Unlimited';

  /** Passed to every tile as the accessible name suffix of its second bar. */
  @property({ type: String, attribute: 'assigned-label' }) assignedLabel = 'allocated';

  /** Accessible name of the meter group. */
  @property({ type: String }) label = 'Resource usage';

  /** Shown instead of the grid when there is nothing to display. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage =
    'No resources to display.';

  private renderGrid(): TemplateResult {
    const columns = clampColumns(this.columns);
    return html`<div
      class=${cx(
        'lia-resource-grid',
        'row',
        'row-cols-1',
        'row-cols-sm-2',
        `row-cols-xl-${columns}`,
        'g-0'
      )}
      role="list"
      aria-label=${this.label}
    >
      ${this.items.map(
        (item) => html`<lia-resource-item
          class="col border-end border-bottom p-3"
          role="listitem"
          .item=${item}
          unlimited-label=${this.unlimitedLabel}
          assigned-label=${this.assignedLabel}
        ></lia-resource-item>`
      )}
    </div>`;
  }

  override render(): TemplateResult {
    const body = this.items.length
      ? this.renderGrid()
      : html`<div class="card-body text-body-secondary">${this.emptyMessage}</div>`;

    if (this.noCard) return html`${body}`;
    return html`<div
      class=${cx('card', 'lia-dashboard-card', this.flush && 'h-100 mb-0')}
    >
      ${body}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-dashboard-grid': LiaDashboardGrid;
  }
}
