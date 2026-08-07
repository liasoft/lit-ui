/**
 * A dependency-free validation engine for the form system.
 *
 * The reference panel leaned on jQuery Validate for a handful of cross-field
 * rules; this module replaces it with plain functions. A *validator* is
 * `(value, context) => message | undefined`, so composing, testing and
 * translating rules needs nothing but TypeScript.
 *
 * Two layers work together:
 *
 * 1. **Implicit rules** derived from the field definition itself — `mandatory`
 *    becomes {@link required}, `pattern` becomes {@link pattern}, a `number`
 *    field becomes {@link numeric}, and so on. You get sensible validation for
 *    free just by describing the form.
 * 2. **Explicit rules** you pass per field name, for anything the definition
 *    cannot express (confirmations, conditional requirements, async-free
 *    business checks).
 *
 * @example
 * ```ts
 * import { validateForm, required, matches, custom } from '@liasoft/lit-ui';
 *
 * const errors = validateForm(definition, values, {
 *   rules: {
 *     password_confirm: matches('password', 'The passwords do not match.'),
 *     slug: custom((value) => /^[a-z0-9-]+$/.test(String(value)), 'Lowercase and dashes only.'),
 *   },
 * });
 * ```
 */

import type {
  FieldCondition,
  FieldType,
  FormDefinition,
  FormErrors,
  FormValues,
} from '../../core/types.js';
import {
  evaluateCondition,
  fieldLabelTitle,
  flattenFields,
  interpolate,
  isFieldDisabled,
  NUMERIC_FIELD_TYPES,
  STATIC_FIELD_TYPES,
  toNumber,
  type ExtendedFormField,
} from './field-model.js';

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

/**
 * Message templates, one per built-in rule. `{label}` is always available;
 * individual rules add `{min}`, `{max}` and `{other}`.
 */
export interface ValidationMessages {
  required: string;
  minLength: string;
  maxLength: string;
  min: string;
  max: string;
  pattern: string;
  email: string;
  url: string;
  numeric: string;
  integer: string;
  matches: string;
  /** Message of {@link requiredOneOf}. */
  requiredOneOf: string;
  /** Fallback for a {@link custom} rule that failed without its own message. */
  invalid: string;
}

/** English defaults for {@link ValidationMessages}. */
export const DEFAULT_VALIDATION_MESSAGES: ValidationMessages = {
  required: 'This field is required.',
  minLength: 'Enter at least {min} characters.',
  maxLength: 'Enter at most {max} characters.',
  min: 'Enter a value of {min} or more.',
  max: 'Enter a value of {max} or less.',
  pattern: 'This value has the wrong format.',
  email: 'Enter a valid email address.',
  url: 'Enter a valid URL.',
  numeric: 'Enter a number.',
  integer: 'Enter a whole number.',
  matches: 'This value must match “{other}”.',
  requiredOneOf: 'Fill in at least one of these fields.',
  invalid: 'This value is not valid.',
};

/* ------------------------------------------------------------------ *
 * Validator contract
 * ------------------------------------------------------------------ */

/** Everything a validator knows besides the value it is judging. */
export interface ValidationContext {
  /** The field's name in the value model. */
  name: string;
  /** Human-readable label, used in messages. Falls back to the name. */
  label: string;
  /** Every current value, so a rule can look at its neighbours. */
  values: FormValues;
  /** The active message templates. */
  messages: ValidationMessages;
  /** The field definition, when the name belongs to one. */
  field?: ExtendedFormField;
}

/** A rule: return a message to reject the value, or `undefined` to accept it. */
export type Validator = (value: unknown, context: ValidationContext) => string | undefined;

/** One or several rules for a single field. */
export type FieldRules = Validator | Validator[];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Is a value "not filled in"? Empty strings (after trimming), empty arrays,
 * empty file selections, `null`, `undefined` and `false` all count.
 *
 * Only {@link required} consults this — every other rule passes empty values
 * through, so a field is optional until you say otherwise.
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean') return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof FileList !== 'undefined' && value instanceof FileList) return value.length === 0;
  return false;
}

function message(
  context: ValidationContext,
  key: keyof ValidationMessages,
  override: string | undefined,
  params: Record<string, string | number> = {}
): string {
  if (override !== undefined) return interpolate(override, { label: context.label, ...params });
  return interpolate(context.messages[key], {
    label: context.label,
    ...params,
  });
}

