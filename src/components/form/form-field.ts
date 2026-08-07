import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { FormErrors, FormValues } from '../../core/types.js';
import { renderRich, uid } from '../../core/utils.js';
import {
  DEFAULT_FORM_FIELD_LABELS,
  fieldLabelDescription,
  fieldLabelTitle,
  initialFieldValue,
  interpolate,
  isFieldRequired,
  isFieldVisible,
  nextToNames,
  slugifyName,
  type ExtendedFormField,
  type FormFieldLabels,
} from './field-model.js';
import { labelTargetId, renderFieldGroup, type FieldControlContext } from './controls.js';
import { EMPTY_ASYNC_FIELD_STATE, type AsyncFieldState } from './async-fields.js';

/** Detail of `lia-field-blur`, the hook per-field live validation hangs off. */
export interface FieldBlurDetail {
  name: string;
}

declare global {
  interface HTMLElementEventMap {
    'lia-field-blur': CustomEvent<FieldBlurDetail>;
  }
}

/** How a field arranges its label and its control. */
export type FieldLayout = 'row' | 'floating' | 'plain';

/**
 * One field of a data-driven form: the label column, the control, the helper
 * note and the validation message.
 *
 * It renders **every** {@link FieldType} — from a plain `text` box to the
 * `textul` number-with-an-unlimited-toggle, the `image` uploader with its
 * preview and delete switch, and `custom`, which just calls your own
 * `field.render()`.
 *
 * ### Layouts
 *
 * | `layout`   | markup                                                        |
 * | ---------- | ------------------------------------------------------------- |
 * | `row`      | two columns: `col-sm-6` label + `col-sm-6` control (default)   |
 * | `floating` | Bootstrap `.form-floating`, for wizard-style single columns    |
 * | `plain`    | the control on its own — for bespoke layouts and modals        |
 *
 * ### Values
 *
 * The element is *controlled but self-healing*: it renders `values[name]` when
 * a value model is supplied, falls back to `value`, and finally to whatever
 * the definition declares. Edits are kept locally until a new `values` object
 * arrives, so it also works standalone with no parent form at all.
 *
 * @example
 * ```ts
 * html`<lia-form-field
 *   name="quota"
 *   .field=${{
 *     type: 'textul',
 *     label: { title: 'Disk quota (MiB)', description: 'Tick the box for unlimited.' },
 *     mandatory: true,
 *     maxlength: 9,
 *   }}
 *   .values=${values}
 *   .errors=${errors}
 *   @lia-change=${(e: CustomEvent) => (values = { ...values, [e.detail.name]: e.detail.value })}
 * ></lia-form-field>`
 * ```
 *
 * @example
 * ```html
 * <lia-form-field name="hostname" layout="floating"></lia-form-field>
 * ```
 */
@customElement('lia-form-field')
export class LiaFormField extends LiaElement {
  /** Key of this field in the value model. Also the default DOM id. */
  @property({ type: String }) name = '';

  /** The field definition. */
  @property({ attribute: false }) field: ExtendedFormField = { type: 'text' };

  /** The form's value model. Wins over {@link value} when it holds the key. */
  @property({ attribute: false }) values?: FormValues;

  /** Value for this field alone — the standalone shorthand for {@link values}. */
  @property({ attribute: false }) value?: unknown;

  /** Validation messages by field name, covering `nextTo` siblings too. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Single message shorthand for {@link errors}, applied to this field. */
  @property({ type: String }) error = '';

  /** Label/control arrangement. */
  @property({ type: String }) layout: FieldLayout = 'row';

  /** Shorthand for `layout="floating"`. */
  @property({ type: Boolean }) floating = false;

  /** Shorthand for `layout="plain"` — render the control without a row. */
  @property({ type: Boolean, attribute: 'no-row' }) noRow = false;

  /** Disable the control regardless of what the definition says. */
  @property({ type: Boolean }) disabled = false;

  /** Render `visible: false` fields anyway, disabled — the "show everything" mode. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Wrap the label in `<mark>`, to point at a setting someone deep-linked to. */
  @property({ type: Boolean }) highlight = false;

  /** Prefix for generated DOM ids, so two forms can share field names. */
  @property({ type: String, attribute: 'id-prefix' }) idPrefix = '';

