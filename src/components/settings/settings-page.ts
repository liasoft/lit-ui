import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  AlertMessage,
  FormButton,
  FormDefinition,
  FormErrors,
  FormSubmitDetail,
  FormValues,
  IconName,
} from '../../core/types.js';
import { cx, uid } from '../../core/utils.js';
import {
  collectInitialValues,
  DEFAULT_FORM_FIELD_LABELS,
  hasMandatoryField,
  slugifyName,
  type FormFieldLabels,
} from '../form/field-model.js';
import { validateForm, type FieldRules, type ValidationMessages } from '../form/validation.js';
import type { FormInvalidDetail } from '../form/form.js';
import {
  filterSettingsGroups,
  groupFields,
  normaliseFilter,
  settingsDefinition,
  settingsNavEntries,
  SETTINGS_ANCHOR_PREFIX,
  settingsGroupAnchor,
  type SettingsGroup,
  type SettingsNavEntry,
} from './settings-model.js';
import { SectionSpy } from './scroll-spy.js';
import type { SettingsNavigateDetail } from './settings-nav.js';
import './settings-group.js';
import './settings-nav.js';
import '../layout/page-heading.js';
import '../feedback/alert-stack.js';
import '../primitives/lia-empty-state.js';

/** Detail of `lia-settings-filter`, fired as the filter box is typed in. */
export interface SettingsFilterDetail {
  text: string;
  /** How many groups still have a visible setting. */
  matches: number;
}

/** Detail of `lia-settings-active`, fired when scroll-spy changes the section. */
export interface SettingsActiveDetail {
  id: string;
}

declare global {
  interface HTMLElementEventMap {
    'lia-settings-filter': CustomEvent<SettingsFilterDetail>;
    'lia-settings-active': CustomEvent<SettingsActiveDetail>;
  }
}

const DEFAULT_BUTTON_VARIANTS = {
  submit: 'primary',
  reset: 'outline-secondary',
  button: 'outline-secondary',
} as const;

/**
 * A whole settings screen: a live-filtered stack of setting groups in the main
 * column, a rail of section anchors on the right that follows the scroll, and
 * one save/reset bar for the lot.
 *
 * ### One form, many groups
 *
 * Each group is a {@link SettingsGroup} — a title, an icon and a
 * {@link FormDefinition}. The page renders them through
 * `<lia-settings-group>`, but owns a *single* value model across all of them,
 * so `lia-submit` hands you every setting on the page at once. The API mirrors
 * `<lia-form>`: {@link getValues}, {@link setValues}, {@link reset} and
 * {@link validate} all behave the same way.
 *
 * ### Filtering
 *
 * Typing in the filter box hides every setting that does not match and marks
 * the matching text with `<mark>`. Groups that lose all of their settings
 * disappear from the page *and* from the rail; when nothing matches at all an
 * empty state offers to clear the filter. Values are never touched by
 * filtering — a hidden setting keeps its value and is still submitted.
 *
 * ### Scroll-spy
 *
 * An `IntersectionObserver` keeps `activeGroup` on the group being read and
 * emits `lia-settings-active`. Set `no-spy` to drive the rail yourself.
 *
 * @example
 * ```ts
 * html`<lia-settings-page
 *   title="Server settings"
 *   icon="fa-solid fa-gears"
 *   description="Everything that applies to the whole installation."
 *   .groups=${groups}
 *   .values=${values}
 *   .alerts=${alerts}
 *   @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
 *   @lia-settings-active=${(e: CustomEvent) => history.replaceState(null, '', `#${e.detail.id}`)}
 * ></lia-settings-page>`
 * ```
 */
@customElement('lia-settings-page')
export class LiaSettingsPage extends LiaElement {
  /* -- content ---------------------------------------------------------- */

  /** The setting groups, in the order they should appear. */
  @property({ attribute: false }) groups: SettingsGroup[] = [];

  /** Id of the group the rail marks as current; scroll-spy keeps it up to date. */
  @property({ type: String, attribute: 'active-group' }) activeGroup = '';

  /** Current filter text. Bind it to keep the box under your own control. */
  @property({ type: String, attribute: 'filter-text' }) filterText = '';

  /**
   * Heading title.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * assigning it never sets the native `title` attribute.
   */
  @property({ type: String }) override title = 'Settings';

  @property({ type: String }) icon: IconName = 'fa-solid fa-gears';

