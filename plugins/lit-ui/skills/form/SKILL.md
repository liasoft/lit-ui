---
name: form
description: Build data-driven forms, multi-step wizards, and click-to-edit values with @liasoft/lit-ui. Load when creating or editing any form UI — a FormDefinition for lia-form, conditional fields (showWhen/requiredWhen), validation rules, async server checks, dependent selects, lia-wizard flows, lia-stepper indicators, or lia-inline-edit in table cells.
---

# Forms & wizard

## When to reach for this family

Describe a form as a `FormDefinition` object and hand it to `<lia-form>` — never hand-roll Bootstrap form markup. The kit renders the two-column layout, owns the value model, validates, and reports via events. For multi-step flows use `<lia-wizard>` (stepper + per-step form + validation gating) instead of wiring forms together yourself. For editing one value in place — typically a table cell inside `<lia-table>` from the table family — use `<lia-inline-edit>`, not a modal with a form. `<lia-stepper>` alone gives a progress indicator for any flow. A form in a modal: set `no-submit` on `<lia-form>` and drive it from the modal footer via `form.submit()` / `form.validate()`.

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/form'` for just this family. Stylesheet loads once globally. Everything renders in light DOM — Bootstrap classes and page CSS reach every control.

## Component reference

### `<lia-form>` — the whole form

Properties: `definition: FormDefinition` (sections, fields, buttons), `values` (assign to seed; reading returns live model), `rules: Record<string, FieldRules>` (extra validators by field name), `messages` (validation message overrides), `errors: FormErrors` (server-side messages, merged in), `hiddenFields: Record<string, string|number>`, booleans `disabled`, `busy` (submit spinner), `floating`, `noSubmit` (`no-submit`, hides button bar), `noValidate` (`no-validate`), `showHidden` (`show-hidden`), strings `submitLabel`, `resetLabel`, `mandatoryNote`, `idPrefix` (`id-prefix`), `highlight` (field name to mark), `labels: FormFieldLabels`. Methods: `getValues()`, `setValues(next, merge=true)`, `reset()`, `submit()`, `async validate(): Promise<FormErrors>` (waits for async rules; empty object = valid), `focusFirstInvalid()`. Getters: `validating`, `pendingFields`, `isValid`, `validationErrors`.

Events: `lia-submit` `{values, button?}` (only after validation passes), `lia-invalid` `{errors, values}`, `lia-change` `{name, value, values}` (every edit), `lia-form-reset` `{values}`, `lia-validating` `{validating, pendingFields}`. Native navigation is always prevented.

```ts
html`<lia-form
  .definition=${{ sections: { main: { title: 'Member', fields: {
    email: { type: 'email', label: 'Email', mandatory: true },
    quota: { type: 'textul', label: 'Quota', value: 10 },
  } } } }}
  .rules=${{ email: required('Email is needed.') }}
  @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
></lia-form>`
```

### `<lia-form-section>` / `<lia-form-field>` — internals

Rendered by `<lia-form>`; you rarely place a section yourself. `<lia-form-field>` is worth placing standalone for bespoke layouts: `name`, `.field` (a `FormField`), `.values` or `.value`, `.errors` or `error`, `layout` (`row` | `floating` | `plain`, shorthands `floating` / `no-row`). Emits `lia-change` and `lia-field-blur` `{name}`. Sections support `collapsible` / `collapsed` in the definition.

### `<lia-inline-edit>` — click-to-edit one value

Properties: `name`, `value`, `type` (`text|number|email|url|tel|textarea|select`), `.options` (for select), `editing` (reflected), `saving` (spinner + lock), `disabled`, `auto-close` (default true; set `"false"` for async saves), `commit-on-blur`, `required`, `empty-text`, `display` (formatted read view), `error` (string marks `is-invalid`), `accepted` (marks `is-valid`), `.row` (context echoed in events), `min`/`max`/`step`/`maxlength`/`rows`. Enter commits (Ctrl+Enter in textarea), Esc cancels. Events: `lia-inline-save` `{name, value, previous, row?}`, `lia-inline-start` / `lia-inline-cancel` `{name, value, row?}`. It owns only the draft — persist and feed the new value back yourself.

```ts
html`<lia-inline-edit name="label" .value=${row.label} .row=${row}
  @lia-inline-save=${(e: CustomEvent) => api.patch(row.id, { label: e.detail.value })}
></lia-inline-edit>`
```

### `<lia-stepper>` — step indicator

`.steps: StepDescriptor[]` (`{id, label, description?, icon?, state?, href?, clickable?, visible?}`), `current` (id or index; earlier steps render `done`), `orientation` (`auto|horizontal|vertical`), `no-interactive`, `no-numbers`. Per-step `state: 'done'|'current'|'upcoming'|'error'|'disabled'` overrides derivation. Emits `lia-step-select` `{id, index, step}` (cancelable).