/* ------------------------------------------------------------------ *
 * Built-in rules
 * ------------------------------------------------------------------ */

/** The value must be filled in. */
export function required(customMessage?: string): Validator {
  return (value, context) =>
    isEmptyValue(value) ? message(context, 'required', customMessage) : undefined;
}

/**
 * The value must be filled in, but only while `condition` holds.
 *
 * This is the declarative half of the reference panel's cross-field rules: the
 * condition is the same {@link FieldCondition} a field's `showWhen` takes, so a
 * field that only appears in one mode can also only be demanded in that mode.
 *
 * @example
 * ```ts
 * // A port is required as soon as a custom host is given.
 * { port: requiredIf({ field: 'host', empty: false }) }
 * ```
 */
export function requiredIf(condition: FieldCondition, customMessage?: string): Validator {
  return (value, context) => {
    if (!evaluateCondition(condition, context.values)) return undefined;
    return isEmptyValue(value) ? message(context, 'required', customMessage) : undefined;
  };
}

/** The value must be filled in *unless* `condition` holds — the inverse of {@link requiredIf}. */
export function requiredUnless(condition: FieldCondition, customMessage?: string): Validator {
  return (value, context) => {
    if (evaluateCondition(condition, context.values)) return undefined;
    return isEmptyValue(value) ? message(context, 'required', customMessage) : undefined;
  };
}

/**
 * The value must be filled in while *every* named field is empty.
 *
 * The "give us a name or a company" rule: each member of the group demands a
 * value only for as long as none of the others has one.
 *
 * @example
 * ```ts
 * const rules = {
 *   lastName: requiredWithout(['company']),
 *   company: requiredWithout(['lastName', 'firstName']),
 * };
 * ```
 */
export function requiredWithout(others: readonly string[], customMessage?: string): Validator {
  return (value, context) => {
    if (others.some((other) => !isEmptyValue(context.values[other]))) return undefined;
    return isEmptyValue(value) ? message(context, 'required', customMessage) : undefined;
  };
}

/**
 * At least one of `names` must be filled in.
 *
 * Unlike {@link requiredWithout} the message lands on the one field this rule
 * is registered against, which is what you want for a group of checkboxes or a
 * multi-select rendered as a single row.
 *
 * @example
 * ```ts
 * { addresses: requiredOneOf(['addresses'], 'Pick at least one address.') }
 * ```
 */
export function requiredOneOf(
  names: readonly string[],
  customMessage?: string
): Validator {
  return (value, context) => {
    const filled = names.some((name) =>
      name === context.name ? !isEmptyValue(value) : !isEmptyValue(context.values[name])
    );
    return filled ? undefined : message(context, 'requiredOneOf', customMessage);
  };
}

/** At least `length` characters. Empty values pass — combine with {@link required}. */
export function minLength(length: number, customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    const actual = Array.isArray(value) ? value.length : String(value).length;
    return actual < length
      ? message(context, 'minLength', customMessage, { min: length })
      : undefined;
  };
}

/** At most `length` characters. */
export function maxLength(length: number, customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    const actual = Array.isArray(value) ? value.length : String(value).length;
    return actual > length
      ? message(context, 'maxLength', customMessage, { max: length })
      : undefined;
  };
}

/** Numeric lower bound (inclusive). */
export function min(limit: number, customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    const parsed = toNumber(value);
    if (parsed === undefined) return message(context, 'numeric', undefined);
    return parsed < limit ? message(context, 'min', customMessage, { min: limit }) : undefined;
  };
}

/** Numeric upper bound (inclusive). */
export function max(limit: number, customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    const parsed = toNumber(value);
    if (parsed === undefined) return message(context, 'numeric', undefined);
    return parsed > limit ? message(context, 'max', customMessage, { max: limit }) : undefined;
  };
}

/**
 * A regular expression the whole value must match.
 *
 * A **string** is treated exactly like the HTML `pattern` attribute: it is
 * implicitly anchored (`^(?:…)$`). Pass a `RegExp` to keep full control. An
 * unparsable expression is ignored rather than throwing at render time.
 */
