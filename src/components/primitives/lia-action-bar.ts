import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { ActionDescriptor, Size, Variant } from '../../core/types.js';
import { isActionVisible, renderAction } from './render-action.js';

/** Horizontal distribution of the controls inside the bar. */
export type ActionBarAlign = 'start' | 'center' | 'end' | 'between';

const ALIGNMENT: Record<ActionBarAlign, string> = {
  start: 'justify-content-start',
  center: 'justify-content-center',
  end: 'justify-content-end',
  between: 'justify-content-between',
};

/**
 * A row of {@link ActionDescriptor}s — the toolbar that sits next to a page
 * heading, in a card header or above a listing.
 *
 * Controls are rendered inline (no nested `<lia-button>` elements), so the bar
 * itself is the single source of `lia-action` events; there is no duplicate
 * bubbling to filter out. Labels collapse below the `lg` breakpoint by
 * default, keeping toolbars usable on narrow screens.
 *
 * @example
 * ```ts
 * html`<lia-action-bar
 *   align="end"
 *   .actions=${[
 *     { id: 'back', icon: 'fa-solid fa-reply', label: 'Back to overview', href: '/list' },
 *     { id: 'add', icon: 'fa-solid fa-plus-circle', label: 'Add entry', variant: 'primary' },
 *   ]}
 *   @lia-action=${(e: CustomEvent) => console.log(e.detail.id)}
 * ></lia-action-bar>`;
 * ```
 */
@customElement('lia-action-bar')
export class LiaActionBar extends LiaElement {
  /** The controls to render, in order. Entries with `visible: false` are skipped. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Horizontal distribution. */
  @property({ type: String }) align: ActionBarAlign = 'start';

  /** Fallback size for actions that do not set their own. */
  @property({ type: String }) size: Size = 'md';

  /** Bootstrap gap step, `0`–`5`. */
  @property({ type: Number }) gap = 1;

  /** Fallback variant for actions that do not set their own. */
  @property({ type: String }) variant: Variant | `outline-${Variant}` = 'outline-primary';

  /** Hide labels below `lg`, keeping the icons. */
  @property({ type: Boolean, attribute: 'label-responsive' }) labelResponsive = true;

  /** Accessible name for the group. */
  @property({ type: String }) label = 'Actions';

  /** Row context echoed back as `detail.row`. */
  @property({ attribute: false }) row?: unknown;

  /** Row index echoed back as `detail.index`. */
  @property({ type: Number }) index?: number;

  override render(): TemplateResult | typeof nothing {
    const visible = this.actions.filter(isActionVisible);
    if (visible.length === 0) return nothing;

    const gap = Math.min(5, Math.max(0, Math.round(this.gap)));
    return html`<div
      class=${cx('d-flex', 'flex-wrap', 'align-items-center', `gap-${gap}`, ALIGNMENT[this.align])}
      role="group"
      aria-label=${this.label}
    >
      ${visible.map((action) =>
        renderAction(action, {
          host: this,
          size: this.size,
          variant: this.variant,
          labelResponsive: this.labelResponsive,
          row: this.row,
          index: this.index,
        })
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-action-bar': LiaActionBar;
  }
}
