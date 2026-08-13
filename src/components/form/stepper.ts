import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import type { IconName } from '../../core/types.js';
import { cx, renderRich } from '../../core/utils.js';

/** How far along a step is. */
export type StepState = 'done' | 'current' | 'upcoming' | 'error' | 'disabled';

/** One step of a multi-step flow. */
export interface StepDescriptor {
  id: string;
  label: string;
  /** Second line under the label. Trusted HTML. */
  description?: string;
  /** Icon shown in the marker instead of the step number. */
  icon?: IconName;
  /** Explicit state; otherwise derived from the current step. */
  state?: StepState;
  /** Renders the step as a link. */
  href?: string;
  /** Allow jumping to this step even when it is not done yet. */
  clickable?: boolean;
  /** `false` removes the step from the indicator. */
  visible?: boolean;
}

/** Detail of `lia-step-select`, fired when a reachable step is activated. */
export interface StepSelectDetail {
  id: string;
  index: number;
  step: StepDescriptor;
}

declare global {
  interface HTMLElementEventMap {
    'lia-step-select': CustomEvent<StepSelectDetail>;
  }
}

/** Overridable strings a `<lia-stepper>` renders for screen readers. */
export interface StepperLabels {
  /** Accessible name of the indicator. */
  nav: string;
  done: string;
  current: string;
  upcoming: string;
  error: string;
  disabled: string;
  /** `{index}` and `{total}` are substituted. */
  position: string;
}

/** English defaults for {@link StepperLabels}. */
export const DEFAULT_STEPPER_LABELS: StepperLabels = {
  nav: 'Progress',
  done: 'Completed',
  current: 'Current step',
  upcoming: 'Not started',
  error: 'Needs attention',
  disabled: 'Unavailable',
  position: 'Step {index} of {total}',
};

const MARKER_CLASSES: Record<StepState, string> = {
  done: 'bg-success-subtle text-success-emphasis border-success-subtle',
  current: 'text-bg-primary border-primary',
  upcoming: 'bg-body-secondary text-body-secondary',
  error: 'text-bg-danger border-danger',
  disabled: 'bg-body-secondary text-body-secondary opacity-50',
};

const MARKER_ICONS: Partial<Record<StepState, IconName>> = {
  done: 'fa-solid fa-check',
  error: 'fa-solid fa-exclamation',
};

/**
 * Resolve each step's state: an explicit `state` wins, otherwise everything
 * before the current step is `done`, the current one is `current`, and the
 * rest are `upcoming`.
 *
 * An unknown `current` leaves every step `upcoming`.
 *
 * @example
 * ```ts
 * resolveStepStates([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 'b');
 * // → ['done', 'current']
 * ```
 */
export function resolveStepStates(
  steps: readonly StepDescriptor[],
  current: string | number
): StepState[] {
  const currentIndex =
    typeof current === 'number' ? current : steps.findIndex((step) => step.id === current);
  return steps.map((step, index) => {
    if (step.state) return step.state;
    if (currentIndex < 0) return 'upcoming';
    if (index < currentIndex) return 'done';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  });
}

/**
 * The step indicator of a multi-step flow: numbered markers with done,
 * current and upcoming states, laid out as a row from `md` up and as a
 * vertical list below it.
 *
 * States come from `current` — everything before it is done — or from each
 * step's own `state`, which is how you mark a step that failed validation
 * (`error`) or one the flow skipped (`disabled`).
 *
 * Completed steps are reachable again by default: they render as buttons (or
 * as links when the step carries an `href`) and emit `lia-step-select`. Set
 * `no-interactive` for a purely decorative indicator.
 *
 * @example
 * ```ts
 * html`<lia-stepper
 *   .steps=${[
 *     { id: 'check', label: 'Requirements', description: 'Environment check' },
 *     { id: 'database', label: 'Database' },
 *     { id: 'admin', label: 'Administrator' },
 *     { id: 'done', label: 'Finish' },
 *   ]}
 *   current="admin"
 *   @lia-step-select=${(e: CustomEvent) => goTo(e.detail.id)}
 * ></lia-stepper>`
 * ```
 */
@customElement('lia-stepper')
export class LiaStepper extends LiaElement {
  /** The steps, in order. */
  @property({ attribute: false }) steps: StepDescriptor[] = [];

  /** Id (or zero-based index) of the step the flow is on. */
  @property({ type: String }) current: string | number = '';

  /** Force a layout instead of switching at the `md` breakpoint. */
  @property({ type: String }) orientation: 'auto' | 'horizontal' | 'vertical' = 'auto';

  /** Make completed steps reachable again. */
  @property({ type: Boolean, attribute: 'no-interactive' }) noInteractive = false;

