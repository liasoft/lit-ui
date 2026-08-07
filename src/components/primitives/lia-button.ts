import { type TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type {
  ActionDescriptor,
  ConfirmDescriptor,
  ModalDescriptor,
  Size,
  Variant,
} from '../../core/types.js';
import { renderAction } from './render-action.js';

/** Drop `undefined` entries so a partial descriptor does not erase defaults. */
function defined(source: ActionDescriptor): Partial<ActionDescriptor> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<ActionDescriptor>;
}

/**
 * A Bootstrap button — or a link that looks like one.
 *
 * Renders an `<a role="button">` when `href` (or `modal`) is set and a
 * `<button>` otherwise. Configure it either with individual properties or by
 * handing it a whole {@link ActionDescriptor} via `.action`; the descriptor
 * wins wherever it defines a value.
 *
 * Activating the button emits a cancelable `lia-action`. When the action
 * carries a `confirm`, a cancelable `lia-action-confirm-request` is emitted
 * first — the feedback family's confirm dialog claims it, and if nothing does
 * the browser's native confirm is used as a fallback. For `modal` actions the
 * Bootstrap `data-bs-toggle` attributes are wired instead and no event fires.
 *
 * @example
 * ```html
 * <lia-button label="Add entry" icon="fa-solid fa-plus" variant="primary"></lia-button>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-button
 *   .action=${{
 *     id: 'delete',
 *     icon: 'fa-solid fa-trash',
 *     title: 'Delete',
 *     variant: 'outline-danger',
 *     size: 'sm',
 *     confirm: { message: 'Delete this entry?', confirmLabel: 'Delete' },
 *   }}
 *   .row=${row}
 *   @lia-action=${(e: CustomEvent) => remove(e.detail.row)}
 * ></lia-button>`;
 * ```
 */
@customElement('lia-button')
export class LiaButton extends LiaElement {
  /** Complete descriptor. Its defined fields override the individual props. */
  @property({ attribute: false }) action?: ActionDescriptor;

  /** Identifier echoed back as `detail.id`. */
  @property({ type: String, attribute: 'action-id' }) actionId = '';

  /** Visible text. */
  @property({ type: String }) label = '';

  /** Icon-font class string rendered before the label. */
  @property({ type: String }) icon = '';

  /** Renders an anchor instead of a button. */
  @property({ type: String }) href = '';

  /** Anchor target. `_blank` also sets `rel="noopener noreferrer"`. */
  @property({ type: String }) target?: ActionDescriptor['target'];

  /** Native tooltip and, for icon-only buttons, the accessible name. */
  @property({ type: String }) override title = '';

  /** Bootstrap contextual style, e.g. `primary` or `outline-danger`. */
  @property({ type: String }) variant: Variant | `outline-${Variant}` = 'primary';

  /** `sm` / `md` / `lg`; `md` renders no size class. */
  @property({ type: String }) size: Size = 'md';

  @property({ type: Boolean }) disabled = false;

  /** Show a spinner in place of the icon and block interaction. */
  @property({ type: Boolean }) loading = false;

  /** Hide the label below the `lg` breakpoint, keeping the icon. */
  @property({ type: Boolean, attribute: 'label-responsive' }) labelResponsive = false;

  /** Stretch the control to the full width of its container. */
  @property({ type: Boolean }) block = false;

  /** `type` of the underlying `<button>`. Ignored when `href` is set. */
  @property({ type: String }) type: 'button' | 'submit' | 'reset' = 'button';

  /** Ask before emitting `lia-action`. */
  @property({ attribute: false }) confirm?: ConfirmDescriptor;

  /** Open this Bootstrap modal instead of emitting an action. */
  @property({ attribute: false }) modal?: ModalDescriptor;

  /** Arbitrary payload echoed back on the action descriptor. */
  @property({ attribute: false }) data?: Record<string, unknown>;

  /** Row context echoed back as `detail.row` (table cells). */
  @property({ attribute: false }) row?: unknown;

  /** Row index echoed back as `detail.index`. */
  @property({ type: Number }) index?: number;

  /** Extra classes for the rendered `<button>`/`<a>` (not the host). */
  @property({ type: String, attribute: 'button-class' }) buttonClass = '';

  /** The descriptor actually rendered — props first, `.action` on top. */
  get descriptor(): ActionDescriptor {
    const base: ActionDescriptor = {
      id: this.actionId || undefined,
      label: this.label || undefined,
      icon: this.icon || undefined,
      href: this.href || undefined,
      target: this.target,
      title: this.title || undefined,
      variant: this.variant,
      size: this.size,
      disabled: this.disabled,
      labelResponsive: this.labelResponsive,
      confirm: this.confirm,
      modal: this.modal,
      data: this.data,
    };
    return this.action ? { ...base, ...defined(this.action) } : base;
  }

  override render(): TemplateResult | typeof nothing {
    return renderAction(this.descriptor, {
      host: this,
      row: this.row,
      index: this.index,
      type: this.type,
      loading: this.loading,
      class: cx(this.block && 'w-100', this.buttonClass),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-button': LiaButton;
  }
}
