import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { Popover } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { Variant } from '../../core/types.js';

/**
 * A bar colour. Either a bare Bootstrap contextual name (`warning`) or a ready
 * made background class (`bg-warning`) — the latter is what `usageVariant()`
 * from `core/utils` returns, so the two interoperate without translation.
 */
export type ProgressVariant = Variant | `bg-${string}` | `text-bg-${string}` | '';

function barColour(variant: ProgressVariant): string {
  if (!variant) return '';
  return variant.startsWith('bg-') || variant.startsWith('text-bg-') ? variant : `bg-${variant}`;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * A Bootstrap progress bar with an optional second "assigned" track.
 *
 * The accessibility attributes live on the track (as Bootstrap 5.3 wants), and
 * `valueNow`/`valueMin`/`valueMax` let you report real quantities — 3 of 10
 * databases — rather than the percentage the bar happens to be drawn at. They
 * are named without the `aria` prefix because `Element` already owns
 * `ariaValueNow` and friends.
 *
 * @example
 * ```html
 * <lia-progress percent="82" variant="warning" thin
 *               text="8.2 GiB / 10 GiB" bar-label="Disk space"></lia-progress>
 * ```
 *
 * @example
 * ```ts
 * // Used quota plus the share already handed out to sub-accounts.
 * html`<lia-progress
 *   thin
 *   percent=${usagePercent(used, total)}
 *   variant=${usageVariant(usagePercent(used, total))}
 *   .valueNow=${used}
 *   .valueMax=${total}
 *   secondary-percent=${usagePercent(assigned, total)}
 *   bar-label="Storage"
 * ></lia-progress>`;
 * ```
 */
@customElement('lia-progress')
export class LiaProgress extends LiaElement {
  /** Fill of the primary bar, 0–100. */
  @property({ type: Number }) percent = 0;

  /** Bar colour; accepts `warning` or `bg-warning`. */
  @property({ type: String }) variant: ProgressVariant = '';

  /** Slim 0.5rem track. */
  @property({ type: Boolean }) thin = false;

  /** Text drawn inside the bar. */
  @property({ type: String }) label = '';

  /** Accessible name for the track. Required when there is no visible label. */
  @property({ type: String, attribute: 'bar-label' }) barLabel = '';

  @property({ type: Boolean }) striped = false;

  @property({ type: Boolean }) animated = false;

  /** Value reported as `aria-valuenow`. Defaults to `percent`. */
  @property({ type: Number, attribute: 'value-now' }) valueNow?: number;

  /** Value reported as `aria-valuemin`. Defaults to `0`. */
  @property({ type: Number, attribute: 'value-min' }) valueMin = 0;

  /** Value reported as `aria-valuemax`. Defaults to `100`. */
  @property({ type: Number, attribute: 'value-max' }) valueMax = 100;

  /** Fill of a second track drawn underneath — "of the limit, this much is allocated". */
  @property({ type: Number, attribute: 'secondary-percent' }) secondaryPercent?: number;

  /** Colour of the second track. */
  @property({ type: String, attribute: 'secondary-variant' }) secondaryVariant: ProgressVariant =
    'primary';

  /** Accessible name for the second track. */
  @property({ type: String, attribute: 'secondary-label' }) secondaryLabel = '';

  /** Caption rendered under the bars, right aligned. */
  @property({ type: String }) text = '';

  /** Extra detail revealed from an info icon next to {@link text}. Trusted HTML. */
  @property({ type: String }) infotext = '';

  /** Accessible name of the info-icon trigger. */
  @property({ type: String, attribute: 'infotext-label' }) infotextLabel = 'More information';

  private infoPopover?: Popover;
  private popoverContent = '';

  override firstUpdated(): void {
    this.syncPopover();
  }

  override updated(): void {
    this.syncPopover();
  }

  override disconnectedCallback(): void {
    this.infoPopover?.dispose();
    this.infoPopover = undefined;
    this.popoverContent = '';
    super.disconnectedCallback();
  }

  /** Create, refresh or tear down the info popover to match `infotext`. */
  private syncPopover(): void {
    const trigger = this.querySelector<HTMLElement>('[data-lia-infotext]');
    if (!trigger || !this.infotext) {
      this.infoPopover?.dispose();
      this.infoPopover = undefined;
      this.popoverContent = '';
      return;
    }
    if (this.infoPopover && this.popoverContent === this.infotext) return;
    this.infoPopover?.dispose();
    this.popoverContent = this.infotext;
    this.infoPopover = new Popover(trigger, {
      content: this.infotext,
      html: true,
      trigger: 'hover focus',
      placement: 'bottom',
      container: 'body',
    });
  }

  private renderTrack(
    percent: number,
    variant: ProgressVariant,
    accessibleName: string,
    options: { primary: boolean } = { primary: true }
  ): TemplateResult {
    const value = clampPercent(percent);
    const now = options.primary ? (this.valueNow ?? value) : value;
    const min = options.primary ? this.valueMin : 0;
    const max = options.primary ? this.valueMax : 100;
    return html`<div
      class=${cx('progress', this.thin && 'progress-thin', !options.primary && 'mt-2')}
      role="progressbar"
      aria-valuenow=${now}
      aria-valuemin=${min}
      aria-valuemax=${max}
      aria-label=${accessibleName || nothing}
    >
      <div
        class=${cx(
          'progress-bar',
          barColour(variant),
          this.striped && 'progress-bar-striped',
          this.animated && 'progress-bar-animated'
        )}
        style=${styleMap({ width: `${value}%` })}
      >
        ${options.primary ? this.label : ''}
      </div>
    </div>`;
  }

  override render(): TemplateResult {
    const hasSecondary =
      this.secondaryPercent !== undefined && this.secondaryPercent !== null;
    const hasCaption = Boolean(this.text) || Boolean(this.infotext);

    return html`
      ${this.renderTrack(this.percent, this.variant, this.barLabel || this.label)}
      ${hasSecondary
        ? this.renderTrack(
            this.secondaryPercent ?? 0,
            this.secondaryVariant,
            this.secondaryLabel || (this.barLabel ? `${this.barLabel} (allocated)` : ''),
            { primary: false }
          )
        : nothing}
      ${hasCaption
        ? html`<div class="text-end small">
            ${this.infotext
              ? html`<button
                  type="button"
                  class="btn btn-link btn-sm p-0 align-baseline border-0"
                  data-lia-infotext
                  aria-label=${this.infotextLabel}
                >
                  <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                </button> `
              : nothing}${this.text}
          </div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-progress': LiaProgress;
  }
}
