import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { Variant } from '../../core/types.js';
import { cx } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { fill } from './internal.js';

/* -------------------------------------------------------------------- *
 * Scoring
 * -------------------------------------------------------------------- */

/** Which individual requirements a password satisfies. */
export interface PasswordChecks {
  /** At least `minLength` characters. */
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

/** The result of {@link scorePassword}. */
export interface PasswordScore {
  /** `0` (unusable) … `4` (very strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** Bar width, `0` for an empty password and `20`…`100` otherwise. */
  percent: number;
  /** Bootstrap contextual colour matching the score. */
  variant: Variant;
  checks: PasswordChecks;
  /** How many of lower/upper/digit/symbol are present. */
  classes: number;
}

/** Tuning knobs for {@link scorePassword}. */
export interface PasswordScoreOptions {
  /** Length below which a password can never score above "weak". Default `8`. */
  minLength?: number;
  /**
   * Lowercase fragments that force a score of `0` when contained in the
   * password. Defaults to {@link DEFAULT_PASSWORD_BLOCKLIST}.
   */
  blocklist?: readonly string[];
}

/**
 * The handful of patterns that show up in every leaked-credential dump. Kept
 * intentionally tiny — this is a hint for the user, not a policy engine; do
 * real breach checking on the server.
 */
export const DEFAULT_PASSWORD_BLOCKLIST: readonly string[] = Object.freeze([
  'password',
  'passwort',
  'qwerty',
  'qwertz',
  'letmein',
  'welcome',
  'iloveyou',
  'admin123',
  'abc123',
  '12345678',
  '11111111',
]);

/** Default strength names, indexed by score. */
export const DEFAULT_PASSWORD_STRENGTH_LABELS: readonly string[] = Object.freeze([
  'Very weak',
  'Weak',
  'Fair',
  'Strong',
  'Very strong',
]);

/** Bootstrap colour per score. */
const SCORE_VARIANTS: readonly Variant[] = Object.freeze([
  'danger',
  'danger',
  'warning',
  'info',
  'success',
]);

/** `true` when the string contains four or more consecutive code points. */
function hasRun(value: string): boolean {
  let ascending = 1;
  let descending = 1;
  for (let index = 1; index < value.length; index += 1) {
    const delta = value.charCodeAt(index) - value.charCodeAt(index - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= 4 || descending >= 4) return true;
  }
  return false;
}

/**
 * Score a password without pulling in a dictionary library.
 *
 * The heuristic rewards length first and character variety second — the order
 * that actually matters for offline cracking — then applies three penalties:
 * a short password never rises above "weak", long single-character runs and
 * alphabetic/numeric sequences cost a point each, and anything containing a
 * blocklisted fragment collapses to `0`.
 *
 * @example
 * ```ts
 * scorePassword('correct-horse-battery-staple').score; // 4
 * scorePassword('Password1').score;                    // 0 — blocklisted
 * ```
 */
export function scorePassword(
  password: string,
  options: PasswordScoreOptions = {}
): PasswordScore {
  const minLength = options.minLength ?? 8;
  const checks: PasswordChecks = {
    length: password.length >= minLength,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^\p{L}\p{N}]/u.test(password),
  };
  const classes =
    Number(checks.lower) + Number(checks.upper) + Number(checks.digit) + Number(checks.symbol);

  if (password.length === 0) {
    return { score: 0, percent: 0, variant: 'danger', checks, classes };
  }

  let points = 0;
  if (password.length >= minLength) points += 1;
  if (password.length >= minLength + 4) points += 1;
  if (password.length >= minLength + 8) points += 1;
  if (classes >= 2) points += 1;
  if (classes >= 3) points += 1;
  if (classes >= 4) points += 1;

  if (/(.)\1{2,}/.test(password)) points -= 1;
  if (hasRun(password)) points -= 1;

  let score: PasswordScore['score'];
  if (points <= 1) score = 0;
  else if (points === 2) score = 1;
  else if (points === 3) score = 2;
  else if (points === 4) score = 3;
  else score = 4;

  // A password below the minimum length is never more than "weak", however
  // exotic its characters are.
  if (!checks.length && score > 1) score = 1;

  const haystack = password.toLowerCase();
  const blocklist = options.blocklist ?? DEFAULT_PASSWORD_BLOCKLIST;
  if (blocklist.some((entry) => entry.length > 0 && haystack.includes(entry))) score = 0;

  return {
    score,
    percent: (score + 1) * 20,
    variant: SCORE_VARIANTS[score] ?? 'danger',
    checks,
    classes,
  };
}

/* -------------------------------------------------------------------- *
 * Element
 * -------------------------------------------------------------------- */

/** Detail of the `lia-password-strength` event. */
export interface PasswordStrengthDetail extends PasswordScore {
  /** The score reached or beat the element's `required` threshold. */
  acceptable: boolean;
}

/** Names of the individual requirement chips. */
export interface PasswordCheckLabels {
  length: string;
  lower: string;
  upper: string;
  digit: string;
  symbol: string;
}

