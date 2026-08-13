---
name: settings
description: Build a settings/preferences screen with @liasoft/lit-ui — grouped settings with a live filter, a scroll-following anchor rail, and one save bar. Load this when building any "configure the system" page (server settings, account preferences, integration config) instead of hand-rolling forms and anchor navigation.
---

# Settings pages

## When to reach for this family

Use it for screens that **configure** a system rather than list its data. One element does the whole job: `<lia-settings-page>` renders a filtered stack of setting groups, a rail of section anchors that follows the scroll, and a single save/reset bar. Prefer it over composing `<lia-form>` + hand-rolled anchors whenever a page has more than one titled block of settings. The pieces are usable alone: `<lia-settings-group>` for a single titled block inside your own `<form>`, `<lia-settings-nav>` as an anchor rail for *any* page of titled sections.

This family composes with the **form** family: every group embeds a `FormDefinition` (same `sections.fields` shape, same field types, same validation), and the page's API mirrors `<lia-form>` — `getValues()`, `setValues()`, `reset()`, `validate()`, `rules`, `messages`, `buttons`, `errors`. It also uses `<lia-page-heading>` (heading + `ActionDescriptor[]` toolbar), `<lia-alert-stack>` (`AlertMessage[]` via `.alerts`), and `<lia-empty-state>` internally.

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/settings'` for just this family. Stylesheet loaded once globally; components render in light DOM (no shadow roots), so Bootstrap classes and page CSS reach everything.

## Component reference

### `<lia-settings-page>` — the whole screen

| Property | Type | Notes |
| --- | --- | --- |
| `groups` | `SettingsGroup[]` | The page content, in order. |
| `values` | `FormValues` | Accessor; caller layer merged over the groups' defaults. |
| `activeGroup` / `active-group` | `string` | Rail's current section; scroll-spy maintains it. |
| `filterText` / `filter-text` | `string` | Bind to control the filter box yourself. |
| `title`, `icon`, `description`, `actions`, `backUrl`, `alerts` | | Heading bar and messages; `actions` is `ActionDescriptor[]`. |
| `errors`, `rules`, `messages`, `buttons`, `hiddenFields` | | Exactly as on `<lia-form>`; `errors` is server-side `FormErrors`. |
| `disabled`, `busy` | `boolean` | `busy` spins the submit button and blocks submits. |
| `highlight` | `string` | Mark one setting by name (deep link from search). |
| `no-filter`, `no-nav`, `no-spy`, `no-submit`, `no-heading`, `no-validate` | `boolean` | Drop the filter, rail, scroll-spy, save bar, heading, or client validation. |
| `anchor-prefix` | `string` | Default `'settings'`; must match nav and groups. |

Methods: `getValues()`, `setValues(next, merge=true)`, `reset()`, `validate()`, `submit()`, `focusFirstInvalid()`. Events: `lia-submit` `{values, button}` (only after validation passes), `lia-invalid` `{errors, values}`, `lia-change` `{name, value, values}`, `lia-form-reset` `{values}`, `lia-settings-filter` `{text, matches}`, `lia-settings-active` `{id}`.

```ts
html`<lia-settings-page
  title="Server settings"
  .groups=${groups}
  .values=${loaded}
  .busy=${this.saving}
  @lia-submit=${(e: CustomEvent) => save(e.detail.values)}
></lia-settings-page>`
```

### `<lia-settings-group>` — one titled block

Rendered by the page for each group; place it yourself only for a single-group page. Pure pass-through: renders `values[name]` into fields, bubbles `lia-change`, never posts or validates. Key properties: `group` (`SettingsGroup`), `values`, `errors`, `labels`, `disabled`, `show-hidden`, `highlight`, `anchor-prefix`, `no-heading`, `level` (heading level 2–6), `inactive-label` (chip shown when `group.activated === false`). Its `<section>` carries the anchor id (`settings-<slug>`) and `tabindex="-1"`.

```ts
html`<lia-settings-group .group=${group} .values=${values} .errors=${errors}></lia-settings-group>`
```

### `<lia-settings-nav>` — the anchor list

Rendered by the page (rail on `lg+`, inline pills below); place it yourself only when driving anchors manually. Properties: `items` (`SettingsNavEntry[]` — `{id, label, icon?, badge?}`, build with `settingsNavEntries(groups)`), `active`, `layout` (`'rail' | 'inline'`), `heading`, `sticky`, `anchor-prefix`, `no-smooth`. Clicking scrolls smoothly, focuses the section, and emits `lia-settings-navigate` `{id, target?}`. `goTo(id)` does the same programmatically.

### Helpers (`settings-model.js`, `scroll-spy.js`)

`filterSettingsGroups(groups, normaliseFilter(text))` narrows groups to matching fields with `<mark>` highlighting; `settingsDefinition(groups)` folds groups into one `FormDefinition`; `settingsGroupAnchor(id)` → `'settings-<slug>'`; `settingsNavItems(entries, active)` → `NavItem[]` for `<lia-sub-sidebar>`. `SectionSpy` is the scroll-spy: `new SectionSpy({ onChange, rootMargin?, root? })`, then `.observe(targets)` with `{id, element}[]` in document order, `.set(id)` after a jump, `.disconnect()` on teardown.

## Patterns and pitfalls

**`SettingsGroup` shape**: `{ id, title, icon?, description?, visible?, activated?, info?, badge?, form: FormDefinition }`. `id` is the anchor target and nav id. `visible: false` removes the group from the page *and* the value model; `activated: false` keeps it but adds a muted "Not configured" chip. `badge` puts a counter on the nav entry. `title`, `description`, `info` are trusted HTML — never put user input in them.

**One flat value model.** The page folds all groups into one definition (section keys namespaced `groupId.sectionKey`), so `lia-submit` hands you *every* setting at once, and a field name used in two groups shares one value. Filtering never touches values — hidden and filtered-out settings keep their value and are still submitted.

**`values` assignment is identity-guarded**: re-committing the same object on re-render is a no-op, so a parent render will not wipe user edits — but to push new values you must pass a *new* object (or call `setValues`).

**Failed submits** emit `lia-invalid`, reveal every message, and focus the first offending control (clearing the filter if it hides it). Server errors go in `.errors` and merge with client validation.

**Scroll in a container?** The default spy observes the viewport. Set `no-spy` and drive `active-group` yourself, or handle `lia-settings-active` to sync the URL hash.
