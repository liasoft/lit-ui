---
name: overview
description: Entry point for building UI with @liasoft/lit-ui, the Bootstrap 5 light-DOM web-components kit (lia-* tags). Load this whenever you see lia-* elements in templates, @liasoft/lit-ui in package.json or imports, or when asked to build admin pages, tables, forms, dashboards or auth screens in a repo that uses this kit. Maps every use case to its component family and the family skill to load next.
---

# @liasoft/lit-ui overview

A Bootstrap 5 web-components kit for admin panels, built with Lit. 70 elements, all prefixed `lia-`. Pages are described as **plain data**: a listing is a `TableListing`, a form is a `FormDefinition`, the sidebar is a `NavItem[]` — you hand the object to a component and get a complete, accessible, dark-mode-aware page. Prefer a descriptor over hand-rolled markup wherever one exists.

## Setup

```ts
import '@liasoft/lit-ui/styles.css';   // once, globally
import { initTheme } from '@liasoft/lit-ui';
initTheme();
import '@liasoft/lit-ui';              // registers all 70 elements
// or a subset: import '@liasoft/lit-ui/components/table';
```

**Light DOM, on purpose.** No shadow roots anywhere: Bootstrap's stylesheet, utility classes and JS plugins (Collapse, Dropdown, Modal, Popover) must see the rendered markup. Consequences: the stylesheet is loaded once globally, Bootstrap classes work inside every component, and the host page's CSS reaches kit internals. Do not attach shadow roots around kit elements or expect style encapsulation.

## Families — which skill to load

| Skill | Elements | Reach for it when… |
|---|---|---|
| `layout` | `lia-app-shell` `lia-navbar` `lia-sidebar` `lia-sub-sidebar` `lia-page` `lia-page-heading` `lia-footer` `lia-global-search` `lia-theme-toggle` `lia-time-range` `lia-breadcrumb` | building the application chrome: shell, navigation from `NavItem[]`, page frame with heading and toolbar |
| `primitives` | `lia-icon` `lia-button` `lia-action-bar` `lia-badge` `lia-progress` `lia-card` `lia-empty-state` `lia-spinner` `lia-copy-button` `lia-tooltip` `lia-popover` `lia-key-value` `lia-lookup` | any small building block; also the `render*` inline helpers for hot paths like table cells |
| `feedback` | `lia-alert` `lia-alert-stack` `lia-banner` `lia-modal` `lia-confirm-dialog` `lia-delete-confirm` `lia-toast` `lia-toast-container` `lia-hint` `lia-error-boundary` | alerts, modals, toasts, confirm flows; imperative `confirmAction()` / `toast()` need no placed element |
| `table` | `lia-table` `lia-data-table` `lia-pagination` | any listing — `lia-table` renders a `TableListing` (server-driven), `lia-data-table` sorts/filters/pages a local array |
| `form` | `lia-form` `lia-form-field` `lia-form-section` `lia-inline-edit` `lia-stepper` `lia-wizard` | any form — a `FormDefinition` drives 24 field types, conditional rules, async validation; never hand-wire inputs |
| `dashboard` | `lia-stat-card` `lia-stat-row` `lia-info-card` `lia-activity-list` `lia-chart` `lia-widget-grid` | KPI landing pages; a `lia-widget-grid` arranges the rest |
| `settings` | `lia-settings-page` `lia-settings-nav` `lia-settings-group` | configuration screens: filtered groups of embedded forms, anchor rail, one save bar |
| `auth` | `lia-auth-layout` `lia-login-form` `lia-forgot-password-form` `lia-reset-password-form` `lia-two-factor-form` `lia-two-factor-setup` `lia-otp-prompt` `lia-credentials-prompt` `lia-question-dialog` `lia-profile-form` `lia-password-strength` `lia-code-input` | sign-in, recovery, 2FA, re-auth prompts; presentation-only — they emit events, nothing posts |
| `editors` | `lia-record-editor` `lia-log-viewer` `lia-diff-view` `lia-code-block` `lia-api-keys-panel` `lia-file-tree` | specialised views: repeatable-record editing, log tailing, diffs, code display, API keys, file trees |

Typical page: `lia-app-shell` → `lia-page` → `lia-data-table` / `lia-form` / dashboard widgets. Load the family skill before writing components from it.

## Base classes (host apps extend these)

- **`LiaElement`** — light-DOM `LitElement` with `emit(type, detail)` for bubbling, composed `lia-*` CustomEvents. Extend for any app component that should match kit conventions.
- **`LiaTransparentElement`** — adds the `lia-transparent` class so the element is not a layout box (custom elements default to `display:inline`, which breaks flex chains and `min-height` propagation). Extend for view/wrapper elements and router outlets.
- **`LiaDataElement`** — extends transparent; implement `load(signal)`, read `loading`/`error` in `render()`. Gives abort-on-removal, `reload()`, `defer-load`, and an overridable `describe(cause)` for error messages. Extend for any fetch-then-render view instead of hand-rolling loading state.
- `LiaPassthroughElement` — keeps authored children intact; for decorating wrappers.

## Cross-cutting contracts

- **`ActionDescriptor`** — every button/toolbar/row action anywhere: `{ id, label, icon, href, variant, size, disabled, visible, confirm, modal, back, data }`. `href` renders an anchor; otherwise a button emitting `lia-action` with detail `{ action, id, row?, rows?, index? }`. `confirm: { message, title?, variant?, confirmLabel? }` routes through `lia-confirm-dialog` before the event fires — identically in page headings, table rows and bulk bars.
- **Events** — all named `lia-*`, bubbling and composed. Global map includes `lia-action`, `lia-submit` (`{ values }`), `lia-change`, `lia-sort`, `lia-page-change`, `lia-search`, `lia-selection-change`, `lia-columns-change`, `lia-navigate` (`{ url, item? }`), `lia-dismiss`.
- **`Variant`** — Bootstrap contextual colors `primary | secondary | success | danger | warning | info | light | dark` (actions also take `outline-*`). **`Size`** — `sm | md | lg`. Icons are icon-font class strings, e.g. `fa-solid fa-user`.
- **Dark mode** — Bootstrap 5.3 `data-bs-theme` on `<html>`. `initTheme()` applies the stored preference (`lia-color-scheme`, `light|dark|auto`) and tracks the OS on `auto`; `applyScheme()` sets it and fires `lia-theme-change` on `window`; `lia-theme-toggle` is the user switch. Never toggle theme classes by hand.
