import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ConfirmDescriptor, IconName, Size, Variant } from '../../core/types.js';
import {
  confirmActionWithOptions,
  type ConfirmOption,
  type ConfirmResult,
} from '../feedback/confirm-dialog.js';

/** Copy used to build a delete prompt. All of it is overridable. */
export interface DeletePromptText {
  /** What kind of thing is being removed, e.g. `entry`, `user`, `record`. */
  entityType?: string;
  /** Which one, e.g. `acme-corp`. */
  entity?: string;
  /** Dialog heading. `{type}` and `{entity}` are substituted. */
  title?: string;
  /** Dialog body. `{type}` and `{entity}` are substituted. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

const DEFAULT_TEXT: Required<Pick<DeletePromptText, 'entityType' | 'title' | 'message'>> & {
  confirmLabel: string;
  cancelLabel: string;
} = {
  entityType: 'entry',
  title: 'Delete {type}?',
  message: 'Do you really want to delete the {type} “{entity}”? This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
};

function fill(template: string, type: string, entity: string): string {
  return template.replace(/\{type\}/g, type).replace(/\{entity\}/g, entity);
}

/**
 * Build the {@link ConfirmDescriptor} for a delete prompt.
 *
 * Useful on its own: hang it on any `ActionDescriptor.confirm` and the shared
 * confirm handler will show exactly the same dialog the element does.
 *
 * @example
 * ```ts
 * const action = {
 *   id: 'delete',
 *   icon: 'fa-solid fa-trash-can',
 *   variant: 'outline-danger',
 *   confirm: deletePrompt({ entity: row.name, entityType: 'project' }),
 * } satisfies ActionDescriptor;
 * ```
 */
export function deletePrompt(text: DeletePromptText = {}): ConfirmDescriptor {
  const type = text.entityType ?? DEFAULT_TEXT.entityType;
  const entity = text.entity ?? '';
  const message = text.message ?? DEFAULT_TEXT.message;
  return {
    title: fill(text.title ?? DEFAULT_TEXT.title, type, entity),
    // Without a name to quote, the generic sentence reads better.
    message: entity
      ? fill(message, type, entity)
      : fill(message.replace(/\s*“\{entity\}”/g, ''), type, entity),
    confirmLabel: text.confirmLabel ?? DEFAULT_TEXT.confirmLabel,
    cancelLabel: text.cancelLabel ?? DEFAULT_TEXT.cancelLabel,
    variant: 'danger',
  };
}

/**
 * Ask for a delete confirmation anywhere, without placing an element.
 *
 * Routes through the feedback family's singleton dialog, so the prompt looks
 * the same wherever it comes from.
 *
 * @example
 * ```ts
 * if ((await confirmDelete({ entity: row.name })).confirmed) await api.remove(row.id);
 * ```
 */
export function confirmDelete(
  text: DeletePromptText & { options?: ConfirmOption[] } = {}
): Promise<ConfirmResult> {
  return confirmActionWithOptions({
    ...deletePrompt(text),
    icon: 'fa-solid fa-triangle-exclamation',
    options: text.options,
  });
}

/** Detail of `lia-delete` and `lia-delete-cancel`. */
export interface DeleteEventDetail {
  /** The name that was quoted in the prompt. */
  entity: string;
  /** The kind of thing that was removed. */
  entityType: string;
  /** Values of the extra switches shown in the dialog. */
  options: Record<string, boolean>;
  /** Arbitrary payload from {@link LiaDeleteConfirm.data}. */
  data?: Record<string, unknown>;
}

/**
 * The delete affordance: a danger-styled button that always asks first.
 *
 * The prompt is pre-built from the entity name and type, styled `danger`, and
 * opens focused on *cancel* so a stray <kbd>Enter</kbd> cannot destroy
 * anything. Extra opt-ins ("also remove its files") ride along as
 * {@link ConfirmOption}s and come back in the event.
 *
 * Only `lia-delete` means "go ahead" — a dismissed dialog emits
 * `lia-delete-cancel` instead, so a listener can never mistake one for the
 * other.
 *
 * @example
 * ```ts
 * html`<lia-delete-confirm
 *   entity=${row.name}
 *   entity-type="project"
 *   .data=${{ id: row.id }}
 *   @lia-delete=${(e: CustomEvent) => api.remove(e.detail.data.id)}
 * ></lia-delete-confirm>`;
 * ```
 *
 * @example
 * ```ts
 * // Trigger-less: opened from your own button, or from a row action.
 * html`<lia-delete-confirm
 *   hide-trigger
 *   entity=${this.target?.name ?? ''}
 *   .options=${[{ name: 'purge', label: 'Also delete stored files' }]}
 *   @lia-delete=${(e: CustomEvent) => this.remove(e.detail.options.purge)}
 * ></lia-delete-confirm>`;
 * ```
 */
@customElement('lia-delete-confirm')
export class LiaDeleteConfirm extends LiaElement {
  /** Name of the thing being deleted; quoted in the prompt. */
  @property({ type: String }) entity = '';

