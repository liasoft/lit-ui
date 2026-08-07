import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  ActionDescriptor,
  AlertMessage,
  FormDefinition,
  FormErrors,
  FormValues,
  IconName,
} from '../../core/types.js';
import { cx } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';
import { DEFAULT_FORM_FIELD_LABELS, type FormFieldLabels } from './field-model.js';
import type { FieldRules, ValidationMessages } from './validation.js';
import type { LiaForm } from './form.js';
import type { FormNoteData } from './form-note.js';
import type { ReplacerToken } from './replacer-hint.js';
import '../layout/page-heading.js';
import '../feedback/alert-stack.js';
import './form.js';
import './form-note.js';
import './replacer-hint.js';

/**
 * A complete "edit this thing" page: the heading bar with a back action and a
 * toolbar, a message region, an optional explanatory note, the form itself,
 * and — for template editors — the table of available placeholders.
 *
 * Title, icon, description and back link fall back to the ones inside the
 * {@link FormDefinition}, so a page is often nothing but
 * `<lia-form-page .definition=${def}>`.
 *
 * Anything you write inside the tag is projected **between the note and the
 * form**, which is where a related listing or a preview belongs.
 *
 * Every event of the inner `<lia-form>` (`lia-submit`, `lia-change`,
 * `lia-invalid`, `lia-reset`) bubbles straight through.
 *
 * @example
 * ```ts
 * html`<lia-form-page
 *   .definition=${definition}
 *   back-url="/keys"
 *   .alerts=${alerts}
 *   .note=${{ title: 'Heads up', text: 'The secret is shown only once.', variant: 'warning' }}
 *   @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
 * ></lia-form-page>`
 * ```
 *
 * @example
 * ```html
 * <lia-form-page back-url="/templates">
 *   <lia-table id="recent"></lia-table>
 * </lia-form-page>
 * ```
 */
@customElement('lia-form-page')
export class LiaFormPage extends LiaElement {
  /** The form description. Also supplies the heading defaults. */
  @property({ attribute: false }) definition: FormDefinition = { sections: {} };

  /**
   * Heading title; defaults to `definition.title`.
   *
   * Declared as a reactive property, so it shadows `HTMLElement.title`:
   * setting it never produces a native browser tooltip.
   */
  @property({ type: String }) override title = '';

  /** Heading icon; defaults to `definition.icon`. */
  @property({ type: String }) icon: IconName = '';

  /** Line under the title; defaults to `definition.description`. Trusted HTML. */
  @property({ type: String }) description = '';

  /** Toolbar on the right of the heading. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Prepends a "back to overview" action; defaults to `definition.backUrl`. */
  @property({ type: String, attribute: 'back-url' }) backUrl = '';

  /** Label of the generated back action. */
  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back to overview';

  /** Render the heading bar at all. */
  @property({ type: Boolean, attribute: 'no-heading' }) noHeading = false;

  /** Flash messages shown between the heading and the note. */
  @property({ attribute: false }) alerts: AlertMessage[] = [];

  /** An explanatory panel above the form. A string is treated as its text. */
  @property({ attribute: false }) note?: string | FormNoteData;

  /** Placeholder documentation rendered under the form. */
  @property({ attribute: false }) replacers?: ReplacerToken[];

  /** Heading of the placeholder table. */
  @property({ type: String, attribute: 'replacers-title' }) replacersTitle =
    'Available placeholders';

  /** Padding utilities for the content section. */
  @property({ type: String, attribute: 'content-class' }) contentClass = 'p-3 p-lg-5';

  /* ----- pass-through to <lia-form> --------------------------------- */

  /** Values to seed the form with. Pass a *new* object to apply a change. */
  @property({ attribute: false }) values: FormValues = {};

  /** Server-side validation messages. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Extra `<input type="hidden">`s appended to the form. */
  @property({ attribute: false }) hiddenFields: Record<string, string | number> = {};

  /** Extra validation rules, keyed by field name. */
  @property({ attribute: false }) rules?: Record<string, FieldRules>;

  /** Validation message overrides. */
  @property({ attribute: false }) messages?: Partial<ValidationMessages>;

  /** Overridable field-level strings. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Hide the form's button bar. */
  @property({ type: Boolean, attribute: 'no-submit' }) noSubmit = false;

