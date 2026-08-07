import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { IconName, Variant } from '../../core/types.js';

/**
 * Relative icon sizes understood by Font Awesome (and most icon fonts that
 * follow its conventions).
 */
export type IconSize =
  | '2xs'
  | 'xs'
  | 'sm'
  | 'lg'
  | 'xl'
  | '2xl'
  | '1x'
  | '2x'
  | '3x'
  | '4x'
  | '5x'
  | '6x'
  | '7x'
  | '8x'
  | '9x'
  | '10x';

/** Options accepted by {@link renderIcon} and {@link iconClasses}. */
export interface RenderIconOptions {
  /** Reserve a uniform width so stacked icons line up (`fa-fw`). */
  fixedWidth?: boolean;
  /** Continuous rotation (`fa-spin`). */
  spin?: boolean;
  /** Stepped rotation, the classic "loading" tick (`fa-spin-pulse`). */
  pulse?: boolean;
  size?: IconSize;
  /** Bootstrap contextual colour, rendered as `text-{variant}`. */
  variant?: Variant;
  /**
   * Accessible name. When omitted the icon is `aria-hidden` — the right call
   * for icons that merely decorate an adjacent text label.
   */
  label?: string;
  /** Extra classes appended verbatim. */
  class?: string;
}

/** Build the class string for an icon element. */
export function iconClasses(name: IconName, options: RenderIconOptions = {}): string {
  return cx(
    name,
    options.fixedWidth && 'fa-fw',
    options.spin && 'fa-spin',
    options.pulse && 'fa-spin-pulse',
    options.size && `fa-${options.size}`,
    options.variant && `text-${options.variant}`,
    options.class
  );
}

/**
 * Render an icon inline, without instantiating a custom element. Returns
 * `nothing` for an empty name so callers can pass optional icons straight
 * through.
 *
 * @example
 * ```ts
 * html`<button class="btn btn-primary">
 *   ${renderIcon('fa-solid fa-plus', { fixedWidth: true })} Add
 * </button>`;
 * ```
 */
export function renderIcon(
  name: IconName | null | undefined,
  options: RenderIconOptions = {}
): TemplateResult | typeof nothing {
  if (!name) return nothing;
  const { label } = options;
  return html`<i
    class=${iconClasses(name, options)}
    role=${label ? 'img' : nothing}
    aria-label=${label ?? nothing}
    aria-hidden=${label ? nothing : 'true'}
  ></i>`;
}

/**
 * An icon-font glyph.
 *
 * Decorative by default (`aria-hidden`); set `label` to promote it to an
 * `img` role with an accessible name. Colour comes from Bootstrap contextual
 * text classes so it follows the active `data-bs-theme`.
 *
 * @example
 * ```html
 * <lia-icon name="fa-solid fa-database" variant="success" fixed-width></lia-icon>
 * <lia-icon name="fa-solid fa-triangle-exclamation" label="Warning"></lia-icon>
 * ```
 */
@customElement('lia-icon')
export class LiaIcon extends LiaElement {
  /** Icon-font class string, e.g. `fa-solid fa-user`. */
  @property({ type: String }) name: IconName = '';

  /** Reserve a uniform width so stacked icons line up. */
  @property({ type: Boolean, attribute: 'fixed-width' }) fixedWidth = false;

  /** Continuous rotation. */
  @property({ type: Boolean }) spin = false;

  /** Stepped rotation. */
  @property({ type: Boolean }) pulse = false;

  /** Relative size, e.g. `lg` or `2x`. */
  @property({ type: String }) size?: IconSize;

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant?: Variant;

  /** Accessible name. Omit for purely decorative icons. */
  @property({ type: String }) label?: string;

  override render(): TemplateResult | typeof nothing {
    return renderIcon(this.name, {
      fixedWidth: this.fixedWidth,
      spin: this.spin,
      pulse: this.pulse,
      size: this.size,
      variant: this.variant,
      label: this.label,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-icon': LiaIcon;
  }
}
