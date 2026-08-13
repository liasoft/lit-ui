import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, ModalDescriptor } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';
import { renderActionRow } from './internal.js';
import { ModalController, modalSizeClass } from './modal-controller.js';

/** Detail of `lia-modal-show` / `lia-modal-hide`. */
export interface ModalToggleDetail {
  /** The DOM id of the `.modal` element. */
  id: string;
}

/**
 * A real Bootstrap 5 modal, driven by a property.
 *
 * The dialog can be opened either way round and stays in sync: set `open` and
 * it shows, and when the user closes it with <kbd>Esc</kbd>, the backdrop or
 * the ✕ button, `open` flips back to `false` and `lia-modal-hide` fires. The
 * Bootstrap instance, the backdrop and the `modal-open` body class are all
 * cleaned up when the element leaves the document — including the awkward case
 * of a route change while the dialog is still on screen.
 *
 * Body content comes from light-DOM children, from a `.content` template or
 * from the trusted HTML on a {@link ModalDescriptor}.
 *
 * @example
 * ```html
 * <lia-modal heading="Server details" size="lg" centered>
 *   <p>Anything you write here becomes the modal body.</p>
 * </lia-modal>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-modal
 *   .open=${this.editing}
 *   heading="Edit entry"
 *   size="lg"
 *   .content=${html`<lia-form .definition=${this.form}></lia-form>`}
 *   .footerActions=${[
 *     { id: 'cancel', label: 'Cancel', variant: 'secondary' },
 *     { id: 'save', label: 'Save', variant: 'primary' },
 *   ]}
 *   @lia-modal-hide=${() => (this.editing = false)}
 *   @lia-action=${(e) => this.run(e.detail.action)}
 * ></lia-modal>`
 * ```
 */
@customElement('lia-modal')
export class LiaModal extends LiaElement {
  /** Whether the dialog is on screen. Reflected as an attribute. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Dialog heading. */
  @property({ type: String }) heading?: string;

  /**
   * A {@link ModalDescriptor} — the shape carried by `ActionDescriptor.modal`.
   * Supplies id, title, body, size, centered and scrollable in one go;
   * individual properties still win.
   */
  @property({ attribute: false }) descriptor?: ModalDescriptor;

  /** DOM id of the `.modal` element, so `data-bs-target="#…"` can find it. */
  @property({ type: String, attribute: 'modal-id' }) modalId?: string;

  /** `sm` | `lg` | `xl` | `fullscreen`, with or without the `modal-` prefix. */
  @property({ type: String }) size?: string;

  /** Vertically centre the dialog. */
  @property({ type: Boolean }) centered?: boolean;

  /** Scroll the body instead of the page when the content is tall. */
  @property({ type: Boolean }) scrollable?: boolean;

  /** Keep the dialog open when the backdrop or <kbd>Esc</kbd> is used. */
  @property({ type: Boolean, attribute: 'static-backdrop' }) staticBackdrop = false;

  /** Accessible name of the header close button, also the default footer label. */
  @property({ type: String }) closeLabel = 'Close';

  /** Buttons rendered in the footer. Falls back to a single close button. */
  @property({ attribute: false }) footerActions?: ActionDescriptor[];

  /** Drop the footer entirely. */
  @property({ type: Boolean, attribute: 'hide-footer' }) hideFooter = false;

  /** Drop the header entirely (the dialog is then only closable from content). */
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;

  /** Renderable body content — wins over light-DOM children and `descriptor.body`. */
  @property({ attribute: false }) content?: unknown;

  /** Trusted HTML body, as an alternative to {@link content}. */
  @property({ type: String, attribute: 'body-html' }) bodyHtml?: string;

  /** Extra classes on `.modal-dialog`. */
  @property({ type: String, attribute: 'dialog-class' }) dialogClass?: string;

  /** Extra classes on `.modal-body`. */
  @property({ type: String, attribute: 'body-class' }) bodyClass?: string;

  private readonly titleId = uid('lia-modal-title');
  private readonly fallbackId = uid('lia-modal');
  /** Holds the children the consumer wrote between the tags. */
  private readonly lightSlot = new LightSlot();

