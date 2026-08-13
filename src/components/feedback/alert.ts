import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, AlertMessage, IconName, Variant } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { feedbackRole, renderActionRow, variantIcon } from './internal.js';

/** How long the fade-out runs before the alert reports itself dismissed. */
const FADE_MS = 180;

/**
 * A contextual message box.
 *
 * Every part is optional: an icon chip, a heading, a trusted-HTML body, a row
 * of action buttons on the right and a close button. Feed it a whole
 * {@link AlertMessage} object or set the individual attributes; the individual
 * ones win, so `<lia-alert .alert=${msg} variant="danger">` is a valid override.
 *
 * @example
 * ```html
 * <lia-alert
 *   variant="success"
 *   heading="Saved"
 *   message="Your changes have been stored."
 *   dismissible
 * ></lia-alert>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-alert
 *   .alert=${{ variant: 'danger', title: 'Error', message: text, dismissible: true }}
 *   .actions=${[{ id: 'back', label: 'Go back', variant: 'light', href: '/' }]}
 *   @lia-dismiss=${() => this.clearError()}
 * ></lia-alert>`
 * ```
 */
@customElement('lia-alert')
export class LiaAlert extends LiaElement {
  /** The whole message as data. Individual properties override its fields. */
  @property({ attribute: false }) alert?: AlertMessage;

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant?: Variant;

  /** Bold heading above the message. */
  @property({ type: String }) heading?: string;

  /** The body text. */
  @property({ type: String }) message?: string;

  /** Render `message` as trusted HTML rather than plain text. */
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml?: boolean;

  /** Icon shown in the `.alert-icon` chip. Defaults to the variant's icon. */
  @property({ type: String }) icon?: IconName;

  /** Suppress the icon chip. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** Show a close button. */
  @property({ type: Boolean }) dismissible?: boolean;

  /** Accessible name of the close button. */
  @property({ type: String }) closeLabel = 'Close';

  /** Auto-dismiss after this many milliseconds. `0` disables it. */
  @property({ type: Number }) timeout?: number;

  /** Buttons rendered on the right-hand side of the alert. */
  @property({ attribute: false }) actions?: ActionDescriptor[];

  /** Bootstrap variant applied to actions that do not carry their own. */
  @property({ type: String }) actionVariant: Variant | `outline-${Variant}` = 'light';

  /** Extra classes on the `.alert` element. */
  @property({ type: String, attribute: 'alert-class' }) alertClass?: string;

  /** Identifier echoed back in the `lia-dismiss` event. */
  @property({ type: String, attribute: 'alert-id' }) alertId?: string;

  /**
   * Monospace detail block under the message, separated by a rule
   * (stack traces, debug output).
   */
  @property({ type: String }) details?: string;

  @state() private closing = false;
  @state() private closed = false;

  private timer?: ReturnType<typeof setTimeout>;

  /** The effective message, merging the `alert` object with the attributes. */
  get data(): AlertMessage {
    const base = this.alert;
    return {
      id: this.alertId ?? base?.id,
      variant: this.variant ?? base?.variant ?? 'info',
      title: this.heading ?? base?.title,
      message: this.message ?? base?.message ?? '',
      html: this.trustedHtml ?? base?.html,
      icon: this.icon ?? base?.icon,
      dismissible: this.dismissible ?? base?.dismissible,
      timeout: this.timeout ?? base?.timeout,
      actions: this.actions ?? base?.actions,
    };
  }

  /** Whether the alert has finished fading out. */
  get isDismissed(): boolean {
    return this.closed;
  }

  /** Fade out and emit `lia-dismiss`. */
  dismiss(): void {
    if (this.closing || this.closed) return;
    this.clearTimer();
    this.closing = true;
    setTimeout(() => {
      this.closed = true;
      this.emit<{ id?: string }>('lia-dismiss', { id: this.data.id });
    }, FADE_MS);
  }

  /** Bring a dismissed alert back. */
  reopen(): void {
    this.clearTimer();
    this.closing = false;
    this.closed = false;
    this.startTimer();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // A new message means a new alert, even on the same element instance.
    if (changed.has('alert') || changed.has('message')) {
      this.closing = false;
      this.closed = false;
    }
  }

  protected override firstUpdated(): void {
    this.startTimer();
  }

  override disconnectedCallback(): void {
    this.clearTimer();
    super.disconnectedCallback();
  }

  private startTimer(): void {
    const timeout = this.data.timeout;
    if (!timeout || timeout <= 0) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.dismiss(), timeout);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.closed) return nothing;
    const data = this.data;
    const showIcon = !this.noIcon;
    const iconClass = data.icon ?? variantIcon(data.variant);

    return html`<div
      class=${cx(
        'alert lia-alert fade d-flex align-items-start',
        `alert-${data.variant}`,
        this.closing ? '' : 'show',
        this.alertClass
      )}
      role=${feedbackRole(data.variant)}
      aria-atomic="true"
    >
      ${showIcon
        ? html`<span class="alert-icon flex-shrink-0"
            ><i class=${iconClass} aria-hidden="true"></i
          ></span>`
        : nothing}
      <div class="lia-alert-body flex-grow-1 min-w-0">
        ${data.title ? html`<h4 class="alert-heading h5">${data.title}</h4>` : nothing}
        <div>${data.html === true ? renderRich(data.message) : data.message}</div>
        ${this.details
          ? html`<hr /><pre class="lia-alert-details mb-0">${this.details}</pre>`
          : nothing}
      </div>
      ${renderActionRow(data.actions, 'ms-3 flex-shrink-0', {
        host: this,
        size: 'sm',
        variant: this.actionVariant,
      })}
      ${data.dismissible === true
        ? html`<button
            type="button"
            class="btn-close ms-2 flex-shrink-0"
            aria-label=${this.closeLabel}
            @click=${() => this.dismiss()}
          ></button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-alert': LiaAlert;
  }
}
