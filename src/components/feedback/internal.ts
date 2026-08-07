/**
 * Internal helpers shared by the feedback family.
 *
 * Deliberately **not** re-exported from `index.ts`: these are implementation
 * details whose names are too generic to travel through the root barrel.
 */

import { html, nothing, type TemplateResult } from 'lit';
import type { ActionDescriptor, Variant } from '../../core/types.js';
import { cx } from '../../core/utils.js';
import { renderActions, type ActionRenderOptions } from '../primitives/render-action.js';

/**
 * Default icon per contextual colour, used when an `AlertMessage` does not
 * carry one of its own. Font Awesome free class names.
 */
export const FEEDBACK_VARIANT_ICONS: Readonly<Record<Variant, string>> = Object.freeze({
  primary: 'fa-solid fa-circle-info',
  secondary: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  danger: 'fa-solid fa-circle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
  light: 'fa-solid fa-circle-info',
  dark: 'fa-solid fa-circle-info',
});

/** Icon class for a variant, falling back to the neutral info glyph. */
export function variantIcon(variant: Variant | undefined): string {
  return FEEDBACK_VARIANT_ICONS[variant ?? 'info'] ?? FEEDBACK_VARIANT_ICONS.info;
}

/**
 * Whether `text-bg-{variant}` produces a dark surface, i.e. whether a
 * `.btn-close` placed on it needs the `btn-close-white` treatment.
 */
export function variantIsDark(variant: Variant | undefined): boolean {
  return variant !== 'warning' && variant !== 'light';
}

/**
 * ARIA role for a piece of feedback. Urgent colours interrupt the screen
 * reader (`alert`), everything else is announced politely (`status`).
 */
export function feedbackRole(variant: Variant | undefined): 'alert' | 'status' {
  return variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
}

/**
 * Render a row of actions in a flex container.
 *
 * Delegates to the primitives family so confirmation, modal triggers, link
 * navigation and the `lia-action` event all behave exactly as they do in
 * tables and toolbars — feedback surfaces only supply the wrapper.
 */
export function renderActionRow<Row = unknown>(
  actions: ActionDescriptor[] | undefined,
  wrapperClass: string,
  options: ActionRenderOptions<Row>
): TemplateResult | typeof nothing {
  const visible = (actions ?? []).filter((action) => action.visible !== false);
  if (visible.length === 0) return nothing;
  return html`<div class=${cx('d-flex flex-wrap align-items-center gap-2', wrapperClass)}>
    ${renderActions(visible, options)}
  </div>`;
}

/** Name of the event a component may fire to hand an error to a boundary. */
export const ERROR_EVENT: string = 'lia-error';
