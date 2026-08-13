import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LiaElement } from '../../core/base-element.js';
import type {
  AlertMessage,
  FormDefinition,
  FormErrors,
  FormSubmitDetail,
  FormValues,
} from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';
import { DEFAULT_FORM_FIELD_LABELS, type FormFieldLabels } from './field-model.js';
import type { FieldRules, ValidationMessages } from './validation.js';
import type { LiaForm } from './form.js';
import { DEFAULT_STEPPER_LABELS, type StepDescriptor, type StepperLabels } from './stepper.js';
import type { StepSelectDetail } from './stepper.js';
import './stepper.js';
import './form.js';
import '../feedback/alert-stack.js';

/** One step of a `<lia-wizard>` flow. */
export interface WizardStep extends StepDescriptor {
  /** Heading above the step body; defaults to {@link StepDescriptor.label}. */
  title?: string;
  /** Lead paragraph under the heading. Trusted HTML. */
  intro?: string;
  /** The step's form. Omit for a step that only shows something. */
  form?: FormDefinition;
  /** Arbitrary renderable body, rendered above the form. */
  content?: unknown;
  /** Let the reader continue without the step's form validating. */
  optional?: boolean;
  /** Label of the "continue" button on this step. */
  nextLabel?: string;
}

/** Why the flow moved. */
export type WizardDirection = 'next' | 'back' | 'jump';

/** Detail of `lia-wizard-step`, fired after the flow moves. */
export interface WizardStepDetail {
  id: string;
  index: number;
  previousId: string;
  direction: WizardDirection;
  values: FormValues;
}

/** Detail of `lia-wizard-finish`, fired when the last step is accepted. */
export interface WizardFinishDetail {
  values: FormValues;
}

declare global {
  interface HTMLElementEventMap {
    'lia-wizard-step': CustomEvent<WizardStepDetail>;
    'lia-wizard-finish': CustomEvent<WizardFinishDetail>;
  }
}

/**
 * A multi-step form flow: the step indicator, the current step's form, and the
 * back / next / finish bar — with per-step validation gating.
 *
 * ### How a step is accepted
 *
 * "Next" submits the step's `<lia-form>`. The form validates itself, so an
 * incomplete step never advances: it reveals its messages, focuses the first
 * offending control and emits `lia-invalid`. A valid step merges its values
 * into the accumulated model and emits `lia-wizard-step` — or
 * `lia-wizard-finish` on the last one. Pressing <kbd>Enter</kbd> in a field
 * does the same thing, because it is a real form submit.
 *
 * ### Who owns the position
 *
 * By default the wizard advances itself and `current` follows along. Add
 * `manual` when the flow lives in the URL: the events still fire, but the
 * wizard stays put until you assign `current` yourself.
 *
 * Steps already completed stay reachable through the indicator, which makes
 * "go back and fix it" free.
 *
 * @example
 * ```ts
 * html`<lia-wizard
 *   .steps=${[
 *     {
 *       id: 'database',
 *       label: 'Database',
 *       intro: 'Where the application stores its data.',
 *       form: {
 *         sections: {
 *           db: {
 *             fields: {
 *               host: { type: 'text', label: 'Host', value: 'localhost', mandatory: true },
 *               name: { type: 'text', label: 'Database', mandatory: true },
 *             },
 *           },
 *         },
 *       },
 *     },
 *     {
 *       id: 'admin',
 *       label: 'Administrator',
 *       form: {
 *         sections: {
 *           user: {
 *             fields: {
 *               login: { type: 'text', label: 'Login', mandatory: true },
 *               password: { type: 'password', label: 'Password', mandatory: true },
 *             },
 *           },
 *         },
 *       },
 *     },
 *     { id: 'done', label: 'Finish', content: 'Everything is ready.' },
 *   ]}
 *   @lia-wizard-finish=${(e: CustomEvent) => install(e.detail.values)}
 * ></lia-wizard>`
 * ```
 */
@customElement('lia-wizard')
export class LiaWizard extends LiaElement {
  /** The steps of the flow, in order. */
  @property({ attribute: false }) steps: WizardStep[] = [];

  /** Id of the step on screen. Defaults to the first one. */
  @property({ type: String }) current = '';

  /** Do not move by itself — the host assigns `current` after each event. */
  @property({ type: Boolean }) manual = false;

