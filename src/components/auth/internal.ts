/**
 * Internal helpers shared by the auth family.
 *
 * Deliberately **not** re-exported from `index.ts`: these are implementation
 * details whose names are too generic to travel through the root barrel.
 *
 * Every auth surface is a short, hand-laid-out stack of labelled controls
 * rather than a `FormDefinition` — sign-in pages have their own rhythm (a
 * reveal toggle on the password, a strength meter glued under a field, a code
 * grid) that the generic two-column form system deliberately does not model.
 * These renderers keep that markup in one place so the six forms stay
 * consistent with each other and with Bootstrap's validation classes.
 */

import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { cx, renderRich } from '../../core/utils.js';
import type { IconName, Variant } from '../../core/types.js';

/* -------------------------------------------------------------------- *
 * Feedback
 * -------------------------------------------------------------------- */

/** Headings used by the error/success alert every auth form can show. */
export interface AuthFeedbackLabels {
  errorTitle: string;
  successTitle: string;
}

/** Options for {@link renderAuthFeedback}. */
export interface AuthFeedbackOptions extends AuthFeedbackLabels {
  /** Render the messages as trusted HTML (the twig originals used `|raw`). */
  trustedHtml?: boolean;
  /** Extra classes on the alert. */
  class?: string;
}

/**
 * The success-wins-over-error alert region shared by every auth form —
 * the `{% if successmsg %}…{% elseif message %}` cascade of the login twigs.
 */
export function renderAuthFeedback(
  error: string | undefined,
  success: string | undefined,
  options: AuthFeedbackOptions
): TemplateResult | typeof nothing {
  const alertClass = cx('mb-3', options.class);
  if (success) {
    return html`<lia-alert
      variant="success"
      heading=${options.successTitle}
      alert-class=${alertClass}
      ?trusted-html=${options.trustedHtml === true}
      .message=${success}
    ></lia-alert>`;
  }
  if (error) {
    return html`<lia-alert
      variant="danger"
      heading=${options.errorTitle}
      alert-class=${alertClass}
      ?trusted-html=${options.trustedHtml === true}
      .message=${error}
    ></lia-alert>`;
  }
  return nothing;
}

/* -------------------------------------------------------------------- *
 * Fields
 * -------------------------------------------------------------------- */

/** Everything {@link renderAuthField} needs to draw one labelled control. */
export interface AuthFieldOptions {
  /** DOM id — also the stem of the hint and error ids. */
  id: string;
  name: string;
  label: string;
  value: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
  placeholder?: string;
  autocomplete?: string;
  inputmode?: 'text' | 'email' | 'numeric' | 'tel' | 'url';
  /** Defaults to `true`; pass `false` for genuinely optional fields. */
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  /** Adds `is-invalid` and wires `aria-invalid`. */
  invalid?: boolean;
  /** Message shown below the control when `invalid`. */
  error?: string;
  /** Small helper text below the control. */
  hint?: string;
  /** Render `hint` as trusted HTML. */
  hintHtml?: boolean;
  /** Extra classes on the wrapper. Defaults to `mb-3`. */
  class?: string;
  onInput: (value: string) => void;
  onBlur?: () => void;
}