export function pattern(expression: string | RegExp, customMessage?: string): Validator {
  let compiled: RegExp | undefined;
  if (typeof expression === 'string') {
    try {
      compiled = new RegExp(`^(?:${expression})$`);
    } catch {
      compiled = undefined;
    }
  } else {
    compiled = expression;
  }
  return (value, context) => {
    if (compiled === undefined || isEmptyValue(value)) return undefined;
    // A global regex carries state between calls; reset it defensively.
    compiled.lastIndex = 0;
    return compiled.test(String(value)) ? undefined : message(context, 'pattern', customMessage);
  };
}

// Deliberately permissive: the authoritative check is always sending the mail.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** A syntactically plausible email address. */
export function email(customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    return EMAIL_RE.test(String(value).trim())
      ? undefined
      : message(context, 'email', customMessage);
  };
}

/** An absolute URL with a scheme the browser understands. */
export function url(customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    try {
      const parsed = new URL(String(value).trim());
      if (!parsed.protocol) return message(context, 'url', customMessage);
      return undefined;
    } catch {
      return message(context, 'url', customMessage);
    }
  };
}

/** Any finite number. */
export function numeric(customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    return toNumber(value) === undefined ? message(context, 'numeric', customMessage) : undefined;
  };
}

/** A finite number without a fractional part. */
export function integer(customMessage?: string): Validator {
  return (value, context) => {
    if (isEmptyValue(value)) return undefined;
    const parsed = toNumber(value);
    if (parsed === undefined || !Number.isInteger(parsed)) {
      return message(context, 'integer', customMessage);
    }
    return undefined;
  };
}

/**
 * The value must equal the current value of another field — the
 * "repeat your password" rule.
 *
 * @param other Name of the field to compare against.
 * @param customMessage Overrides the default message.
 * @param otherLabel Label of the other field, substituted for `{other}`.
 */
export function matches(other: string, customMessage?: string, otherLabel?: string): Validator {
  return (value, context) => {
    const theirs = context.values[other];
    if (String(value ?? '') === String(theirs ?? '')) return undefined;
    return message(context, 'matches', customMessage, {
      other: otherLabel ?? other,
    });
  };
}

/**
 * An arbitrary predicate.
 *
 * Return `true`/`undefined` to accept, `false` to reject with
 * `customMessage` (or the generic `invalid` message), or a string to reject
 * with that exact message.
 *
 * @example
 * ```ts
 * custom((value, { values }) => values['kind'] !== 'external' || !isEmptyValue(value),
 *        'Required for external entries.')
 * ```
 */
export function custom(
  predicate: (value: unknown, context: ValidationContext) => boolean | string | undefined,
  customMessage?: string
): Validator {
  return (value, context) => {
    const result = predicate(value, context);
    if (result === true || result === undefined) return undefined;
    if (result === false) return message(context, 'invalid', customMessage);
    return result;
  };
}

/**
 * Run `rule` only while the value is not the `textul` "unlimited" sentinel
 * (`-1`), so an unlimited quota is never rejected by its own bounds.
 */
export function unlessUnlimited(rule: Validator): Validator {
  return (value, context) => {
    const parsed = toNumber(value);
    if (parsed !== undefined && parsed < 0) return undefined;
    return rule(value, context);
  };
}

/* ------------------------------------------------------------------ *
 * Deriving rules from a definition
 * ------------------------------------------------------------------ */

/**
 * The rules a field definition implies on its own — the reason a plain
 * `{ type: 'email', mandatory: true }` already validates.
 */
export function implicitRules(field: ExtendedFormField): Validator[] {
  const rules: Validator[] = [];
  const unlimited = field.type === 'textul';
  const wrap = (rule: Validator): Validator => (unlimited ? unlessUnlimited(rule) : rule);

  if (field.mandatory) rules.push(required());
  else if (field.requiredWhen !== undefined) rules.push(requiredIf(field.requiredWhen));

  switch (field.type) {
    case 'email':
      rules.push(email());
      break;
    case 'url':
      rules.push(url());
      break;
    case 'number':
    case 'textul':
      rules.push(wrap(numeric()));
      break;
    default:
      break;
  }

  if (field.pattern) rules.push(pattern(field.pattern));
  if (typeof field.maxlength === 'number' && !NUMERIC_FIELD_TYPES.has(field.type)) {
    rules.push(maxLength(field.maxlength));
  }
  if (typeof field.min === 'number') rules.push(wrap(min(field.min)));
  if (typeof field.max === 'number') rules.push(wrap(max(field.max)));

  return rules;
}

