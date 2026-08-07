import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import type { InfoEntry, IconName, Variant } from '../../core/types.js';
import { renderIcon } from './lia-icon.js';
import { renderBadge } from './lia-badge.js';
import { LightSlot } from './light-slot.js';

/**
 * A "bold label over its value" row — the building block of every info card.
 *
 * The element **is** the `.list-group-item`: the Bootstrap classes are put on
 * the host rather than on an inner wrapper, so `.list-group > .list-group-item`
 * and the `:first-child`/`:last-child` border rules keep matching and the row
 * needs no corrective CSS. Drop it straight into a `<ul class="list-group">`
 * or `<div class="list-group list-group-flush">`.
 *
 * The value can come from `value` (plain text), `html` (trusted markup), the
 * `entry` object, or from light-DOM children — useful when the value is a
 * stack of badges or links.
 *
 * @example
 * ```html
 * <div class="list-group list-group-flush">
 *   <lia-key-value label="Hostname" value="node-01"></lia-key-value>
 *   <lia-key-value label="Version" value="2.1.0" href="/changelog"></lia-key-value>
 *   <lia-key-value label="Services">
 *     <span class="badge text-bg-success me-1">IMAP</span>
 *     <span class="badge text-bg-success">SMTP</span>
 *   </lia-key-value>
 * </div>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-key-value
 *   .entry=${{ label: 'Members', value: names.join(', '), badge: { text: names.length } }}
 * ></lia-key-value>`;
 * ```
 */
@customElement('lia-key-value')
export class LiaKeyValue extends LiaElement {
  /** Complete entry; its fields win over the individual properties. */
  @property({ attribute: false }) entry?: InfoEntry;

  /** The bold caption. */
  @property({ type: String }) label = '';

  /** Plain-text value. */
  @property({ type: String }) value = '';

  /** Trusted HTML value; wins over {@link value}. */
  @property({ type: String }) html = '';

  /** Turns the value into a link. */
  @property({ type: String }) href = '';

  /** Icon-font class string rendered before the label. */
  @property({ type: String }) icon: IconName = '';

  /** Contextual tint of the whole row, e.g. `info` for a highlighted note. */
  @property({ type: String }) variant?: Variant;

  /** Counter chip pinned to the right end of the row. */
  @property({ attribute: false }) badge?: InfoEntry['badge'];

  /**
   * Render only the label/value pair without the `list-group-item` chrome, for
   * use outside a list group.
   */
  @property({ type: Boolean }) bare = false;

  private readonly lightSlot = new LightSlot();

  private hostClasses: string[] = [];

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  override willUpdate(): void {
    this.syncHostClasses();
  }

  override disconnectedCallback(): void {
    for (const name of this.hostClasses) this.classList.remove(name);
    this.hostClasses = [];
    super.disconnectedCallback();
  }

  /** Put the list-group classes on the host, replacing the previous set. */
  private syncHostClasses(): void {
    const variant = this.entry?.variant ?? this.variant;
    const next = this.bare
      ? ['d-flex', 'justify-content-between', 'align-items-start', 'gap-2']
      : [
          'list-group-item',
          'd-flex',
          'justify-content-between',
          'align-items-start',
          'gap-2',
          ...(variant ? [`list-group-item-${variant}`] : []),
        ];

    for (const name of this.hostClasses) {
      if (!next.includes(name)) this.classList.remove(name);
    }
    for (const name of next) this.classList.add(name);
    this.hostClasses = next;
  }

  private renderValue(): TemplateResult | typeof nothing {
    const markup = this.entry?.html ?? (this.html || undefined);
    const text = this.entry?.value ?? (this.value || undefined);
    const href = this.entry?.href ?? (this.href || undefined);

    const body = markup !== undefined ? renderRich(markup) : (text ?? nothing);
    const projected = this.lightSlot.isEmpty ? nothing : this.lightSlot.node;
    if (body === nothing && projected === nothing) return nothing;

    if (href) {
      return html`<a href=${href}>${body}${projected}</a>`;
    }
    return html`${body}${projected}`;
  }

  override render(): TemplateResult {
    const label = this.entry?.label ?? this.label;
    const icon = this.entry?.icon ?? this.icon;
    const badge = this.entry?.badge ?? this.badge;

    return html`<div class=${cx('me-auto', 'min-w-0')}>
        ${label
          ? html`<div class="fw-bold d-flex align-items-center gap-1">
              ${renderIcon(icon)}<span>${label}</span>
            </div>`
          : nothing}
        ${this.renderValue()}
      </div>
      ${badge
        ? renderBadge(badge.text, { variant: badge.variant ?? 'primary', pill: true })
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-key-value': LiaKeyValue;
  }
}
