import { html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { StatCardData } from '../../core/types.js';
import './lia-stat-card.js';

function clampColumns(columns: number): number {
  if (!Number.isFinite(columns)) return 4;
  return Math.min(6, Math.max(1, Math.round(columns)));
}

/**
 * A responsive band of {@link LiaStatCard}s — the row of KPIs that usually
 * sits at the top of a dashboard.
 *
 * One card per row on phones, two from `sm`, `columns` from `lg`. All cards are
 * stretched to equal height, so a card with a description does not make its
 * neighbours look unfinished.
 *
 * @example
 * ```ts
 * html`<lia-stat-row
 *   columns="4"
 *   .items=${[
 *     { label: 'Accounts', value: 128, icon: 'fa-solid fa-users', variant: 'primary' },
 *     { label: 'Storage', value: '1.4 TiB', icon: 'fa-solid fa-hard-drive', variant: 'info' },
 *     { label: 'Open tickets', value: 7, icon: 'fa-solid fa-life-ring', variant: 'warning' },
 *     { label: 'Errors', value: 0, icon: 'fa-solid fa-bug', variant: 'success' },
 *   ]}
 * ></lia-stat-row>`;
 * ```
 */
@customElement('lia-stat-row')
export class LiaStatRow extends LiaElement {
  /** The KPIs to render. */
  @property({ attribute: false }) items: StatCardData[] = [];

  /** Cards per row from the `lg` breakpoint up (1–6). */
  @property({ type: Number }) columns = 4;

  /** Bootstrap gutter step between the cards (0–5). */
  @property({ type: Number }) gutter = 3;

  /** Accessible name of the group. */
  @property({ type: String }) label = 'Key figures';

  override render(): TemplateResult {
    const columns = clampColumns(this.columns);
    const gutter = Math.min(5, Math.max(0, Math.round(this.gutter)));

    return html`<div
      class=${cx(
        'row',
        'row-cols-1',
        'row-cols-sm-2',
        `row-cols-lg-${columns}`,
        `g-${gutter}`,
        'mb-4'
      )}
      role="list"
      aria-label=${this.label}
    >
      ${this.items.map(
        (item) => html`<lia-stat-card class="col" role="listitem" flush .data=${item}></lia-stat-card>`
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-stat-row': LiaStatRow;
  }
}