  /** Line under the title. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Toolbar on the right of the heading. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Prepends a "back" action to the toolbar. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Render the heading bar at all. */
  @property({ type: Boolean, attribute: 'no-heading' }) noHeading = false;

  /** Messages between the heading and the settings. */
  @property({ attribute: false }) alerts: AlertMessage[] = [];

  /** Padding utilities for the body. */
  @property({ type: String, attribute: 'content-class' }) contentClass = 'p-3 p-lg-5';

  /* -- form model ------------------------------------------------------- */

  /** Server-side validation messages, merged with the client-side ones. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Extra `<input type="hidden">`s appended to the form (ids, tokens, …). */
  @property({ attribute: false }) hiddenFields: Record<string, string | number> = {};

  /** Extra validation rules, keyed by field name. */
  @property({ attribute: false }) rules?: Record<string, FieldRules>;

  /** Validation message overrides. */
  @property({ attribute: false }) messages?: Partial<ValidationMessages>;

  /** Overridable field-level strings. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Replace the default reset/save pair. */
  @property({ attribute: false }) buttons?: FormButton[];

  /** Disable every control and button. */
  @property({ type: Boolean }) disabled = false;

  /** Show a spinner in the submit button and block further submits. */
  @property({ type: Boolean }) busy = false;

  /** Turn client-side validation off entirely. */
  @property({ type: Boolean, attribute: 'no-validate' }) noValidate = false;

  /** Render `visible: false` fields anyway, disabled. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Name of a single setting to mark, e.g. one linked to from a search hit. */
  @property({ type: String }) highlight = '';

  /** Hide the save/reset bar — for a read-only view of the settings. */
  @property({ type: Boolean, attribute: 'no-submit' }) noSubmit = false;

  /* -- chrome ----------------------------------------------------------- */

  /** Hide the filter box. */
  @property({ type: Boolean, attribute: 'no-filter' }) noFilter = false;

  /** Hide the section rail. */
  @property({ type: Boolean, attribute: 'no-nav' }) noNav = false;

  /** Stop following the scroll position. */
  @property({ type: Boolean, attribute: 'no-spy' }) noSpy = false;

  /** Heading above the rail. */
  @property({ type: String, attribute: 'nav-title' }) navTitle = 'Sections';

  /** Accessible name of the rail. */
  @property({ type: String, attribute: 'nav-label' }) navLabel = 'Settings sections';

  /** Prefix of the anchor ids shared by the rail and the groups. */
  @property({ type: String, attribute: 'anchor-prefix' }) anchorPrefix = SETTINGS_ANCHOR_PREFIX;

  @property({ type: String, attribute: 'filter-label' }) filterLabel = 'Filter settings';

  @property({ type: String, attribute: 'filter-placeholder' }) filterPlaceholder =
    'Filter settings…';

  @property({ type: String, attribute: 'clear-filter-label' }) clearFilterLabel = 'Clear filter';

  /** Live-region template; `{count}` is the number of matching groups. */
  @property({ type: String, attribute: 'filter-status' }) filterStatus =
    '{count} matching sections';

  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Save';

  @property({ type: String, attribute: 'reset-label' }) resetLabel = 'Reset';

  /** Footnote next to the red asterisk. Empty string removes it. */
  @property({ type: String, attribute: 'mandatory-note' }) mandatoryNote = 'Mandatory field';

  @property({ type: String, attribute: 'empty-title' }) emptyTitle = 'No matching settings';

  @property({ type: String, attribute: 'empty-message' }) emptyMessage =
    'Nothing here matches the filter.';

  /* -- internals -------------------------------------------------------- */

  @state() private model: FormValues = {};

  /** Settings the user has left at least once — the ones allowed to show errors. */
  @state() private touched: ReadonlySet<string> = new Set<string>();

  /** After a rejected submit every message is shown, touched or not. */
  @state() private submitted = false;

  private baseValues: FormValues = {};

  private explicitValues: FormValues = {};

  private lastAssignedValues?: FormValues;

  private syncedFor?: SettingsGroup[];

  private mergedDefinition: FormDefinition = { sections: {} };

  /** Field name -> id of the group that declares it, for focus management. */
  private owners = new Map<string, string>();

  private filterCache?: {
    groups: SettingsGroup[];
    needle: string;
    result: SettingsGroup[];
  };

  private readonly instanceId = uid('lia-settings');

  private readonly spy = new SectionSpy({
    onChange: (id) => {
      if (id === null || id === this.activeGroup) return;
      this.activeGroup = id;
      this.emit<SettingsActiveDetail>('lia-settings-active', { id });
    },
  });