  private readonly modal = new ModalController(
    this,
    {},
    {
      onShown: () => {
        this.open = true;
        this.emit<ModalToggleDetail>('lia-modal-show', { id: this.resolvedId });
      },
      onHidden: () => {
        this.open = false;
        this.emit<ModalToggleDetail>('lia-modal-hide', { id: this.resolvedId });
      },
    }
  );

  /** The DOM id the `.modal` element is rendered with. */
  get resolvedId(): string {
    return this.modalId ?? this.descriptor?.id ?? this.fallbackId;
  }

  /** The `.modal` element, once rendered. */
  get modalElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>(':scope > .modal');
  }

  /** Open the dialog. */
  show(): void {
    this.open = true;
  }

  /** Close the dialog. */
  hide(): void {
    this.open = false;
  }

  /** Flip the dialog's state. */
  toggle(): void {
    this.open = !this.open;
  }

  override connectedCallback(): void {
    // Lift the authored children out before lit renders over the top of them;
    // they are handed back to the template as a plain DOM node, which lit-html
    // commits verbatim, so their identity and listeners survive re-renders.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  protected override firstUpdated(): void {
    const element = this.modalElement;
    if (element) this.modal.attach(element, this.bootstrapConfig());
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('staticBackdrop')) this.modal.configure(this.bootstrapConfig());
    if (changed.has('open')) {
      if (this.open) this.modal.show();
      else this.modal.hide();
    }
  }

  private bootstrapConfig(): { backdrop: boolean | 'static'; keyboard: boolean; focus: boolean } {
    return {
      backdrop: this.staticBackdrop ? 'static' : true,
      keyboard: !this.staticBackdrop,
      focus: true,
    };
  }

  private renderFooter(): TemplateResult | typeof nothing {
    if (this.hideFooter) return nothing;
    const actions = (this.footerActions ?? []).filter((action) => action.visible !== false);
    if (actions.length === 0) {
      return html`<div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click=${() => this.hide()}>
          ${this.closeLabel}
        </button>
      </div>`;
    }
    return html`<div class="modal-footer">
      ${renderActionRow(this.footerActions, 'justify-content-end', {
        host: this,
        variant: 'secondary',
      })}
    </div>`;
  }

  protected override render(): TemplateResult {
    const title = this.heading ?? this.descriptor?.title ?? '';
    const body =
      this.content !== undefined && this.content !== null
        ? this.content
        : this.bodyHtml
          ? renderRich(this.bodyHtml)
          : this.descriptor?.body
            ? renderRich(this.descriptor.body)
            : nothing;
    // Authored children always render too, after any declarative body.
    const dialogClasses = cx(
      'modal-dialog',
      modalSizeClass(this.size ?? this.descriptor?.size),
      (this.centered ?? this.descriptor?.centered) === true ? 'modal-dialog-centered' : '',
      (this.scrollable ?? this.descriptor?.scrollable) === true ? 'modal-dialog-scrollable' : '',
      this.dialogClass
    );

    // NOTE: the `class` attribute on `.modal` is deliberately static. Bootstrap
    // owns the `show` class on that element, and a lit attribute binding would
    // rewrite the whole attribute and clobber it mid-transition. Dynamic
    // classes go on `.modal-dialog`, which Bootstrap never touches.
    return html`<div
      class="modal fade"
      id=${this.resolvedId}
      tabindex="-1"
      aria-labelledby=${ifDefined(this.hideHeader ? undefined : this.titleId)}
      aria-label=${ifDefined(this.hideHeader ? title || 'Dialog' : undefined)}
      aria-hidden="true"
    >
      <div class=${dialogClasses}>
        <div class="modal-content">
          ${this.hideHeader
            ? nothing
            : html`<div class="modal-header">
                <h5 class="modal-title" id=${this.titleId}>${title}</h5>
                <button
                  type="button"
                  class="btn-close"
                  aria-label=${this.closeLabel}
                  @click=${() => this.hide()}
                ></button>
              </div>`}
          <div class=${cx('modal-body', this.bodyClass)}>${body}${this.lightSlot.node}</div>
          ${this.renderFooter()}
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-modal': LiaModal;
  }
  interface HTMLElementEventMap {
    'lia-modal-show': CustomEvent<ModalToggleDetail>;
    'lia-modal-hide': CustomEvent<ModalToggleDetail>;
  }
}
