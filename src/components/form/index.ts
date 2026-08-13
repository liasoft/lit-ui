/**
 * Form family — the data-driven form system.
 *
 * Describe a form as a {@link FormDefinition} — sections of named
 * {@link FormField}s — and hand it to `<lia-form>`. The kit renders the
 * two-column Bootstrap layout, owns the value model, validates it, and tells
 * you about it through events. No page posts, no jQuery, no per-field wiring.
 *
 * | Element               | What it is                                          |
 * | --------------------- | --------------------------------------------------- |
 * | `<lia-form-field>`    | one labelled row; renders every `FieldType`           |
 * | `<lia-form-section>`  | a card of field rows, optionally collapsible          |
 * | `<lia-form>`          | the whole definition, value model and button bar      |
 * | `<lia-inline-edit>`   | one value, edited in place on click                   |
 * | `<lia-stepper>`       | the numbered step indicator of a multi-step flow      |
 * | `<lia-wizard>`        | stepper + per-step form + validation-gated navigation |
 *
 * Supporting modules:
 *
 * - `field-model.js` — value derivation, definition walking, label strings.
 * - `controls.js` — the pure control renderers, for bespoke layouts.
 * - `validation.js` — the rule engine ({@link validateForm} and friends).
 * - `async-fields.js` — debounced, abortable server checks and dependent
 *   option lists ({@link AsyncValidationController},
 *   {@link DependentOptionsController}).
 *
 * ### Conditional fields
 *
 * Fields and sections take `showWhen` / `hideWhen` / `disabledWhen` /
 * `readonlyWhen` / `requiredWhen`, each a {@link FieldCondition} evaluated
 * against the live value model. Hiding thresholds behind a "bypass" switch,
 * folding away the sections another setting makes irrelevant, revealing the
 * advanced half of an installer — all of it is expressed in the definition
 * instead of in DOM-poking event handlers. See {@link evaluateCondition}.
 *
 * ### Asynchronous fields
 *
 * Server-backed behaviour is declarative too:
 * `asyncRules` for a debounced server-side check (an "is this name taken?"
 * probe) and `dependsOn` + `optionsFor` / `optionsLoader` for a select
 * narrowed by another field. `<lia-form>`
 * debounces, aborts superseded requests, shows the spinner, blocks the submit
 * while a check is out, and clears a selection its option list no longer
 * contains.
 *
 * ```ts
 * loginname: {
 *   type: 'text',
 *   label: 'Login name',
 *   asyncRules: [{ id: 'free', debounce: 400, validate: checkLoginFree }],
 * },
 * zone: { type: 'select', label: 'Zone', dependsOn: 'region', optionsLoader: fetchZones },
 * ```
 *
 * ```ts
 * import '@liasoft/lit-ui/components/form';
 * ```
 *
 * @example
 * ```ts
 * import { matches, required } from '@liasoft/lit-ui';
 *
 * html`<lia-form
 *   .definition=${{
 *     title: 'New access key',
 *     icon: 'fa-solid fa-key',
 *     sections: {
 *       main: {
 *         title: 'Key',
 *         fields: {
 *           label: { type: 'text', label: 'Label', mandatory: true },
 *           scope: {
 *             type: 'select',
 *             label: { title: 'Scope', description: 'What the key may reach.' },
 *             options: [
 *               { value: 'read', label: 'Read only' },
 *               { value: 'write', label: 'Read and write' },
 *             ],
 *           },
 *           expires: { type: 'date', label: 'Expires on' },
 *           quota: { type: 'textul', label: 'Request quota', desc: 'Tick for unlimited.' },
 *           enabled: { type: 'switch', label: 'Enabled', checked: true },
 *         },
 *       },
 *     },
 *   }}
 *   .rules=${{ label: required('Give the key a name.') }}
 *   @lia-submit=${(e: CustomEvent) => create(e.detail.values)}
 * ></lia-form>`
 * ```
 */

export * from './field-model.js';
export * from './async-fields.js';
export * from './validation.js';
export * from './controls.js';
export * from './form-field.js';
export * from './form-section.js';
export * from './form.js';
export * from './inline-edit.js';
export * from './stepper.js';
export * from './wizard.js';
