/**
 * The control renderers of the form system.
 *
 * These are plain functions rather than elements on purpose: Bootstrap's
 * `.input-group` styles only reach **direct** children, so the inputs of a
 * `nextTo` group must sit next to each other in the DOM with nothing in
 * between. Rendering them functionally also keeps a hundred-row settings page
 * down to a hundred custom elements instead of several hundred.
 *
 * `<lia-form-field>` composes these into a labelled row; you only need them
 * directly if you are building a bespoke layout.
 */

import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { cx, renderRich } from '../../core/utils.js';
import type { FormValues, SelectOption } from '../../core/types.js';
import { hasAsyncBehaviour, hasDependentOptions } from './async-fields.js';
import {
  coerceOptionValue,
  DEFAULT_FORM_FIELD_LABELS,
  fieldChoices,
  fieldLabelTitle,
  groupOptions,
  imageDeleteName,
  initialFieldValue,
  interpolate,
  isFieldDisabled,
  isFieldReadonly,
  isFieldRequired,
  isFieldVisible,
  isOptionSelected,
  isSingleToggle,
  slugifyName,
  toBoolean,
  toNumber,
  toValueArray,
  unlimitedName,
  type ExtendedFormField,
  type FormFieldLabels,
} from './field-model.js';
import '../primitives/lia-copy-button.js';

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

/**
 * Everything a control needs from its host: where its value lives, where a new
 * value goes, and how it is identified in the document.
 */
export interface FieldControlContext {
  /** DOM id for a field name. Must be stable across renders. */
  idFor(name: string): string;
  /**
   * Current value of a field. `field` is the definition to fall back to when
   * the value model has no entry yet; omit it for companion names such as
   * `logo_delete`.
   */
  valueOf(name: string, field?: ExtendedFormField): unknown;
  /** Report a new value for a field. */
  change(name: string, field: ExtendedFormField, value: unknown): void;
  /** A control lost focus — the hook live validation hangs off. */
  blur?: (name: string, field: ExtendedFormField) => void;
  /** Validation message for a field, if it currently has one. */
  errorOf?: (name: string) => string | undefined;
  /** Ids to expose as `aria-describedby` on the primary control. */
  describedBy?: string;
  /** Disable every control (the form is submitting, or read-only). */
  disabled?: boolean;
  /**
   * The whole value model, so `disabledWhen` / `readonlyWhen` / `requiredWhen`
   * can be resolved. Omit it and only the static flags count.
   */
  values?: FormValues;
  /**
   * Render the field's own label next to check boxes, switches and radios.
   * Off in the two-column row layout, where the label sits in the left column.
   */
  inlineLabels?: boolean;
  /** User-visible strings. */
  labels: FormFieldLabels;

  /* ----- asynchronous state, supplied by `<lia-form>` ---------------- */

  /**
   * The choices a dependent field currently has, overriding its own `options`
   * / `values`. Return `undefined` to fall back to the definition.
   */
  optionsOf?: (name: string) => SelectOption[] | undefined;
  /** An {@link AsyncRule} is queued or in flight for this field. */
  checkingOf?: (name: string) => boolean;
  /** Every async rule of this field has come back happy for the current value. */
  asyncValidOf?: (name: string) => boolean;
  /** An `optionsLoader` is out for this field. */
  loadingOptionsOf?: (name: string) => boolean;
}

