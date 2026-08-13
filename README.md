# @liasoft/lit-ui

A Bootstrap 5 web-components UI kit for admin panels: application shell, navigation,
dashboards, data tables and a data-driven form system — built with [Lit](https://lit.dev).

Pages are described as **plain data**. A listing is a `TableListing` object, a form is a
`FormDefinition`, the sidebar is a `NavItem[]`. You hand those to a component and get a
complete, accessible, dark-mode-aware page — no templating, no framework.

---

## Install

```bash
npm install @liasoft/lit-ui bootstrap
```

```ts
import '@liasoft/lit-ui/styles.css';
import { initTheme } from '@liasoft/lit-ui';

initTheme();
```

Import the whole kit, or just the families you need:

```ts
import '@liasoft/lit-ui';                      // registers all 70 elements
import '@liasoft/lit-ui/components/table';     // or a subset
```

### Light DOM, on purpose

Components render into the **light DOM**, not shadow DOM. This kit *is* Bootstrap: its
stylesheet, its utility classes and its JavaScript plugins (Collapse, Dropdown, Modal,
Popover) all need to see the rendered markup. Shadow roots would cut every one of those
off.

The consequence: **load `styles.css` once, globally.** There is no per-component style
encapsulation, and your own CSS can reach kit internals — which is usually what you want
in an admin UI, but it is a real trade-off worth knowing about.

---

## Claude Code

The kit ships first-class [Claude Code](https://claude.com/claude-code) support: the
repo doubles as a plugin marketplace, and the `lit-ui` plugin carries one knowledge
skill per component family plus an overview that maps use cases to families. An agent
working in your repo loads exactly the component knowledge it needs — nothing more:

```
/plugin marketplace add liasoft/lit-ui
/plugin install lit-ui@lit-ui
```

After that, asking Claude Code to "add a members listing with row actions" makes it
reach for `TableListing` and `lia-data-table` the way this README would.

---

## A complete page

```ts
import { html, render } from 'lit';
import '@liasoft/lit-ui';

render(html`
  <lia-app-shell
    brand-label="Orbit Console"
    .navItems=${nav}
    .user=${{ loginname: 'amara', isAdmin: true }}
    search-enabled
  >
    <lia-page title="Members" icon="fa-solid fa-users"
      .actions=${[{ id: 'add', label: 'Invite a member', icon: 'fa-solid fa-plus',
                    variant: 'primary' }]}
    >
      <lia-data-table
        listing-id="members"
        .columns=${[
          { key: 'name',    label: 'Name',    sortable: true },
          { key: 'quota',   label: 'Quota',   renderer: 'progressbar' },
          { key: 'active',  label: 'Active',  renderer: 'boolean' },
        ]}
        .rows=${members}
        selectable
        .rowActions=${(row) => [
          { id: 'edit',   icon: 'fa-solid fa-pen',   href: `#/members/${row.id}` },
          { id: 'delete', icon: 'fa-solid fa-trash', variant: 'outline-danger',
            confirm: { message: `Delete ${row.name}?` } },
        ]}
        @lia-action=${(e) => console.log(e.detail.action.id, e.detail.row)}
      ></lia-data-table>
    </lia-page>
  </lia-app-shell>
`, document.querySelector('#app'));
```

That is the whole page: sidebar, navbar with global search, heading bar with a toolbar,
sortable and selectable table with bulk actions, per-row confirm dialogs, pagination,
column manager and search.

---

## The families

| Family | Elements |
|---|---|
| **primitives** | `lia-icon` `lia-button` `lia-action-bar` `lia-badge` `lia-progress` `lia-card` `lia-empty-state` `lia-spinner` `lia-copy-button` `lia-tooltip` `lia-popover` `lia-key-value` |
| **layout** | `lia-app-shell` `lia-navbar` `lia-sidebar` `lia-sub-sidebar` `lia-page` `lia-page-heading` `lia-footer` `lia-global-search` `lia-theme-toggle` `lia-breadcrumb` |
| **feedback** | `lia-alert` `lia-alert-stack` `lia-banner` `lia-modal` `lia-confirm-dialog` `lia-delete-confirm` `lia-toast` `lia-toast-container` `lia-hint` `lia-error-boundary` |
| **table** | `lia-table` `lia-data-table` `lia-pagination` |
| **form** | `lia-form` `lia-form-field` `lia-form-section` `lia-inline-edit` `lia-stepper` `lia-wizard` |
| **dashboard** | `lia-stat-card` `lia-stat-row` `lia-info-card` `lia-activity-list` `lia-chart` `lia-widget-grid` |
| **settings** | `lia-settings-page` `lia-settings-nav` `lia-settings-group` |
| **auth** | `lia-auth-layout` `lia-login-form` `lia-forgot-password-form` `lia-reset-password-form` `lia-two-factor-form` `lia-two-factor-setup` `lia-otp-prompt` `lia-credentials-prompt` `lia-question-dialog` `lia-profile-form` `lia-password-strength` `lia-code-input` |
| **editors** | `lia-record-editor` `lia-log-viewer` `lia-diff-view` `lia-code-block` `lia-api-keys-panel` `lia-file-tree` |

---

## The form system

One `FormDefinition` drives everything — 24 field types, two-column rows, input-group
composition, conditional visibility and validation:

```ts
const form: FormDefinition = {
  title: 'Host settings',
  sections: {
    general: {
      title: 'General',
      icon: 'fa-solid fa-gear',
      fields: {
        hostname: {
          type: 'text',
          label: { title: 'Hostname', description: 'Fully qualified.' },
          mandatory: true,
        },
        tls: { type: 'switch', label: 'Enable TLS' },
        cert: {
          type: 'select',
          label: 'Certificate',
          options: certs,
          showWhen: { field: 'tls', truthy: true },   // conditional
        },
        quota: {
          type: 'textul',                              // number + "unlimited" (-1)
          label: 'Storage quota',
          nextTo: { unit: { type: 'select', options: units, prefix: 'per' } },
        },
      },
    },
  },
};
```

```html
<lia-form .definition=${form} @lia-submit=${(e) => save(e.detail.values)}></lia-form>
```

Field types: `text` `password` `number` `email` `url` `tel` `date` `datetime-local`
`time` `file` `hidden` `textarea` `select` `checkbox` `radio` `switch` `textul` `label`
`infotext` `longtext` `link` `itemlist` `image` `custom`.

Beyond the field types, the system supports conditional rules (`showWhen`, `hideWhen`,
`disabledWhen`, `readonlyWhen`, `requiredWhen`), cross-field validators (`requiredIf`,
`requiredUnless`, `requiredWithout`, `requiredOneOf`), debounced async validation with
abort semantics, and dependent option lists.

---

## Theming

Override the SCSS tokens before importing, and everything follows — including Bootstrap
itself:

```scss
$lia-800: #0f766e;   // your brand
$primary: $lia-800;
$lia-sidebar-width: 280px;

@use '@liasoft/lit-ui/scss/app';
```

Light and dark are both first-class via Bootstrap 5.3's `data-bs-theme`. `initTheme()`
wires the stored preference and follows the OS when set to `auto`; `<lia-theme-toggle>`
gives users the switch.

---

## The demo app

```bash
npm install
npm run dev        # http://localhost:5180
```

45 routes covering every element and every meaningful state, plus six complete page
compositions under **Full pages** — an admin dashboard, a settings page with
sub-sidebar navigation, a log viewer, a usage page, a sign-in screen and an install
wizard. Each demo shows the data object that drives it next to the live example.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | demo app with HMR |
| `npm run build` | library + demo |
| `npm run build:lib` | ES bundle, per-family entry points, `dist/liasoft-lit-ui.css`, `.d.ts` |
| `npm run typecheck` | `tsc --noEmit` (strict, no unused) |

## Status

`0.1.0`. There is no automated test suite yet — the kit is verified by a typecheck, both
builds, and a headless render of every demo route. Treat the component APIs as unstable
until `1.0`.

## License

MIT.
