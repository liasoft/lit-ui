import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import '../primitives/lia-copy-button.js';

/** One substitutable placeholder offered by a template editor. */
export interface ReplacerToken {
  /** The bare name, without the surrounding delimiters, e.g. `firstname`. */
  token: string;
  /** What the placeholder expands to. Trusted HTML is allowed. */
  description?: string;
  /** Hide the entry without removing it from the list. */
  visible?: boolean;
  /** A concrete example of the expansion, shown after the description. */
  example?: string;
}

/**
 * The reference table of `{placeholder}` tokens shown under a template-editing
 * textarea: which substitutions exist, and what each one expands to.
 *
 * Delimiters are configurable, so the same component documents `{name}`,
 * `%name%`, `${name}` or `[[name]]` equally well. Each token gets a copy
 * button, because the point of the table is to paste from it.
 *
 * @example
 * ```ts
 * html`<lia-replacer-hint
 *   .tokens=${[
 *     { token: 'firstname', description: 'The recipient’s first name.', example: 'Ada' },
 *     { token: 'link', description: 'The one-time confirmation link.' },
 *   ]}
 * ></lia-replacer-hint>`
 * ```
 *
 * @example
 * ```html
 * <lia-replacer-hint prefix="%" suffix="%" copyable="false"></lia-replacer-hint>
 * ```
 */
@customElement('lia-replacer-hint')
export class LiaReplacerHint extends LiaElement {
  /** The placeholders to document. */
  @property({ attribute: false }) tokens: ReplacerToken[] = [];

  /**
   * Card heading.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * setting it never produces a native browser tooltip.
   */
  @property({ type: String }) override title = 'Available placeholders';

  /** Optional paragraph between the heading and the table. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Opening delimiter. Named `prefix` as an attribute. */
  @property({ type: String, attribute: 'prefix' }) tokenPrefix = '{';

  /** Closing delimiter. Named `suffix` as an attribute. */
  @property({ type: String, attribute: 'suffix' }) tokenSuffix = '}';

  /** Show a copy button next to every token. Set `copyable="false"` to hide. */
  @property({ converter: flag }) copyable = true;

  /** Accessible name of the copy buttons. */
  @property({ type: String, attribute: 'copy-label' }) copyLabel = 'Copy placeholder';

  /** Shown instead of the table when there is nothing to document. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = '';

  /** Extra classes on the `.card`. */
  @property({ type: String, attribute: 'card-class' }) cardClass = 'my-3';

  /** The tokens that will actually be rendered. */
  get visibleTokens(): ReplacerToken[] {
    return this.tokens.filter((entry) => entry.visible !== false);
  }

  /** The full text of a token, delimiters included. */
  placeholderFor(token: ReplacerToken): string {
    return `${this.tokenPrefix}${token.token}${this.tokenSuffix}`;
  }

  protected override render(): unknown {
    const tokens = this.visibleTokens;
    if (tokens.length === 0 && !this.emptyMessage) return nothing;

    return html`<div class=${cx('card', 'lia-replacer-hint', this.cardClass)}>
      <div class="card-body">
        ${this.title ? html`<h5 class="card-title">${this.title}</h5>` : nothing}
        ${
          this.description
            ? html`<p class="card-text text-body-secondary">${renderRich(this.description)}</p>`
            : nothing
        }
        ${
          tokens.length === 0
            ? html`<p class="text-body-secondary mb-0">${this.emptyMessage}</p>`
            : html`<dl class="row mb-0">
                ${tokens.map((token) => {
                  const placeholder = this.placeholderFor(token);
                  return html`<dt
                      class="col-sm-4 col-lg-3 d-flex align-items-center gap-1 fw-normal"
                    >
                      <code class="text-nowrap">${placeholder}</code>
                      ${
                        this.copyable
                          ? html`<lia-copy-button
                              class="lia-replacer-copy"
                              .text=${placeholder}
                              .title=${this.copyLabel}
                            ></lia-copy-button>`
                          : nothing
                      }
                    </dt>
                    <dd class="col-sm-8 col-lg-9 mb-2">
                      ${renderRich(token.description ?? '')}
                      ${
                        token.example
                          ? html`<span class="text-body-secondary ms-1">— ${token.example}</span>`
                          : nothing
                      }
                    </dd>`;
                })}
              </dl>`
        }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-replacer-hint': LiaReplacerHint;
  }
}
