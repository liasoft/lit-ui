/**
 * Internal helpers shared by the layout family.
 *
 * Deliberately **not** re-exported from `index.ts`: these are implementation
 * details whose names are too generic to travel through the root barrel.
 */

import { html, nothing, type TemplateResult } from 'lit';
import type { ActionDescriptor } from '../../core/types.js';
import { cx } from '../../core/utils.js';
import { renderActions } from '../primitives/render-action.js';

/**
 * Render the action toolbar of a heading bar, banner or page alert.
 *
 * Delegates to the primitives family so confirmation, modal triggers, link
 * navigation and the `lia-action` event behave exactly as they do in tables
 * and toolbars — the layout chrome only supplies the flex wrapper.
 *
 * Pass the host element so listeners see the `<lia-page-heading>` (or the
 * shell) as the event target rather than the individual button.
 */
export function renderLayoutActions(
  actions: readonly ActionDescriptor[] | undefined,
  host: EventTarget,
  wrapperClass?: string
): TemplateResult | typeof nothing {
  const visible = (actions ?? []).filter((action) => action.visible !== false);
  if (visible.length === 0) return nothing;
  return html`<div
    class=${cx('d-flex flex-wrap justify-content-end align-items-center gap-1', wrapperClass)}
  >
    ${renderActions(visible, { host, variant: 'outline-primary', labelResponsive: true })}
  </div>`;
}
