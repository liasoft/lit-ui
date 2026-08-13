import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { renderIcon } from './lia-icon.js';
import { renderActions } from './render-action.js';

/**
 * The "there is nothing here" panel shown in place of an empty listing.
 *
 * An alert with a heading, an explanatory line, an optional icon and a row of
 * call-to-action buttons — so the dead end can offer a way forward.
 *
 * @example
 * ```ts
 * html`<lia-empty-state
 *   title="No entries yet"
 *   message="Nothing has been created here so far."
 *   icon="fa-solid fa-inbox"
 *   .actions=${[{ id: 'add', label: 'Add the first entry', icon: 'fa-solid fa-plus', variant: 'primary' }]}
 * ></lia-empty-state>`;
 * ```
 */
@customElement('lia-empty-state')
export class LiaEmptyState extends LiaElement {
  /**
   * Heading. Prefer the property binding — a static `title="…"` attribute also
   * produces a native browser tooltip on the host.
   */
  @property({ type: String }) override title = 'Nothing here yet';

  /** Explanatory line under the heading. */
  @property({ type: String }) message = '';

  /** Render {@link message} as trusted HTML. */
  @property({ type: Boolean }) html = false;

  /** Icon-font class string shown beside the heading. */
  @property({ type: String }) icon: IconName = '';

  /** Buttons offering a way out of the empty state. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Bootstrap contextual colour of the panel. */
  @property({ type: String }) variant: Variant = 'info';

  /**
   * The explanation as rendered content rather than as text, for a message that has to contain
   * something — a link to where the missing data would be, a value the reader can act on.
   *
   * Takes precedence over {@link message}. Prefer it to `html`: that renders a trusted string, which
   * is the wrong tool the moment any part of the sentence comes from data.
   */
  @property({ attribute: false }) content?: unknown;

  /** Centre the content instead of aligning it to the start. */
  @property({ type: Boolean }) centered = false;

  override render(): TemplateResult {
    return html`<div
      class=${cx('alert', `alert-${this.variant}`, this.centered && 'text-center')}
      role="status"
    >
      <h4 class="alert-heading d-flex align-items-center gap-2 ${this.centered ? 'justify-content-center' : ''}">
        ${renderIcon(this.icon)}<span>${this.title}</span>
      </h4>
      ${this.content !== undefined
        ? html`<p class="mb-0">${this.content}</p>`
        : this.message
          ? html`<p class="mb-0">${this.html ? renderRich(this.message) : this.message}</p>`
          : nothing}
      ${this.actions.length
        ? html`<div
            class=${cx(
              'd-flex',
              'flex-wrap',
              'gap-2',
              'mt-3',
              this.centered && 'justify-content-center'
            )}
            role="group"
            aria-label="Suggested actions"
          >
            ${renderActions(this.actions, { host: this, variant: 'primary' })}
          </div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-empty-state': LiaEmptyState;
  }
}
