---
name: primitives
description: Use when placing basic UI building blocks with @liasoft/lit-ui — buttons and toolbars, badges, progress meters, cards, empty states, spinners, copy buttons, tooltips/popovers, key-value info rows, or hover-lookup identifiers — or when wiring the ActionDescriptor / lia-action / confirm contract that every action button in the kit shares.
---

# Primitives

## When to reach for this family

These are the blocks every other family composes. Prefer them over hand-rolled Bootstrap markup:

- Any clickable action → `lia-button` (single) or `lia-action-bar` (toolbar row). Never hand-roll `<button class="btn">` with your own click plumbing — the descriptor pipeline gives you confirm dialogs, href/modal handling, and one uniform `lia-action` event.
- Status chip → `lia-badge`. Usage meter → `lia-progress`. Loading → `lia-spinner`. Empty listing → `lia-empty-state` (composes `actions` to offer a way forward).
- Panel with header/actions/footer → `lia-card`. Its `headerActions`/`footerActions` take the same `ActionDescriptor[]`.
- Label-over-value rows in an info card → `lia-key-value` inside a `list-group` (often inside `<lia-card no-body>`).
- Bootstrap tooltip/popover without imperative plugin code → `lia-tooltip` / `lia-popover` (wrap the trigger).
- Copy-to-clipboard → `lia-copy-button`. Identifier that explains itself on hover → `lia-lookup`.
- Hot paths (table cells, hundreds of rows): use the inline helpers `renderIcon()`, `renderBadge()`, `renderAction()`/`renderActions()`, `renderSpinner()` instead of instantiating elements.

Actions with `confirm:` compose with the feedback family's `lia-confirm-dialog`; without one on the page, the browser's native `confirm()` is the fallback.

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/primitives'` for this family only. Stylesheet loads once globally. Everything renders into light DOM — Bootstrap classes and page CSS reach all internals.

## ActionDescriptor — the shared contract

Every action button in the kit is data: `{ id, label, icon, href, target, title, variant, size, visible, disabled, confirm, modal, labelResponsive, back, data }` (all optional; `visible !== false` shows). `href` renders an `<a role="button">` and navigates; `modal: { id, title, ... }` wires `data-bs-toggle="modal"` (no event fires); `back: true` steps history back. Triggering emits a **cancelable** `lia-action` (`detail: { action, id, row, index }` — cancel it to suppress navigation). With `confirm: { message, title?, confirmLabel?, cancelLabel?, variant? }`, a cancelable `lia-action-confirm-request` fires first (`detail` adds `confirm`, `accept()`, `cancel()`); a confirm dialog claims it via `preventDefault()`, else native `confirm()` runs. `renderAction(action, { host, size, variant, row, index, loading })` and `renderActions([...])` emit this markup inline.

## Component reference

### `lia-button` — one Bootstrap button or link
Props: `label`, `icon`, `href`, `target`, `title`, `variant` (`primary`… or `outline-*`, default `primary`), `size` (`sm|md|lg`), `disabled`, `loading` (spinner + blocked), `label-responsive`, `block` (full width), `type`, `action-id` (→ `detail.id`), and object props `.action` (full descriptor, wins field-by-field), `.confirm`, `.modal`, `.data`, `.row`, `.index`. Emits `lia-action`.

```ts
html`<lia-button .action=${{ id: 'delete', icon: 'fa-solid fa-trash', title: 'Delete',
    variant: 'outline-danger', size: 'sm',
    confirm: { message: 'Delete this entry?', confirmLabel: 'Delete' } }}
  .row=${row} @lia-action=${(e: CustomEvent) => remove(e.detail.row)}></lia-button>`
```

### `lia-action-bar` — toolbar of descriptors
Props: `.actions: ActionDescriptor[]`, `align` (`start|center|end|between`), `size`, `variant` (fallbacks; default `outline-primary`), `gap` (0–5), `label-responsive` (default **true**: labels hide below `lg`), `label`, `.row`, `.index`. Renders buttons inline — the bar is the single `lia-action` source.

```ts
html`<lia-action-bar align="end"
  .actions=${[{ id: 'back', icon: 'fa-solid fa-reply', label: 'Back', href: '/list' },
              { id: 'add', icon: 'fa-solid fa-plus-circle', label: 'Add entry', variant: 'primary' }]}
  @lia-action=${e => handle(e.detail.id)}></lia-action-bar>`
```

### `lia-icon` — icon-font glyph
Props: `name` (`fa-solid fa-user`), `fixed-width`, `spin`, `pulse`, `size` (`2xs`…`10x`), `variant`, `label` (sets `role="img"`; omitted = `aria-hidden`). Inline: `renderIcon(name, { fixedWidth, spin, size, variant, label })`.
`<lia-icon name="fa-solid fa-database" variant="success" fixed-width></lia-icon>`

### `lia-badge` — status/counter chip
Props: `text`, `variant` (default `secondary`), `pill`, `icon`, `subtle` (tinted bg + emphasis text), `title`, or `.value` (a table `BadgeCellValue { text, variant?, icon? }`). Inline: `renderBadge(text, opts)`.
`<lia-badge text="Active" variant="success"></lia-badge>`

### `lia-progress` — meter with optional second track
Props: `percent` (0–100), `variant` (accepts `warning` or `bg-warning` — pairs with `usageVariant()`), `thin`, `label` (text in bar), `bar-label` (accessible name — set it when no visible label), `striped`, `animated`, `value-now`/`value-min`/`value-max` (real quantities for aria), `secondary-percent`/`secondary-variant`/`secondary-label` (allocated-share track), `text` (right-aligned caption), `infotext` (trusted HTML popover behind an (i)).

