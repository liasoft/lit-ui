/**
 * The pure, DOM-free half of the form system: how a {@link FormField}
 * definition maps onto a value, how a {@link FormDefinition} is walked, and
 * the user-visible strings the field renderer needs.
 *
 * Everything here is a plain function so it can be unit-tested, reused by a
 * server renderer, or called from application code that never touches a
 * component.
 */

import type {
  FieldCondition,
  FieldConditionClause,
  FieldConditionGroup,
  FieldType,
  FormDefinition,
  FormField,
  FormSection,
  FormValues,
  SelectOption,
} from '../../core/types.js';

/* ------------------------------------------------------------------ *
 * Local additions to the shared FormField contract
 * ------------------------------------------------------------------ */

/**
 * The handful of properties this family understands on top of the shared
 * {@link FormField} contract.
 *
 * `prefix` is already part of the `nextTo` record type in `core/types`; it is
 * repeated here so a field can be typed on its own, outside that record.
 */
export interface FormFieldExtras {
  /**
   * A read-only echo of a `hidden` field's value, rendered beside the hidden
   * input so the user can see what is about to be submitted.
   */
  display?: string;
  /** `input-group-text` rendered *before* this field inside a `nextTo` group. */
  prefix?: string;
}

/** A {@link FormField} plus this family's {@link FormFieldExtras}. */
export type ExtendedFormField = FormField & FormFieldExtras;

/* ------------------------------------------------------------------ *
 * User-visible strings
 * ------------------------------------------------------------------ */

/**
 * Every string a field row can print that does not come from the field
 * definition itself. Pass a partial override through `<lia-form labels>` to
 * translate the form system.
 *
 * `{items}` and `{type}` are substituted by {@link interpolate}.
 */
export interface FormFieldLabels {
  /** Accessible name of the red asterisk next to a mandatory label. */
  mandatory: string;
  /** Callout under the label. `{items}` is the comma-joined list. */
  requiresReconfiguration: string;
  /** Accessible name of the "unlimited" toggle of a `textul` field. */
  unlimited: string;
  /** Label of the "remove the current image" switch. */
  imageDelete: string;
  /** `alt` text of the current-image preview. */
  imageAlt: string;
  /** Tooltip of the copy button on a `longtext` field. */
  copy: string;
  /** Confirmation after a successful copy. */
  copied: string;
  /** Shown instead of a control for an unsupported `type`. `{type}` is the type. */
  unknownType: string;
  /** Accessible status while an {@link AsyncRule} is checking the value. */
  checking: string;
  /** Accessible status while an `optionsLoader` is fetching the choices. */
  loadingOptions: string;
  /**
   * Placeholder entry of a dependent select whose value is not in the list —
   * the seat the selection lands in after its option disappeared.
   */
  selectPlaceholder: string;
}

/** English defaults for {@link FormFieldLabels}. */
export const DEFAULT_FORM_FIELD_LABELS: FormFieldLabels = {
  mandatory: 'required',
  requiresReconfiguration: 'Changing this option requires a reconfiguration of: {items}',
  unlimited: 'Unlimited',
  imageDelete: 'Remove the current image',
  imageAlt: 'Current image',
  copy: 'Copy to clipboard',
  copied: 'Copied',
  unknownType: 'Unsupported field type: {type}',
  checking: 'Checking…',
  loadingOptions: 'Loading the choices…',
  selectPlaceholder: 'Choose…',
};

/**
 * Substitute `{placeholder}` tokens in a template string. Unknown tokens are
 * left in place so a missing parameter is visible rather than silent.
 *
 * @example
 * ```ts
 * interpolate('Requires {items}', { items: 'nginx, php-fpm' });
 * // → 'Requires nginx, php-fpm'
 * ```
 */
export function interpolate(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    key in params ? String(params[key]) : token
  );
}

/* ------------------------------------------------------------------ *
 * Field introspection
 * ------------------------------------------------------------------ */

/** Field types that never carry a value and are never validated. */
export const STATIC_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'infotext',
  'link',
  'itemlist',
  'longtext',
]);

/** Field types whose control is a group of inputs rather than a single one. */
export const GROUPED_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(['radio']);

/** Field types that hold a number. */
export const NUMERIC_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(['number', 'textul']);

/* ------------------------------------------------------------------ *
 * Conditions
 * ------------------------------------------------------------------ */

/** Compare two values the way a form does: scalars as strings, arrays by membership. */
function looseEquals(value: unknown, expected: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => String(entry) === String(expected));
  if (value === null || value === undefined) return expected === null || expected === undefined;
  return String(value) === String(expected);
}

