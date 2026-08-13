import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import type { IconName, Variant } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderBadge } from '../primitives/lia-badge.js';

/** One row of an {@link LiaActivityList}. */
export interface ActivityItem {
  /** Stable identifier, echoed in the `lia-activity-select` event. */
  id?: string;
  /** Icon-font class string shown before the text. */
  icon?: IconName;
  /** Plain-text description of what happened. */
  text: string;
  /** Trusted HTML alternative to {@link text}. */
  html?: string;
  /** Right-aligned chip, typically a timestamp or a status word. */
  meta?: string | number;
  /** Colour of the meta chip. */
  metaVariant?: Variant;
  /** Contextual tint of the whole row. */
  variant?: Variant;
  /** Makes the row a link. */
  href?: string;
  /** Muted second line under the text. */
  description?: string;
}

/** Detail of the `lia-activity-select` event. */
export interface ActivitySelectDetail {
  item: ActivityItem;
  index: number;
}

declare global {
  interface HTMLElementEventMap {
    'lia-activity-select': CustomEvent<ActivitySelectDetail>;
  }
}

/**
 * A compact list of things that happened, or still have to: an icon, a line of
 * text and a right-aligned chip holding the timestamp or state.
 *
 * The same shape covers "outstanding tasks", "last scheduled runs" and
 * "recent events".
 * A row with `href` becomes a link. With `interactive`, the remaining rows
 * become real buttons that emit `lia-activity-select`; without it they stay
 * plain text, so nothing looks clickable that is not.
 *
 * @example
 * ```ts
 * html`<lia-activity-list
 *   title="Scheduled jobs"
 *   icon="fa-solid fa-clock-rotate-left"
 *   .items=${[
 *     { icon: 'fa-solid fa-database', text: 'Backup', meta: '02:15', metaVariant: 'primary' },
 *     { icon: 'fa-solid fa-envelope', text: 'Mail queue', meta: 'never run', metaVariant: 'secondary' },
 *   ]}
 * ></lia-activity-list>`;
 * ```
 *
 * @example
 * ```html
 * <!-- bare list, to drop inside an existing card -->
 * <lia-activity-list flush-list empty-message="Nothing pending."></lia-activity-list>
 * ```
 */
@customElement('lia-activity-list')
export class LiaActivityList extends LiaElement {
  /** The rows. */
  @property({ attribute: false }) items: ActivityItem[] = [];

  /**
   * Card heading; setting it wraps the list in a card. Prefer the property
   * binding — a static `title="…"` attribute also gives the host a tooltip.
   */
  @property({ type: String }) override title = '';

  /** Icon-font class string rendered before the title. */
  @property({ type: String }) icon: IconName = '';

  /** Wrap the list in a card even without a title. */
  @property({ type: Boolean }) card = false;

  /** Render the list group flush (no outer borders). Implied inside a card. */
  @property({ type: Boolean, attribute: 'flush-list' }) flushList = false;

  /** Drop the card's bottom margin and stretch it — for use inside a grid cell. */
  @property({ type: Boolean }) flush = false;

  /** Shown when there are no rows. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'Nothing to show.';

  /** Accessible name of the list. */
  @property({ type: String }) label = 'Activity';

  /**
   * Render rows without an `href` as buttons that emit `lia-activity-select`.
   * Off by default: a row nobody listens to should not look clickable.
   */
  @property({ type: Boolean }) interactive = false;

  private select(item: ActivityItem, index: number): void {
    this.emit<ActivitySelectDetail>('lia-activity-select', { item, index });
  }

  private renderRow(item: ActivityItem, index: number): TemplateResult {
    const body = html`<div class="d-flex align-items-start gap-2 me-auto min-w-0">
        ${renderIcon(item.icon, { fixedWidth: true, class: 'mt-1' })}
        <div class="min-w-0">
          <div>${item.html ? renderRich(item.html) : item.text}</div>
          ${item.description
            ? html`<div class="small text-body-secondary">${item.description}</div>`
            : nothing}
        </div>
      </div>
      ${item.meta !== undefined && item.meta !== ''
        ? renderBadge(item.meta, {
            variant: item.metaVariant ?? 'primary',
            class: 'text-nowrap align-self-center',
          })
        : nothing}`;

    const classes = cx(
      'list-group-item',
      'd-flex',
      'justify-content-between',
      'align-items-start',
      'gap-2',
      item.variant && `list-group-item-${item.variant}`
    );

    if (item.href) {
      return html`<a class=${cx(classes, 'list-group-item-action')} href=${item.href}>${body}</a>`;
    }
    if (this.interactive) {
      return html`<button
        type="button"
        class=${cx(classes, 'list-group-item-action', 'text-start', 'w-100')}
        @click=${() => this.select(item, index)}
      >
        ${body}
      </button>`;
    }
    return html`<div class=${classes}>${body}</div>`;
  }

  private renderList(): TemplateResult {
    const inCard = Boolean(this.title || this.card);
    return html`<div
      class=${cx('list-group', (inCard || this.flushList) && 'list-group-flush')}
      role="group"
      aria-label=${this.label}
    >
      ${this.items.length
        ? this.items.map((item, index) => this.renderRow(item, index))
        : html`<div class="list-group-item text-body-secondary">${this.emptyMessage}</div>`}
    </div>`;
  }

  override render(): TemplateResult {
    const list = this.renderList();
    if (!this.title && !this.card) return list;

    return html`<div class=${cx('card', this.flush && 'h-100 mb-0')}>
      ${this.title || this.icon
        ? html`<div class="card-header d-flex align-items-center gap-1">
            ${renderIcon(this.icon)}${this.title}
          </div>`
        : nothing}
      ${list}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-activity-list': LiaActivityList;
  }
}
