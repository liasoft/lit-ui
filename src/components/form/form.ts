import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  FormButton,
  FormDefinition,
  FormErrors,
  FormSubmitDetail,
  FormValues,
  SelectOption,
} from '../../core/types.js';
import { cx, uid } from '../../core/utils.js';
import {
  collectInitialValues,
  DEFAULT_FORM_FIELD_LABELS,
  hasMandatoryField,
  isSectionVisible,
  slugifyName,
  type ExtendedFormField,
  type FormFieldLabels,
} from './field-model.js';
import {
  asyncFieldStateEqual,
  asyncRuleFields,
  AsyncValidationController,
  dependentOptionFields,
  DependentOptionsController,
  EMPTY_ASYNC_FIELD_STATE,
  flattenFieldIndex,
  reconcileOptionValue,
  type AsyncFieldState,
} from './async-fields.js';
import { validateForm, type FieldRules, type ValidationMessages } from './validation.js';
import './form-section.js';

/** Detail of `lia-invalid`, fired when a submit is blocked by validation. */
export interface FormInvalidDetail {
  errors: FormErrors;
  values: FormValues;
}

/** Detail of `lia-form-reset`, fired after the form returns to its initial values. */
export interface FormResetDetail {
  values: FormValues;
}

/**
 * Detail of `lia-validating`, fired whenever the set of fields with async work
 * in flight changes — the hook a host hangs its own "saving is not available
 * yet" affordance off.
 */
export interface FormValidatingDetail {
  /** `true` while anything is queued or in flight. */
  validating: boolean;
  /** The field names behind it. */
  pendingFields: string[];
}

declare global {
  interface HTMLElementEventMap {
    'lia-invalid': CustomEvent<FormInvalidDetail>;
    'lia-form-reset': CustomEvent<FormResetDetail>;
    'lia-validating': CustomEvent<FormValidatingDetail>;
  }
}

const DEFAULT_BUTTON_VARIANTS = {
  submit: 'primary',
  reset: 'outline-secondary',
  button: 'outline-secondary',
} as const;

/**
 * A whole form, rendered from a {@link FormDefinition}: one card per section,
 * hidden fields, the centred button bar and the "* mandatory field" footnote.
 *
 * ### It owns the value model
 *
 * The form seeds `.values` from the definition, keeps it up to date as the
 * user types, and exposes {@link getValues}, {@link setValues}, {@link reset}
 * and {@link validate}. Assigning a new `definition` starts a fresh model.
 *
 * ### It never navigates
 *
 * The native submit is always prevented. A valid submit emits `lia-submit`
 * with `{ values, button }`; an invalid one emits `lia-invalid` and focuses
 * the first offending control. Every edit emits `lia-change`.
 *
 * ### Validation
 *
 * Rules are derived from the definition (`mandatory`, `pattern`, `min`/`max`,
 * the `email`/`url`/`number` types) and can be extended per field name through
 * `.rules` — see the {@link module:validation} helpers. Messages appear once a
 * field has been blurred, and all at once after a rejected submit.
 *
 * ### Conditional fields
 *
 * A field or section can carry `showWhen` / `hideWhen` / `disabledWhen` /
 * `readonlyWhen` / `requiredWhen`, each a {@link FieldCondition} resolved
 * against the live value model. Rows appear, grey out and start demanding a
 * value as the user types, with no work from the host — and a field the
 * condition hides is never validated, so an invisible requirement can never
 * block a submit.
 *
 * ### Asynchronous rules and dependent options
 *
 * A field can carry `asyncRules` — checks that have to ask a server — and
 * `optionsFor` / `optionsLoader` + `dependsOn`, which recompute or fetch its
 * choices when a watched field moves. The form debounces them, aborts the
 * previous request whenever the value changes again, shows a spinner in the
 * control and an `is-valid` mark on a clean pass, clears a selection that fell
 * out of its own option list, and makes a submit *wait* rather than race.
 * `.validating` and `.pendingFields` expose the state; {@link validate}
 * resolves only once everything has spoken.
 *
 * @example
 * ```ts
 * html`<lia-form
 *   .definition=${{
 *     sections: {
 *       delivery: {
 *         fields: {
 *           mode: { type: 'select', label: 'Mode', options: modes },
 *           host: {
 *             type: 'text',
 *             label: 'Host',
 *             showWhen: { field: 'mode', equals: 'remote' },
 *             requiredWhen: { field: 'mode', equals: 'remote' },
 *           },
 *         },
 *       },
 *     },
 *   }}
 * ></lia-form>`
 * ```
 *
 * @example
 * ```ts
 * html`<lia-form
 *   .definition=${{
 *     id: 'profile',
 *     sections: {
 *       identity: {
 *         title: 'Identity',
 *         icon: 'fa-solid fa-id-card',
 *         fields: {
 *           email: { type: 'email', label: 'Email', mandatory: true },
 *           password: { type: 'password', label: 'Password' },
 *           confirm: { type: 'password', label: 'Repeat password' },
 *         },
 *       },
 *     },
 *   }}
 *   .rules=${{ confirm: matches('password') }}
 *   @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
 * ></lia-form>`
 * ```
 *
 * @example
 * ```ts
 * const form = document.querySelector('lia-form')!;
 * form.setValues({ email: 'ada@example.org' });
 * if (Object.keys(await form.validate()).length === 0) send(form.getValues());
 * ```
 *
 * @example
 * ```ts
 * html`<lia-form
 *   .definition=${{
 *     sections: {
 *       account: {
 *         fields: {
 *           login: {
 *             type: 'text',
 *             label: 'Login name',
 *             mandatory: true,
 *             asyncRules: [{ id: 'free', debounce: 400, validate: checkLoginFree }],
 *           },
 *           region: { type: 'select', label: 'Region', options: regions },
 *           zone: {
 *             type: 'select',
 *             label: 'Zone',
 *             dependsOn: 'region',
 *             optionsLoader: (values, signal) => fetchZones(values.region, signal),
 *           },
 *         },
 *       },
 *     },
 *   }}
 * ></lia-form>`
 * ```
 */
