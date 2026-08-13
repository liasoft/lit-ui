import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { BadgeCellValue, IconName, Variant } from '../../core/types.js';
import { renderIcon } from './lia-icon.js';

/** Options for {@link renderBadge}. */
export interface RenderBadgeOptions {
  variant?: Variant;
  /** Fully rounded "counter" shape. */
  pill?: boolean;
  icon?: IconName;
  /** Tinted background with emphasis text instead of a solid fill. */
  subtle?: boolean;
  title?: string;
  class?: string;
}

/** Bootstrap classes for a badge, including the 5.3 colour-contrast helpers. */
export function badgeClasses(options: RenderBadgeOptions = {}): string {
  const variant = options.variant ?? 'secondary';
  return cx(
    'badge',
    options.pill && 'rounded-pill',
    options.subtle
      ? `bg-${variant}-subtle text-${variant}-emphasis border border-${variant}-subtle`
      : `text-bg-${variant}`,
    options.class
  );
}

/**
 * Render a badge inline, without instantiating a custom element — handy for
 * table cells that show a handful of badges per row.
 */
export function renderBadge(
  text: string | number | null | undefined,
  options: RenderBadgeOptions = {}
): TemplateResult | typeof nothing {
  if (text === null || text === undefined || text === '') return nothing;
  return html`<span class=${badgeClasses(options)} title=${ifDefined(options.title)}
    >${renderIcon(options.icon, { class: 'me-1' })}${text}</span
  >`;
}

/**
 * A short status or counter chip.
 *
 * Uses Bootstrap 5.3's `text-bg-*` helpers so the foreground colour stays
 * legible in both light and dark themes; `subtle` switches to the softer
 * tinted treatment.
 *
 * @example
 * ```html
 * <lia-badge text="Active" variant="success"></lia-badge>
 * <lia-badge text="12" variant="primary" pill></lia-badge>
 * <lia-badge text="Beta" variant="info" subtle icon="fa-solid fa-flask"></lia-badge>
 * ```
 */
@customElement('lia-badge')
export class LiaBadge extends LiaElement {
  /** The badge content. */
  @property({ type: String }) text: string | number = '';

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant: Variant = 'secondary';

  /** Fully rounded "counter" shape. */
  @property({ type: Boolean }) pill = false;

  /** Icon-font class string rendered before the text. */
  @property({ type: String }) icon: IconName = '';

  /** Tinted background with emphasis text instead of a solid fill. */
  @property({ type: Boolean }) subtle = false;

  /** Native tooltip. */
  @property({ type: String }) override title = '';

  /** Alternative to the individual props — accepts a table `BadgeCellValue`. */
  @property({ attribute: false }) value?: BadgeCellValue;

  override render(): TemplateResult | typeof nothing {
    const text = this.value?.text ?? this.text;
    return renderBadge(text, {
      variant: this.value?.variant ?? this.variant,
      icon: this.value?.icon ?? this.icon,
      pill: this.pill,
      subtle: this.subtle,
      title: this.title || undefined,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-badge': LiaBadge;
  }
}
