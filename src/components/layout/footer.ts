import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import { renderRich } from '../../core/utils.js';
import { flag } from './flag.js';

/** A legal / meta link in the footer strip. */
export interface FooterLink {
  label: string;
  href: string;
  /** Opens in a new tab and gets `rel="noopener noreferrer"`. */
  external?: boolean;
  title?: string;
}

/**
 * The small, centred footer strip under the page content: an optional logo, an
 * optional version string, a line of text and a bullet-separated row of legal
 * links (imprint, terms, privacy — whatever you pass).
 *
 * Everything is a property; there is no built-in branding. `text` and `note`
 * accept trusted HTML so a copyright line can contain its own link.
 *
 * @example
 * ```ts
 * html`<lia-footer
 *   text="&copy; 2026 Example Ltd."
 *   version="2.4.0"
 *   show-version
 *   .links=${[
 *     { label: 'Imprint', href: '/imprint' },
 *     { label: 'Privacy', href: '/privacy' },
 *   ]}
 * ></lia-footer>`
 * ```
 */
@customElement('lia-footer')
export class LiaFooter extends LiaElement {
  /** Main line. Trusted HTML. */
  @property({ type: String }) text = '';

  /** Legal / meta links, rendered bullet-separated. */
  @property({ attribute: false }) links: FooterLink[] = [];

  /** Version string shown before {@link text}. */
  @property({ type: String }) version = '';

  /** Whether {@link version} is rendered at all. */
  @property({ converter: flag, attribute: 'show-version' }) showVersion = true;

  /** Optional small logo before the version/text. */
  @property({ type: String, attribute: 'logo-src' }) logoSrc = '';

  /** Alt text for {@link logoSrc}. */
  @property({ type: String, attribute: 'logo-alt' }) logoAlt = '';

  /** Second, smaller line — credits, translator, build id. Trusted HTML. */
  @property({ type: String }) note = '';

  /** Accessible name of the `contentinfo` landmark. */
  @property({ type: String }) label = 'Footer';

  protected override render(): unknown {
    const showVersion = this.showVersion && this.version !== '';
    const links = this.links.filter((link) => link.href !== '');

    return html`<footer class="lia-footer text-center mb-3" aria-label="${this.label}">
      <span>
        ${this.logoSrc
          ? html`<img
              class="lia-footer-logo align-text-top me-1"
              src="${this.logoSrc}"
              alt="${this.logoAlt}"
            />`
          : nothing}
        ${showVersion ? html`<span class="lia-footer-version me-1">${this.version}</span>` : nothing}
        ${renderRich(this.text)}
        ${links.length
          ? html`<br />${links.map(
              (link) => html`<a
                class="lia-footer-link"
                href="${link.href}"
                title="${link.title ?? link.label}"
                target="${link.external ? '_blank' : '_self'}"
                rel="${ifDefined(link.external ? 'noopener noreferrer' : undefined)}"
                >${link.label}</a
              >`
            )}`
          : nothing}
      </span>
      ${this.note ? html`<br /><small class="mt-3 d-inline-block">${renderRich(this.note)}</small>` : nothing}
    </footer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-footer': LiaFooter;
  }
}