@customElement('lia-form')
export class LiaForm extends LiaElement {
  /** The form description: sections, fields, buttons. */
  @property({ attribute: false }) definition: FormDefinition = { sections: {} };

  /** `action` of the underlying `<form>`, kept for progressive enhancement. */
  @property({ type: String }) action = '';

  /** `method` of the underlying `<form>`. */
  @property({ type: String }) method: 'post' | 'get' = 'post';

  /** Extra `<input type="hidden">`s appended to the form (ids, tokens, …). */
  @property({ attribute: false }) hiddenFields: Record<string, string | number> = {};

  /** Server-side validation messages, merged with the client-side ones. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Hide the button bar — for a form embedded in a modal with its own footer. */
  @property({ type: Boolean, attribute: 'no-submit' }) noSubmit = false;

  /** Disable every control and button. */
  @property({ type: Boolean }) disabled = false;

  /** Show a spinner in the submit button and block further submits. */
  @property({ type: Boolean }) busy = false;

  /** Render every field with Bootstrap's floating labels. */
  @property({ type: Boolean }) floating = false;

  /** Render `visible: false` fields anyway, disabled. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Turn client-side validation off entirely. */
  @property({ type: Boolean, attribute: 'no-validate' }) noValidate = false;

  /** Name of a field to highlight, e.g. one linked to from a search result. */
  @property({ type: String }) highlight = '';

  /** Extra validation rules, keyed by field name. */
  @property({ attribute: false }) rules?: Record<string, FieldRules>;

  /** Validation message overrides. */
  @property({ attribute: false }) messages?: Partial<ValidationMessages>;

  /** Overridable field-level strings. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Prefix for generated DOM ids, so two forms can share field names. */
  @property({ type: String, attribute: 'id-prefix' }) idPrefix = '';

  /** Label of the default submit button. */
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Save';

  /** Label of the default reset button. */
  @property({ type: String, attribute: 'reset-label' }) resetLabel = 'Reset';

  /** Footnote next to the red asterisk. Empty string removes it. */
  @property({ type: String, attribute: 'mandatory-note' }) mandatoryNote = 'Mandatory field';

  @state() private model: FormValues = {};

  /** Fields the user has left at least once — the ones allowed to show errors. */
  @state() private touched: ReadonlySet<string> = new Set<string>();

  /** After a rejected submit every message is shown, touched or not. */
  @state() private submitted = false;

