import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { ActionDescriptor, ActionEventDetail, IconName, Variant } from '../../core/types.js';
import { cx } from '../../core/utils.js';
import { LightSlot } from '../primitives/light-slot.js';
import './hint.js';
import { ERROR_EVENT } from './internal.js';

/** What the boundary caught, normalised for display. */
export interface CaughtError {
  message: string;
  stack?: string;
  /** The original value, whatever was thrown. */
  cause?: unknown;
}

const RETRY_ACTION_ID = 'lia-error-retry';

function normaliseError(error: unknown): CaughtError {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack, cause: error };
  }
  if (typeof error === 'string') return { message: error, cause: error };
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return { message, cause: error };
  }
  return { message: String(error), cause: error };
}

/**
 * Keeps one broken widget from taking the whole page down.
 *
 * Wrap a region in `<lia-error-boundary>` and any error raised inside it — a
 * failed resource, a rejected promise, or an explicit bubbling `lia-error`
 * event from a child component — replaces the region with a `<lia-hint>`
 * carrying a retry button, instead of leaving the user staring at a blank
 * area.
 *
 * By default only errors that can be attributed to the subtree are caught.
 * Set `global` to also adopt window-level errors and unhandled rejections,
 * which is what you want for a single top-level boundary around the app shell.
 *
 * @example
 * ```html
 * <lia-error-boundary heading="This panel could not be loaded" show-details>
 *   <lia-chart></lia-chart>
 * </lia-error-boundary>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-error-boundary
 *   global
 *   heading="Something went wrong"
 *   .onError=${(error) => telemetry.report(error)}
 *   @lia-error-reset=${() => this.reload()}
 * >
 *   ${this.page}
 * </lia-error-boundary>`
 * ```
 */
@customElement('lia-error-boundary')
export class LiaErrorBoundary extends LiaElement {
  /** Also catch window-level errors and unhandled promise rejections. */
  @property({ type: Boolean }) global = false;

  /** Headline of the fallback hint. */
  @property({ type: String }) heading = 'Something went wrong';

  /** Explanation shown under the headline. */
  @property({ type: String }) message =
    'An unexpected error stopped this section from rendering.';

  /** Bootstrap contextual colour of the fallback hint. */
  @property({ type: String }) variant: Variant = 'danger';

  /** Icon of the fallback hint. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-triangle-exclamation';

  /** Show the error message and stack trace behind a disclosure. */
  @property({ type: Boolean, attribute: 'show-details' }) showDetails = false;

  /** Label of the technical-details disclosure. */
  @property({ type: String }) detailsLabel = 'Technical details';

  /** Label of the retry button. */
  @property({ type: String }) retryLabel = 'Try again';

  /** Remove the retry button. */
  @property({ type: Boolean, attribute: 'no-retry' }) noRetry = false;

  /** Extra buttons rendered next to the retry button. */
  @property({ attribute: false }) actions?: ActionDescriptor[];

  /** Called with the raw value whenever the boundary catches something. */
  @property({ attribute: false }) onError?: (error: unknown) => void;

  /** How the fallback frames itself; see `<lia-hint>`. */
  @property({ type: String }) appearance: 'card' | 'alert' | 'plain' = 'card';

  /** Extra classes on the wrapper that holds the protected content. */
  @property({ type: String, attribute: 'content-class' }) contentClass?: string;

  @state() private failure?: CaughtError;

  /** Holds the protected content the consumer wrote between the tags. */
  private readonly lightSlot = new LightSlot();

  /** The error currently being displayed, if any. */
  get caught(): CaughtError | undefined {
    return this.failure;
  }

  /** Hand an error to the boundary by hand. */
  reportError(error: unknown): void {
    if (this.failure) return;
    this.failure = normaliseError(error);
    this.onError?.(error);
  }

  /** Clear the error and show the protected content again. */
  reset(): void {
    if (!this.failure) return;
    this.failure = undefined;
    this.emit<{ id?: string }>('lia-error-reset', {});
  }

  override connectedCallback(): void {
    // Lift the protected content out before lit renders over the top of it.
    this.lightSlot.capture(this);
    super.connectedCallback();
    window.addEventListener('error', this.handleWindowError, true);
    window.addEventListener('unhandledrejection', this.handleRejection);
    this.addEventListener(ERROR_EVENT, this.handleChildError);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('error', this.handleWindowError, true);
    window.removeEventListener('unhandledrejection', this.handleRejection);
    this.removeEventListener(ERROR_EVENT, this.handleChildError);
    super.disconnectedCallback();
  }

  /**
   * Capture-phase listener on `window`: resource errors do not bubble, but the
   * capture phase still passes through every ancestor, so containment against
   * this element is the reliable attribution test.
   */
  private readonly handleWindowError = (event: ErrorEvent): void => {
    const target = event.target;
    const inSubtree = target instanceof Node && target !== this && this.contains(target);
    if (!inSubtree && !this.global) return;
    this.reportError(event.error ?? event.message);
  };

  private readonly handleRejection = (event: PromiseRejectionEvent): void => {
    if (!this.global) return;
    this.reportError(event.reason);
  };

  private readonly handleChildError = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (detail && typeof detail === 'object' && 'error' in detail) {
      this.reportError((detail as { error: unknown }).error);
      return;
    }
    this.reportError(detail ?? new Error(this.message));
  };

  private handleHintAction(event: Event): void {
    const detail = (event as CustomEvent<ActionEventDetail>).detail;
    if (detail?.action?.id !== RETRY_ACTION_ID) return;
    event.stopPropagation();
    this.reset();
  }

  private get hintActions(): ActionDescriptor[] {
    const retry: ActionDescriptor[] = this.noRetry
      ? []
      : [{ id: RETRY_ACTION_ID, label: this.retryLabel, icon: 'fa-solid fa-rotate-right', variant: 'primary' }];
    return [...retry, ...(this.actions ?? [])];
  }

  protected override render(): TemplateResult {
    const failure = this.failure;
    const details = this.showDetails && failure ? (failure.stack ?? failure.message) : undefined;
    return html`<div class="lia-error-boundary">
      <div
        class=${cx('lia-error-boundary-content', this.contentClass, failure ? 'd-none' : '')}
        aria-hidden=${failure ? 'true' : 'false'}
      >
        ${this.lightSlot.node}
      </div>
      ${failure
        ? html`<lia-hint
            appearance=${this.appearance}
            variant=${this.variant}
            icon=${this.icon}
            heading=${this.heading}
            .body=${[this.message, failure.message].filter(
              (text, index, all) => Boolean(text) && all.indexOf(text) === index
            )}
            details=${details ?? ''}
            detailsLabel=${details ? this.detailsLabel : ''}
            .actions=${this.hintActions}
            @lia-action=${(event: Event) => this.handleHintAction(event)}
          ></lia-hint>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-error-boundary': LiaErrorBoundary;
  }
  interface HTMLElementEventMap {
    'lia-error-reset': CustomEvent<{ id?: string }>;
  }
}
