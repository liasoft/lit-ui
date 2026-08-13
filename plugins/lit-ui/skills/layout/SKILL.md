---
name: layout
description: Use when building the application chrome of an admin UI with @liasoft/lit-ui — the app shell, navbar, sidebars, page wrapper, page heading, breadcrumb, footer, global search, theme toggle, or a dashboard time-range picker. Covers the NavItem[]/ActionDescriptor data shapes, lia-navigate/lia-search/lia-action event contracts, light-DOM content projection, and initTheme().
---

# App shell & layout

## When to reach for this family

Every screen of an admin app lives inside this chrome. Prefer `<lia-app-shell>` over hand-assembling navbar + rails + footer: it wires the sidebar toggler, projects your content into `<main>`, and re-emits every child event. Inside the shell, wrap each screen in `<lia-page>` rather than hand-rolling a title bar + alert region — the shell detects a projected `lia-page` and drops its own padding. Use `<lia-page-heading>` alone only when you need a title bar outside a page (e.g. above a card). `<lia-breadcrumb>`, `<lia-time-range>`, `<lia-theme-toggle>` and `<lia-footer>` also work standalone. Heading/banner action toolbars are `ActionDescriptor[]` rendered by the primitives family's `renderActions`, so `confirm:` on an action opens `lia-confirm-dialog` (feedback family) exactly as in a table row. `lia-auth-layout` is NOT here — that is the auth family.

## Setup

`import '@liasoft/lit-ui'` registers everything (or just `import '@liasoft/lit-ui/components/layout'`); load `@liasoft/lit-ui/styles.css` once globally; call `initTheme()` (from the root export, `core/theme`) once at start-up to apply the persisted colour scheme and track the OS in `auto`. Everything renders into the light DOM — no shadow roots, so Bootstrap classes and page CSS reach every element, and there is no `<slot>`.

## Component reference

### Shared data shapes (core/types)

```ts
NavItem: { id?, label, url?, icon?, active?, visible?, external?, addUrl?,
           badge?: { text, variant? }, items?: NavItem[] }   // items => collapsible group
UserInfo: { loginname, name?, email?, avatarUrl?, isAdmin? }
UserMenuItem: { id?, label, icon?, href?, external?, divider?, visible? }
SearchResult: { label, url, description?, icon?, group? }
AlertMessage: { id?, variant, message, title?, html?, icon?, dismissible?, actions? }
ActionDescriptor: { id?, label?, icon?, href?, variant?, size?, confirm?, modal?, data?, ... }
```

### `lia-app-shell` — the whole chrome: banners, navbar, sidebar, main + footer, sub-sidebar

| Property | Type | Notes |
|---|---|---|
| `.navItems` / `.subNavItems` | `NavItem[]` | primary rail / right rail (empty hides it) |
| `sub-nav-title`, `sub-nav-sticky` | string, bool | right-rail heading; keep in view on scroll |
| `brand-label`, `brand-logo`, `brand-href` | string | brand block |
| `.user`, `.userMenu`, `logout-href` | — | account dropdown; empty href → pure `lia-logout` button |
| `home-href`, `home-label` | string | empty href hides home link |
| `search-enabled`, `search-placeholder`, `.searchResults`, `search-loading`, `search-error` | — | controlled search: assign results after `lia-search` |
| `.banners` | `AlertMessage[]` | full-bleed strips above the navbar |
| `show-footer`, `footer-text`, `.footerLinks`, `footer-version`, `footer-note`, `footer-logo` | — | footer passthrough |
| `content-class` | string | content padding; auto: none for `lia-page`, else `p-3 p-lg-5` |
| `collapsed-sidebar`, `show-theme-toggle`, `.navExtra` | — | start collapsed; theme switcher; extra utility-nav content |

Methods: `appendContent(node)`, `clearContent()`, `toggleSidebar(show?)`. Events bubbling out: `lia-navigate` (cancelable), `lia-search`, `lia-action`, `lia-logout`, `lia-dismiss`.

```ts
html`<lia-app-shell brand-label="Acme" home-href="/" .navItems=${nav} .user=${user}
  .userMenu=${menu} .searchResults=${hits} footer-text="&copy; 2026 Acme"
  @lia-navigate=${(e) => { e.preventDefault(); router.go(e.detail.url); }}
  @lia-search=${(e) => load(e.detail.text)}>
  <lia-page title="Volumes" icon="fa-solid fa-database">…</lia-page>
</lia-app-shell>`
```

### `lia-page` — heading + alert region + content, dropped into the shell