### `<lia-wizard>` — multi-step form flow

`.steps: WizardStep[]` — each a `StepDescriptor` plus `title?`, `intro?`, `form?: FormDefinition`, `content?`, `optional?`, `nextLabel?`. Also `current` (step id), `manual` (host assigns `current` after each event — for URL-driven flows), `.errors`, `.rules`, `.alerts: AlertMessage[]` (renders a `lia-alert-stack` from the feedback family), `busy`, `disabled`, `no-validate`, `no-stepper`, `no-card`, `floating`, `back-label`/`next-label`/`finish-label`. Methods: `getValues()`, `setValues()`, `reset()`, `next()`, `back()`, `goTo(id)`. "Next" submits the step's form, so an invalid step never advances; a valid step merges values into the accumulated model. Events: `lia-wizard-step` `{id, index, previousId, direction, values}`, `lia-wizard-finish` `{values}`.

```ts
html`<lia-wizard
  .steps=${[
    { id: 'db', label: 'Database', form: { sections: { db: { fields: {
      host: { type: 'text', label: 'Host', mandatory: true } } } } } },
    { id: 'done', label: 'Finish', content: 'Ready.' },
  ]}
  @lia-wizard-finish=${(e: CustomEvent) => install(e.detail.values)}
></lia-wizard>`
```

## Field types (24)

| type | value | reads |
|---|---|---|
| `text` `password` `email` `url` `tel` | string | `placeholder`, `maxlength`, `pattern`, `autocomplete` |
| `number` | number | `min`, `max`, `step` |
| `date` `datetime-local` `time` | string | native temporal inputs |
| `textarea` | string | `rows`, `cols` |
| `select` | string, or array with `multiple` | `options` (grouped by `option.group`), `selected` |
| `checkbox` | boolean, or array when `values` given | `checked`, `values: SelectOption[]` |
| `radio` | string | `values` (always a group) |
| `switch` | boolean | `checked` |
| `textul` | number, `-1` = unlimited | number + "unlimited" toggle |
| `file` / `image` | `FileList \| null` | `accept`; `image` adds preview + delete switch |
| `hidden` | string | `display` echoes it read-only |
| `label` `infotext` `longtext` `link` `itemlist` | static, never validated | `href` (link), `items` (itemlist); `longtext` has a copy button |
| `custom` | — | renders `field.render(field, id)` |

Shared `FormField` keys: `label` (string or `{title, description}`), `note`, `desc`, `mandatory`, `disabled`, `readonly`, `visible`, `nextTo` (siblings in one input-group, with `prefix`), `requiresReconf`, `class`.

## Conditions, validation, async

**Conditions** — fields and sections take `showWhen` / `hideWhen`; fields also `disabledWhen` / `readonlyWhen` / `requiredWhen`. A `FieldCondition` is a clause `{field, equals?, notEquals?, in?, notIn?, truthy?, empty?, gt?, gte?, lt?, lte?, matches?}`, a group `{all}|{any}|{not}`, a `(values) => boolean` function, or an array (AND). Scalars compare as strings. A hidden field keeps its value but is **never validated** — an invisible mandatory field cannot block submit; disabled fields are skipped too.

**Validation** — implicit rules come free from the definition (`mandatory`, `pattern`, `min`/`max`, `maxlength`, `email`/`url`/`number` types). Extend via `.rules` with builders from the package root: `required`, `requiredIf(condition)`, `requiredUnless`, `requiredWithout([...])`, `requiredOneOf([...])`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url`, `numeric`, `integer`, `matches('other')` (password confirmation), `custom(predicate)`, `unlessUnlimited(rule)` (skips textul's `-1`). All take an optional custom message. Collision-proof namespace: `validationRules`. Messages show after blur, or all at once after a rejected submit.

**Async** — declared on the field: `asyncRules: [{id, validate(value, values, signal), debounce?, triggerOn?: 'blur'|'change'}]` — resolve `null` to accept, a message to reject; a rejected promise means "could not tell" and marks nothing. The form debounces (default 300ms), aborts superseded requests, blocks submit while pending. Dependent options: `dependsOn: 'region'` + `optionsFor(values)` (pure) or `optionsLoader(values, signal)` (fetched, with spinner). When new options no longer contain the selection, the form clears it and emits `lia-change` — a stale id can never be posted.

## Pitfalls

- `mandatory: true` on a `checkbox`/`switch` means "must be on" — `false` counts as empty.
- Async rule `id`s must be stable across renders; a per-render id resets the rule's slot.
- Prefer `await form.validate()` over `isValid` before programmatic submits — it waits for in-flight async work.
- Wizard steps' values accumulate; `getValues()` includes the current step's form. `keyed` remounts the form per step, seeded from the collected model, so "back" shows what was typed.
- Custom buttons via `definition.buttons: [{label, type?, variant?, id?}]`; `lia-submit`'s `detail.button` tells you which one fired.
