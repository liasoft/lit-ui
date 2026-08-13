import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { cx } from '../../core/utils.js';
import type {
  ActionDescriptor,
  ActionEventDetail,
  ConfirmDescriptor,
  Size,
  Variant,
} from '../../core/types.js';
import { renderIcon } from './lia-icon.js';

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

/** Name of the event every action-rendering component fires when triggered. */
export const ACTION_EVENT = 'lia-action';

/**
 * Name of the event fired *instead of* {@link ACTION_EVENT} when the action
 * carries a {@link ConfirmDescriptor}.
 */
export const ACTION_CONFIRM_REQUEST_EVENT = 'lia-action-confirm-request';

/**
 * Detail of `lia-action-confirm-request`.
 *
 * The event is **cancelable**. A confirm-dialog component (the feedback
 * family's `lia-confirm-dialog`) listens for it, calls `preventDefault()` to
 * claim responsibility, shows its dialog and finally invokes {@link accept} or
 * {@link cancel}. If nobody claims the event, the action falls back to the
 * browser's native `window.confirm()` so a button is never silently inert.
 */
export interface ActionConfirmRequestDetail<Row = unknown> extends ActionEventDetail<Row> {
  /** The confirmation copy to present. */
  confirm: ConfirmDescriptor;
  /** Proceed: emits `lia-action` and performs any pending navigation. */
  accept: () => void;
  /** Abandon the action. Provided for symmetry; calling it is optional. */
  cancel: () => void;
}

