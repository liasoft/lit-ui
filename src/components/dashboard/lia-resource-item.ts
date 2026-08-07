import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { formatBytes as toHumanBytes, usagePercent, usageVariant } from '../../core/utils.js';
import type { ResourceItem } from '../../core/types.js';
import '../primitives/lia-progress.js';

/** Fill of the usage bar for a limit that may be zero or unlimited. */
function meterPercent(used: number, available: number): number {
  if (available < 0) return 100; // unlimited — a full, neutral track
  if (available === 0) return used > 0 ? 100 : 0;
  return usagePercent(used, available);
}

/**
 * A resource meter tile: a label, the `used / limit` figures and a thin bar
 * whose colour turns amber past 75 % and red past 90 %.
 *
 * A negative `available` means *unlimited*: the bar is drawn full in the
 * neutral secondary colour and the limit is printed as {@link unlimitedLabel}.
 * The optional `assigned` figure adds a second, primary-coloured bar showing
 * how much of the limit has already been handed out to sub-accounts.
 *
 * All figures are plain numbers; set `format-bytes` to print them as byte
 * sizes instead. `byteUsage` appends a second, parenthesised byte figure to
 * the label — the pattern used for "5 databases (1.2 GiB)".
 *
 * The whole tile becomes a link when `href` is set: the anchor is stretched
 * over the host, so the padding a grid cell adds is clickable too.
 *
 * @example
 * ```html
 * <lia-resource-item label="Databases" used="3" available="10"></lia-resource-item>
 * <lia-resource-item label="Disk space" used="8500000000" available="10737418240"
 *                    format-bytes href="/storage"></lia-resource-item>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-resource-item
 *   .item=${{ label: 'Traffic', used: 812, available: -1, formatBytes: true }}
 *   unlimited-label=${t('unlimited')}
 * ></lia-resource-item>`;
 * ```
 */
@customElement('lia-resource-item')
export class LiaResourceItem extends LiaElement {
  /** Complete descriptor; its fields win over the individual properties. */
  @property({ attribute: false }) item?: ResourceItem;

  /** Caption of the tile. */
  @property({ type: String }) label = '';

  /** Consumed amount. */
  @property({ type: Number }) used = 0;

  /** Limit. A negative value means unlimited. */
  @property({ type: Number }) available = -1;

  /** Portion of the limit already allocated elsewhere; adds a second bar. */
  @property({ type: Number }) assigned?: number;

  /** Print {@link used} and {@link available} as byte sizes. */
  @property({ type: Boolean, attribute: 'format-bytes' }) formatBytes = false;

  /** Extra byte figure appended to the label in parentheses. */
  @property({ type: Number, attribute: 'byte-usage' }) byteUsage?: number;

  /** Turns the whole tile into a link. */
  @property({ type: String }) href = '';

  /** Link target, when {@link href} is set. */
  @property({ type: String }) target?: '_blank' | '_self' | '_parent' | '_top';

  /** Text printed instead of a negative limit. */
  @property({ type: String, attribute: 'unlimited-label' }) unlimitedLabel = 'Unlimited';

  /** Accessible name suffix of the second bar. */
  @property({ type: String, attribute: 'assigned-label' }) assignedLabel = 'allocated';

  private hostClasses: string[] = [];

  override willUpdate(): void {
    this.syncHostClasses();
  }

  override disconnectedCallback(): void {
    for (const name of this.hostClasses) this.classList.remove(name);
    this.hostClasses = [];
    super.disconnectedCallback();
  }

  /**
   * A stretched link needs a positioned ancestor, and the tile's padding
   * usually lives on the host (the grid cell). Position the host itself so the
   * entire cell, padding included, is clickable.
   */
  private syncHostClasses(): void {
    const next = this.resolved.href ? ['position-relative'] : [];
    for (const name of this.hostClasses) {
      if (!next.includes(name)) this.classList.remove(name);
    }
    for (const name of next) this.classList.add(name);
    this.hostClasses = next;
  }

  /** Merge the `item` descriptor over the individual properties. */
  private get resolved(): Required<Pick<ResourceItem, 'label' | 'used' | 'available'>> &
    Pick<ResourceItem, 'assigned' | 'byteUsage' | 'href' | 'formatBytes'> {
    const item = this.item;
    return {
      label: item?.label ?? this.label,
      used: item?.used ?? this.used,
      available: item?.available ?? this.available,
      assigned: item?.assigned ?? this.assigned,
      byteUsage: item?.byteUsage ?? this.byteUsage,
      href: item?.href ?? this.href,
      formatBytes: item?.formatBytes ?? this.formatBytes,
    };
  }

  private figure(value: number, asBytes: boolean): string {
    return asBytes ? toHumanBytes(value) : String(value);
  }

  override render(): TemplateResult {
    const { label, used, available, assigned, byteUsage, href, formatBytes } = this.resolved;
    const unlimited = available < 0;
    const percent = meterPercent(used, available);
    const usedText = this.figure(used, Boolean(formatBytes));
    const limitText = unlimited ? this.unlimitedLabel : this.figure(available, Boolean(formatBytes));
    const hasAssigned = assigned !== undefined && assigned !== null;
    const assignedPercent = hasAssigned && available > 0 ? usagePercent(assigned, available) : 0;

    return html`
      <div class="row g-1 mb-1 align-items-baseline">
        <div class="col text-truncate">
          ${href
            ? html`<a class="stretched-link text-reset" href=${href} target=${this.target ?? nothing}
                >${label}</a
              >`
            : label}${byteUsage !== undefined && byteUsage !== null
            ? html` <small class="text-body-secondary">(${toHumanBytes(byteUsage)})</small>`
            : nothing}
        </div>
        <div class="col-auto">
          <small class="text-body-secondary">${usedText} / ${limitText}</small>
        </div>
      </div>
      <lia-progress
        thin
        percent=${percent}
        variant=${usageVariant(percent, unlimited)}
        value-now=${percent}
        value-max="100"
        bar-label=${`${label}: ${usedText} / ${limitText}`}
        secondary-percent=${hasAssigned ? assignedPercent : nothing}
        secondary-label=${hasAssigned
          ? `${label}: ${this.figure(assigned ?? 0, Boolean(formatBytes))} ${this.assignedLabel}`
          : nothing}
      ></lia-progress>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-resource-item': LiaResourceItem;
  }
}