/** Options shared by {@link validateForm} and {@link validateFieldValue}. */
export interface ValidateOptions {
  /** Extra rules, keyed by field name. Names need not exist in the definition. */
  rules?: Record<string, FieldRules>;
  /** Message templates to use instead of {@link DEFAULT_VALIDATION_MESSAGES}. */
  messages?: Partial<ValidationMessages>;
  /** Set `false` to run only the explicit {@link rules}. Defaults to `true`. */
  implicit?: boolean;
}

function resolveMessages(overrides?: Partial<ValidationMessages>): ValidationMessages {
  return overrides ? { ...DEFAULT_VALIDATION_MESSAGES, ...overrides } : DEFAULT_VALIDATION_MESSAGES;
}

function toArray(rules: FieldRules | undefined): Validator[] {
  if (!rules) return [];
  return Array.isArray(rules) ? rules : [rules];
}

/**
 * Validate a single field and return the first message that rejects it.
 *
 * `<lia-form>` calls this on blur so the user is corrected while typing,
 * without lighting up the whole form.
 *
 * @example
 * ```ts
 * const error = validateFieldValue('email', definition.sections.a.fields['email'], values);
 * ```
 */
export function validateFieldValue(
  name: string,
  field: ExtendedFormField | undefined,
  values: FormValues,
  options: ValidateOptions = {}
): string | undefined {
  const context: ValidationContext = {
    name,
    label: (field ? fieldLabelTitle(field) : '') || name,
    values,
    messages: resolveMessages(options.messages),
    field,
  };

  const validators: Validator[] = [];
  if (field && options.implicit !== false) validators.push(...implicitRules(field));
  validators.push(...toArray(options.rules?.[name]));

  const value = values[name];
  for (const validate of validators) {
    const failure = validate(value, context);
    if (failure) return failure;
  }
  return undefined;
}

/** Field types that are never validated because they hold no user input. */
const UNVALIDATED: ReadonlySet<FieldType> = STATIC_FIELD_TYPES;

/**
 * Validate every visible field of a definition against a value model.
 *
 * Returns a `{ fieldName: message }` map — empty when the form is valid, which
 * makes `Object.keys(validateForm(…)).length === 0` the whole "is it valid?"
 * test.
 *
 * A field a `showWhen`/`hideWhen` condition currently hides is **not**
 * validated: a mandatory field the user cannot see must never block a submit.
 * Its value stays in the model, so the rule comes back the moment the field
 * does. A disabled field is skipped for the same reason — a control the user
 * cannot reach must not be able to reject the form.
 *
 * Rules given for names that are *not* in the definition are still run, so you
 * can validate values the form collects outside a field (a captcha token, a
 * confirmation checkbox rendered by hand).
 */
export function validateForm(
  definition: FormDefinition,
  values: FormValues,
  options: ValidateOptions = {}
): FormErrors {
  const errors: FormErrors = {};
  const seen = new Set<string>();

  for (const [name, field] of flattenFields(definition, {
    visibleOnly: true,
    values,
  })) {
    seen.add(name);
    if (UNVALIDATED.has(field.type)) continue;
    if (isFieldDisabled(field, values)) continue;
    const failure = validateFieldValue(name, field, values, options);
    if (failure) errors[name] = failure;
  }

  for (const name of Object.keys(options.rules ?? {})) {
    if (seen.has(name)) continue;
    const failure = validateFieldValue(name, undefined, values, options);
    if (failure) errors[name] = failure;
  }

  return errors;
}

/**
 * Every built-in rule builder under one namespace.
 *
 * The bare names ({@link min}, {@link max}, {@link custom}, …) read best in a
 * rules map, but they are generic enough to collide with your own imports.
 * This object is the collision-proof way in.
 *
 * @example
 * ```ts
 * import { validationRules as v } from '@liasoft/lit-ui';
 *
 * const rules = { port: [v.required(), v.integer(), v.min(1), v.max(65535)] };
 * ```
 */
export const validationRules = {
  required,
  requiredIf,
  requiredUnless,
  requiredWithout,
  requiredOneOf,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  email,
  url,
  numeric,
  integer,
  matches,
  custom,
  unlessUnlimited,
} as const;