  /** Hide the step numbers, leaving only markers and labels. */
  @property({ type: Boolean, attribute: 'no-numbers' }) noNumbers = false;

  /** Overridable screen-reader strings. */
  @property({ attribute: false }) labels: StepperLabels = DEFAULT_STEPPER_LABELS;

  /** The steps actually rendered, with their resolved states. */
  get resolvedSteps(): Array<{ step: StepDescriptor; state: StepState }> {
    const visible = this.steps.filter((step) => step.visible !== false);
    const states = resolveStepStates(visible, this.current);
    return visible.map((step, index) => ({ step, state: states[index] ?? 'upcoming' }));
  }

  private isReachable(step: StepDescriptor, state: StepState): boolean {
    if (state === 'disabled' || state === 'current') return false;
    if (step.clickable === true) return true;
    if (step.href) return true;
    return !this.noInteractive && (state === 'done' || state === 'error');
  }

  private select(step: StepDescriptor, index: number, event: Event): void {
    const detail: StepSelectDetail = { id: step.id, index, step };
    const emitted = this.emit<StepSelectDetail>('lia-step-select', detail, { cancelable: true });
    // A link navigates unless a listener claims the step change.
    if (emitted.defaultPrevented) event.preventDefault();
  }

  private renderMarker(step: StepDescriptor, state: StepState, index: number): TemplateResult {
    const icon = step.icon ?? MARKER_ICONS[state];
    return html`<span
      class=${cx(
        'lia-stepper-marker',
        'rounded-circle',
        'border',
        'd-inline-flex',
        'align-items-center',
        'justify-content-center',
        'flex-shrink-0',
        MARKER_CLASSES[state]
      )}
      aria-hidden="true"
      >${icon
        ? html`<i class=${icon}></i>`
        : this.noNumbers
          ? nothing
          : html`${index + 1}`}</span
    >`;
  }

  private renderBody(step: StepDescriptor, state: StepState, index: number, total: number): TemplateResult {
    const position = this.labels.position
      .replace('{index}', String(index + 1))
      .replace('{total}', String(total));
    return html`${this.renderMarker(step, state, index)}
      <span class="lia-stepper-body">
        <span class="lia-stepper-label d-block">${renderRich(step.label)}</span>
        ${step.description
          ? html`<small class="lia-stepper-description d-block text-body-secondary"
              >${renderRich(step.description)}</small
            >`
          : nothing}
        <span class="visually-hidden">${position}. ${this.labels[state]}</span>
      </span>`;
  }

  private renderStep(
    step: StepDescriptor,
    state: StepState,
    index: number,
    total: number
  ): TemplateResult {
    const inner = this.renderBody(step, state, index, total);
    const linkClasses = cx(
      'lia-stepper-link',
      'd-flex',
      'align-items-center',
      'gap-2',
      'p-3',
      'text-start',
      this.orientation === 'horizontal' && 'flex-column text-center',
      this.orientation === 'auto' && 'flex-md-column text-md-center'
    );

    let control: TemplateResult;
    if (!this.isReachable(step, state)) {
      control = html`<span class=${cx(linkClasses, state === 'disabled' && 'opacity-50')}
        >${inner}</span
      >`;
    } else if (step.href) {
      control = html`<a
        class=${cx(linkClasses, 'link-body-emphasis')}
        href=${step.href}
        @click=${(event: MouseEvent) => this.select(step, index, event)}
        >${inner}</a
      >`;
    } else {
      control = html`<button
        type="button"
        class=${cx(linkClasses, 'btn', 'btn-link', 'link-body-emphasis', 'w-100', 'border-0')}
        @click=${(event: MouseEvent) => this.select(step, index, event)}
      >
        ${inner}
      </button>`;
    }

    return html`<li
      class=${cx('lia-stepper-step', 'flex-fill', `lia-stepper-${state}`)}
      data-state=${state}
      aria-current=${ifDefined(state === 'current' ? 'step' : undefined)}
    >
      ${control}
    </li>`;
  }

  protected override render(): unknown {
    const steps = this.resolvedSteps;
    if (steps.length === 0) return nothing;

    return html`<nav class="lia-stepper" aria-label=${this.labels.nav}>
      <ol
        class=${cx(
          'lia-stepper-list',
          'list-unstyled',
          'd-flex',
          'mb-0',
          this.orientation === 'horizontal' && 'flex-row',
          this.orientation === 'vertical' && 'flex-column',
          this.orientation === 'auto' && 'flex-column flex-md-row'
        )}
      >
        ${steps.map(({ step, state }, index) =>
          this.renderStep(step, state, index, steps.length)
        )}
      </ol>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-stepper': LiaStepper;
  }
}
