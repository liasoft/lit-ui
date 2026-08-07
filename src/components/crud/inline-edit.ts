import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { SelectOption } from '../../core/types.js';
import { cx, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';

/** Controls `<lia-inline-edit>` can turn into while editing. */
export type InlineEditType = 'text' | 'number' | 'email' | 'url' | 'tel' | 'textarea' | 'select';

/** Detail of `lia-inline-save`. */
export interface InlineSaveDetail {
  /** The field name, so one listener can serve a whole table. */
  name: string;
  /** The value the user committed. */
  value: string;
  /** What it was before. */
  previous: string;
  /** Row context, when the editor sits in a table cell. */
  row?: unknown;
}

/** Detail of `lia-inline-cancel` and `lia-inline-start`. */
export interface InlineEditDetail {
  name: string;
  value: string;
  row?: unknown;
}

/**
 * An in-place single-field editor: the value reads as plain text until it is
 * clicked, then becomes an input with save and cancel buttons.
 *
 * Built for table cells, where opening a whole form page to change one string
 * is absurd. The element owns nothing but the draft: committing emits
 * `lia-inline-save` and it is up to you to persist the value and feed the new
 * one back in. For an asynchronous save, set `auto-close="false"`, flip
 * `saving` while the request runs and clear `editing` when it lands.
 *
 * Keyboard: <kbd>Enter</kbd> commits (<kbd>Ctrl</kbd>+<kbd>Enter</kbd> in a
 * textarea), <kbd>Esc</kbd> abandons, and the read-only view is a real button
 * so it is reachable by tab.
 *
 * @example
 * ```ts
 * html`<lia-inline-edit
 *   name="label"
 *   .value=${row.label}
 *   .row=${row}
 *   @lia-inline-save=${(e: CustomEvent) => api.patch(row.id, { label: e.detail.value })}
 * ></lia-inline-edit>`;
 * ```
 *
 * @example
 * ```ts
 * html`<lia-inline-edit
 *   name="status"
 *   type="select"
 *   .value=${row.status}
 *   .options=${[{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]}
 *   auto-close="false"
 *   .saving=${this.pending === row.id}
 *   @lia-inline-save=${(e: CustomEvent) => this.save(row, e.detail.value)}
 * ></lia-inline-edit>`;
 * ```
 */
@customElement('lia-inline-edit')
export class LiaInlineEdit extends LiaElement {
  /** Field name, echoed in every event. */
  @property({ type: String }) name = '';

  /** The committed value. Rendered as text when not editing. */
  @property({ type: String }) value = '';

  /** Control used while editing. */
  @property({ type: String }) type: InlineEditType = 'text';

  /** Options for `type="select"`. */
  @property({ attribute: false }) options: SelectOption[] = [];

  /** Whether the editor is open. Reflected so CSS can key off it. */
  @property({ type: Boolean, reflect: true }) editing = false;

  /** Show a spinner and lock the controls while a save is in flight. */
  @property({ type: Boolean }) saving = false;

  /** Make the field read-only: the value renders as plain text. */
  @property({ type: Boolean }) disabled = false;

  /** Close the editor as soon as the user commits. */
  @property({ converter: flag, attribute: 'auto-close' }) autoClose = true;

  /** Commit when the control loses focus, instead of discarding the draft. */
  @property({ type: Boolean, attribute: 'commit-on-blur' }) commitOnBlur = false;

  /** Text shown when {@link value} is empty. */
  @property({ type: String, attribute: 'empty-text' }) emptyText = '—';

  /** Overrides the read-only rendering, e.g. a formatted date. */
  @property({ type: String }) display?: string;

  @property({ type: String }) placeholder = '';

  /** Accessible name of the control; falls back to {@link name}. */
  @property({ type: String }) label = '';

  /** Native tooltip and accessible name of the read-only trigger. */
  @property({ type: String, attribute: 'edit-label' }) editLabel = 'Edit';

  @property({ type: String, attribute: 'save-label' }) saveLabel = 'Save';

  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = 'Cancel';

  /** Reject an empty value: saving is disabled until something is typed. */
  @property({ type: Boolean }) required = false;

  @property({ type: Number }) maxlength?: number;

  @property({ type: Number }) min?: number;

  @property({ type: Number }) max?: number;

  @property({ type: Number }) step?: number;

  /** Rows for `type="textarea"`. */
  @property({ type: Number }) rows = 2;

  /** Row context echoed in every event, for editors inside a listing. */
  @property({ attribute: false }) row?: unknown;

  /**
   * The last write was rejected. Any non-empty string marks the control
   * `is-invalid` and prints the message underneath; assign `''` to clear it.
   * Set this from your save handler — the component never validates remotely
   * on its own.
   */
  @property({ type: String }) error = '';

  /**
   * The last write landed. Marks the control `is-valid`, the counterpart of
   * {@link error}, so a debounced auto-save can confirm itself without a toast.
   */
  @property({ type: Boolean }) accepted = false;

  /** Uncommitted text. */
  @state() private draft = '';

  /** Set when the editor has just opened, so focus lands on the control once. */
  @state() private pendingFocus = false;

  private readonly controlId = uid('lia-inline');

  /** Open the editor and seed the draft from {@link value}. */
  start(): void {
    if (this.disabled || this.saving || this.editing) return;
    this.draft = this.value;
    this.editing = true;
    this.pendingFocus = true;
    this.emit<InlineEditDetail>('lia-inline-start', {
      name: this.name,
      value: this.value,
      row: this.row,
    });
  }

  /** Abandon the draft and close the editor. */
  cancel(): void {
    if (!this.editing) return;
    this.editing = false;
    this.draft = this.value;
    this.emit<InlineEditDetail>('lia-inline-cancel', {
      name: this.name,
      value: this.value,
      row: this.row,
    });
  }

  /**
   * Commit the draft. Emits `lia-inline-save` unless the value is unchanged,
   * in which case the editor simply closes — a no-op should not look like a
   * write to the listener.
   */
  save(): void {
    if (!this.editing || this.saving) return;
    const next = this.draft;
    if (this.required && next.trim() === '') return;
    const previous = this.value;
    if (next === previous) {
      this.editing = false;
      return;
    }
    this.value = next;
    if (this.autoClose) this.editing = false;
    this.emit<InlineSaveDetail>('lia-inline-save', {
      name: this.name,
      value: next,
      previous,
      row: this.row,
    });
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && !this.editing) this.draft = this.value;
  }

  protected override updated(): void {
    if (!this.pendingFocus || !this.editing) return;
    this.pendingFocus = false;
    const control = this.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `#${CSS.escape(this.controlId)}`
    );
    control?.focus();
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.select();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key !== 'Enter') return;
    // A textarea needs its Enter for line breaks.
    if (this.type === 'textarea' && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.save();
  }

  private handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    this.draft = target.value;
  }

  private handleBlur(event: FocusEvent): void {
    if (!this.commitOnBlur || !this.editing) return;
    // Ignore focus moving to our own save / cancel buttons.
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    this.save();
  }

  private renderControl(): TemplateResult {
    const shared = {
      id: this.controlId,
      name: this.name || nothing,
      'aria-label': this.label || this.name || this.editLabel,
      'aria-invalid': this.error ? 'true' : nothing,
      'aria-describedby': this.error ? this.feedbackId : nothing,
    };

    if (this.type === 'select') {
      return html`<select
        class=${cx('form-select', 'form-select-sm', this.validityClass)}
        id=${shared.id}
        name=${shared.name}
        aria-label=${shared['aria-label']}
        aria-invalid=${shared['aria-invalid']}
        aria-describedby=${shared['aria-describedby']}
        ?disabled=${this.saving}
        .value=${this.draft}
        @change=${(event: Event) => this.handleInput(event)}
        @keydown=${(event: KeyboardEvent) => this.handleKeydown(event)}
        @blur=${(event: FocusEvent) => this.handleBlur(event)}
      >
        ${this.options.map(
          (option) =>
            html`<option
              value=${String(option.value)}
              ?disabled=${option.disabled === true}
              ?selected=${String(option.value) === this.draft}
            >
              ${option.label}
            </option>`
        )}
      </select>`;
    }

    if (this.type === 'textarea') {
      return html`<textarea
        class=${cx('form-control', 'form-control-sm', this.validityClass)}
        id=${shared.id}
        name=${shared.name}
        aria-label=${shared['aria-label']}
        aria-invalid=${shared['aria-invalid']}
        aria-describedby=${shared['aria-describedby']}
        rows=${this.rows}
        placeholder=${this.placeholder || nothing}
        maxlength=${this.maxlength ?? nothing}
        ?disabled=${this.saving}
        ?required=${this.required}
        .value=${this.draft}
        @input=${(event: Event) => this.handleInput(event)}
        @keydown=${(event: KeyboardEvent) => this.handleKeydown(event)}
        @blur=${(event: FocusEvent) => this.handleBlur(event)}
      ></textarea>`;
    }

    return html`<input
      class=${cx('form-control', 'form-control-sm', this.validityClass)}
      type=${this.type}
      id=${shared.id}
      name=${shared.name}
      aria-label=${shared['aria-label']}
      aria-invalid=${shared['aria-invalid']}
      aria-describedby=${shared['aria-describedby']}
      placeholder=${this.placeholder || nothing}
      maxlength=${this.maxlength ?? nothing}
      min=${this.min ?? nothing}
      max=${this.max ?? nothing}
      step=${this.step ?? nothing}
      ?disabled=${this.saving}
      ?required=${this.required}
      .value=${this.draft}
      @input=${(event: Event) => this.handleInput(event)}
      @keydown=${(event: KeyboardEvent) => this.handleKeydown(event)}
      @blur=${(event: FocusEvent) => this.handleBlur(event)}
    />`;
  }

  private renderDisplay(): TemplateResult {
    const text = this.display ?? this.displayText;
    const empty = text === '';
    const body = html`<span class=${empty ? 'text-body-secondary' : nothing}
        >${empty ? this.emptyText : text}</span
      >
      ${this.disabled
        ? nothing
        : html`<i
            class="fa-solid fa-pen lia-inline-edit-pen ms-2 small text-body-secondary"
            aria-hidden="true"
          ></i>`}`;

    if (this.disabled) {
      return html`<span class="lia-inline-edit-value">${body}</span>`;
    }

    return html`<button
      type="button"
      class="lia-inline-edit-trigger btn btn-link btn-sm p-0 text-reset text-decoration-none text-start"
      title=${this.editLabel}
      ?disabled=${this.saving}
      @click=${() => this.start()}
    >
      ${body}
    </button>`;
  }

  /** `is-invalid` / `is-valid`, or nothing while the write's fate is unknown. */
  private get validityClass(): string {
    if (this.error) return 'is-invalid';
    return this.accepted ? 'is-valid' : '';
  }

  private get feedbackId(): string {
    return `${this.controlId}-feedback`;
  }

  /** The value as it reads when the editor is closed. */
  private get displayText(): string {
    if (this.type === 'select') {
      const match = this.options.find((option) => String(option.value) === this.value);
      if (match) return match.label;
    }
    return this.value;
  }

  protected override render(): TemplateResult {
    if (!this.editing) return this.renderDisplay();
    const blocked = this.saving || (this.required && this.draft.trim() === '');
    return html`<div class="lia-inline-edit input-group input-group-sm flex-nowrap">
      ${this.renderControl()}
      <button
        type="button"
        class="btn btn-outline-success"
        title=${this.saveLabel}
        aria-label=${this.saveLabel}
        ?disabled=${blocked}
        @click=${() => this.save()}
      >
        ${this.saving
          ? html`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`
          : html`<i class="fa-solid fa-check" aria-hidden="true"></i>`}
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        title=${this.cancelLabel}
        aria-label=${this.cancelLabel}
        ?disabled=${this.saving}
        @click=${() => this.cancel()}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      ${this.error
        ? html`<div id=${this.feedbackId} class="invalid-feedback d-block">${this.error}</div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-inline-edit': LiaInlineEdit;
  }
  interface HTMLElementEventMap {
    'lia-inline-save': CustomEvent<InlineSaveDetail>;
    'lia-inline-cancel': CustomEvent<InlineEditDetail>;
    'lia-inline-start': CustomEvent<InlineEditDetail>;
  }
}
