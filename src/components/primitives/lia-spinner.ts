import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { Size, Variant } from '../../core/types.js';

/** Options for {@link renderSpinner}. */
export interface RenderSpinnerOptions {
  /** `grow` renders the pulsing dot instead of the rotating ring. */
  grow?: boolean;
  size?: Size;
  variant?: Variant;
  class?: string;
}

/** Bootstrap classes for a spinner. `lg` uses the kit's `spinner-*-lg` helper. */
export function spinnerClasses(options: RenderSpinnerOptions = {}): string {
  const kind = options.grow ? 'spinner-grow' : 'spinner-border';
  const size = options.size && options.size !== 'md' ? `${kind}-${options.size}` : '';
  return cx(kind, size, options.variant && `text-${options.variant}`, options.class);
}

/**
 * Render a spinner inline, without instantiating a custom element.
 * `label` is announced to assistive technology but stays visually hidden.
 */
export function renderSpinner(label = 'Loading…', options: RenderSpinnerOptions = {}): TemplateResult {
  return html`<span class=${spinnerClasses(options)} role="status"
    ><span class="visually-hidden">${label}</span></span
  >`;
}

/**
 * A busy indicator.
 *
 * Always carries an accessible status label; set `label-visible` to show it
 * next to the spinner as well.
 *
 * @example
 * ```html
 * <lia-spinner variant="primary" label="Loading entries"></lia-spinner>
 * <lia-spinner grow size="sm" label="Saving" label-visible></lia-spinner>
 * ```
 */
@customElement('lia-spinner')
export class LiaSpinner extends LiaElement {
  /** Pulsing dot instead of the rotating ring. */
  @property({ type: Boolean }) grow = false;

  /** `sm` / `md` / `lg`. */
  @property({ type: String }) size: Size = 'md';

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant?: Variant;

  /** Status text. Announced always, shown only with `label-visible`. */
  @property({ type: String }) label = 'Loading…';

  /** Also render the label next to the spinner. */
  @property({ type: Boolean, attribute: 'label-visible' }) labelVisible = false;

  override render(): TemplateResult {
    const spinner = html`<span
      class=${spinnerClasses({ grow: this.grow, size: this.size, variant: this.variant })}
      aria-hidden=${this.labelVisible ? 'true' : nothing}
      role=${this.labelVisible ? nothing : 'status'}
    >
      ${this.labelVisible ? nothing : html`<span class="visually-hidden">${this.label}</span>`}
    </span>`;

    if (!this.labelVisible) return spinner;

    return html`<span class="d-inline-flex align-items-center gap-2" role="status"
      >${spinner}<span>${this.label}</span></span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-spinner': LiaSpinner;
  }
}
