import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { IconName, StatCardData, Variant } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';

/**
 * A single KPI: one big number, its caption, an icon chip and an optional
 * change indicator.
 *
 * Colour comes from Bootstrap's contextual palette only — the chip uses the
 * 5.3 `*-subtle` / `*-emphasis` pair, so it stays legible in both themes and
 * never competes with the number itself. Set `href` to make the whole card a
 * link (the anchor is stretched across it, the caption carries the name).
 *
 * @example
 * ```html
 * <lia-stat-card label="Active domains" value="128" icon="fa-solid fa-globe"
 *                variant="primary" delta="+6" delta-variant="success"
 *                description="since last month"></lia-stat-card>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-stat-card
 *   .data=${{ label: 'Failed jobs', value: 3, icon: 'fa-solid fa-triangle-exclamation',
 *             variant: 'danger', href: '/jobs?state=failed' }}
 * ></lia-stat-card>`;
 * ```
 */
@customElement('lia-stat-card')
export class LiaStatCard extends LiaElement {
  /** Complete descriptor; its fields win over the individual properties. */
  @property({ attribute: false }) data?: StatCardData;

  /** Caption under (or above) the value. */
  @property({ type: String }) label = '';

  /** The headline figure. Pre-format it — the card prints it verbatim. */
  @property({ type: String }) value: string | number = '';

  /** Icon-font class string for the chip. */
  @property({ type: String }) icon: IconName = '';

  /** Contextual colour of the chip. */
  @property({ type: String }) variant: Variant = 'primary';

  /** Short change indicator, e.g. `+12 %`. */
  @property({ type: String }) delta = '';

  /** Colour of the change indicator. */
  @property({ type: String, attribute: 'delta-variant' }) deltaVariant: Variant = 'secondary';

  /** Muted line under the value. */
  @property({ type: String }) description = '';

  /** Turns the whole card into a link. */
  @property({ type: String }) href = '';

  /** Drop the card's bottom margin and stretch it — for use inside a grid row. */
  @property({ type: Boolean }) flush = false;

  private get resolved(): StatCardData {
    const data = this.data;
    return {
      label: data?.label ?? this.label,
      value: data?.value ?? this.value,
      icon: data?.icon ?? this.icon,
      variant: data?.variant ?? this.variant,
      delta: data?.delta ?? this.delta,
      deltaVariant: data?.deltaVariant ?? this.deltaVariant,
      description: data?.description ?? this.description,
      href: data?.href ?? this.href,
    };
  }

  override render(): TemplateResult {
    const { label, value, icon, variant, delta, deltaVariant, description, href } = this.resolved;
    const tone = variant ?? 'primary';

    return html`<div class=${cx('card', this.flush && 'h-100 mb-0')}>
      <div class="card-body d-flex align-items-start gap-3">
        ${icon
          ? html`<span
              class=${cx(
                'lia-stat-chip',
                'd-inline-flex',
                'align-items-center',
                'justify-content-center',
                'rounded-3',
                `bg-${tone}-subtle`,
                `text-${tone}-emphasis`
              )}
              aria-hidden="true"
              >${renderIcon(icon)}</span
            >`
          : nothing}
        <div class="min-w-0 flex-grow-1">
          <div class="small text-uppercase fw-semibold text-body-secondary text-truncate">
            ${href ? html`<a class="stretched-link text-reset" href=${href}>${label}</a>` : label}
          </div>
          <div class="d-flex align-items-baseline flex-wrap gap-2">
            <span class="fs-3 fw-semibold lh-1">${value}</span>
            ${delta
              ? html`<span class=${cx('small', 'fw-semibold', `text-${deltaVariant ?? 'secondary'}`)}
                  >${delta}</span
                >`
              : nothing}
          </div>
          ${description
            ? html`<div class="small text-body-secondary mt-1">${description}</div>`
            : nothing}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-stat-card': LiaStatCard;
  }
}
