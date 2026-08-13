import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type { AlertMessage, IconName, NavItem } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';
import { flag } from '../layout/flag.js';
import '../feedback/alert.js';
import '../layout/theme-toggle.js';

/**
 * The centred card the sign-in pages share.
 *
 * Owns everything the sign-in pages have in common: the vertical centring,
 * the brand block, the heading, the alert region, the card-footer link row
 * and the colour-scheme switch.
 *
 * The form itself is projected: write it between the tags, or hand it in as
 * the `content` property from a lit template.
 *
 * @example
 * ```html
 * <lia-auth-layout heading="Sign in" description="Welcome back.">
 *   <lia-login-form show-remember forgot-href="/forgot"></lia-login-form>
 * </lia-auth-layout>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-auth-layout
 *   logo-src=${logo}
 *   brand="Control Center"
 *   heading="Reset your password"
 *   .alerts=${this.alerts}
 *   .links=${[{ label: 'Back to sign in', url: '/', icon: 'fa-solid fa-angles-left' }]}
 *   footer-text="&copy; 2026 Example Ltd."
 *   .content=${html`<lia-reset-password-form></lia-reset-password-form>`}
 * ></lia-auth-layout>`
 * ```
 */
@customElement('lia-auth-layout')
export class LiaAuthLayout extends LiaElement {
  /** Image shown above the card. */
  @property({ type: String, attribute: 'logo-src' }) logoSrc = '';

  /** Accessible name of the logo. Falls back to `brand`. */
  @property({ type: String, attribute: 'logo-alt' }) logoAlt = '';

  /** Wordmark rendered when there is no logo — or under it, if both are set. */
  @property({ type: String }) brand = '';

  /** Icon rendered before `brand` when no logo image is supplied. */
  @property({ type: String, attribute: 'brand-icon' }) brandIcon: IconName = '';

  /** Card title, rendered as the page's `<h1>`. */
  @property({ type: String }) heading = '';

  /** Lead paragraph under the heading. */
  @property({ type: String }) description = '';

  /** Render `description` and `footerText` as trusted HTML. */
  @property({ type: Boolean, attribute: 'trusted-html' }) trustedHtml = false;

  /** Messages rendered above the projected form. */
  @property({ attribute: false }) alerts: AlertMessage[] = [];

  /** Shorthand for a single danger alert. */
  @property({ type: String }) error = '';

  /** Shorthand for a single success alert. Wins over {@link error}. */
  @property({ type: String }) success = '';

  @property({ type: String, attribute: 'error-title' }) errorTitle = 'Error';

  @property({ type: String, attribute: 'success-title' }) successTitle = 'Success';

  /** Links rendered in the card footer, e.g. "forgot password", "sign up". */
  @property({ attribute: false }) links: NavItem[] = [];

  /** Small print under the card. */
  @property({ type: String, attribute: 'footer-text' }) footerText = '';

  /** Show the colour-scheme switcher above the card. */
  @property({ converter: flag, attribute: 'show-theme-toggle' }) showThemeToggle = true;

  /** Accessible name of the colour-scheme switcher. */
  @property({ type: String, attribute: 'theme-label' }) themeLabel = 'Colour scheme';

  /** Card width in pixels. */
  @property({ type: Number, attribute: 'max-width' }) maxWidth = 420;

  /** Fill the viewport height and centre the card in it. */
  @property({ converter: flag }) centered = true;

  /** Renderable body — an alternative to writing children between the tags. */
  @property({ attribute: false }) content?: unknown;

  /** Extra classes on the `.card`. */
  @property({ type: String, attribute: 'card-class' }) cardClass = '';

  /** Extra classes on the `.card-body` that holds the form. */
  @property({ type: String, attribute: 'body-class' }) bodyClass = '';

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Lift authored children out before lit renders over them.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  private renderBrand(): TemplateResult | typeof nothing {
    if (!this.logoSrc && !this.brand) return nothing;
    return html`<div class="lia-auth-brand text-center my-4">
      ${this.logoSrc
        ? html`<img
            class="lia-auth-logo img-fluid"
            src=${this.logoSrc}
            alt=${this.logoAlt || this.brand || ''}
          />`
        : nothing}
      ${this.brand && !this.logoSrc
        ? html`<span class="h4 d-inline-flex align-items-center gap-2 mb-0">
            ${this.brandIcon
              ? html`<i class=${this.brandIcon} aria-hidden="true"></i>`
              : nothing}${this.brand}
          </span>`
        : nothing}
    </div>`;
  }

  private renderAlerts(): TemplateResult | typeof nothing {
    const messages: AlertMessage[] = [...this.alerts];
    if (this.success) {
      messages.push({ variant: 'success', title: this.successTitle, message: this.success });
    } else if (this.error) {
      messages.push({ variant: 'danger', title: this.errorTitle, message: this.error });
    }
    if (messages.length === 0) return nothing;
    return html`<div class="lia-auth-alerts">
      ${messages.map(
        (message) => html`<lia-alert
          .alert=${message}
          alert-class="mb-3"
          ?trusted-html=${message.html === true || this.trustedHtml}
        ></lia-alert>`
      )}
    </div>`;
  }

  private renderLinks(): TemplateResult | typeof nothing {
    const links = this.links.filter((link) => link.visible !== false);
    if (links.length === 0) return nothing;
    return html`<div class="card-footer d-flex flex-wrap justify-content-between gap-2">
      ${links.map(
        (link) => html`<a
          class="card-link text-body-secondary d-inline-flex align-items-center gap-1 mx-0"
          href=${link.url ?? '#'}
          target=${ifDefined(link.external ? '_blank' : undefined)}
          rel=${ifDefined(link.external ? 'noopener noreferrer' : undefined)}
        >
          ${link.icon ? html`<i class=${link.icon} aria-hidden="true"></i>` : nothing}${link.label}
        </a>`
      )}
    </div>`;
  }

  protected override render(): TemplateResult {
    return html`<div
      class=${cx(
        'lia-auth d-flex flex-column',
        this.centered && 'min-vh-100 justify-content-center',
        'py-4'
      )}
    >
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-12 lia-auth-column" style="max-width: ${this.maxWidth}px">
            ${this.showThemeToggle
              ? html`<div class="lia-auth-tools d-flex justify-content-end">
                  <lia-theme-toggle label=${this.themeLabel}></lia-theme-toggle>
                </div>`
              : nothing}
            ${this.renderBrand()}
            <div class=${cx('card shadow', this.cardClass)}>
              <div class=${cx('card-body', this.bodyClass)}>
                ${this.heading ? html`<h1 class="card-title h5">${this.heading}</h1>` : nothing}
                ${this.description
                  ? html`<p class="text-body-secondary">
                      ${this.trustedHtml ? renderRich(this.description) : this.description}
                    </p>`
                  : nothing}
                ${this.renderAlerts()}${this.content ?? nothing}${this.lightSlot.node}
              </div>
              ${this.renderLinks()}
            </div>
            ${this.footerText
              ? html`<p class="lia-auth-footer text-center text-body-secondary small mt-4 mb-0">
                  ${this.trustedHtml ? renderRich(this.footerText) : this.footerText}
                </p>`
              : nothing}
          </div>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-auth-layout': LiaAuthLayout;
  }
}