/** Defaults for {@link PasswordCheckLabels}; `{min}` is the minimum length. */
export const DEFAULT_PASSWORD_CHECK_LABELS: PasswordCheckLabels = {
  length: '{min}+ characters',
  lower: 'Lowercase',
  upper: 'Uppercase',
  digit: 'Number',
  symbol: 'Symbol',
};

/**
 * A thin strength meter for a password field: a slim progress bar plus a
 * word, and optionally the list of requirements still outstanding.
 *
 * Scoring is local and dependency-free (see {@link scorePassword}), so the
 * value never leaves the page. Whenever the score changes the element emits
 * `lia-password-strength`, which is how `<lia-reset-password-form>` and
 * `<lia-profile-form>` decide whether to let the user submit.
 *
 * @example
 * ```html
 * <input id="pw" type="password" class="form-control" />
 * <lia-password-strength password="hunter2" min-length="10" show-checks></lia-password-strength>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-password-strength
 *   .password=${this.password}
 *   .required=${3}
 *   .labels=${['Unusable', 'Weak', 'Fair', 'Good', 'Excellent']}
 *   @lia-password-strength=${(e: CustomEvent) => (this.canSubmit = e.detail.acceptable)}
 * ></lia-password-strength>`
 * ```
 */
@customElement('lia-password-strength')
export class LiaPasswordStrength extends LiaElement {
  /** The password to score. */
  @property({ type: String }) password = '';

  /** Length below which the score is capped at "weak". */
  @property({ type: Number, attribute: 'min-length' }) minLength = 8;

  /** Lowest score considered acceptable, reported as `detail.acceptable`. */
  @property({ type: Number }) required = 2;

  /** Strength names, indexed by score. */
  @property({ attribute: false }) labels: readonly string[] = DEFAULT_PASSWORD_STRENGTH_LABELS;

  /** Prefix of the bar's accessible name, e.g. "Password strength: Fair". */
  @property({ type: String }) label = 'Password strength';

  /** Show the strength word next to the bar. */
  @property({ converter: flag, attribute: 'show-label' }) showLabel = true;

  /** Show a chip per unmet requirement. */
  @property({ type: Boolean, attribute: 'show-checks' }) showChecks = false;

  /** Names of the requirement chips. */
  @property({ attribute: false }) checkLabels: PasswordCheckLabels = DEFAULT_PASSWORD_CHECK_LABELS;

  /** Render nothing at all while the password is empty. */
  @property({ type: Boolean, attribute: 'show-empty' }) showEmpty = false;

  /** Fragments that collapse the score to zero. */
  @property({ attribute: false }) blocklist?: readonly string[];

  /** Extra classes on the wrapper. */
  @property({ type: String, attribute: 'meter-class' }) meterClass = '';

  /** The current score — recomputed on demand, never cached. */
  get score(): PasswordScore {
    return scorePassword(this.password, {
      minLength: this.minLength,
      ...(this.blocklist ? { blocklist: this.blocklist } : {}),
    });
  }

  /** Whether the current score reaches {@link required}. */
  get acceptable(): boolean {
    return this.password.length > 0 && this.score.score >= this.required;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('password') && !changed.has('minLength') && !changed.has('required')) return;
    const score = this.score;
    this.emit<PasswordStrengthDetail>('lia-password-strength', {
      ...score,
      acceptable: this.password.length > 0 && score.score >= this.required,
    });
  }

  private labelFor(score: PasswordScore['score']): string {
    return this.labels[score] ?? DEFAULT_PASSWORD_STRENGTH_LABELS[score] ?? '';
  }

  private renderChecks(checks: PasswordChecks): TemplateResult | typeof nothing {
    if (!this.showChecks) return nothing;
    const entries: Array<[keyof PasswordChecks, string]> = [
      ['length', fill(this.checkLabels.length, { min: this.minLength })],
      ['lower', this.checkLabels.lower],
      ['upper', this.checkLabels.upper],
      ['digit', this.checkLabels.digit],
      ['symbol', this.checkLabels.symbol],
    ];
    return html`<ul class="lia-password-checks list-unstyled d-flex flex-wrap gap-2 mt-2 mb-0">
      ${entries.map(
        ([key, text]) => html`<li
          class=${cx('small', checks[key] ? 'text-success' : 'text-body-secondary')}
        >
          <i
            class=${checks[key] ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'}
            aria-hidden="true"
          ></i>
          ${text}
        </li>`
      )}
    </ul>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.password.length === 0 && !this.showEmpty) return nothing;
    const score = this.score;
    const word = this.labelFor(score.score);

    return html`<div class=${cx('lia-password-strength mt-2', this.meterClass)}>
      <div
        class="progress lia-password-strength-bar"
        role="progressbar"
        aria-label=${this.label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${score.percent}
        aria-valuetext="${this.label}: ${word}"
      >
        <div
          class="progress-bar bg-${score.variant}"
          style="width: ${score.percent}%"
        ></div>
      </div>
      ${this.showLabel
        ? html`<div class="d-flex justify-content-end">
            <small class="text-${score.variant}">${word}</small>
          </div>`
        : nothing}
      ${this.renderChecks(score.checks)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-password-strength': LiaPasswordStrength;
  }
  interface HTMLElementEventMap {
    'lia-password-strength': CustomEvent<PasswordStrengthDetail>;
  }
}
