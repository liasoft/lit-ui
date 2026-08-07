import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import type { ActionDescriptor, IconName, Variant } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderActions } from '../primitives/render-action.js';

/**
 * The oversized "you are not done setting this up yet" panel that greets a
 * freshly installed application.
 *
 * A tinted block with a heading, a lead paragraph, one prominent call to
 * action and a large watermark glyph in the corner. The call to action is a
 * link when `cta-href` is set and a button otherwise — the button emits
 * `lia-action`, so the host can open a wizard without a page load.
 *
 * @example
 * ```html
 * <lia-welcome-panel
 *   heading="Welcome aboard"
 *   text="A few settings are still missing before the system can run."
 *   cta-label="Configure now"
 *   cta-href="/setup"
 *   dismissible
 * ></lia-welcome-panel>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-welcome-panel
 *   variant="primary"
 *   icon="fa-solid fa-rocket"
 *   heading=${t('welcome.title')}
 *   text=${t('welcome.note')}
 *   cta-label=${t('welcome.cta')}
 *   cta-id="start-setup"
 *   @lia-action=${() => openWizard()}
 * ></lia-welcome-panel>`;
 * ```
 */
@customElement('lia-welcome-panel')
export class LiaWelcomePanel extends LiaElement {
  /** Headline. */
  @property({ type: String }) heading = 'Welcome';

  /** Lead paragraph under the headline. */
  @property({ type: String }) text = '';

  /** Render {@link text} as trusted HTML. */
  @property({ type: Boolean }) html = false;

  /** Label of the call-to-action control. Empty hides it. */
  @property({ type: String, attribute: 'cta-label' }) ctaLabel = '';

  /** Makes the call to action a link. */
  @property({ type: String, attribute: 'cta-href' }) ctaHref = '';

  /** Identifier reported in `lia-action` when the call to action is a button. */
  @property({ type: String, attribute: 'cta-id' }) ctaId = 'welcome-cta';

  /** Icon-font class string of the call to action. */
  @property({ type: String, attribute: 'cta-icon' }) ctaIcon: IconName = '';

  /** Further, secondary controls rendered next to the call to action. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Contextual colour of the panel. */
  @property({ type: String }) variant: Variant = 'info';

  /** Large watermark glyph in the bottom-right corner. Empty hides it. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-wand-magic-sparkles';

  /** Offer a close button that removes the panel and emits `lia-dismiss`. */
  @property({ type: Boolean }) dismissible = false;

  /** Accessible name of the close button. */
  @property({ type: String, attribute: 'dismiss-label' }) dismissLabel = 'Dismiss';

  @state() private dismissed = false;

  /** Hide the panel and notify the host. */
  dismiss(): void {
    this.dismissed = true;
    this.emit('lia-dismiss', { id: this.ctaId });
  }

  private renderCta(): TemplateResult | typeof nothing {
    if (!this.ctaLabel) return nothing;
    const classes = cx('btn', 'btn-lg', 'btn-light', `text-${this.variant}`);
    const inner = html`${renderIcon(this.ctaIcon, { class: 'me-1' })}${this.ctaLabel}`;

    if (this.ctaHref) {
      return html`<a class=${classes} href=${this.ctaHref}>${inner}</a>`;
    }
    return html`<button
      type="button"
      class=${classes}
      @click=${() =>
        this.emit('lia-action', {
          action: { id: this.ctaId, label: this.ctaLabel },
          id: this.ctaId,
        })}
    >
      ${inner}
    </button>`;
  }

  override render(): TemplateResult | typeof nothing {
    if (this.dismissed) return nothing;

    return html`<div
      class=${cx('alert', `alert-${this.variant}`, 'position-relative', 'p-5')}
      role="region"
      aria-label=${this.heading}
    >
      ${this.dismissible
        ? html`<button
            type="button"
            class="btn-close position-absolute top-0 end-0 m-3"
            aria-label=${this.dismissLabel}
            @click=${() => this.dismiss()}
          ></button>`
        : nothing}
      <h3 class="alert-heading">${this.heading}</h3>
      ${this.text
        ? html`<p class="lead mb-5">${this.html ? renderRich(this.text) : this.text}</p>`
        : nothing}
      <div class="d-flex flex-wrap align-items-center gap-2">
        ${this.renderCta()}${renderActions(this.actions, { host: this, variant: 'outline-light' })}
      </div>
      ${this.icon
        ? html`<aside
            class="lia-welcome-watermark position-absolute bottom-0 end-0 p-5 d-none d-md-block"
            aria-hidden="true"
          >
            ${renderIcon(this.icon, { size: '5x' })}
          </aside>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-welcome-panel': LiaWelcomePanel;
  }
}