  /** Overridable user-visible strings. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /**
   * Async progress handed down by `<lia-form>`: which fields are being checked
   * or loading their choices, and what those choices are.
   *
   * A `<lia-form-field>` used on its own never runs async rules — the form
   * owns the value model, so it owns the requests that judge it.
   */
  @property({ attribute: false }) asyncState: AsyncFieldState = EMPTY_ASYNC_FIELD_STATE;

  /** Edits made since the last `values` object arrived. */
  @state() private draft: FormValues = {};

  private readonly instanceId = uid('lia-field');

  protected override willUpdate(changed: PropertyValues<this>): void {
    // A fresh value model is the source of truth again.
    if (changed.has('values') || changed.has('value') || changed.has('field')) {
      if (Object.keys(this.draft).length > 0) this.draft = {};
    }
  }

  /* ---------------------------------------------------------------- *
   * Model access
   * ---------------------------------------------------------------- */

  /** The effective layout, resolving the boolean shorthands. */
  get resolvedLayout(): FieldLayout {
    if (this.noRow) return 'plain';
    if (this.floating) return 'floating';
    return this.layout;
  }

  /** DOM id for a field name inside this element. */
  idFor(name: string): string {
    const slug = slugifyName(name);
    return this.idPrefix ? `${this.idPrefix}-${slug}` : slug;
  }

  /** Current value of `name`, falling back to the definition's default. */
  valueFor(name: string, field?: ExtendedFormField): unknown {
    if (name in this.draft) return this.draft[name];
    if (this.values && name in this.values) return this.values[name];
    if (name === this.name && this.value !== undefined) return this.value;
    return field ? initialFieldValue(field) : undefined;
  }

  /** Validation message for `name`, if any. */
  errorFor(name: string): string | undefined {
    if (name === this.name && this.error) return this.error;
    const message = this.errors[name];
    return message === '' ? undefined : message;
  }