/** A context with sensible no-op defaults, for one-off rendering. */
export function createControlContext(
  overrides: Partial<FieldControlContext> = {}
): FieldControlContext {
  return {
    idFor: (name) => slugifyName(name),
    valueOf: (_name, field) => (field ? initialFieldValue(field) : undefined),
    change: () => undefined,
    labels: DEFAULT_FORM_FIELD_LABELS,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** Is this field currently rejected, either by the server or by validation? */
export function isFieldInvalid(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): boolean {
  return field.valid === false || Boolean(context.errorOf?.(name));
}

/**
 * Is this control disabled right now? The form-wide flag, the field's own
 * `disabled`, its `disabledWhen` condition, and `visible: false` (which the
 * reference template also renders as a disabled control) all count.
 */
export function isDisabled(field: ExtendedFormField, context: FieldControlContext): boolean {
  if (context.disabled === true || field.visible === false) return true;
  return isFieldDisabled(field, context.values);
}

/** Is this control read-only right now — `readonly`, or `readonlyWhen` holding? */
export function isReadonly(field: ExtendedFormField, context: FieldControlContext): boolean {
  return isFieldReadonly(field, context.values);
}

/** Does this control demand a value right now — `mandatory`, or `requiredWhen` holding? */
export function isRequired(field: ExtendedFormField, context: FieldControlContext): boolean {
  if (field.mandatory === true) return true;
  if (field.requiredWhen === undefined) return false;
  // No model to resolve against: leave the browser out of it rather than
  // demanding a value the condition may well not want.
  return context.values ? isFieldRequired(field, context.values) : false;
}

/* ------------------------------------------------------------------ *
 * Asynchronous state
 * ------------------------------------------------------------------ */

/**
 * The `<option>`s a select should render: the resolved list of a dependent
 * field, or the definition's own.
 */
export function resolvedOptions(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): SelectOption[] {
  return context.optionsOf?.(name) ?? field.options ?? [];
}

/** The same, for the check box and radio groups that read `values` first. */
export function resolvedChoices(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): SelectOption[] {
  return context.optionsOf?.(name) ?? fieldChoices(field);
}

/** Is anything asynchronous out for this field — a rule, or its options? */
export function isFieldBusy(name: string, context: FieldControlContext): boolean {
  return context.checkingOf?.(name) === true || context.loadingOptionsOf?.(name) === true;
}

/**
 * Should this control wear Bootstrap's `is-valid`? Only a field that actually
 * asked a server earns the green tick — a plain `text` box that merely happens
 * to be filled in does not.
 */
export function isAsyncValid(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): boolean {
  if (isFieldInvalid(name, field, context)) return false;
  return context.asyncValidOf?.(name) === true;
}

/** Render any value as the string an `<input>` expects. */
export function inputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

/** Strip markup so a copy button puts readable text on the clipboard. */
function plainText(value: string): string {
  if (!value.includes('<')) return value.trim();
  const template = document.createElement('template');
  template.innerHTML = value;
  return (template.content.textContent ?? '').trim();
}

function readInputValue(target: HTMLInputElement, field: ExtendedFormField): unknown {
  if (field.type === 'number') {
    if (target.value === '') return '';
    const parsed = target.valueAsNumber;
    return Number.isNaN(parsed) ? target.value : parsed;
  }
  return target.value;
}

/* ------------------------------------------------------------------ *
 * Text-like inputs
 * ------------------------------------------------------------------ */

function renderTextInput(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const invalid = isFieldInvalid(name, field, context);
  const isNumber = field.type === 'number';
  return html`<input
    type=${field.type}
    id=${id}
    name=${name}
    class=${cx(
      'form-control',
      invalid && 'is-invalid',
      isAsyncValid(name, field, context) && 'is-valid',
      field.class
    )}
    .value=${live(inputString(context.valueOf(name, field)))}
    placeholder=${ifDefined(field.placeholder)}
    autocomplete=${ifDefined(field.autocomplete)}
    min=${ifDefined(isNumber ? field.min : undefined)}
    max=${ifDefined(isNumber ? field.max : undefined)}
    step=${ifDefined(isNumber ? field.step : undefined)}
    maxlength=${ifDefined(isNumber ? undefined : field.maxlength)}
    pattern=${ifDefined(field.pattern)}
    aria-describedby=${ifDefined(context.describedBy)}
    aria-invalid=${invalid ? 'true' : nothing}
    ?required=${isRequired(field, context)}
    ?readonly=${isReadonly(field, context)}
    ?disabled=${isDisabled(field, context)}
    @input=${(event: Event) =>
      context.change(name, field, readInputValue(event.currentTarget as HTMLInputElement, field))}
    @blur=${() => context.blur?.(name, field)}
  />`;
}

function renderFileInput(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const invalid = isFieldInvalid(name, field, context);
  return html`<input
    type="file"
    id=${context.idFor(name)}
    name=${name}
    class=${cx('form-control', invalid && 'is-invalid', field.class)}
    accept=${ifDefined(field.accept)}
    aria-describedby=${ifDefined(context.describedBy)}
    aria-invalid=${invalid ? 'true' : nothing}
    ?multiple=${field.multiple === true}
    ?required=${isRequired(field, context)}
    ?disabled=${isDisabled(field, context)}
    @change=${(event: Event) =>
      context.change(name, field, (event.currentTarget as HTMLInputElement).files)}
    @blur=${() => context.blur?.(name, field)}
  />`;
}

function renderHidden(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  return html`<input
      type="hidden"
      id=${id}
      name=${name}
      .value=${live(inputString(context.valueOf(name, field)))}
    />
    ${
      field.display
        ? html`<input
            type="text"
            id=${`${id}_display`}
            class="form-control-plaintext"
            readonly
            .value=${live(field.display)}
          />`
        : nothing
    }`;
}

function renderTextarea(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const invalid = isFieldInvalid(name, field, context);
  return html`<textarea
    id=${context.idFor(name)}
    name=${name}
    class=${cx(
      'form-control',
      invalid && 'is-invalid',
      isAsyncValid(name, field, context) && 'is-valid',
      field.class
    )}
    rows=${field.rows ?? 5}
    cols=${ifDefined(field.cols)}
    maxlength=${ifDefined(field.maxlength)}
    placeholder=${ifDefined(field.placeholder)}
    aria-describedby=${ifDefined(context.describedBy)}
    aria-invalid=${invalid ? 'true' : nothing}
    ?required=${isRequired(field, context)}
    ?readonly=${isReadonly(field, context)}
    ?disabled=${isDisabled(field, context)}
    .value=${live(inputString(context.valueOf(name, field)))}
    @input=${(event: Event) =>
      context.change(name, field, (event.currentTarget as HTMLTextAreaElement).value)}
    @blur=${() => context.blur?.(name, field)}
  ></textarea>`;
}

/* ------------------------------------------------------------------ *
 * Select
 * ------------------------------------------------------------------ */

function renderOption(option: SelectOption, value: unknown): TemplateResult {
  return html`<option
    value=${String(option.value)}
    ?disabled=${option.disabled === true}
    .selected=${live(isOptionSelected(option, value))}
  >
    ${option.label}
  </option>`;
}

function renderSelect(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const invalid = isFieldInvalid(name, field, context);
  const value = context.valueOf(name, field);
  const multiple = field.multiple === true;
  const options = resolvedOptions(name, field, context);
  const loading = context.loadingOptionsOf?.(name) === true;
  const onChange = (event: Event): void => {
    const select = event.currentTarget as HTMLSelectElement;
    const next = multiple
      ? Array.from(select.selectedOptions).map((option) =>
          coerceOptionValue(options, option.value)
        )
      : coerceOptionValue(options, select.value);
    context.change(name, field, next);
  };

  // A list that changes under the user needs somewhere for the selection to
  // land once its option is gone. Without this seat the browser silently
  // highlights the first entry while the model still holds `''` — the select
  // would *look* answered and post nothing.
  const orphaned =
    !multiple &&
    hasDependentOptions(field) &&
    !options.some((option) => isOptionSelected(option, value));

  return html`<select
    id=${context.idFor(name)}
    name=${multiple ? `${name}[]` : name}
    class=${cx(
      'form-select',
      invalid && 'is-invalid',
      isAsyncValid(name, field, context) && 'is-valid',
      field.class
    )}
    aria-describedby=${ifDefined(context.describedBy)}
    aria-invalid=${invalid ? 'true' : nothing}
    aria-busy=${loading ? 'true' : nothing}
    ?multiple=${multiple}
    ?required=${isRequired(field, context)}
    ?disabled=${isDisabled(field, context) || isReadonly(field, context) || loading}
    @change=${onChange}
    @blur=${() => context.blur?.(name, field)}
  >
    ${
      orphaned
        ? html`<option value="" disabled .selected=${live(true)}>
            ${field.placeholder ?? context.labels.selectPlaceholder}
          </option>`
        : nothing
    }
    ${groupOptions(options).map((group) =>
      group.group
        ? html`<optgroup label=${group.group}>
            ${group.options.map((option) => renderOption(option, value))}
          </optgroup>`
        : html`${group.options.map((option) => renderOption(option, value))}`
    )}
  </select>`;
}

/* ------------------------------------------------------------------ *
 * Toggles
 * ------------------------------------------------------------------ */

function renderSingleToggle(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const invalid = isFieldInvalid(name, field, context);
  const checked = toBoolean(context.valueOf(name, field));
  const inlineLabel = context.inlineLabels ? fieldLabelTitle(field) : '';

  return html`<div class=${cx('form-check', 'form-switch', field.class)}>
    <!-- Companion so an unchecked box still posts a value on a native submit. -->
    <input type="hidden" name=${name} value="0" />
    <input
      type="checkbox"
      id=${id}
      name=${name}
      class=${cx('form-check-input', invalid && 'is-invalid')}
      role="switch"
      value=${inputString(field.value ?? '1')}
      aria-describedby=${ifDefined(context.describedBy)}
      aria-invalid=${invalid ? 'true' : nothing}
      .checked=${live(checked)}
      ?required=${isRequired(field, context)}
      ?disabled=${isDisabled(field, context)}
      @change=${(event: Event) =>
        context.change(name, field, (event.currentTarget as HTMLInputElement).checked)}
      @blur=${() => context.blur?.(name, field)}
    />
    ${
      inlineLabel
        ? html`<label class="form-check-label" for=${id}>${renderRich(inlineLabel)}</label>`
        : nothing
    }
  </div>`;
}

function renderToggleGroup(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const selected = toValueArray(context.valueOf(name, field));
  const invalid = isFieldInvalid(name, field, context);

  const toggle = (option: SelectOption, on: boolean): void => {
    const next = selected.filter((entry) => String(entry) !== String(option.value));
    if (on) next.push(option.value);
    context.change(name, field, next);
  };

  return html`${resolvedChoices(name, field, context).map((option, index) => {
    const optionId = `${id}-${index}`;
    return html`<div class=${cx('form-check', 'form-switch', field.class)}>
      <input
        type="checkbox"
        id=${optionId}
        name=${`${name}[]`}
        class=${cx('form-check-input', invalid && 'is-invalid')}
        role="switch"
        value=${String(option.value)}
        .checked=${live(selected.some((entry) => String(entry) === String(option.value)))}
        ?disabled=${isDisabled(field, context) || option.disabled === true}
        @change=${(event: Event) =>
          toggle(option, (event.currentTarget as HTMLInputElement).checked)}
        @blur=${() => context.blur?.(name, field)}
      />
      <label class="form-check-label" for=${optionId}>${option.label}</label>
    </div>`;
  })}`;
}

function renderRadioGroup(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const value = context.valueOf(name, field);
  const invalid = isFieldInvalid(name, field, context);
  return html`${resolvedChoices(name, field, context).map((option, index) => {
    const optionId = `${id}-${index}`;
    return html`<div class=${cx('form-check', field.class)}>
      <input
        type="radio"
        id=${optionId}
        name=${name}
        class=${cx('form-check-input', invalid && 'is-invalid')}
        value=${String(option.value)}
        .checked=${live(isOptionSelected(option, value))}
        ?required=${isRequired(field, context)}
        ?disabled=${isDisabled(field, context) || option.disabled === true}
        @change=${() => context.change(name, field, option.value)}
        @blur=${() => context.blur?.(name, field)}
      />
      <label class="form-check-label" for=${optionId}>${option.label}</label>
    </div>`;
  })}`;
}

/* ------------------------------------------------------------------ *
 * textul — a number with an "unlimited" escape hatch
 * ------------------------------------------------------------------ */

function unlimitedMax(field: ExtendedFormField): string | undefined {
  if (typeof field.max === 'number') return String(field.max);
  // The reference panel derives the ceiling from the column width: a
  // `maxlength` of 9 means "999999999". Kept as a string so 16-digit limits
  // survive without going through a float.
  if (typeof field.maxlength === 'number' && field.maxlength > 0) {
    return '9'.repeat(field.maxlength);
  }
  return undefined;
}

function renderUnlimitedNumber(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const raw = context.valueOf(name, field);
  const parsed = toNumber(raw);
  const unlimited = parsed !== undefined && parsed < 0;
  const invalid = isFieldInvalid(name, field, context);
  const disabled = isDisabled(field, context);

  return html`<div class="input-group">
    <input
      type="number"
      id=${id}
      name=${name}
      class=${cx('form-control', invalid && 'is-invalid', field.class)}
      min=${field.min ?? 0}
      max=${ifDefined(unlimitedMax(field))}
      step=${ifDefined(field.step)}
      placeholder=${ifDefined(unlimited ? context.labels.unlimited : field.placeholder)}
      aria-describedby=${ifDefined(context.describedBy)}
      aria-invalid=${invalid ? 'true' : nothing}
      .value=${live(unlimited ? '' : inputString(raw))}
      ?required=${isRequired(field, context) && !unlimited}
      ?readonly=${isReadonly(field, context)}
      ?disabled=${disabled || unlimited}
      @input=${(event: Event) =>
        context.change(
          name,
          field,
          readInputValue(event.currentTarget as HTMLInputElement, {
            ...field,
            type: 'number',
          })
        )}
      @blur=${() => context.blur?.(name, field)}
    />
    <div class="input-group-text">
      <input
        type="checkbox"
        id=${context.idFor(unlimitedName(name))}
        name=${unlimitedName(name)}
        class="form-check-input mt-0"
        role="switch"
        value="1"
        title=${context.labels.unlimited}
        aria-label=${context.labels.unlimited}
        .checked=${live(unlimited)}
        ?disabled=${disabled}
        @change=${(event: Event) => {
          const toggle = event.currentTarget as HTMLInputElement;
          context.change(name, field, toggle.checked ? -1 : (field.min ?? 0));
          // Leaving "unlimited" hands the user an empty number box; put the
          // caret in it rather than making them aim for it.
          if (!toggle.checked) {
            const box = toggle.closest('.input-group')?.querySelector<HTMLInputElement>('input[type="number"]');
            queueMicrotask(() => box?.focus());
          }
        }}
      />
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Static and composite controls
 * ------------------------------------------------------------------ */

function renderPlaintext(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  return html`<input
    type="text"
    id=${context.idFor(name)}
    name=${name}
    class=${cx('form-control-plaintext', field.class)}
    readonly
    .value=${live(inputString(context.valueOf(name, field)))}
  />`;
}

function renderInfotext(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  return html`<span id=${context.idFor(name)} class=${cx('form-control-plaintext', field.class)}
    >${renderRich(inputString(field.value))}</span
  >`;
}

function renderLongtext(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const id = context.idFor(name);
  const text = inputString(field.value);
  return html`<div class="d-flex align-items-start gap-2">
    <p id=${id} class=${cx('text-break', 'flex-grow-1', 'mb-0', field.class)}>
      ${renderRich(text)}
    </p>
    <lia-copy-button
      .text=${plainText(text)}
      .title=${context.labels.copy}
      copied-title=${context.labels.copied}
    ></lia-copy-button>
  </div>`;
}

function renderLink(field: ExtendedFormField): TemplateResult {
  const label = fieldLabelTitle(field) || field.href || '';
  return html`<a href=${field.href ?? '#'} class=${cx(field.class || 'link-primary')}
    >${renderRich(label)}</a
  >`;
}

function renderItemList(field: ExtendedFormField): TemplateResult | typeof nothing {
  const items = field.items ?? [];
  if (items.length === 0) return nothing;
  return html`<div class=${cx('lia-field-itemlist', field.class)}>
    ${items.map(
      (entry) =>
        html`<p class="mb-1">
          ${renderRich(entry.item)}${
            entry.href
              ? html` <a href=${entry.href} class=${cx(entry.class || 'link-primary')}
                  >${renderRich(entry.label ?? entry.href)}</a
                >`
              : nothing
          }
        </p>`
    )}
  </div>`;
}

function renderImage(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): TemplateResult {
  const current = typeof field.value === 'string' ? field.value : '';
  const deleteName = imageDeleteName(name);
  const deleteId = context.idFor(deleteName);
  const fileField: ExtendedFormField = {
    ...field,
    type: 'file',
    value: undefined,
  };

  return html`${
    current
      ? html`<img src=${current} alt=${context.labels.imageAlt} class="lia-field-image-preview" />
          <div class="form-check form-switch my-2">
            <input
              type="checkbox"
              id=${deleteId}
              name=${deleteName}
              class="form-check-input"
              role="switch"
              value="1"
              .checked=${live(toBoolean(context.valueOf(deleteName)))}
              ?disabled=${isDisabled(field, context)}
              @change=${(event: Event) =>
                context.change(
                  deleteName,
                  field,
                  (event.currentTarget as HTMLInputElement).checked
                )}
            />
            <label class="form-check-label" for=${deleteId}>${context.labels.imageDelete}</label>
          </div>`
      : nothing
  }
  ${renderFileInput(name, fileField, context)}`;
}

function renderUnknown(field: ExtendedFormField, context: FieldControlContext): TemplateResult {
  return html`<div class="alert alert-warning mb-0" role="alert">
    ${interpolate(context.labels.unknownType, { type: String(field.type) })}
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/**
 * Render the control of a single field — no label, no row, no `nextTo`
 * siblings. Use {@link renderFieldGroup} unless you are assembling the group
 * yourself.
 */
export function renderFieldControl(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): unknown {
  switch (field.type) {
    case 'text':
    case 'password':
    case 'email':
    case 'url':
    case 'tel':
    case 'date':
    case 'datetime-local':
    case 'time':
    case 'number':
      return renderTextInput(name, field, context);
    case 'file':
      return renderFileInput(name, field, context);
    case 'hidden':
      return renderHidden(name, field, context);
    case 'textarea':
      return renderTextarea(name, field, context);
    case 'select':
      return renderSelect(name, field, context);
    case 'checkbox':
    case 'switch':
      return isSingleToggle(field)
        ? renderSingleToggle(name, field, context)
        : renderToggleGroup(name, field, context);
    case 'radio':
      return renderRadioGroup(name, field, context);
    case 'textul':
      return renderUnlimitedNumber(name, field, context);
    case 'label':
      return renderPlaintext(name, field, context);
    case 'infotext':
      return renderInfotext(name, field, context);
    case 'longtext':
      return renderLongtext(name, field, context);
    case 'link':
      return renderLink(field);
    case 'itemlist':
      return renderItemList(field);
    case 'image':
      return renderImage(name, field, context);
    case 'custom':
      return field.render ? field.render(field, context.idFor(name)) : nothing;
    default:
      return renderUnknown(field, context);
  }
}

/**
 * The `nextTo` siblings of a field, flattened into a list of `input-group`
 * children: an optional `input-group-text` prefix followed by the control,
 * recursing into siblings of siblings.
 */
export function renderNextTo(field: ExtendedFormField, context: FieldControlContext): unknown[] {
  const parts: unknown[] = [];
  for (const [name, sibling] of Object.entries(field.nextTo ?? {})) {
    if (!isFieldVisible(sibling, context.values)) continue;
    if (sibling.prefix) {
      parts.push(html`<span class="input-group-text">${renderRich(sibling.prefix)}</span>`);
    }
    parts.push(renderFieldControl(name, sibling, context));
    parts.push(...renderNextTo(sibling, context));
  }
  return parts;
}

/** Options for {@link renderFieldGroup}. */
export interface FieldGroupOptions {
  /**
   * Wrap the primary control in Bootstrap's `.form-floating` and print this
   * text as the floating label.
   */
  floatingLabel?: string;
  /** Id the floating label points at. Defaults to the control's own id. */
  floatingFor?: string;
}

/**
 * The control plus its `nextTo` siblings, wrapped in an `.input-group` when
 * there is more than one of them.
 *
 * @example
 * ```ts
 * renderFieldGroup('local_part', field, context);
 * // → <div class="input-group">
 * //     <input class="form-control" …>
 * //     <span class="input-group-text">@</span>
 * //     <select class="form-select" …>
 * //   </div>
 * ```
 */
export function renderFieldGroup(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext,
  options: FieldGroupOptions = {}
): unknown {
  let primary = renderFieldControl(name, field, context);

  if (options.floatingLabel) {
    primary = html`<div class="form-floating">
      ${primary}
      <label for=${options.floatingFor ?? context.idFor(name)}
        >${renderRich(options.floatingLabel)}</label
      >
    </div>`;
  }

  const siblings = renderNextTo(field, context);
  const group =
    siblings.length === 0 ? primary : html`<div class="input-group">${primary}${siblings}</div>`;

  return withAsyncStatus(name, field, context, group);
}

/** Field types whose control is a stack of rows rather than a single box. */
const BLOCK_CONTROLS: ReadonlySet<string> = new Set(['radio', 'checkbox', 'switch']);

/**
 * Overlay the "something is happening" spinner on a control that has async
 * work attached.
 *
 * The wrapper is decided by the *definition*, never by the state, so the
 * control element itself is never torn down and rebuilt — a spinner appearing
 * mid-word must not cost the user their caret.
 */
function withAsyncStatus(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext,
  group: unknown
): unknown {
  if (!hasAsyncBehaviour(field)) return group;

  const loadingOptions = context.loadingOptionsOf?.(name) === true;
  const busy = isFieldBusy(name, context);
  const status = loadingOptions ? context.labels.loadingOptions : context.labels.checking;

  return html`<div
    class=${cx(
      'lia-async-field',
      field.type === 'select' && 'lia-async-field-select',
      BLOCK_CONTROLS.has(field.type) && 'lia-async-field-block'
    )}
    data-lia-busy=${busy ? 'true' : 'false'}
  >
    ${group}${
      busy
        ? html`<span
            class="lia-async-spinner spinner-border spinner-border-sm text-body-secondary"
            role="status"
            ><span class="visually-hidden">${status}</span></span
          >`
        : nothing
    }
  </div>`;
}

/**
 * The id the row label should point at, or `undefined` when the control is a
 * group (or nothing focusable at all) and the label must become a
 * `aria-labelledby` target instead.
 */
export function labelTargetId(
  name: string,
  field: ExtendedFormField,
  context: FieldControlContext
): string | undefined {
  const id = context.idFor(name);
  switch (field.type) {
    case 'infotext':
    case 'link':
    case 'itemlist':
    case 'longtext':
    case 'custom':
    case 'radio':
      return undefined;
    case 'checkbox':
    case 'switch':
      return isSingleToggle(field) ? id : undefined;
    case 'hidden':
      return field.display ? `${id}_display` : undefined;
    default:
      return id;
  }
}