  /** A submit is waiting for the async rules to speak. */
  @state() private settling = false;

  /** What the field rows need to know about the work in flight. */
  @state() private asyncState: AsyncFieldState = EMPTY_ASYNC_FIELD_STATE;

  private baseValues: FormValues = {};

  private explicitValues: FormValues = {};

  private lastAssignedValues?: FormValues;

  private syncedFor?: FormDefinition;

  private readonly instanceId = uid('lia-form');

  /* ----- asynchronous machinery ------------------------------------- */

  private readonly asyncValidation = new AsyncValidationController({
    values: () => this.model,
    notify: () => this.notifyAsync(),
  });

  private readonly dependentOptions = new DependentOptionsController({
    values: () => this.model,
    notify: () => this.notifyAsync(),
    changed: (name, options) => this.applyOptions(name, options),
  });

  /**
   * A controller has news. Inside an update there is nothing to schedule — the
   * snapshot is rebuilt further down the same pass — and asking for one anyway
   * would spend a whole extra render cycle per keystroke.
   */
  private notifyAsync(): void {
    if (this.isUpdatePending) return;
    this.requestUpdate();
  }

  /** Every field by name, rebuilt whenever the definition changes. */
  private fieldIndex = new Map<string, ExtendedFormField>();

  /** Names that currently carry async rules — the set `retain` was given. */
  private asyncRuleNames: string[] = [];

  /** Names that currently carry derived or loaded options. */
  private dependentNames: string[] = [];

  /** Values cleared because their option list moved; announced after update. */
  private clearedByOptions: string[] = [];

  /** Fingerprint of the last `lia-validating` detail, so it fires only on change. */
  private pendingSignature = '0:';

  /* ---------------------------------------------------------------- *
   * Value model
   * ---------------------------------------------------------------- */

  /**
   * The current values. Assigning replaces the caller-supplied layer on top of
   * the definition's defaults; reading always returns the live model.
   */
  get values(): FormValues {
    return this.model;
  }

  set values(next: FormValues) {
    // lit-html re-commits object bindings on every render; only a genuinely
    // new object should reset the caller-supplied layer, or a parent that
    // re-renders would wipe what the user just typed.
    if (next === this.lastAssignedValues) return;
    this.lastAssignedValues = next;
    this.explicitValues = { ...next };
    this.model = { ...this.baseValues, ...this.explicitValues };
  }

  /** A copy of the current values — safe to mutate, safe to post. */
  getValues(): FormValues {
    return { ...this.model };
  }

  /**
   * Merge (or replace) values.
   *
   * @param next   The values to apply.
   * @param merge  `false` drops everything not mentioned in `next`.
   */
  setValues(next: FormValues, merge = true): void {
    this.explicitValues = merge ? { ...this.explicitValues, ...next } : { ...next };
    this.model = { ...this.baseValues, ...this.explicitValues };
  }

  /** Return to the definition's defaults and clear the validation state. */
  reset(): void {
    this.explicitValues = {};
    this.model = { ...this.baseValues };
    this.touched = new Set<string>();
    this.submitted = false;
    // A verdict belongs to the value it judged; the values are gone.
    for (const name of this.asyncRuleNames) this.asyncValidation.invalidate(name);
    this.emit<FormResetDetail>('lia-form-reset', { values: this.getValues() });
  }

  override disconnectedCallback(): void {
    // Nothing in flight outlives the element: no verdict can land on a form
    // that is no longer on the page, and no request keeps running for it.
    this.asyncValidation.destroy();
    this.dependentOptions.destroy();
    super.disconnectedCallback();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Moved rather than created: the loaders were cancelled on the way out, so
    // ask for one update to set them going again.
    if (this.hasUpdated) this.requestUpdate();
  }

  protected override willUpdate(): void {
    // A new definition rebuilds the defaults, but keeps whatever the caller or
    // the user has put on top — a consumer that inlines its definition object
    // must not lose the current input on every render.
    if (this.syncedFor !== this.definition) {
      this.syncedFor = this.definition;
      this.baseValues = collectInitialValues(this.definition);
      this.model = { ...this.baseValues, ...this.explicitValues };
      this.fieldIndex = flattenFieldIndex(this.definition);
    }
    this.syncAsyncWork();
  }