  /** Every message this row is responsible for: its own plus its siblings'. */
  get messages(): string[] {
    const names = [this.name, ...nextToNames(this.field)];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of names) {
      const message = this.errorFor(name);
      if (message && !seen.has(message)) {
        seen.add(message);
        out.push(message);
      }
    }
    if (out.length === 0 && this.field.valid === false && this.field.error) {
      out.push(this.field.error);
    }
    return out;
  }

  private handleChange(name: string, _field: ExtendedFormField, value: unknown): void {
    this.draft = { ...this.draft, [name]: value };
    const values: FormValues = { ...this.values, ...this.draft };
    this.emit('lia-change', { name, value, values });
  }

  private handleBlur(name: string): void {
    this.emit<FieldBlurDetail>('lia-field-blur', { name });
  }

  private get noteId(): string {
    return `${this.instanceId}-note`;
  }

  private get feedbackId(): string {
    return `${this.instanceId}-feedback`;
  }

  private get labelId(): string {
    return `${this.instanceId}-label`;
  }

  private get describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.field.note) ids.push(this.noteId);
    if (this.messages.length > 0) ids.push(this.feedbackId);
    return ids.length > 0 ? ids.join(' ') : undefined;
  }

  /**
   * The value model conditions are resolved against: the form's, with any
   * uncommitted local edits on top. `undefined` when the element is used
   * standalone with no model at all, which leaves conditions unevaluated.
   */
  get conditionValues(): FormValues | undefined {
    if (!this.values) return Object.keys(this.draft).length > 0 ? { ...this.draft } : undefined;
    return { ...this.values, ...this.draft };
  }

  /** The rendering context handed to the control functions. */
  get context(): FieldControlContext {
    return {
      idFor: (name) => this.idFor(name),
      valueOf: (name, field) => this.valueFor(name, field),
      change: (name, field, value) => this.handleChange(name, field, value),
      blur: (name) => this.handleBlur(name),
      errorOf: (name) => this.errorFor(name),
      describedBy: this.describedBy,
      disabled: this.disabled,
      values: this.conditionValues,
      inlineLabels: this.resolvedLayout !== 'row',
      labels: this.labels,
      optionsOf: (name) => this.asyncState.options.get(name),
      checkingOf: (name) => this.asyncState.validating.has(name),
      asyncValidOf: (name) => this.asyncState.clean.has(name),
      loadingOptionsOf: (name) => this.asyncState.loadingOptions.has(name),
    };
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  private renderMandatoryMark(): TemplateResult | typeof nothing {
    if (!isFieldRequired(this.field, this.conditionValues)) return nothing;
    return html`<span class="text-danger" aria-hidden="true">*</span
      ><span class="visually-hidden"> ${this.labels.mandatory}</span>`;
  }

  private renderReconf(): TemplateResult | typeof nothing {
    const items = this.field.requiresReconf;
    if (!items?.length) return nothing;
    // A <span> rather than the reference template's <div>: this lives inside a
    // <label>, which only accepts phrasing content.
    return html`<span
      class="bg-info bg-opacity-25 rounded p-2 mt-2 d-flex align-items-center"
      role="note"
    >
      <i class="fa-solid fa-circle-exclamation me-2" aria-hidden="true"></i>
      <span>${interpolate(this.labels.requiresReconfiguration, { items: items.join(', ') })}</span>
    </span>`;
  }

  private renderLabelContent(): TemplateResult {
    const title = fieldLabelTitle(this.field);
    const description = fieldLabelDescription(this.field);
    const heading = html`${renderRich(title)}${this.renderMandatoryMark()}`;
    return html`${this.highlight ? html`<mark>${heading}</mark>` : heading}
    ${
      description
        ? html`<br /><small class="text-body-secondary">${renderRich(description)}</small>`
        : nothing
    }
    ${
      this.field.desc
        ? html`<br /><small class="text-body-secondary">${renderRich(this.field.desc)}</small>`
        : nothing
    }
    ${this.renderReconf()}`;
  }

  private renderNote(): TemplateResult | typeof nothing {
    if (!this.field.note) return nothing;
    return html`<small id=${this.noteId} class="text-info d-block mt-1"
      >${renderRich(this.field.note)}</small
    >`;
  }

  private renderFeedback(): TemplateResult | typeof nothing {
    const messages = this.messages;
    if (messages.length === 0) return nothing;
    return html`<div id=${this.feedbackId} class="invalid-feedback d-block">
      ${messages.map((message) => html`<div>${message}</div>`)}
    </div>`;
  }

  private renderControl(floatingLabel?: string): unknown {
    const target = labelTargetId(this.name, this.field, this.context);
    return renderFieldGroup(this.name, this.field, this.context, {
      floatingLabel,
      floatingFor: target,
    });
  }

  private renderPlain(): TemplateResult {
    return html`${this.renderControl()}${this.renderNote()}${this.renderFeedback()}`;
  }

  private renderFloating(): TemplateResult {
    const title = fieldLabelTitle(this.field);
    const inlineLabelled =
      this.field.type === 'checkbox' || this.field.type === 'switch' || this.field.type === 'radio';
    return html`<div class="mb-3">
      ${inlineLabelled ? this.renderControl() : this.renderControl(title)}
      ${this.renderNote()}${this.renderFeedback()}
    </div>`;
  }

  private renderRow(): TemplateResult {
    const target = labelTargetId(this.name, this.field, this.context);
    const labelContent = this.renderLabelContent();
    const labelClasses = 'col-sm-6 col-form-label pe-3';

    return html`${
        this.field.priorInfotext
          ? html`<h5 class="lia-formfield-heading">${renderRich(this.field.priorInfotext)}</h5>`
          : nothing
      }
      <div class="row g-0 lia-formfield align-items-center">
        ${
          target
            ? html`<label for=${target} class=${labelClasses}>${labelContent}</label>`
            : html`<span id=${this.labelId} class=${labelClasses}>${labelContent}</span>`
        }
        <div
          class="col-sm-6"
          role=${target ? nothing : 'group'}
          aria-labelledby=${target ? nothing : this.labelId}
        >
          ${this.renderControl()}${this.renderNote()}${this.renderFeedback()}
        </div>
      </div>`;
  }

  protected override render(): unknown {
    if (!isFieldVisible(this.field, this.conditionValues) && !this.showHidden) return nothing;

    // A hidden input with nothing to show has no row to sit in.
    if (this.field.type === 'hidden' && !this.field.display) {
      return this.renderControl();
    }

    switch (this.resolvedLayout) {
      case 'plain':
        return this.renderPlain();
      case 'floating':
        return this.renderFloating();
      default:
        return this.renderRow();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-form-field': LiaFormField;
  }
}