  /* ---------------------------------------------------------------- *
   * Value model
   * ---------------------------------------------------------------- */

  /**
   * The current values of every setting on the page — hidden and
   * filtered-out ones included. Assigning replaces the caller-supplied layer
   * on top of the groups' defaults.
   */
  get values(): FormValues {
    return this.model;
  }

  set values(next: FormValues) {
    // lit-html re-commits object bindings on every render; only a genuinely
    // new object should reset the caller layer, or a parent that re-renders
    // would wipe what the user just typed.
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
   * @param next  The values to apply.
   * @param merge `false` drops everything not mentioned in `next`.
   */
  setValues(next: FormValues, merge = true): void {
    this.explicitValues = merge ? { ...this.explicitValues, ...next } : { ...next };
    this.model = { ...this.baseValues, ...this.explicitValues };
  }

  /** Return every setting to its declared default and clear the messages. */
  reset(): void {
    this.explicitValues = {};
    this.model = { ...this.baseValues };
    this.touched = new Set<string>();
    this.submitted = false;
    this.emit('lia-form-reset', { values: this.getValues() });
  }

  /** The groups folded into one definition — what validation runs against. */
  get definition(): FormDefinition {
    return this.mergedDefinition;
  }

  protected override willUpdate(_changed: PropertyValues): void {
    if (this.syncedFor !== this.groups) {
      this.syncedFor = this.groups;
      this.mergedDefinition = settingsDefinition(this.groups);
      this.baseValues = collectInitialValues(this.mergedDefinition);
      this.model = { ...this.baseValues, ...this.explicitValues };
      this.owners = new Map<string, string>();
      for (const group of this.groups) {
        for (const [name] of groupFields(group)) this.owners.set(name, group.id);
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Validation
   * ---------------------------------------------------------------- */

  /** Every current validation failure, whether or not it is on screen yet. */
  get validationErrors(): FormErrors {
    if (this.noValidate) return {};
    return validateForm(this.mergedDefinition, this.model, {
      rules: this.rules,
      messages: this.messages,
    });
  }

  /** `true` when nothing fails validation right now. */
  get isValid(): boolean {
    return Object.keys(this.validationErrors).length === 0;
  }

  /** The messages actually rendered: server errors plus revealed client ones. */
  get visibleErrors(): FormErrors {
    const shown: FormErrors = { ...this.errors };
    for (const [name, message] of Object.entries(this.validationErrors)) {
      if (this.submitted || this.touched.has(name)) shown[name] = message;
    }
    return shown;
  }

  /**
   * Validate now, reveal every message, and return the failures. An empty
   * object means the page is ready to submit.
   */
  validate(): FormErrors {
    const errors = this.validationErrors;
    this.submitted = true;
    return errors;
  }

  /** Submit programmatically, exactly as the save button would. */
  submit(): void {
    this.runSubmit();
  }

  /**
   * Focus the first setting that failed validation, clearing the filter first
   * if the offending setting is currently hidden by it.
   */
  focusFirstInvalid(errors: FormErrors = this.validationErrors): void {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const owner = this.owners.get(first);
    const prefix = owner ? slugifyName(owner) : '';
    const id = prefix ? `${prefix}-${slugifyName(first)}` : slugifyName(first);
    const control = this.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!control) return;
    control.focus();
    // Guarded: `scrollIntoView` is missing in the DOM implementations used by
    // unit tests, and a failed validation must not take the page down with it.
    control.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- *
   * Filtering
   * ---------------------------------------------------------------- */

  /** The groups as they are currently rendered: visible, filtered, highlighted. */
  get visibleGroups(): SettingsGroup[] {
    const needle = normaliseFilter(this.filterText);
    const cached = this.filterCache;
    if (cached && cached.groups === this.groups && cached.needle === needle) return cached.result;
    const result = filterSettingsGroups(this.groups, needle);
    this.filterCache = { groups: this.groups, needle, result };
    return result;
  }

  /** Entries of the section rail, in sync with {@link visibleGroups}. */
  get navEntries(): SettingsNavEntry[] {
    return settingsNavEntries(this.visibleGroups);
  }

  private handleFilterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterText = input.value;
    // `visibleGroups` is memoised, so reading it here costs nothing extra.
    this.emit<SettingsFilterDetail>('lia-settings-filter', {
      text: this.filterText,
      matches: this.visibleGroups.length,
    });
  }

  /** Clear the filter and put the cursor back in the box. */
  clearFilter(): void {
    if (this.filterText === '') return;
    this.filterText = '';
    this.emit<SettingsFilterDetail>('lia-settings-filter', {
      text: '',
      matches: this.visibleGroups.length,
    });
    void this.updateComplete.then(() => {
      this.querySelector<HTMLInputElement>(`#${this.instanceId}-filter`)?.focus();
    });
  }

  /* ---------------------------------------------------------------- *
   * Scroll-spy
   * ---------------------------------------------------------------- */

  protected override updated(_changed: PropertyValues): void {
    if (this.noSpy || this.noNav) {
      this.spy.disconnect();
      return;
    }
    this.spy.observe(
      this.visibleGroups
        .map((group) => ({
          id: group.id,
          element: this.querySelector(`#${CSS.escape(settingsGroupAnchor(group.id, this.anchorPrefix))}`),
        }))
        .filter((target): target is { id: string; element: Element } => target.element !== null)
    );
  }

  override disconnectedCallback(): void {
    this.spy.disconnect();
    super.disconnectedCallback();
  }

  private handleNavigate(event: CustomEvent<SettingsNavigateDetail>): void {
    this.activeGroup = event.detail.id;
    // The observer would report the same section a moment later anyway; this
    // just keeps the rail from flickering through the sections we scroll past.
    this.spy.set(event.detail.id);
  }

  /* ---------------------------------------------------------------- *
   * Form events
   * ---------------------------------------------------------------- */

  private handleFieldChange(event: Event): void {
    const detail = (event as CustomEvent<{ name: string; value: unknown }>).detail;
    if (!detail || typeof detail.name !== 'string') return;
    // Swallow the field's event; we re-emit one carrying the whole model.
    event.stopPropagation();
    this.model = { ...this.model, [detail.name]: detail.value };
    this.explicitValues = { ...this.explicitValues, [detail.name]: detail.value };
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
    if (this.touched.has(detail.name)) return;
    const next = new Set(this.touched);
    next.add(detail.name);
    this.touched = next;
  }

  private handleSubmit(event: Event): void {
    // Never let the browser navigate: this kit is data-driven, not form-post.
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLElement | null;
    const index = submitter?.dataset['liaButton'];
    this.runSubmit(index === undefined ? undefined : this.resolvedButtons[Number(index)]);
  }

  private handleReset(event: Event): void {
    // Our controls are value-driven; a native reset would only desync the DOM.
    event.preventDefault();
    this.reset();
  }

  private runSubmit(button?: FormButton): void {
    if (this.disabled || this.busy) return;
    const errors = this.validate();
    if (Object.keys(errors).length > 0) {
      this.emit<FormInvalidDetail>('lia-invalid', { errors, values: this.getValues() });
      void this.updateComplete.then(() => this.focusFirstInvalid(errors));
      return;
    }
    this.emit<FormSubmitDetail>('lia-submit', { values: this.getValues(), button });
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  /** The buttons that will be rendered — yours, or reset + save. */
  get resolvedButtons(): FormButton[] {
    if (this.buttons?.length) return this.buttons;
    return [
      { label: this.resetLabel, type: 'reset', variant: 'outline-secondary' },
      { label: this.submitLabel, type: 'submit', variant: 'primary' },
    ];
  }

  private renderButton(button: FormButton, index: number, total: number): TemplateResult {
    const type = button.type ?? 'submit';
    const variant = button.variant ?? DEFAULT_BUTTON_VARIANTS[type];
    const spinning = this.busy && type === 'submit';
    return html`<button
      type=${type}
      id=${button.id ?? nothing}
      data-lia-button=${index}
      class=${cx('btn', 'btn-lg', `btn-${variant}`, index < total - 1 && 'me-md-3')}
      ?disabled=${this.disabled || this.busy}
      aria-busy=${spinning ? 'true' : nothing}
    >
      ${spinning
        ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
        : nothing}${button.label}
    </button>`;
  }

  private renderFilter(matches: number): unknown {
    if (this.noFilter) return nothing;
    const id = `${this.instanceId}-filter`;
    return html`<div class="lia-settings-filter mb-3">
      <div class="input-group">
        <span class="input-group-text" aria-hidden="true">
          <i class="fa-solid fa-magnifying-glass"></i>
        </span>
        <input
          id=${id}
          type="search"
          class="form-control"
          autocomplete="off"
          placeholder=${this.filterPlaceholder}
          aria-label=${this.filterLabel}
          aria-controls=${`${this.instanceId}-groups`}
          .value=${this.filterText}
          @input=${this.handleFilterInput}
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          title=${this.clearFilterLabel}
          aria-label=${this.clearFilterLabel}
          ?disabled=${this.filterText === ''}
          @click=${() => this.clearFilter()}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <p class="visually-hidden" role="status" aria-live="polite">
        ${this.filterText ? this.filterStatus.replace('{count}', String(matches)) : ''}
      </p>
    </div>`;
  }

  private renderMandatoryNote(): unknown {
    if (!this.mandatoryNote || !hasMandatoryField(this.mergedDefinition, this.model)) return nothing;
    return html`<p class="lia-form-mandatory-note mb-0">
      <span class="text-danger" aria-hidden="true">*</span> ${this.mandatoryNote}
    </p>`;
  }

  private renderEmpty(): TemplateResult {
    return html`<lia-empty-state
      .title=${this.emptyTitle}
      .message=${this.emptyMessage}
      icon="fa-solid fa-filter-circle-xmark"
      variant="info"
      .actions=${[
        {
          id: 'clear-filter',
          label: this.clearFilterLabel,
          icon: 'fa-solid fa-xmark',
          variant: 'outline-secondary' as const,
        },
      ]}
      @lia-action=${(event: CustomEvent) => {
        event.stopPropagation();
        this.clearFilter();
      }}
    ></lia-empty-state>`;
  }

  protected override render(): unknown {
    const groups = this.visibleGroups;
    const errors = this.visibleErrors;
    const buttons = this.resolvedButtons;

    return html`${this.noHeading
      ? nothing
      : html`<lia-page-heading
          .title=${this.title}
          .icon=${this.icon}
          .description=${this.description}
          .actions=${this.actions}
          .backUrl=${this.backUrl}
          .backLabel=${this.backLabel}
        ></lia-page-heading>`}
    ${this.alerts.length
      ? html`<div class="px-3 px-lg-5 pt-3">
          <lia-alert-stack .messages=${this.alerts}></lia-alert-stack>
        </div>`
      : nothing}
    <div
      class=${cx('lia-settings-body', 'd-flex', 'align-items-start', 'gap-lg-4', this.contentClass)}
      @lia-settings-navigate=${this.handleNavigate}
    >
      <div class="lia-settings-main flex-grow-1 min-w-0">
        ${this.renderFilter(groups.length)}
        ${this.noNav
          ? nothing
          : html`<lia-settings-nav
              class="d-lg-none"
              layout="inline"
              .items=${this.navEntries}
              .active=${this.activeGroup}
              .label=${this.navLabel}
              .anchorPrefix=${this.anchorPrefix}
            ></lia-settings-nav>`}
        <form
          class="lia-settings-form"
          id=${`${this.instanceId}-groups`}
          novalidate
          @submit=${this.handleSubmit}
          @reset=${this.handleReset}
          @lia-change=${this.handleFieldChange}
          @lia-field-blur=${this.handleFieldBlur}
        >
          ${groups.length === 0
            ? this.renderEmpty()
            : groups.map(
                (group) => html`<lia-settings-group
                  .group=${group}
                  .values=${this.model}
                  .errors=${errors}
                  .labels=${this.labels}
                  .disabled=${this.disabled || this.busy}
                  .showHidden=${this.showHidden}
                  .highlight=${this.highlight}
                  .anchorPrefix=${this.anchorPrefix}
                ></lia-settings-group>`
              )}
          ${Object.entries(this.hiddenFields).map(
            ([name, value]) => html`<input type="hidden" name=${name} .value=${String(value)} />`
          )}
          ${this.noSubmit || buttons.length === 0
            ? nothing
            : html`<div class="col-12 text-center mb-2 d-grid gap-2 d-md-block">
                ${buttons.map((button, index) =>
                  this.renderButton(button, index, buttons.length)
                )}
              </div>`}
          ${this.renderMandatoryNote()}
        </form>
      </div>
      ${this.noNav
        ? nothing
        : html`<lia-settings-nav
            layout="rail"
            sticky
            .items=${this.navEntries}
            .active=${this.activeGroup}
            .heading=${this.navTitle}
            .label=${this.navLabel}
            .anchorPrefix=${this.anchorPrefix}
          ></lia-settings-nav>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-settings-page': LiaSettingsPage;
  }
}