Key props: `title` (bind `.title` to avoid the native tooltip), `icon`, `description` (trusted HTML), `.badge` `{text, variant?}`, `.actions: ActionDescriptor[]`, `back-url`/`back-label`, `.alerts: AlertMessage[]`, `show-heading`, `content-class` (default `p-3 p-lg-5`). Emits `lia-action`, `lia-dismiss {id}`. Also has `appendContent`/`clearContent`.

### `lia-page-heading` — title bar, usually rendered by `lia-page`

Standalone use: `title`, `icon`, `description`, `.badge`, `.actions`, `back-url`/`back-label`/`back-icon` (prepends a back action), `level` (1–6, default 5, all styled `h5`). Buttons without `href` emit `lia-action` with the descriptor; anchors navigate but still emit.

### `lia-sidebar` — primary dark rail; usually rendered by the shell

`.items: NavItem[]`, `collapse-id` (navbar toggler target), `collapsed`, `label`, `add-label`, `external-label`. Nested `items` become Bootstrap collapse groups; the group holding the `active` entry opens on first render. Emits cancelable `lia-navigate {url, item}`.

### `lia-sub-sidebar` — light right rail (page TOC); usually rendered by the shell

`.items: NavItem[]`, `.title`, `sticky`, `label`. Hidden below `lg`; renders nothing when empty; no collapsing. Emits `lia-navigate`.

### `lia-navbar` — top bar; usually rendered by the shell

Standalone props mirror the shell's brand/user/search/home/logout set, plus `sidebar-id`, `show-logout`, `no-shadow`, `.extra` (renderable placed before the home link; `<li class="nav-item">` children written inside the tag are moved there too). Emits `lia-logout {user}` (cancelable), `lia-navigate` from user-menu items.

### `lia-global-search` — debounced, controlled search box (the navbar hosts one)

`.results: SearchResult[]`, `loading`, `error` (non-empty string → error row), `min-chars` (3), `delay` (250), `field` (echoed in the event), `placeholder`, plus text props (`min-chars-text`, `empty-text`, `loading-text`, `error-text`). Emits `lia-search {field, text}`; picking a hit emits cancelable `lia-navigate`. It never fetches — you assign `results` after handling `lia-search`. `reset()` clears it. Results sharing a `group` render under a group header; full keyboard support built in.

### `lia-breadcrumb` — Bootstrap breadcrumb from a `NavItem[]` trail

`.items` (root first; last or `active` entry renders as plain text), `home-href`/`home-icon`/`home-label` (icon-only home crumb), `divider` (CSS content string like `'›'`), `list-class`. Emits cancelable `lia-navigate`.

```ts
html`<lia-breadcrumb home-href="/" .items=${[
  { label: 'Storage', url: '/storage' }, { label: 'vol-01' }]}></lia-breadcrumb>`
```

### `lia-theme-toggle` — light/dark/auto switcher

`variant` (`'dropdown'` | `'button'` — button cycles), `nav-link`, `show-label`, `light-label`/`dark-label`/`auto-label`, `label`. Stamps `data-bs-theme` on `<html>` via `applyScheme`, persists to localStorage, fires `lia-theme-change` on `window`, and follows external changes.

### `lia-footer` — centred footer strip

`text` (trusted HTML), `.links: FooterLink[]` `{label, href, external?, title?}`, `version`, `show-version`, `logo-src`/`logo-alt`, `note`, `label`.

### `lia-time-range` — dashboard preset/absolute time picker

`.presets: TimeRangePreset[]` `{id, label}` (defaults exported as `DEFAULT_TIME_RANGE_PRESETS`), `.value?: TimeRangeValue` `{from?, to?, preset?, label?}`, `show-refresh`. It resolves nothing: picking "Last hour" emits `lia-range-change {preset: '1h'}` (absolute pair → `{from, to, preset: null}`); the app resolves against its own clock and assigns `value` back. `lia-refresh` carries no detail.

## Patterns and pitfalls

- **Content projection, not slots.** The shell and page move children into their content section on connect and watch for later additions with a MutationObserver. Use `appendContent()` for imperative insertion.
- **Navigation is interceptable.** Every link emits cancelable `lia-navigate {url, item}`; `preventDefault()` and route client-side. On mobile, call `shell.toggleSidebar(false)` after routing — the rail stays open otherwise.
- **`title` shadows the native property** on `lia-page`, `lia-page-heading`, `lia-sub-sidebar` — bind `.title=${…}` to avoid a browser tooltip.
- **`confirm:` actions need the feedback family's dialog** — call `installConfirmHandler()` (root export) once at start-up alongside `initTheme()`.
- **Descriptor visibility**: `visible: false` on any NavItem/action hides without deleting; deep-link state is yours — set `active` on the current NavItem so the sidebar opens the right group.