  /** Server-side validation messages for the current step. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Messages shown above the step body. */
  @property({ attribute: false }) alerts: AlertMessage[] = [];

  /** Extra validation rules for the current step, keyed by field name. */
  @property({ attribute: false }) rules?: Record<string, FieldRules>;

  /** Validation message overrides. */
  @property({ attribute: false }) messages?: Partial<ValidationMessages>;

  /** Overridable field-level strings. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Overridable screen-reader strings of the indicator. */
  @property({ attribute: false }) stepperLabels: StepperLabels = DEFAULT_STEPPER_LABELS;

  /** Disable every control. */
  @property({ type: Boolean }) disabled = false;

  /** Spinner in the continue button; blocks further submits. */
  @property({ type: Boolean }) busy = false;

  /** Turn client-side validation off for every step. */
  @property({ type: Boolean, attribute: 'no-validate' }) noValidate = false;

  /** Hide the step indicator. */
  @property({ type: Boolean, attribute: 'no-stepper' }) noStepper = false;

  /** Render the step body without the surrounding card. */
  @property({ type: Boolean, attribute: 'no-card' }) noCard = false;

  /** Render the step's fields with Bootstrap's floating labels. */
  @property({ type: Boolean }) floating = false;

  @property({ type: String, attribute: 'back-label' }) backLabel = 'Back';

  @property({ type: String, attribute: 'next-label' }) nextLabel = 'Next';

  @property({ type: String, attribute: 'finish-label' }) finishLabel = 'Finish';

  /** Shown when there are no steps at all. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'Nothing to do here.';

  /** Values collected from the steps accepted so far. */
  @state() private collected: FormValues = {};

  /* ---------------------------------------------------------------- *
   * Position
   * ---------------------------------------------------------------- */

  /** The steps that take part in the flow. */
  get visibleSteps(): WizardStep[] {
    return this.steps.filter((step) => step.visible !== false);
  }

  /** Zero-based index of the current step; `0` when `current` is unknown. */
  get currentIndex(): number {
    const steps = this.visibleSteps;
    const index = steps.findIndex((step) => step.id === this.current);
    return index < 0 ? 0 : index;
  }

  /** The step on screen. */
  get currentStep(): WizardStep | undefined {
    return this.visibleSteps[this.currentIndex];
  }

  /** `true` when the current step is the last one. */
  get isLast(): boolean {
    return this.currentIndex >= this.visibleSteps.length - 1;
  }

  /** `true` when the current step is the first one. */
  get isFirst(): boolean {
    return this.currentIndex <= 0;
  }

  /** The inner `<lia-form>` of the current step, when it has one. */
  get form(): LiaForm | null {
    return this.querySelector('lia-form');
  }

  /** Everything collected so far, current step included. */
  getValues(): FormValues {
    return { ...this.collected, ...(this.form?.getValues() ?? {}) };
  }

  /** Seed (or overwrite) the collected values. */
  setValues(next: FormValues, merge = true): void {
    this.collected = merge ? { ...this.collected, ...next } : { ...next };
  }

  /** Empty the collected values and return to the first step. */
  reset(): void {
    this.collected = {};
    const first = this.visibleSteps[0];
    if (first && !this.manual) this.current = first.id;
  }

  /* ---------------------------------------------------------------- *
   * Movement
   * ---------------------------------------------------------------- */

  /**
   * Try to leave the current step forwards. A step with a form is submitted,
   * so it validates first; a step without one advances immediately.
   */
  next(): void {
    if (this.disabled || this.busy) return;
    const step = this.currentStep;
    if (!step) return;
    if (step.form && !step.optional && !this.noValidate) {
      // Delegating to the form keeps validation, focus handling and the
      // `lia-invalid` event in exactly one place.
      this.form?.submit();
      return;
    }
    this.accept(this.form?.getValues() ?? {});
  }

  /** Go back one step. Nothing is validated and nothing is discarded. */
  back(): void {
    if (this.isFirst) return;
    // Keep whatever the reader typed, so returning shows it again.
    this.collected = { ...this.collected, ...(this.form?.getValues() ?? {}) };
    this.move(this.currentIndex - 1, 'back');
  }

  /** Jump to a step by id — used by the indicator. */
  goTo(id: string, direction: WizardDirection = 'jump'): void {
    const index = this.visibleSteps.findIndex((step) => step.id === id);
    if (index < 0) return;
    this.collected = { ...this.collected, ...(this.form?.getValues() ?? {}) };
    this.move(index, direction);
  }