declare global {
  interface HTMLElementEventMap {
    'lia-action-confirm-request': CustomEvent<ActionConfirmRequestDetail>;
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/** Options for {@link renderAction} / {@link renderActions}. */
export interface ActionRenderOptions<Row = unknown> {
  /**
   * Element the `lia-action` event is dispatched from. Defaults to the button
   * itself, which is nearly always what you want — but components should pass
   * `this` so listeners see a stable target.
   */
  host?: EventTarget;
  /** Fallback size for actions that do not carry their own. */
  size?: Size;
  /** Fallback variant for actions that do not carry their own. */
  variant?: Variant | `outline-${Variant}`;
  /** Fallback for {@link ActionDescriptor.labelResponsive}. */
  labelResponsive?: boolean;
  /** Extra classes added to every rendered control. */
  class?: string;
  /** Row context echoed back in the event detail (table cells). */
  row?: Row;
  /** Row index echoed back in the event detail. */
  index?: number;
  /** `type` for the `<button>` form of the control. Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset';
  /** Swap the icon for a spinner and disable interaction. */
  loading?: boolean;
  /** Imperative hook called before the event is dispatched. */
  onAction?: (detail: ActionEventDetail<Row>, event: Event) => void;
}

/** `visible !== false` — actions are shown unless explicitly hidden. */
export function isActionVisible(action: ActionDescriptor): boolean {
  return action.visible !== false;
}

/** Bootstrap button classes for an action. */
export function actionButtonClasses<Row = unknown>(
  action: ActionDescriptor,
  options: ActionRenderOptions<Row> = {}
): string {
  const variant = action.variant ?? options.variant ?? 'outline-secondary';
  const size = action.size ?? options.size;
  return cx(
    'btn',
    `btn-${variant}`,
    size && size !== 'md' && `btn-${size}`,
    action.disabled && 'disabled',
    options.class
  );
}

/** Dispatch a cancelable `lia-action`. Cancelling suppresses link navigation. */
export function emitAction<Row = unknown>(
  host: EventTarget,
  detail: ActionEventDetail<Row>
): CustomEvent<ActionEventDetail<Row>> {
  const event = new CustomEvent<ActionEventDetail<Row>>(ACTION_EVENT, {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail,
  });
  host.dispatchEvent(event);
  return event;
}

/**
 * Run an action: ask for confirmation if the descriptor wants it, then emit
 * `lia-action` and finally run `onAccept` (used for link navigation) unless a
 * listener cancelled the event.
 *
 * @example
 * ```ts
 * triggerAction(this, { action, id: action.id, row });
 * ```
 */
export function triggerAction<Row = unknown>(
  host: EventTarget,
  detail: ActionEventDetail<Row>,
  onAccept?: () => void
): void {
  const proceed = (): void => {
    const event = emitAction(host, detail);
    if (!event.defaultPrevented) onAccept?.();
  };

  const confirmation = detail.action.confirm;
  if (!confirmation) {
    proceed();
    return;
  }

  const request: ActionConfirmRequestDetail<Row> = {
    ...detail,
    confirm: confirmation,
    accept: proceed,
    cancel: () => undefined,
  };
  const event = new CustomEvent<ActionConfirmRequestDetail<Row>>(ACTION_CONFIRM_REQUEST_EVENT, {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: request,
  });
  host.dispatchEvent(event);

  if (event.defaultPrevented) return;

  // Nobody claimed the request — degrade to the platform dialog rather than
  // performing a destructive action unannounced.
  if (typeof globalThis.confirm !== 'function') return;
  if (globalThis.confirm(confirmation.message)) proceed();
}

/** A click the browser should handle itself (new tab, download, …). */
function isModifiedClick(event: Event): boolean {
  if (!(event instanceof MouseEvent)) return false;
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function navigateTo(href: string, target?: ActionDescriptor['target']): void {
  if (target && target !== '_self') {
    globalThis.open(href, target, 'noopener');
    return;
  }
  globalThis.location.assign(href);
}

function handleActionEvent<Row>(
  action: ActionDescriptor,
  options: ActionRenderOptions<Row>,
  event: Event
): void {
  if (action.disabled || options.loading) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Modal triggers are pure Bootstrap: let the plugin open the dialog.
  if (action.modal) return;

  const host = options.host ?? (event.currentTarget as EventTarget);
  const detail: ActionEventDetail<Row> = {
    action,
    id: action.id,
    row: options.row,
    index: options.index,
  };

  const href = action.href;
  if (href) {
    if (isModifiedClick(event)) return; // "open in new tab" and friends
    if (action.confirm) {
      // Hold the navigation until the confirmation resolves.
      event.preventDefault();
      options.onAction?.(detail, event);
      triggerAction(host, detail, () => navigateTo(href, action.target));
      return;
    }
    // Plain link: navigate natively, but let a listener cancel it.
    options.onAction?.(detail, event);
    if (emitAction(host, detail).defaultPrevented) event.preventDefault();
    return;
  }

  options.onAction?.(detail, event);
  triggerAction(host, detail, action.back ? () => globalThis.history?.back() : undefined);
}

function actionLabel(
  action: ActionDescriptor,
  responsive: boolean
): TemplateResult | typeof nothing {
  if (!action.label) return nothing;
  const spacing = action.icon ? 'ms-1' : '';
  if (responsive) {
    return html`<span class=${cx('d-none', 'd-lg-inline', action.icon && 'ms-lg-1')}
      >${action.label}</span
    >`;
  }
  return html`<span class=${spacing || nothing}>${action.label}</span>`;
}

/**
 * Render a single {@link ActionDescriptor} as a Bootstrap button or link,
 * without instantiating a custom element. This is what table cells, toolbars
 * and card headers use so a listing of 200 rows does not create 600 elements.
 *
 * - `href` renders an `<a role="button">`, everything else a `<button>`.
 * - `modal` wires the Bootstrap `data-bs-toggle="modal"` attributes.
 * - `confirm` routes through {@link triggerAction}.
 *
 * @example
 * ```ts
 * html`<td class="text-end">
 *   ${renderActions(rowActions(row), { host: this, size: 'sm', row })}
 * </td>`;
 * ```
 */
export function renderAction<Row = unknown>(
  action: ActionDescriptor,
  options: ActionRenderOptions<Row> = {}
): TemplateResult | typeof nothing {
  if (!isActionVisible(action)) return nothing;

  const classes = actionButtonClasses(action, options);
  const responsive = action.labelResponsive ?? options.labelResponsive ?? false;
  const glyph = options.loading
    ? html`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`
    : renderIcon(action.icon);
  const inner = html`${glyph}${actionLabel(action, responsive)}`;
  const onClick = (event: Event): void => handleActionEvent(action, options, event);

  // An icon-only control still needs an accessible name.
  const ariaLabel = action.label ? undefined : (action.title ?? action.id);

  if (action.modal) {
    const target = `#${action.modal.id}`;
    return html`<a
      class=${classes}
      role="button"
      href=${target}
      data-bs-toggle="modal"
      data-bs-target=${target}
      title=${ifDefined(action.title)}
      aria-label=${ifDefined(ariaLabel)}
      aria-disabled=${action.disabled ? 'true' : nothing}
      @click=${onClick}
      >${inner}</a
    >`;
  }

  if (action.href) {
    return html`<a
      class=${classes}
      role="button"
      href=${action.href}
      target=${ifDefined(action.target)}
      rel=${ifDefined(action.target === '_blank' ? 'noopener noreferrer' : undefined)}
      title=${ifDefined(action.title)}
      aria-label=${ifDefined(ariaLabel)}
      aria-disabled=${action.disabled ? 'true' : nothing}
      tabindex=${action.disabled ? '-1' : nothing}
      @click=${onClick}
      >${inner}</a
    >`;
  }

  return html`<button
    type=${options.type ?? 'button'}
    class=${classes}
    title=${ifDefined(action.title)}
    aria-label=${ifDefined(ariaLabel)}
    aria-busy=${options.loading ? 'true' : nothing}
    ?disabled=${Boolean(action.disabled) || Boolean(options.loading)}
    @click=${onClick}
  >
    ${inner}
  </button>`;
}

/**
 * Render a list of actions, skipping hidden ones. Controls are separated by a
 * single space so inline-block buttons do not collide; put them in a flex
 * container (or use `<lia-action-bar>`) when you want a controlled gap.
 */
export function renderActions<Row = unknown>(
  actions: readonly ActionDescriptor[] | undefined | null,
  options: ActionRenderOptions<Row> = {}
): TemplateResult | typeof nothing {
  const visible = (actions ?? []).filter(isActionVisible);
  if (visible.length === 0) return nothing;
  return html`${visible.map(
    (action, position) =>
      html`${position > 0 ? html` ` : nothing}${renderAction(action, options)}`
  )}`;
}
