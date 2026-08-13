import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { IconName, InfoEntry, Variant } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { LightSlot } from '../primitives/light-slot.js';
import '../primitives/lia-key-value.js';
import '../primitives/lia-copy-button.js';

/** Crude tag stripper for building the plain-text copy of an HTML value. */
function toPlainText(markup: string): string {
  return markup
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Render the whole panel as a plain-text block — one `- label: value` per row. */
export function infoEntriesToText(entries: readonly InfoEntry[]): string {
  return entries
    .map((entry) => {
      const value = entry.value ?? (entry.html ? toPlainText(entry.html) : '');
      const badge = entry.badge ? ` (${entry.badge.text})` : '';
      return `- ${entry.label}: ${value}${badge}`.trimEnd();
    })
    .join('\n');
}

/**
 * A details panel: a card header with an icon and a title, and a flush list
 * group of bold-label-over-value rows.
 *
 * This is the one component behind every "details" panel a dashboard needs —
 * system information, account information, contact information. Rows are
 * {@link InfoEntry} objects, so a row can carry a link, a counter badge, a
 * contextual tint or trusted HTML. Extra rows written as light-DOM children
 * are appended after the data-driven ones.
 *
 * With `copyable` the header grows a copy button that puts the entire panel on
 * the clipboard as `- label: value` lines — a shortcut for pasting system
 * details into a support ticket.
 *
 * @example
 * ```ts
 * html`<lia-info-card
 *   title="System details"
 *   icon="fa-solid fa-gears"
 *   copyable
 *   .entries=${[
 *     { label: 'Hostname', value: 'node-01.example.net' },
 *     { label: 'Runtime', value: '8.3.4', href: '/system/runtime' },
 *     { label: 'Services', html: '<span class="badge text-bg-success">IMAP</span>' },
 *     { label: 'Sites', value: siteNames.join(', '), badge: { text: siteNames.length } },
 *   ]}
 * ></lia-info-card>`;
 * ```
 *
 * @example
 * ```html
 * <lia-info-card title="Account" icon="fa-solid fa-user">
 *   <lia-key-value label="Plan" value="Business"></lia-key-value>
 * </lia-info-card>
 * ```
 */
@customElement('lia-info-card')
export class LiaInfoCard extends LiaElement {
  /**
   * Panel heading. Prefer the property binding (`.title=${…}`) — a static
   * `title="…"` attribute also gives the host a native browser tooltip.
   */
  @property({ type: String }) override title = '';

  /** Icon-font class string rendered before the title. */
  @property({ type: String }) icon: IconName = '';

  /** The rows of the panel. */
  @property({ attribute: false }) entries: InfoEntry[] = [];

  /** Show the "copy the whole panel" button in the header. */
  @property({ type: Boolean }) copyable = false;

  /** Text put on the clipboard; defaults to the rendered entries. */
  @property({ type: String, attribute: 'copy-text' }) copyText = '';

  /** Accessible name and tooltip of the copy button. */
  @property({ type: String, attribute: 'copy-title' }) copyTitle = 'Copy details to clipboard';

  /** Confirmation announced after a successful copy. */
  @property({ type: String, attribute: 'copied-title' }) copiedTitle = 'Details copied';

  /** Contextual tint of the card header and border. */
  @property({ type: String }) variant?: Variant;

  /** Shown when there are neither entries nor projected rows. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No details available.';

  /** Drop the card's bottom margin and stretch it — for use inside a grid cell. */
  @property({ type: Boolean }) flush = false;

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    // The slot wrapper is `display: contents`, so it takes no space — but it
    // is still a DOM parent. Give it the list-group classes as well, or
    // Bootstrap's `.list-group-flush > .list-group-item` rules would skip the
    // projected rows and they would grow borders the generated rows lack.
    this.lightSlot.node.classList.add('list-group', 'list-group-flush');
    super.connectedCallback();
  }

  /** The plain-text representation used by the copy button. */
  get text(): string {
    return this.copyText || infoEntriesToText(this.entries);
  }

  private renderHeader(): TemplateResult | typeof nothing {
    if (!this.title && !this.icon && !this.copyable) return nothing;
    return html`<div
      class=${cx(
        'card-header',
        'd-flex',
        'justify-content-between',
        'align-items-center',
        'gap-2',
        this.variant && `text-bg-${this.variant}`
      )}
    >
      <span class="d-inline-flex align-items-center gap-1 text-truncate">
        ${renderIcon(this.icon)}${this.title}
      </span>
      ${this.copyable
        ? html`<lia-copy-button
            .text=${this.text}
            title=${this.copyTitle}
            copied-title=${this.copiedTitle}
          ></lia-copy-button>`
        : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const empty = this.entries.length === 0 && this.lightSlot.isEmpty;

    return html`<div
      class=${cx('card', this.variant && `border-${this.variant}`, this.flush && 'h-100 mb-0')}
    >
      ${this.renderHeader()}
      <div class="list-group list-group-flush">
        ${this.entries.map((entry) => html`<lia-key-value .entry=${entry}></lia-key-value>`)}
        ${this.lightSlot.node}
        ${empty
          ? html`<div class="list-group-item text-body-secondary">${this.emptyMessage}</div>`
          : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-info-card': LiaInfoCard;
  }
}