```ts
html`<lia-progress thin percent=${usagePercent(used, total)} variant=${usageVariant(usagePercent(used, total))}
  .valueNow=${used} .valueMax=${total} text="8.2 GiB / 10 GiB" bar-label="Disk space"></lia-progress>`
```

### `lia-card` — Bootstrap card
Props: `title` (prefer `.title=${…}` — the attribute doubles as a native tooltip), `subtitle`, `icon`, `variant` (tints header + border), `no-body` (for flush list-groups/tables), `.headerActions` / `.footerActions` (`ActionDescriptor[]`, emit `lia-action`), `.content` / `.footer` (renderable values), `.headerTools` (controls handed up by a child rendering as the body), `card-class`, `body-class`, `deactivated`. Light-DOM children are lifted into the body, so both `.content` and children work.

```html
<lia-card title="System details" icon="fa-solid fa-gears" no-body>
  <ul class="list-group list-group-flush">
    <lia-key-value label="Hostname" value="node-01"></lia-key-value>
  </ul>
</lia-card>
```

### `lia-empty-state` — "nothing here" panel
Props: `title`, `message`, `.content` (renderable — prefer over `html` for data-bearing messages), `html` (trusted), `icon`, `variant` (default `info`), `.actions` (CTA descriptors → `lia-action`), `centered`.
```ts
html`<lia-empty-state title="No entries yet" message="Nothing has been created here so far."
  icon="fa-solid fa-inbox" .actions=${[{ id: 'add', label: 'Add the first entry', variant: 'primary' }]}></lia-empty-state>`
```

### `lia-spinner` — busy indicator
Props: `grow`, `size`, `variant`, `label` (always announced; default `Loading…`), `label-visible`. Inline: `renderSpinner(label, opts)`.
`<lia-spinner variant="primary" label="Loading entries"></lia-spinner>`

### `lia-copy-button` — clipboard copy
Props: `text` (literal; wins) or `source-id` (copies that element's trimmed `textContent`), `title`, `copied-title`, `failed-title`, `label`, `size` (default `sm`), `variant` (default `outline-secondary`), `icon`, `copied-icon`, `disabled`. Emits `lia-copy` (`detail: { text, ok }`); icon flips to a tick for ~1.6 s. Also `copy(): Promise<boolean>`.
`<lia-copy-button source-id="sysinfo" title="Copy system info"></lia-copy-button>`

### `lia-tooltip` / `lia-popover` — declarative Bootstrap overlays
Wrap the trigger; the plugin attaches to the first child. Shared props (overlay base): `content` (empty disables), `placement` (`auto|top|bottom|left|right`), `trigger` (`hover focus` default; `manual` = imperative `show()`/`hide()` only), `html` (Bootstrap still sanitises), `disabled`, `container` (e.g. `body`), `delay`, `overlay-class`. `lia-popover` adds `heading`. No events; instance rebuilt on option change, disposed on disconnect.
```html
<lia-tooltip content="Rebuild the configuration" placement="bottom">
  <button class="btn btn-outline-secondary">Rebuild</button>
</lia-tooltip>
```

### `lia-key-value` — label-over-value row
The host **is** the `.list-group-item` — drop it directly into a `list-group`. Props: `label`, `value`, `html` (trusted; wins over `value`), `href` (links the value), `icon`, `variant` (row tint), `.badge` (`{ text, variant? }` pill on the right), `.entry` (whole `InfoEntry`, wins), `bare` (no list-group chrome). Light-DOM children become the value (badges, links).
```ts
html`<lia-key-value .entry=${{ label: 'Members', value: names.join(', '), badge: { text: names.length } }}></lia-key-value>`
```

### `lia-lookup` — identifier with on-demand detail popover
Props: `label` (or light-DOM children), `heading`, `.load: () => Promise<LookupDetail>` (`InfoEntry[]` or `{ rows, images? }` with `LookupImage { src, alt, caption?, href? }`), `href` (trigger becomes an anchor: hover = summary, click = page), `placement`, `empty-text`, `error-text`, `trigger-hint`, `disabled`. `load` runs **at most once per element**, on first hover/focus — 500 rows cost nothing until hovered; cache sharing across rows is your job. Detail is data, not markup, by design (injection-safe). Helper: `renderLookup(label, load, heading?, href?)`.
```ts
html`<lia-lookup label=${row.application} heading="Application"
  href=${`/applications/${row.appId}`} .load=${() => describeApplication(row.appId)}></lia-lookup>`
```

## Patterns and pitfalls

- **One event to rule actions**: listen for `lia-action` once on a container; switch on `detail.id`. Cancel the event to stop an `href` action's navigation. `modal` actions fire no event at all — Bootstrap handles them.
- **Confirm flow degrades safely**: no `lia-confirm-dialog` on the page → native `window.confirm`. Never build your own confirmation around a button; put `confirm:` on the descriptor.
- **Inline helpers on hot paths**: table cells should call `renderAction`/`renderBadge`/`renderIcon`, not stamp custom elements per row. Pass `{ host: this, row, index }` so listeners get a stable target and row context.
- **`title` attribute gotchas**: on `lia-card`/`lia-empty-state`, a static `title="…"` attribute also produces a native browser tooltip on the host — prefer `.title=${…}` bindings.
- **`variant` on `lia-progress`** interoperates with `usageVariant()` from core utils (`bg-*` accepted verbatim).
- **Trusted-HTML props** (`html` on empty-state/key-value/overlays, `infotext` on progress) must never receive data-derived strings; use `.content` / `InfoEntry` / `lia-lookup`'s data path instead.