/** Ids referenced from `aria-describedby`, in the order they are rendered. */
function describedBy(options: { id: string; hint?: string; invalid?: boolean; error?: string }) {
  const ids = [
    options.hint ? `${options.id}-hint` : '',
    options.invalid && options.error ? `${options.id}-error` : '',
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/** The hint + invalid-feedback pair rendered under a control. */
function renderFieldMessages(options: {
  id: string;
  hint?: string;
  hintHtml?: boolean;
  invalid?: boolean;
  error?: string;
}): TemplateResult | typeof nothing {
  const hint = options.hint
    ? html`<div class="form-text" id="${options.id}-hint">
        ${options.hintHtml === true ? renderRich(options.hint) : options.hint}
      </div>`
    : nothing;
  const error =
    options.invalid === true && options.error
      ? html`<div class="invalid-feedback d-block" id="${options.id}-error">${options.error}</div>`
      : nothing;
  if (hint === nothing && error === nothing) return nothing;
  return html`${hint}${error}`;
}

/**
 * One labelled `<input>` row, Bootstrap-styled, with hint and error slots.
 *
 * Mirrors the `mb-3 > label.col-form-label + input.form-control` block the
 * login twigs repeat, but adds the `aria-describedby` / `aria-invalid` wiring
 * they were missing.
 */
export function renderAuthField(options: AuthFieldOptions): TemplateResult {
  return html`<div class=${options.class ?? 'mb-3'}>
    <label class="form-label" for=${options.id}>${options.label}</label>
    <input
      class=${cx('form-control', options.invalid === true && 'is-invalid')}
      id=${options.id}
      name=${options.name}
      type=${options.type ?? 'text'}
      .value=${options.value}
      placeholder=${ifDefined(options.placeholder || undefined)}
      autocomplete=${ifDefined(options.autocomplete || undefined)}
      inputmode=${ifDefined(options.inputmode)}
      ?required=${options.required !== false}
      ?disabled=${options.disabled === true}
      ?readonly=${options.readonly === true}
      aria-invalid=${options.invalid === true ? 'true' : nothing}
      aria-describedby=${ifDefined(describedBy(options))}
      @input=${(event: Event) => options.onInput((event.target as HTMLInputElement).value)}
      @blur=${() => options.onBlur?.()}
    />
    ${renderFieldMessages(options)}
  </div>`;
}

/** Options for {@link renderAuthPasswordField}. */
export interface AuthPasswordFieldOptions extends Omit<AuthFieldOptions, 'type' | 'inputmode'> {
  /** Offer the show/hide eye button. Defaults to `true`. */
  reveal?: boolean;
  /** Whether the value is currently legible. */
  revealed?: boolean;
  revealLabel?: string;
  hideLabel?: string;
  onToggleReveal?: () => void;
  /** Rendered between the control and its messages — the strength meter. */
  below?: unknown;
}

/**
 * A password field with an optional reveal toggle.
 *
 * The toggle is a real `aria-pressed` button rather than a checkbox, so a
 * screen reader announces the current state instead of a nameless control.
 */
export function renderAuthPasswordField(options: AuthPasswordFieldOptions): TemplateResult {
  const revealable = options.reveal !== false && options.onToggleReveal !== undefined;
  const revealed = revealable && options.revealed === true;
  const control = html`<input
    class=${cx('form-control', options.invalid === true && 'is-invalid')}
    id=${options.id}
    name=${options.name}
    type=${revealed ? 'text' : 'password'}
    .value=${options.value}
    placeholder=${ifDefined(options.placeholder || undefined)}
    autocomplete=${ifDefined(options.autocomplete || undefined)}
    ?required=${options.required !== false}
    ?disabled=${options.disabled === true}
    ?readonly=${options.readonly === true}
    aria-invalid=${options.invalid === true ? 'true' : nothing}
    aria-describedby=${ifDefined(describedBy(options))}
    @input=${(event: Event) => options.onInput((event.target as HTMLInputElement).value)}
    @blur=${() => options.onBlur?.()}
  />`;

  return html`<div class=${options.class ?? 'mb-3'}>
    <label class="form-label" for=${options.id}>${options.label}</label>
    ${revealable
      ? html`<div class="input-group">
          ${control}
          <button
            class="btn btn-outline-secondary"
            type="button"
            aria-pressed=${revealed ? 'true' : 'false'}
            aria-controls=${options.id}
            aria-label=${revealed
              ? (options.hideLabel ?? 'Hide password')
              : (options.revealLabel ?? 'Show password')}
            title=${revealed
              ? (options.hideLabel ?? 'Hide password')
              : (options.revealLabel ?? 'Show password')}
            ?disabled=${options.disabled === true}
            @click=${() => options.onToggleReveal?.()}
          >
            <i
              class=${revealed ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}
              aria-hidden="true"
            ></i>
          </button>
        </div>`
      : control}
    ${options.below ?? nothing}${renderFieldMessages(options)}
  </div>`;
}

/* -------------------------------------------------------------------- *
 * Switches and buttons
 * -------------------------------------------------------------------- */

/** Options for {@link renderAuthSwitch}. */
export interface AuthSwitchOptions {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  /** `switch` is the Froxlor look; `checkbox` is the plain box. */
  control?: 'switch' | 'checkbox';
  /** Render `label` as trusted HTML. */
  html?: boolean;
  /** Extra classes on the `.form-check` wrapper. */
  class?: string;
  onChange: (checked: boolean) => void;
}

/** A Bootstrap check or switch with its label. */
export function renderAuthSwitch(options: AuthSwitchOptions): TemplateResult {
  return html`<div
    class=${cx('form-check', options.control !== 'checkbox' && 'form-switch', options.class)}
  >
    <input
      class="form-check-input"
      type="checkbox"
      role=${options.control !== 'checkbox' ? 'switch' : nothing}
      id=${options.id}
      name=${options.name}
      .checked=${options.checked}
      ?disabled=${options.disabled === true}
      @change=${(event: Event) => options.onChange((event.target as HTMLInputElement).checked)}
    />
    <label class="form-check-label" for=${options.id}>
      ${options.html === true ? renderRich(options.label) : options.label}
    </label>
  </div>`;
}

/** Options for {@link renderAuthSubmit}. */
export interface AuthSubmitOptions {
  label: string;
  /** Swap the icon for a spinner and block the button. */
  loading?: boolean;
  /** Label shown while `loading`. Defaults to `label`. */
  loadingLabel?: string;
  disabled?: boolean;
  variant?: Variant | `outline-${Variant}`;
  icon?: IconName;
  /** Stretch to the full width of the card. Defaults to `true`. */
  block?: boolean;
  /** Extra classes on the wrapper. */
  class?: string;
}

/**
 * The primary submit button of an auth card — Froxlor's
 * `card-body.d-grid.gap-2 > button.btn.btn-primary`.
 */
export function renderAuthSubmit(options: AuthSubmitOptions): TemplateResult {
  const busy = options.loading === true;
  const button = html`<button
    type="submit"
    class=${cx('btn', `btn-${options.variant ?? 'primary'}`)}
    ?disabled=${busy || options.disabled === true}
    aria-busy=${busy ? 'true' : nothing}
  >
    ${busy
      ? html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>`
      : options.icon
        ? html`<i class="${options.icon} me-2" aria-hidden="true"></i>`
        : nothing}${busy ? (options.loadingLabel ?? options.label) : options.label}
  </button>`;

  return html`<div
    class=${cx(options.block === false ? 'd-flex gap-2' : 'd-grid gap-2', options.class)}
  >
    ${button}
  </div>`;
}

/** A `←`-prefixed "back to sign in" link, as used by the fpwd/rpwd cards. */
export function renderAuthBackLink(
  href: string | undefined,
  label: string,
  onClick?: (event: Event) => void
): TemplateResult | typeof nothing {
  if (!label) return nothing;
  return html`<a
    class="card-link text-body-secondary d-inline-flex align-items-center gap-1"
    href=${href || '#'}
    @click=${(event: Event) => onClick?.(event)}
  >
    <i class="fa-solid fa-angles-left" aria-hidden="true"></i>${label}
  </a>`;
}

/* -------------------------------------------------------------------- *
 * Misc
 * -------------------------------------------------------------------- */

/** Replace `{name}` placeholders in a label template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/**
 * Move focus to the first enabled control inside `root`.
 *
 * The twig templates leaned on the `autofocus` attribute, which browsers only
 * honour for markup present at parse time — useless for a component that
 * renders after hydration.
 */
export function focusFirstControl(root: ParentNode, selector = 'input, select, textarea'): void {
  const enabled = selector
    .split(',')
    .map((part) => `${part.trim()}:not([disabled])`)
    .join(', ');
  root.querySelector<HTMLElement>(enabled)?.focus();
}