function compiledMatcher(expression: string | RegExp): RegExp | undefined {
  if (typeof expression !== 'string') return expression;
  try {
    return new RegExp(`^(?:${expression})$`);
  } catch {
    return undefined;
  }
}

/** Is `value` "not filled in"? Mirrors the validation module's notion of empty. */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean') return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof FileList !== 'undefined' && value instanceof FileList) return value.length === 0;
  return false;
}

function evaluateClause(clause: FieldConditionClause, values: FormValues): boolean {
  const value = values[clause.field];

  if ('equals' in clause && !looseEquals(value, clause.equals)) return false;
  if ('notEquals' in clause && looseEquals(value, clause.notEquals)) return false;
  if (clause.in && !clause.in.some((entry) => looseEquals(value, entry))) return false;
  if (clause.notIn?.some((entry) => looseEquals(value, entry))) return false;
  if (clause.truthy !== undefined && toBoolean(value) !== clause.truthy) return false;
  if (clause.empty !== undefined && isBlank(value) !== clause.empty) return false;

  const bounded =
    clause.gt !== undefined ||
    clause.gte !== undefined ||
    clause.lt !== undefined ||
    clause.lte !== undefined;
  if (bounded) {
    const parsed = toNumber(value);
    if (parsed === undefined) return false;
    if (clause.gt !== undefined && !(parsed > clause.gt)) return false;
    if (clause.gte !== undefined && !(parsed >= clause.gte)) return false;
    if (clause.lt !== undefined && !(parsed < clause.lt)) return false;
    if (clause.lte !== undefined && !(parsed <= clause.lte)) return false;
  }

  if (clause.matches !== undefined) {
    const matcher = compiledMatcher(clause.matches);
    if (!matcher) return false;
    matcher.lastIndex = 0;
    if (!matcher.test(String(value ?? ''))) return false;
  }

  return true;
}

function isGroup(condition: object): condition is FieldConditionGroup {
  return 'all' in condition || 'any' in condition || 'not' in condition;
}

/**
 * Does a {@link FieldCondition} hold for this value model?
 *
 * An `undefined` condition holds — a field with no condition is always on. An
 * array is an AND; `{ any: [...] }` is an OR; `{ not: … }` inverts. Anything
 * unrecognised holds too, so a typo makes a field appear rather than silently
 * vanish.
 *
 * @example
 * ```ts
 * evaluateCondition({ field: 'mode', equals: 'advanced' }, { mode: 'advanced' }); // → true
 * evaluateCondition([{ field: 'a', truthy: true }, { field: 'b', truthy: true }], values);
 * evaluateCondition({ any: [{ field: 'a', truthy: true }, { field: 'b', truthy: true }] }, values);
 * ```
 */
export function evaluateCondition(
  condition: FieldCondition | undefined,
  values: FormValues
): boolean {
  if (condition === undefined) return true;
  if (typeof condition === 'function') return condition(values) === true;
  if (Array.isArray(condition)) {
    return condition.every((entry) => evaluateCondition(entry, values));
  }
  if (isGroup(condition)) {
    if (condition.all && !condition.all.every((entry) => evaluateCondition(entry, values))) {
      return false;
    }
    if (condition.any && !condition.any.some((entry) => evaluateCondition(entry, values))) {
      return false;
    }
    if (condition.not !== undefined && evaluateCondition(condition.not, values)) return false;
    return true;
  }
  if (typeof (condition as FieldConditionClause).field === 'string') {
    return evaluateClause(condition as FieldConditionClause, values);
  }
  return true;
}

/**
 * Resolve `showWhen` / `hideWhen` against a value model.
 *
 * With no `values` the conditions are not evaluated at all and only the static
 * flag counts — that is what a component rendering a lone field does.
 */
