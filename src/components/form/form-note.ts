import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName, Variant } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';
import { renderIcon } from '../primitives/lia-icon.js';

/** A note as plain data, for forms that carry their explanation with them. */
export interface FormNoteData {
  /** Bold heading above the text. */
  title?: string;
  /** The note itself. */
  text: string;
  variant?: Variant;
  icon?: IconName;
  /** Render {@link text} as trusted HTML. */
  rich?: boolean;
}

/** Default icon per contextual colour, so a note reads at a glance. */
const ICONS: Partial<Record<Variant, IconName>> = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  danger: 'fa-solid fa-circle-exclamation',
};

/**
 * The explanatory block that sits above (or inside) a form: what this form is
 * for, what will happen when it is saved, what the caveats are.
 *
 * It is an `alert`-styled panel with `role="note"` rather than `role="alert"`
 * — the content is standing context, not something that just happened, and
 * screen readers should not interrupt for it.
 *
 * The body can come from `text` (optionally as trusted HTML via `rich`) or
 * from light-DOM children, and both can be used at once.
 *
 * @example
 * ```html
 * <lia-form-note title="Before you start" variant="warning">
 *   Saving reloads the service. Existing sessions are kept.
 * </lia-form-note>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-form-note
 *   .variant=${'info'}
 *   .title=${'Template placeholders'}
 *   .text=${'Use <code>{name}</code> anywhere in the body.'}
 *   rich
 *   dismissible
 * ></lia-form-note>`
 * ```
 */
@customElement('lia-form-note')
export class LiaFormNote extends LiaElement {
  /**
   * Bold heading above the text.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * setting it never produces a native browser tooltip.
   */
  @property({ type: String }) override title = '';

  /** The note body. */
  @property({ type: String }) text = '';

  /** Render {@link text} as trusted HTML instead of plain text. */
  @property({ type: Boolean }) rich = false;

  /** Bootstrap contextual colour. */
  @property({ type: String }) variant: Variant = 'info';

  /** Leading icon. Defaults to one that matches {@link variant}. */
  @property({ type: String }) icon?: IconName;

  /** Render without any icon at all. */
  @property({ type: Boolean, attribute: 'no-icon' }) noIcon = false;

  /** Add a close button that hides the note and emits `lia-dismiss`. */
  @property({ type: Boolean }) dismissible = false;

  /** Accessible name of the close button. */
  @property({ type: String, attribute: 'dismiss-label' }) dismissLabel = 'Dismiss';

  /** Stable id echoed in the `lia-dismiss` event. */
  @property({ type: String, attribute: 'note-id' }) noteId?: string;

  /** Extra classes on the panel. */
  @property({ type: String, attribute: 'note-class' }) noteClass = 'mb-4';

  @state() private dismissed = false;

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  /** Bring a dismissed note back. */
  restore(): void {
    this.dismissed = false;
  }

  private get resolvedIcon(): IconName | undefined {
    if (this.noIcon) return undefined;
    return this.icon ?? ICONS[this.variant];
  }

  private renderClose(): TemplateResult | typeof nothing {
    if (!this.dismissible) return nothing;
    return html`<button
      type="button"
      class="btn-close"
      aria-label=${this.dismissLabel}
      @click=${() => {
        this.dismissed = true;
        this.emit('lia-dismiss', { id: this.noteId });
      }}
    ></button>`;
  }

  protected override render(): unknown {
    if (this.dismissed) return nothing;
    return html`<div
      class=${cx('alert', `alert-${this.variant}`, 'd-flex', 'gap-2', this.noteClass)}
      role="note"
    >
      ${renderIcon(this.resolvedIcon, { class: 'mt-1' })}
      <div class="flex-grow-1 min-w-0">
        ${this.title ? html`<h6 class="alert-heading mb-1">${this.title}</h6>` : nothing}
        ${this.text ? html`<div>${this.rich ? renderRich(this.text) : this.text}</div>` : nothing}
        ${this.lightSlot.node}
      </div>
      ${this.renderClose()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-form-note': LiaFormNote;
  }
}
