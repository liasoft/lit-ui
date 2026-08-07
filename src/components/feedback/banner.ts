import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { feedbackRole, renderActionRow, variantIcon } from './internal.js';

/**
 * A full-bleed notification strip docked above the navbar.
 *
 * This is the generic form of the "the panel is not configured yet" and
 * "your distribution changed" bars Froxlor renders at the very top of the
 * user area: a short message on the left, one or two actions on the right, no
 * rounded corners and no bottom margin so it butts straight against the
 * navigation.
 *
 * @example
 * ```ts
 * html`<lia-banner
 *   variant="info"
 *   message="Initial setup has not been completed yet."
 *   .actions=${[{ id: 'setup', label: 'Start setup', variant: 'light', href: '/setup' }]}
 * ></lia-banner>`
 * ```
 *
 * @example
 * ```html
 * <lia-banner
 *   variant="warning"
 *   message="A newer version is available."
 *   dismissible
 * ></lia-banner>
 * ```
 */
@customElement('lia-banner')
export class LiaBanner extends LiaElement {
  /** Bootstrap contextual colour. */
  @property({ type: String }) variant: Variant = 'info';

  /** Icon shown before the message. Defaults to the variant's icon. */
  @property({ type: String }) icon?: IconName;

  /** Suppress the icon. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** Bold lead-in rendered before the message. */
  @property({ type: String }) heading?: string;

  /** The message. */
  @property({ type: String }) message = '';

  /** Render `message` as trusted HTML rather than plain text. */
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;

  /** Buttons rendered on the right-hand side. */
  @property({ attribute: false }) actions?: ActionDescriptor[];

  /** Bootstrap variant applied to actions that do not carry their own. */
  @property({ type: String }) actionVariant: Variant | `outline-${Variant}` = 'light';

  /** Show a close button at the far right. */
  @property({ type: Boolean }) dismissible = false;

  /** Accessible name of the close button. */
  @property({ type: String }) closeLabel = 'Close';

  /** Identifier echoed back in the `lia-dismiss` event. */
  @property({ type: String, attribute: 'banner-id' }) bannerId?: string;

  /** Extra classes on the `.alert` element. */
  @property({ type: String, attribute: 'banner-class' }) bannerClass?: string;

  @state() private closed = false;

  /** Whether the banner has been dismissed. */
  get isDismissed(): boolean {
    return this.closed;
  }

  /** Hide the banner and emit `lia-dismiss`. */
  dismiss(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit<{ id?: string }>('lia-dismiss', { id: this.bannerId });
  }

  /** Show a dismissed banner again. */
  reopen(): void {
    this.closed = false;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.closed) return nothing;
    const iconClass = this.icon ?? variantIcon(this.variant);

    return html`<div
      class=${cx(
        'alert lia-banner mb-0 rounded-0 py-2',
        'd-flex flex-wrap justify-content-between align-items-center gap-2',
        `alert-${this.variant}`,
        this.bannerClass
      )}
      role=${feedbackRole(this.variant)}
    >
      <span class="d-flex align-items-baseline gap-2 min-w-0">
        ${this.noIcon
          ? nothing
          : html`<i class="alert-icon ${iconClass}" aria-hidden="true"></i>`}
        <span class="min-w-0">
          ${this.heading ? html`<strong class="me-1">${this.heading}</strong>` : nothing}
          ${this.trustedHtml ? renderRich(this.message) : this.message}
        </span>
      </span>
      <span class="d-flex align-items-center gap-2 ms-auto">
        ${renderActionRow(this.actions, '', {
          host: this,
          size: 'sm',
          variant: this.actionVariant,
        })}
        ${this.dismissible
          ? html`<button
              type="button"
              class="btn-close ms-1"
              aria-label=${this.closeLabel}
              @click=${() => this.dismiss()}
            ></button>`
          : nothing}
      </span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-banner': LiaBanner;
  }
}