  private accept(values: FormValues): void {
    this.collected = { ...this.collected, ...values };
    if (this.isLast) {
      this.emit<WizardFinishDetail>('lia-wizard-finish', { values: { ...this.collected } });
      return;
    }
    this.move(this.currentIndex + 1, 'next');
  }

  private move(index: number, direction: WizardDirection): void {
    const steps = this.visibleSteps;
    const target = steps[index];
    if (!target) return;
    const previousId = this.currentStep?.id ?? '';
    if (!this.manual) this.current = target.id;
    this.emit<WizardStepDetail>('lia-wizard-step', {
      id: target.id,
      index,
      previousId,
      direction,
      values: { ...this.collected },
    });
  }

  private handleStepSubmit(event: Event): void {
    // The step's form is an implementation detail; the flow speaks in
    // `lia-wizard-*` events instead.
    event.stopPropagation();
    const detail = (event as CustomEvent<FormSubmitDetail>).detail;
    this.accept(detail?.values ?? {});
  }

  private handleStepSelect(event: CustomEvent<StepSelectDetail>): void {
    event.stopPropagation();
    this.goTo(event.detail.id);
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  private renderBody(step: WizardStep): TemplateResult {
    const heading = step.title ?? step.label;
    return html`${heading ? html`<h2 class="h4 mb-3">${renderRich(heading)}</h2>` : nothing}
    ${step.intro ? html`<p class="lead">${renderRich(step.intro)}</p>` : nothing}
    ${heading || step.intro ? html`<hr />` : nothing}
    ${this.alerts.length
      ? html`<lia-alert-stack .messages=${this.alerts}></lia-alert-stack>`
      : nothing}
    ${step.content ?? nothing}
    ${step.form
      ? keyed(
          step.id,
          html`<lia-form
            no-submit
            .definition=${step.form}
            .values=${this.collected}
            .errors=${this.errors}
            .rules=${this.rules}
            .messages=${this.messages}
            .labels=${this.labels}
            .disabled=${this.disabled}
            .busy=${this.busy}
            .floating=${this.floating}
            .noValidate=${this.noValidate}
            .idPrefix=${step.id}
            @lia-submit=${this.handleStepSubmit}
          ></lia-form>`
        )
      : nothing}
    ${this.renderControls(step)}`;
  }

  private renderControls(step: WizardStep): TemplateResult {
    const first = this.isFirst;
    const last = this.isLast;
    const nextLabel = step.nextLabel ?? (last ? this.finishLabel : this.nextLabel);
    return html`<div
      class=${cx('d-flex', 'mt-4', first ? 'justify-content-end' : 'justify-content-between')}
    >
      ${first
        ? nothing
        : html`<button
            type="button"
            class="btn btn-outline-secondary"
            ?disabled=${this.disabled || this.busy}
            @click=${() => this.back()}
          >
            <i class="fa-solid fa-angle-left me-1" aria-hidden="true"></i>${this.backLabel}
          </button>`}
      <button
        type="button"
        class=${cx('btn', last ? 'btn-success' : 'btn-primary')}
        ?disabled=${this.disabled || this.busy}
        aria-busy=${this.busy ? 'true' : nothing}
        @click=${() => this.next()}
      >
        ${this.busy
          ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
          : nothing}${nextLabel}
        <i
          class=${last ? 'fa-solid fa-check ms-1' : 'fa-solid fa-angle-right ms-1'}
          aria-hidden="true"
        ></i>
      </button>
    </div>`;
  }

  protected override render(): unknown {
    const steps = this.visibleSteps;
    const step = this.currentStep;
    if (!step) {
      return html`<p class="text-body-secondary fst-italic mb-0">${this.emptyMessage}</p>`;
    }

    const body = this.renderBody(step);

    return html`<div class="lia-wizard">
      ${this.noStepper
        ? nothing
        : html`<lia-stepper
            class="mb-3"
            .steps=${steps}
            .current=${step.id}
            .labels=${this.stepperLabels}
            @lia-step-select=${this.handleStepSelect}
          ></lia-stepper>`}
      ${this.noCard
        ? body
        : html`<div class="card border-0 shadow-sm">
            <div class="card-body p-4 p-lg-5">${body}</div>
          </div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-wizard': LiaWizard;
  }
}
