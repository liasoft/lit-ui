import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { IconName, Variant } from '../../core/types.js';
import { cx, renderRich, uid } from '../../core/utils.js';
import { renderAuthSwitch } from './internal.js';
import { LiaAuthPrompt } from './prompt-base.js';

/** One button in the answer row. */
export interface QuestionAnswer {
  /** Reported as `detail.answer`. */
  id: string;
  label: string;
  variant?: Variant | `outline-${Variant}`;
  icon?: IconName;
  disabled?: boolean;
}

/** An extra opt-in shown with the question, e.g. "also delete the files". */
export interface QuestionExtra {
  /** Key the value is reported under in `detail.extras`. */
  name: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  /** `switch` is the default look; `checkbox` renders a plain box. */
  control?: 'switch' | 'checkbox';
  /** Render `label` as trusted HTML. */
  html?: boolean;
}

/** Detail of the `lia-answer` event. */
export interface QuestionAnswerDetail {
  /** The `id` of the chosen answer, or `null` when the dialog was dismissed. */
  answer: string | null;
  /** Extra name -> checked, for every {@link QuestionExtra} that was offered. */
  extras: Record<string, boolean>;
}

/** The plain yes/no pair, cancel first as modal convention wants. */
export const DEFAULT_QUESTION_ANSWERS: readonly QuestionAnswer[] = Object.freeze([
  { id: 'no', label: 'No', variant: 'secondary' },
  { id: 'yes', label: 'Yes', variant: 'danger' },
]);

/**
 * A titled question with a row of answers, an optional detail body and any
 * number of extra opt-ins.
 *
 * This generalises the reference panel's `yesnoquestion` page, whose one
 * hard-coded switch ("also delete the user's files") becomes an arbitrary
 * {@link QuestionExtra} list, and whose fixed Yes/No pair becomes any set of
 * {@link QuestionAnswer}s. Answering emits `lia-answer` with both the chosen
 * id and the state of every extra; dismissing emits the same event with
 * `answer: null`, so a single listener covers all exits.
 *
 * Awaitable too — `await dialog.ask()` resolves to the detail or `null`.
 *
 * @example
 * ```html
 * <lia-question-dialog
 *   heading="Delete this account?"
 *   question="The account and every service it owns will be removed."
 * ></lia-question-dialog>
 * ```
 *
 * @example
 * ```ts
 * const answer = await dialog.ask();
 * // answer?.answer === 'yes', answer?.extras.purgeFiles === true
 *
 * html`<lia-question-dialog
 *   .answers=${[
 *     { id: 'cancel', label: 'Keep it', variant: 'secondary' },
 *     { id: 'delete', label: 'Delete', variant: 'danger', icon: 'fa-solid fa-trash' },
 *   ]}
 *   .extras=${[{ name: 'purgeFiles', label: 'Also delete stored files', checked: true }]}
 *   @lia-answer=${(e: CustomEvent) => this.resolve(e.detail)}
 * ></lia-question-dialog>`
 * ```
 */
@customElement('lia-question-dialog')
export class LiaQuestionDialog extends LiaAuthPrompt<QuestionAnswerDetail> {
  /** The buttons offered, left to right. */
  @property({ attribute: false }) answers: readonly QuestionAnswer[] = DEFAULT_QUESTION_ANSWERS;

  /** Extra opt-ins shown between the question and the buttons. */
  @property({ attribute: false }) extras: readonly QuestionExtra[] = [];

  /** Longer explanation under the question, rendered as trusted HTML. */
  @property({ type: String }) detail = '';

  /**
   * Id of the answer focused when the dialog opens. Defaults to the first
   * non-destructive one, so a stray <kbd>Enter</kbd> cannot delete anything.
   */
  @property({ type: String, attribute: 'default-answer' }) defaultAnswer = '';

  /** Id of the answer triggered by submitting the form (pressing Enter). */
  @property({ type: String, attribute: 'submit-answer' }) submitAnswer = '';

  @state() private extraValues: Record<string, boolean> = {};

  private readonly instanceId = uid('lia-question');

  override heading = 'Are you sure?';

  override icon: IconName = 'fa-solid fa-triangle-exclamation';

  /** The current state of every extra. */
  get extraState(): Record<string, boolean> {
    return { ...this.extraValues };
  }

  /** Show the dialog and resolve with the answer, or `null` when dismissed. */
  ask(): Promise<QuestionAnswerDetail | null> {
    this.syncExtras();
    return this.request();
  }

  /** Answer programmatically, exactly as clicking the button would. */
  answer(id: string): void {
    const detail: QuestionAnswerDetail = { answer: id, extras: this.extraState };
    this.emit<QuestionAnswerDetail>('lia-answer', detail);
    this.close(detail);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('extras')) this.syncExtras();
  }

  private syncExtras(): void {
    this.extraValues = Object.fromEntries(
      this.extras.map((extra) => [extra.name, extra.checked === true])
    );
  }

  protected override focusInitial(): void {
    const target =
      this.defaultAnswer ||
      this.answers.find((entry) => entry.variant !== 'danger')?.id ||
      this.answers[0]?.id;
    if (!target) return;
    this.querySelector<HTMLButtonElement>(
      `[data-lia-answer="${CSS.escape(target)}"]`
    )?.focus();
  }

  protected override submitPrompt(): void {
    const target =
      this.submitAnswer ||
      this.answers.find((entry) => entry.variant === 'danger')?.id ||
      this.answers[this.answers.length - 1]?.id;
    if (target) this.answer(target);
  }

  protected override onCancelled(): void {
    this.emit<QuestionAnswerDetail>('lia-answer', { answer: null, extras: this.extraState });
  }

  protected override renderBody(): TemplateResult | typeof nothing {
    const detail = this.detail
      ? html`<div class="text-body-secondary">${renderRich(this.detail)}</div>`
      : nothing;
    const extras =
      this.extras.length > 0
        ? html`<div class="lia-question-extras mt-3 d-flex flex-column gap-2">
            ${this.extras.map((extra) =>
              renderAuthSwitch({
                id: `${this.instanceId}-${extra.name}`,
                name: extra.name,
                label: extra.label,
                checked: this.extraValues[extra.name] === true,
                disabled: extra.disabled === true || this.loading,
                ...(extra.control ? { control: extra.control } : {}),
                html: extra.html === true,
                class: 'mb-0',
                onChange: (checked) => {
                  this.extraValues = { ...this.extraValues, [extra.name]: checked };
                },
              })
            )}
          </div>`
        : nothing;
    if (detail === nothing && extras === nothing) return nothing;
    return html`<div class="lia-question-body">${detail}${extras}</div>`;
  }

  protected override renderFooter(): TemplateResult[] {
    return this.answers.map(
      (entry) => html`<button
        type="button"
        class=${cx('btn', `btn-${entry.variant ?? 'secondary'}`)}
        data-lia-answer=${entry.id}
        ?disabled=${entry.disabled === true || this.loading}
        @click=${() => this.answer(entry.id)}
      >
        ${entry.icon
          ? html`<i class="${entry.icon} me-2" aria-hidden="true"></i>`
          : nothing}${entry.label}
      </button>`
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-question-dialog': LiaQuestionDialog;
  }
  interface HTMLElementEventMap {
    'lia-answer': CustomEvent<QuestionAnswerDetail>;
  }
}
