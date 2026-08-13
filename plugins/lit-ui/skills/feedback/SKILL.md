---
name: feedback
description: Use when showing messages to the user with @liasoft/lit-ui - inline alerts and flash-message stacks, full-bleed banners, Bootstrap modals, "are you sure?" confirmation and delete prompts, toasts, diagnostic hint panels, and error boundaries. Covers lia-alert, lia-alert-stack, lia-banner, lia-modal, lia-confirm-dialog, lia-delete-confirm, lia-toast(-container), lia-hint, lia-error-boundary plus the toast(), confirmAction() and installConfirmHandler() helpers.
---

# Feedback

Everything the UI uses to talk back to the user. All elements are light-DOM Lit components styled by Bootstrap 5.

## When to reach for this family

- Inline message in a page: `<lia-alert>`. A list of server flash messages: `<lia-alert-stack>` — never hand-roll a `.alert` div loop.
- App-wide strip above the navbar (maintenance, trial, impersonation): `<lia-banner>` (the shell family's `lia-app-shell` renders these from its `banners` property).
- Dialogs: `<lia-modal>` — a real Bootstrap modal driven by an `open` property. Prefer it over raw Bootstrap markup; it cleans up backdrop and `modal-open` on disconnect (route changes included).
- "Are you sure?": call `confirmAction()` / `confirmActionWithOptions()` — they lazily mount a singleton `<lia-confirm-dialog>` on `document.body`. Delete flows: `<lia-delete-confirm>` or `confirmDelete()`.
- Transient notifications: call `toast()` — it mounts a singleton `<lia-toast-container>`. Place your own container only to change placement or cap.
- Diagnostic/empty/403/404 screens with remediation steps: `<lia-hint>`. Wrap fragile widgets in `<lia-error-boundary>`, which renders a hint on failure.
- Actions everywhere (`ActionDescriptor[]` on alerts, banners, toasts, hints, modal footers, toolbars, table rows) compose with this family: an action with `confirm:` goes through the shared confirm dialog once the handler is installed.

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/feedback'` for this family only; load the stylesheet (`@liasoft/lit-ui/styles.css`) once globally. Light DOM — Bootstrap classes and page CSS reach every part.

## Component reference

All action rows emit `lia-action` with `ActionEventDetail` (`{ action, id, ... }`). Dismissals emit `lia-dismiss` with `{ id?: string }`.

| Tag | Purpose | Key properties | Events |
| --- | --- | --- | --- |
| `lia-alert` | Contextual message box | `.alert` (AlertMessage), `variant`, `heading`, `message`, `trusted-html`, `icon`, `no-icon`, `dismissible`, `timeout` (ms, 0=off), `.actions`, `details` (monospace block), `alert-id` | `lia-dismiss`, `lia-action` |
| `lia-alert-stack` | Stacked alerts with per-item dismissal | `.messages` (AlertMessage[]), `dismissible` (force), `gap`, `emptyMessage`, `no-icon` | `lia-dismiss` (re-emitted with the message id) |
| `lia-banner` | Full-bleed strip above the navbar | `variant`, `message`, `heading`, `trusted-html`, `icon`, `.actions`, `dismissible`, `banner-id` | `lia-dismiss`, `lia-action` |
| `lia-modal` | Property-driven Bootstrap modal | `open` (reflected, the whole API), `heading`, `.descriptor` (ModalDescriptor), `modal-id`, `size` (`sm`/`lg`/`xl`/`fullscreen`), `centered`, `scrollable`, `static-backdrop`, `.footerActions`, `hide-footer`, `hide-header`, `.content` (template) / `body-html` / light-DOM children | `lia-modal-show` / `lia-modal-hide` (`{id}`), `lia-action` |
| `lia-confirm-dialog` | Promise-returning confirm dialog | `defaultTitle`, `defaultConfirmLabel`, `defaultCancelLabel`; methods `confirm(request)` → `Promise<boolean>`, `confirmWithOptions()` → `Promise<ConfirmResult>` | `lia-confirm` (ConfirmResult). Usually the singleton — don't place it yourself. |
| `lia-delete-confirm` | Danger button that always asks first | `entity`, `entity-type`, `heading`/`message` (`{type}`/`{entity}` substituted), `.options` (ConfirmOption[]), `.data` (echoed back), `label` (empty = icon-only), `variant`, `size`, `busy`, `disabled`, `hide-trigger` (drive via `request()`) | `lia-delete` / `lia-delete-cancel` (DeleteEventDetail: `{entity, entityType, options, data}`) |
| `lia-toast` | Single Bootstrap toast | `.message` (AlertMessage), `variant`, `heading`, `text`, `timeout` (0 = sticky), `caption`, `.actions`, `no-close`, `open` | `lia-dismiss`, `lia-toast-hide`. Normally rendered by the container. |
| `lia-toast-container` | Fixed, stacking toast region | `placement` (nine `top/middle/bottom` × `start/center/end` spots, default `top-end`), `.messages`, `defaultTimeout` (5000), `max` (6, 0 = unlimited); method `push(msg)` → id | `lia-dismiss` |
| `lia-hint` | Diagnostic/remediation panel | `variant`, `heading`, `lead`, `.body` (string or string[], trusted HTML), `.steps` (string \| HintStep: `{title, text, html, code}`), `code` (copyable block), `details` + `detailsLabel` (collapsed disclosure), `.actions`, `footnote`, `appearance` (`card`/`alert`/`plain`), `solid`, `page` (centre full-height) | `lia-action` |
| `lia-error-boundary` | Renders a hint instead of a blank area | `global` (also catch window errors/rejections), `heading`, `message`, `show-details`, `retryLabel`, `no-retry`, `.actions`, `.onError` (callback); methods `reportError()`, `reset()` | `lia-error-reset` |

```ts
html`<lia-alert-stack .messages=${msgs} @lia-dismiss=${(e) => this.drop(e.detail.id)}></lia-alert-stack>`;

html`<lia-modal .open=${this.editing} heading="Edit entry" size="lg"
  .footerActions=${[{ id: 'cancel', label: 'Cancel', variant: 'secondary' }, { id: 'save', label: 'Save', variant: 'primary' }]}
  @lia-modal-hide=${() => (this.editing = false)}
  @lia-action=${(e) => this.run(e.detail.action)}>…body…</lia-modal>`;

html`<lia-delete-confirm entity=${row.name} entity-type="project" .data=${{ id: row.id }}
  @lia-delete=${(e) => api.remove(e.detail.data.id)}></lia-delete-confirm>`;

toast('Settings saved.');
toast({ variant: 'danger', title: 'Upload failed', message: err.message, timeout: 0 });
if (await confirmAction({ message: 'Rebuild the index?', variant: 'danger' })) rebuild();
```

## Patterns and pitfalls

- **Install the confirm handler once at start-up.** Any `ActionDescriptor` with a `confirm: ConfirmDescriptor` (`{title?, message, confirmLabel?, cancelLabel?, variant?}`) makes its emitter raise a cancelable `lia-action-confirm-request` before `lia-action`; without a handler it falls back to `window.confirm()`. `installConfirmHandler()` claims those events document-wide and routes them through the styled singleton dialog. Do this in every app; it returns an uninstall function.
- **Data-driven messages.** `AlertMessage` (`{id?, variant, title?, message, html?, icon?, dismissible?, timeout?, actions?}`) is the shared shape for alerts, stacks and toasts. `html: true` renders the message as trusted HTML — never feed it user input.
- **Confirm results.** `confirmActionWithOptions()`/`confirmDelete()` resolve `{confirmed, options, data}`; extra `ConfirmOption` switches ("also delete files") come back in `options`. Dismissing via Esc/backdrop resolves `false`. Destructive (`variant: 'danger'`) prompts open focused on cancel.
- **Delete is two events.** Only `lia-delete` means proceed; a dismissed dialog fires `lia-delete-cancel`. `deletePrompt({entity, entityType})` builds the same `ConfirmDescriptor` for use on any action.
- **Modal state is two-way.** User closing (Esc/backdrop/✕) flips `open` back and fires `lia-modal-hide` — mirror it into your state there. With no `.footerActions` a default Close button renders; suppress with `hide-footer`.
- **Error contract.** Children hand failures upward via a bubbling `new CustomEvent('lia-error', {bubbles: true, composed: true, detail: {error}})`; the nearest boundary catches it. Use one `global` boundary around the app shell for window-level errors.