function passesConditions(
  spec: { showWhen?: FieldCondition; hideWhen?: FieldCondition },
  values?: FormValues
): boolean {
  if (!values) return true;
  if (spec.showWhen !== undefined && !evaluateCondition(spec.showWhen, values)) return false;
  if (spec.hideWhen !== undefined && evaluateCondition(spec.hideWhen, values)) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Resolved field state
 * ------------------------------------------------------------------ */

/**
 * `visible !== false`, plus `showWhen`/`hideWhen` when a value model is given.
 * Fields are shown unless something explicitly hides them.
 */
export function isFieldVisible(field: FormField, values?: FormValues): boolean {
  if (field.visible === false) return false;
  return passesConditions(field, values);
}

/** `visible !== false`, plus `showWhen`/`hideWhen` when a value model is given. */
export function isSectionVisible(section: FormSection, values?: FormValues): boolean {
  if (section.visible === false) return false;
  return passesConditions(section, values);
}

/** `disabled === true`, or `disabledWhen` holding for this value model. */
export function isFieldDisabled(field: FormField, values?: FormValues): boolean {
  if (field.disabled === true) return true;
  if (!values || field.disabledWhen === undefined) return false;
  return evaluateCondition(field.disabledWhen, values);
}

/** `readonly === true`, or `readonlyWhen` holding for this value model. */
export function isFieldReadonly(field: FormField, values?: FormValues): boolean {
  if (field.readonly === true) return true;
  if (!values || field.readonlyWhen === undefined) return false;
  return evaluateCondition(field.readonlyWhen, values);
}

/** `mandatory === true`, or `requiredWhen` holding for this value model. */
export function isFieldRequired(field: FormField, values?: FormValues): boolean {
  if (field.mandatory === true) return true;
  if (field.requiredWhen === undefined) return false;
  // Without a model a conditional requirement is treated as *possible*, so the
  // asterisk and the "* mandatory field" footnote still appear.
  if (!values) return true;
  return evaluateCondition(field.requiredWhen, values);
}

/** The label text of a field, whether it was given as a string or an object. */
export function fieldLabelTitle(field: FormField): string {
  if (!field.label) return '';
  return typeof field.label === 'string' ? field.label : field.label.title;
}

/** The small description under the label, when the label is an object. */
export function fieldLabelDescription(field: FormField): string | undefined {
  if (!field.label || typeof field.label === 'string') return undefined;
  return field.label.description;
}

/**
 * The choices of a group control. `values` is the documented slot for check
 * box and radio groups; `options` is accepted too, so a group and a select can
 * share one list.
 */
export function fieldChoices(field: FormField): SelectOption[] {
  return field.values ?? field.options ?? [];
}

/**
 * Is this a single on/off control (as opposed to a multi-value group)?
 *
 * A field whose choices are derived or loaded is always a group, even before
 * the first list arrives: the answer has to be stable across renders, or the
 * control would be torn down and rebuilt the moment the options land.
 */
export function isSingleToggle(field: FormField): boolean {
  if (field.type !== 'checkbox' && field.type !== 'switch') return false;
  if (field.optionsFor !== undefined || field.optionsLoader !== undefined) return false;
  return fieldChoices(field).length === 0;
}

/* ------------------------------------------------------------------ *
 * Value coercion
 * ------------------------------------------------------------------ */

/**
 * Truthiness with the conventions a form posts: `'0'`, `'false'`, `'off'`,
 * `'no'` and the empty string all mean *off*.
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    return !(
      normalised === '' ||
      normalised === '0' ||
      normalised === 'false' ||
      normalised === 'off' ||
      normalised === 'no'
    );
  }
  return Boolean(value);
}

/** Parse a value as a finite number, or `undefined` when it is not one. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Normalise a multi-value selection to an array. Comma-separated strings are
 * split, because that is how a serialised multi-select usually arrives.
 */
export function toValueArray(value: unknown): Array<string | number> {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string | number => entry !== null && entry !== undefined)
      .map((entry) => (typeof entry === 'number' ? entry : String(entry)));
  }
  if (typeof value === 'number') return [value];
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
  }
  return [];
}

/** Does `value` (scalar or array) select `option`? Compared as strings. */
export function isOptionSelected(option: SelectOption, value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => String(entry) === String(option.value));
  if (value === null || value === undefined) return false;
  return String(value) === String(option.value);
}

/**
 * Map a raw DOM string back onto the option's declared value, so a numeric
 * option list keeps producing numbers.
 */
export function coerceOptionValue(
  options: readonly SelectOption[] | undefined,
  raw: string
): string | number {
  const match = options?.find((option) => String(option.value) === raw);
  return match ? match.value : raw;
}

/** Group options for `<optgroup>` rendering, preserving declaration order. */
export function groupOptions(
  options: readonly SelectOption[] | undefined
): Array<{ group?: string; options: SelectOption[] }> {
  const groups: Array<{ group?: string; options: SelectOption[] }> = [];
  const index = new Map<string, { group?: string; options: SelectOption[] }>();
  for (const option of options ?? []) {
    const key = option.group ?? '';
    let bucket = index.get(key);
    if (!bucket) {
      bucket = option.group ? { group: option.group, options: [] } : { options: [] };
      index.set(key, bucket);
      groups.push(bucket);
    }
    bucket.options.push(option);
  }
  return groups;
}