  /** What kind of thing it is; used in the heading and the sentence. */
  @property({ type: String, attribute: 'entity-type' }) entityType = DEFAULT_TEXT.entityType;

  /** Overrides the heading. `{type}` and `{entity}` are substituted. */
  @property({ type: String }) heading?: string;

  /** Overrides the body. `{type}` and `{entity}` are substituted. */
  @property({ type: String }) message?: string;

  /** Extra switches shown inside the dialog. */
  @property({ attribute: false }) options?: ConfirmOption[];

  /** Arbitrary payload echoed back on the event — typically the row id. */
  @property({ attribute: false }) data?: Record<string, unknown>;

  /** Label of the trigger button. Empty renders an icon-only button. */
  @property({ type: String }) label = '';

  /** Icon of the trigger button. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-trash-can';

  /**
   * Tooltip and accessible name of the trigger button.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute on the host.
   */
  @property({ type: String }) override title = 'Delete';

  @property({ type: String }) variant: Variant | `outline-${Variant}` = 'outline-danger';

  @property({ type: String }) size: Size = 'sm';

  /** Render no button — drive the flow with {@link request} instead. */
  @property({ type: Boolean, attribute: 'hide-trigger' }) hideTrigger = false;

  @property({ type: Boolean }) disabled = false;

  /** Show a spinner on the trigger while the deletion runs. */
  @property({ type: Boolean }) busy = false;

  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = DEFAULT_TEXT.confirmLabel;

  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = DEFAULT_TEXT.cancelLabel;

  /** The prompt this element would show, for reuse on an `ActionDescriptor`. */
  get prompt(): ConfirmDescriptor {
    return deletePrompt({
      entity: this.entity,
      entityType: this.entityType,
      title: this.heading,
      message: this.message,
      confirmLabel: this.confirmLabel,
      cancelLabel: this.cancelLabel,
    });
  }

  /**
   * Open the dialog and report the answer. Emits `lia-delete` when the user
   * agrees and `lia-delete-cancel` when they do not.
   */
  async request(): Promise<ConfirmResult> {
    const result = await confirmActionWithOptions({
      ...this.prompt,
      icon: 'fa-solid fa-triangle-exclamation',
      options: this.options,
      data: this.data,
    });
    const detail: DeleteEventDetail = {
      entity: this.entity,
      entityType: this.entityType,
      options: result.options,
      data: this.data,
    };
    this.emit<DeleteEventDetail>(result.confirmed ? 'lia-delete' : 'lia-delete-cancel', detail);
    return result;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.hideTrigger) return nothing;
    const sizeClass = this.size === 'md' ? '' : ` btn-${this.size}`;
    return html`<button
      type="button"
      class="btn btn-${this.variant}${sizeClass}"
      title=${this.title}
      aria-label=${this.label ? nothing : this.title}
      aria-busy=${this.busy ? 'true' : nothing}
      ?disabled=${this.disabled || this.busy}
      @click=${() => void this.request()}
    >
      ${this.busy
        ? html`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`
        : html`<i class="${this.icon}" aria-hidden="true"></i>`}
      ${this.label ? html`<span class="ms-1">${this.label}</span>` : nothing}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-delete-confirm': LiaDeleteConfirm;
  }
  interface HTMLElementEventMap {
    'lia-delete': CustomEvent<DeleteEventDetail>;
    'lia-delete-cancel': CustomEvent<DeleteEventDetail>;
  }
}