  /** Disable every control and button. */
  @property({ type: Boolean }) disabled = false;

  /** Show a spinner in the submit button. */
  @property({ type: Boolean }) busy = false;

  /** Turn client-side validation off. */
  @property({ type: Boolean, attribute: 'no-validate' }) noValidate = false;

  /** Render `visible: false` fields anyway, disabled. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Name of a field to highlight, e.g. one linked to from a search result. */
  @property({ type: String }) highlight = '';

  /** Label of the default submit button. */
  @property({ type: String, attribute: 'submit-label' }) submitLabel = 'Save';

  /** Label of the default reset button. */
  @property({ type: String, attribute: 'reset-label' }) resetLabel = 'Reset';

  /** Footnote next to the red asterisk. */
  @property({ type: String, attribute: 'mandatory-note' }) mandatoryNote = 'Mandatory field';

  private readonly lightSlot = new LightSlot();

  override connectedCallback(): void {
    // Must run before Lit takes ownership of the light DOM.
    this.lightSlot.capture(this);
    super.connectedCallback();
  }

  /** The inner `<lia-form>`, once rendered. */
  get form(): LiaForm | null {
    return this.querySelector('lia-form');
  }

  /** A copy of the form's current values. */
  getValues(): FormValues {
    return this.form?.getValues() ?? {};
  }

  /** Merge (or replace) the form's values. */
  setValues(next: FormValues, merge = true): void {
    this.form?.setValues(next, merge);
  }

  /** Return the form to the definition's defaults. */
  reset(): void {
    this.form?.reset();
  }

  /** `true` while the form has an async rule or an options loader in flight. */
  get validating(): boolean {
    return this.form?.validating ?? false;
  }

  /** The field names behind {@link validating}. */
  get pendingFields(): string[] {
    return this.form?.pendingFields ?? [];
  }

  /**
   * Validate now, reveal every message, and return the failures. Waits for any
   * outstanding async rule, exactly like `<lia-form>.validate()`.
   */
  async validate(): Promise<FormErrors> {
    return (await this.form?.validate()) ?? {};
  }

  private get resolvedNote(): FormNoteData | undefined {
    if (this.note === undefined) return undefined;
    return typeof this.note === 'string' ? { text: this.note } : this.note;
  }

  private renderNote(): unknown {
    const note = this.resolvedNote;
    if (!note) return nothing;
    return html`<lia-form-note
      .title=${note.title ?? ''}
      .text=${note.text}
      .rich=${note.rich === true}
      .variant=${note.variant ?? 'info'}
      .icon=${note.icon}
    ></lia-form-note>`;
  }

  protected override render(): unknown {
    const title = this.title || this.definition.title || '';
    const icon = this.icon || this.definition.icon || '';
    const description = this.description || this.definition.description || '';
    const backUrl = this.backUrl || this.definition.backUrl || '';

    return html`${
        this.noHeading
          ? nothing
          : html`<lia-page-heading
              .title=${title}
              .icon=${icon}
              .description=${description}
              .actions=${this.actions}
              .backUrl=${backUrl}
              .backLabel=${this.backLabel}
            ></lia-page-heading>`
      }
      <section class=${cx('lia-page-content', 'flex-grow-1', this.contentClass)}>
        ${
          this.alerts.length
            ? html`<lia-alert-stack .messages=${this.alerts}></lia-alert-stack>`
            : nothing
        }
        ${this.renderNote()} ${this.lightSlot.node}
        <lia-form
          .definition=${this.definition}
          .values=${this.values}
          .errors=${this.errors}
          .hiddenFields=${this.hiddenFields}
          .rules=${this.rules}
          .messages=${this.messages}
          .labels=${this.labels}
          .noSubmit=${this.noSubmit}
          .disabled=${this.disabled}
          .busy=${this.busy}
          .noValidate=${this.noValidate}
          .showHidden=${this.showHidden}
          .highlight=${this.highlight}
          .submitLabel=${this.submitLabel}
          .resetLabel=${this.resetLabel}
          .mandatoryNote=${this.mandatoryNote}
        ></lia-form>
        ${
          this.replacers?.length
            ? html`<lia-replacer-hint
                .tokens=${this.replacers}
                .title=${this.replacersTitle}
              ></lia-replacer-hint>`
            : nothing
        }
      </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-form-page': LiaFormPage;
  }
}