/**
 * The value a field starts with, derived from its definition.
 *
 * The mapping is deliberately narrow so `<lia-form>.values` is a *plain*
 * object an application can post as JSON:
 *
 * | type                       | value                                   |
 * | -------------------------- | --------------------------------------- |
 * | `checkbox` / `switch`      | `boolean` (or `Array` with `values`)    |
 * | `select` (`multiple`)      | `Array<string \| number>`               |
 * | `textul`                   | `number`, `-1` meaning *unlimited*      |
 * | `file` / `image`           | `FileList \| null`                      |
 * | everything else            | the declared `value`, or `''`           |
 */
export function initialFieldValue(field: FormField): unknown {
  switch (field.type) {
    case 'checkbox':
    case 'switch':
      if (field.values?.length) return toValueArray(field.value ?? field.selected);
      if (field.checked !== undefined) return field.checked;
      return toBoolean(field.value);
    case 'select':
      if (field.multiple) return toValueArray(field.selected ?? field.value);
      return field.selected ?? field.value ?? '';
    case 'radio':
      return field.selected ?? field.value ?? '';
    case 'textul':
      return toNumber(field.value) ?? 0;
    case 'file':
    case 'image':
      return null;
    default:
      return field.value ?? '';
  }
}

/** Name of the companion "remove current image" flag of an `image` field. */
export function imageDeleteName(name: string): string {
  return `${name}_delete`;
}

/** Name of the companion "unlimited" checkbox of a `textul` field. */
export function unlimitedName(name: string): string {
  return `${name}_ul`;
}

/* ------------------------------------------------------------------ *
 * Walking a definition
 * ------------------------------------------------------------------ */

/** Options for {@link flattenFields}. */
export interface FlattenOptions {
  /** Skip fields and sections that are hidden. Defaults to `true`. */
  visibleOnly?: boolean;
  /**
   * The value model `showWhen`/`hideWhen` are resolved against. Omit it and
   * only the static `visible` flag is consulted.
   */
  values?: FormValues;
}

function pushField(
  target: Array<[string, ExtendedFormField]>,
  name: string,
  field: ExtendedFormField,
  visibleOnly: boolean,
  values?: FormValues
): void {
  if (visibleOnly && !isFieldVisible(field, values)) return;
  target.push([name, field]);
  for (const [siblingName, sibling] of Object.entries(field.nextTo ?? {})) {
    pushField(target, siblingName, sibling, visibleOnly, values);
  }
}

/**
 * Every field of a definition as `[name, field]` pairs, in declaration order,
 * with `nextTo` siblings inlined after their host field.
 *
 * @example
 * ```ts
 * for (const [name, field] of flattenFields(definition)) {
 *   console.log(name, field.type);
 * }
 * ```
 */
export function flattenFields(
  definition: FormDefinition,
  options: FlattenOptions = {}
): Array<[string, ExtendedFormField]> {
  const visibleOnly = options.visibleOnly !== false;
  const values = options.values;
  const result: Array<[string, ExtendedFormField]> = [];
  for (const section of Object.values(definition.sections ?? {})) {
    if (visibleOnly && !isSectionVisible(section, values)) continue;
    for (const [name, field] of Object.entries(section.fields ?? {})) {
      pushField(result, name, field, visibleOnly, values);
    }
  }
  return result;
}

/** The `nextTo` sibling names of a field, recursively. */
export function nextToNames(field: FormField): string[] {
  const names: string[] = [];
  for (const [name, sibling] of Object.entries(field.nextTo ?? {})) {
    names.push(name, ...nextToNames(sibling));
  }
  return names;
}

/**
 * Build the starting value model of a whole definition — the object
 * `<lia-form>` seeds itself with.
 *
 * Purely presentational fields (`infotext`, `link`, `itemlist`, `longtext`)
 * contribute nothing; `image` fields also contribute their `_delete` flag.
 */
export function collectInitialValues(definition: FormDefinition): FormValues {
  const values: FormValues = {};
  for (const [name, field] of flattenFields(definition, {
    visibleOnly: false,
  })) {
    if (STATIC_FIELD_TYPES.has(field.type)) continue;
    values[name] = initialFieldValue(field);
    if (field.type === 'image') values[imageDeleteName(name)] = false;
  }
  return values;
}

/**
 * Does any visible field of the definition demand a value?
 *
 * A `requiredWhen` field counts whether or not its condition holds right now,
 * so the "* mandatory field" footnote does not flicker while the user types.
 */
export function hasMandatoryField(definition: FormDefinition, values?: FormValues): boolean {
  const options: FlattenOptions = values ? { values } : {};
  return flattenFields(definition, options).some(([, field]) => isFieldRequired(field));
}

/** Turn an arbitrary field name into a safe DOM id fragment. */
export function slugifyName(name: string): string {
  const slug = name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? 'field' : slug;
}