  protected override updated(): void {
    this.announcePending();

    if (this.clearedByOptions.length === 0) return;
    const names = this.clearedByOptions;
    this.clearedByOptions = [];
    // Announced once this update is over, so a listener reading the DOM sees
    // the select it is being told about — and so a host that mirrors the
    // values back does not land in the middle of our own render.
    void this.updateComplete.then(() => {
      for (const name of names) {
        this.emit('lia-change', {
          name,
          value: this.model[name],
          values: this.getValues(),
        });
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * Asynchronous fields
   * ---------------------------------------------------------------- */

  /** Tell the host when — and only when — the pending set actually moved. */
  private announcePending(): void {
    const pendingFields = this.pendingFields;
    const signature = `${this.validating ? '1' : '0'}:${pendingFields.join(',')}`;
    if (signature === this.pendingSignature) return;
    this.pendingSignature = signature;
    this.emit<FormValidatingDetail>('lia-validating', {
      validating: this.validating,
      pendingFields,
    });
  }

  /**
   * Bring the two controllers in line with the definition and the values.
   *
   * The `optionsFor` pass loops: clearing one select's value can perfectly
   * well be the change the next select was watching for. It is bounded, so a
   * pair of fields that keep invalidating each other degrade into a stale
   * list rather than a locked-up tab.
   */
  private syncAsyncWork(): void {
    for (let pass = 0; pass < 5; pass += 1) {
      const fields = dependentOptionFields(this.definition, this.model);
      this.dependentNames = fields.map(([name]) => name);
      if (!this.dependentOptions.sync(fields)) break;
    }

    const ruleFields = this.noValidate ? [] : asyncRuleFields(this.definition, this.model);
    this.asyncRuleNames = ruleFields.map(([name]) => name);
    this.asyncValidation.retain(ruleFields);
    // Catches the values a host put there itself — `setValues`, a new `.values`
    // object, a definition swap — none of which came past `handleFieldChange`.
    this.asyncValidation.refresh();

    const next = this.collectAsyncState();
    if (!asyncFieldStateEqual(this.asyncState, next)) this.asyncState = next;
  }

  private collectAsyncState(): AsyncFieldState {
    const clean = new Set<string>();
    for (const name of this.asyncRuleNames) {
      if (this.asyncValidation.isClean(name)) clean.add(name);
    }
    const options = new Map<string, SelectOption[]>();
    for (const name of this.dependentNames) {
      const resolved = this.dependentOptions.optionsOf(name);
      if (resolved) options.set(name, resolved);
    }
    return {
      validating: new Set(this.asyncValidation.pendingFields),
      clean,
      loadingOptions: new Set(this.dependentOptions.pendingFields),
      options,
    };
  }

  /**
   * A dependent field has new choices. Drop the selection if it is not among
   * them — a stale id that still looks well-formed is the whole reason this
   * feature exists.
   */
  private applyOptions(name: string, options: SelectOption[]): void {
    const field = this.fieldIndex.get(name);
    if (!field) return;
    const next = reconcileOptionValue(field, this.model[name], options);
    if (next === undefined) return;
    this.model = { ...this.model, [name]: next };
    this.explicitValues = { ...this.explicitValues, [name]: next };
    this.asyncValidation.invalidate(name);
    this.clearedByOptions.push(name);
  }

  /**
   * `true` while any async rule or options loader is queued or in flight.
   * A submit waits for this to go quiet.
   */
  get validating(): boolean {
    return this.asyncValidation.pending || this.dependentOptions.pending || this.settling;
  }

  /** The fields behind {@link validating}, in definition order. */
  get pendingFields(): string[] {
    const names = new Set<string>(this.asyncValidation.pendingFields);
    for (const name of this.dependentOptions.pendingFields) names.add(name);
    return Array.from(names);
  }

  /* ---------------------------------------------------------------- *
   * Validation
   * ---------------------------------------------------------------- */

  /**
   * Every current validation failure, whether or not it is on screen yet.
   *
   * Synchronous rules and the verdicts of {@link AsyncRule}s share the map,
   * keyed by field name. A synchronous failure wins: there is no point telling
   * someone their login name is taken while it is also too short.
   */
  get validationErrors(): FormErrors {
    if (this.noValidate) return {};
    const sync = validateForm(this.definition, this.model, {
      rules: this.rules,
      messages: this.messages,
    });
    return { ...this.asyncValidation.errors(), ...sync };
  }

  /**
   * `true` when nothing fails validation right now **and** nothing is still
   * being checked — an unfinished async rule is not a pass.
   */
  get isValid(): boolean {
    return !this.validating && Object.keys(this.validationErrors).length === 0;
  }

  /**
   * The messages actually rendered: server errors plus revealed client ones.
   *
   * A synchronous message waits for the field to be blurred, or for a rejected
   * submit. An {@link AsyncRule} verdict does not: the user asked for it by
   * typing, a server took the trouble to answer, and sitting on "that name is
   * already taken" until the control is left would be perverse.
   */
  get visibleErrors(): FormErrors {
    const shown: FormErrors = { ...this.errors };
    if (this.noValidate) return shown;
    Object.assign(shown, this.asyncValidation.errors());
    for (const [name, message] of Object.entries(this.syncValidationErrors)) {
      if (this.submitted || this.touched.has(name)) shown[name] = message;
    }
    return shown;
  }

  /**
   * Validate now, reveal every message, and return the failures.
   * An empty object means the form is ready to submit.
   *
   * **This waits.** Queued {@link AsyncRule} debounces fire immediately, rules
   * that have never run for the current value are run, and every outstanding
   * options loader is awaited — so the map it resolves with is the whole
   * truth, not the half of it that happened to be synchronous.
   *
   * @example
   * ```ts
   * const errors = await form.validate();
   * if (Object.keys(errors).length === 0) send(form.getValues());
   * ```
   */
  async validate(): Promise<FormErrors> {
    this.submitted = true;
    if (this.noValidate) return {};
    this.settling = true;
    try {
      await this.dependentOptions.settle();
      await this.asyncValidation.settle();
    } finally {
      this.settling = false;
    }
    return this.validationErrors;
  }

  /** The failures known without asking anybody — the synchronous rules only. */
  get syncValidationErrors(): FormErrors {
    if (this.noValidate) return {};
    return validateForm(this.definition, this.model, {
      rules: this.rules,
      messages: this.messages,
    });
  }

  /** Submit the form programmatically, exactly as the submit button would. */
  submit(): void {
    void this.runSubmit();
  }

  /* ---------------------------------------------------------------- *
   * Events
   * ---------------------------------------------------------------- */

  private handleFieldChange(event: Event): void {
    const detail = (event as CustomEvent<{ name: string; value: unknown }>).detail;
    if (!detail || typeof detail.name !== 'string') return;
    // Swallow the field's event; we re-emit one carrying the whole model.
    event.stopPropagation();
    this.model = { ...this.model, [detail.name]: detail.value };
    this.explicitValues = {
      ...this.explicitValues,
      [detail.name]: detail.value,
    };
    // The old verdict judged the old value: kill it, abort the request behind
    // it, and start again from the new one.
    this.asyncValidation.invalidate(detail.name);
    this.asyncValidation.schedule(detail.name, 'change');
    this.emit('lia-change', {
      name: detail.name,
      value: detail.value,
      values: this.getValues(),
    });
  }

  private handleFieldBlur(event: Event): void {
    const detail = (event as CustomEvent<{ name: string }>).detail;
    if (!detail?.name) return;
    event.stopPropagation();
    // Leaving the control also cuts short a debounce that is still waiting.
    this.asyncValidation.schedule(detail.name, 'blur');
    if (this.touched.has(detail.name)) return;
    const next = new Set(this.touched);
    next.add(detail.name);
    this.touched = next;
  }

  private buttonFor(submitter: HTMLElement | null): FormButton | undefined {
    const index = submitter?.dataset['liaButton'];
    if (index === undefined) return undefined;
    return this.resolvedButtons[Number(index)];
  }

  private handleSubmit(event: Event): void {
    // Never let the browser navigate: this kit is data-driven, not form-post.
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLElement | null;
    void this.runSubmit(this.buttonFor(submitter));
  }

  /**
   * The click is never dropped: it puts the button into its spinner, waits for
   * the outstanding async rules, and only then decides between `lia-submit`
   * and `lia-invalid`.
   */
  private async runSubmit(button?: FormButton): Promise<void> {
    if (this.disabled || this.busy || this.settling) return;
    const errors = await this.validate();
    if (Object.keys(errors).length > 0) {
      this.emit<FormInvalidDetail>('lia-invalid', {
        errors,
        values: this.getValues(),
      });
      void this.updateComplete.then(() => this.focusFirstInvalid(errors));
      return;
    }
    this.emit<FormSubmitDetail>('lia-submit', {
      values: this.getValues(),
      button,
    });
  }

  private handleReset(event: Event): void {
    // Our controls are value-driven; a native reset would only desync the DOM.
    event.preventDefault();
    this.reset();
  }

  /** Move focus to the first control that failed validation. */
  focusFirstInvalid(errors: FormErrors = this.validationErrors): void {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const slug = slugifyName(first);
    const id = this.idPrefix ? `${this.idPrefix}-${slug}` : slug;
    const control = this.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    control?.focus();
    control?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  /** The buttons that will be rendered — the definition's, or reset + save. */
  get resolvedButtons(): FormButton[] {
    if (this.definition.buttons?.length) return this.definition.buttons;
    return [
      { label: this.resetLabel, type: 'reset', variant: 'outline-secondary' },
      { label: this.submitLabel, type: 'submit', variant: 'primary' },
    ];
  }

  private renderButton(button: FormButton, index: number, total: number): TemplateResult {
    const type = button.type ?? 'submit';
    const variant = button.variant ?? DEFAULT_BUTTON_VARIANTS[type];
    // A pending check disables the *submit* only: nobody should be stopped
    // from resetting or cancelling because a login-name lookup is slow.
    const waiting = type === 'submit' && this.validating;
    const spinning = (this.busy || waiting) && type === 'submit';
    return html`<button
      type=${type}
      id=${ifDefined(button.id)}
      data-lia-button=${index}
      class=${cx('btn', 'btn-lg', `btn-${variant}`, index < total - 1 && 'me-md-3')}
      ?disabled=${this.disabled || this.busy || waiting}
      aria-busy=${spinning ? 'true' : nothing}
    >
      ${
        spinning
          ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
          : nothing
      }${button.label}
    </button>`;
  }

  private renderButtonBar(): TemplateResult | typeof nothing {
    if (this.noSubmit) return nothing;
    const buttons = this.resolvedButtons;
    if (buttons.length === 0) return nothing;
    return html`<div class="col-12 text-center mb-2 d-grid gap-2 d-md-block">
      ${buttons.map((button, index) => this.renderButton(button, index, buttons.length))}
    </div>`;
  }

  private renderMandatoryNote(): TemplateResult | typeof nothing {
    if (!this.mandatoryNote || !hasMandatoryField(this.definition, this.model)) return nothing;
    return html`<p class="lia-form-mandatory-note mb-0">
      <span class="text-danger" aria-hidden="true">*</span>
      ${this.mandatoryNote}
    </p>`;
  }

  protected override render(): unknown {
    const errors = this.visibleErrors;
    const sections = Object.entries(this.definition.sections ?? {}).filter(
      ([, section]) => this.showHidden || isSectionVisible(section, this.model)
    );

    return html`<form
      class="lia-form"
      id=${this.definition.id ?? this.instanceId}
      action=${ifDefined(this.action || undefined)}
      method=${this.method}
      enctype="multipart/form-data"
      novalidate
      @submit=${this.handleSubmit}
      @reset=${this.handleReset}
      @lia-change=${this.handleFieldChange}
      @lia-field-blur=${this.handleFieldBlur}
    >
      ${sections.map(
        ([id, section]) =>
          html`<lia-form-section
            .sectionId=${id}
            .section=${section}
            .values=${this.model}
            .errors=${errors}
            .labels=${this.labels}
            .asyncState=${this.asyncState}
            .disabled=${this.disabled || this.busy}
            .floating=${this.floating}
            .showHidden=${this.showHidden}
            .highlight=${this.highlight}
            .idPrefix=${this.idPrefix}
          ></lia-form-section>`
      )}
      ${Object.entries(this.hiddenFields).map(
        ([name, value]) => html`<input type="hidden" name=${name} .value=${String(value)} />`
      )}
      ${this.renderButtonBar()}${this.renderMandatoryNote()}
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-form': LiaForm;
  }
}
