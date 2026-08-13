---
name: dashboard
description: Build landing/overview pages with @liasoft/lit-ui dashboard components — KPI stat cards and rows, key/value info panels with copy-to-clipboard, activity/task lists, lazy-loaded Chart.js charts, and the span-based widget grid that lays them out. Load when composing a dashboard, adding KPIs, detail panels, activity feeds, or charts to an admin UI.
---

# Dashboard Family

## When to reach for this family

This is the landing-page family. A complete dashboard is `lia-page` (layout family) wrapping a `lia-stat-row` of KPIs on top and a `lia-widget-grid` below it holding info cards, activity lists and charts.

- **KPI figures** → `lia-stat-card` for one, `lia-stat-row` for the usual band of them. Prefer these over hand-rolled Bootstrap cards — you get equal-height responsive columns, icon chips, deltas and link-cards for free.
- **"Details" panels** (system info, account info, contact info) → `lia-info-card`. Prefer it over a hand-built list group; rows are data (`InfoEntry[]`) and it grows a copy-whole-panel button with `copyable`.
- **Things that happened / things still to do** → `lia-activity-list`. Same shape covers recent events, scheduled jobs, outstanding tasks.
- **Charts** → `lia-chart`, a theme-aware Chart.js wrapper. Chart.js is not bundled (external to the build, imported dynamically on first render) — the consuming app installs `chart.js` itself only if it draws charts.
- **Layout** → `lia-widget-grid`: a declarative Bootstrap 12-column grid, widgets in, responsive layout out. Prefer it over hand-writing `row`/`col-*` divs.

## Setup

`import '@liasoft/lit-ui'` registers everything, or just this family: `import '@liasoft/lit-ui/components/dashboard'`. The stylesheet is loaded once globally. All elements render into light DOM (no shadow roots), so Bootstrap classes and the host page's CSS reach every part.

## Component reference

### `lia-stat-card` — one KPI: big number, caption, icon chip, optional delta

| Prop | Type | Notes |
|---|---|---|
| `data` | `StatCardData` | Complete descriptor; its fields win over individual props |
| `label` / `value` | `string` / `string\|number` | Caption and headline figure. Pre-format the value — printed verbatim |
| `icon` | `string` | Icon-font class for the chip |
| `variant` | `Variant \| 'off'` | Chip tone; `'off'` (default) is a neutral chip |
| `delta`, `delta-variant` | `string`, `Variant` | Change indicator, e.g. `+12 %`, and its colour |
| `description` | `string` | Muted line under the value |
| `href` | `string` | Makes the whole card a stretched link |
| `flush` | `boolean` | Drops bottom margin, stretches to `h-100` — for grid cells |

```ts
html`<lia-stat-card .data=${{ label: 'Failed jobs', value: 3,
  icon: 'fa-solid fa-triangle-exclamation', variant: 'danger', href: '/jobs?state=failed' }}></lia-stat-card>`
```

### `lia-stat-row` — responsive band of stat cards

`items: StatCardData[]`, `columns` (cards per row from `lg`, 1–6, default 4), `gutter` (0–5, default 3), `label` (accessible group name, default "Key figures"). One card per row on phones, two from `sm`. Cards are equal height.

```ts
html`<lia-stat-row columns="4" .items=${kpis}></lia-stat-row>`
```

### `lia-info-card` — key/value details panel, copyable

| Prop | Type | Notes |
|---|---|---|
| `title`, `icon` | `string` | Header. Prefer `.title=${…}` binding — a static attribute also becomes a browser tooltip |
| `entries` | `InfoEntry[]` | Rows: `{ label, value?, html?, href?, icon?, badge?: {text, variant?}, variant? }` |
| `copyable` | `boolean` | Header copy button; copies the panel as `- label: value` lines |
| `copy-text`, `copy-title`, `copied-title` | `string` | Override clipboard text / button labels |
| `variant` | `Variant` | Tints header (`text-bg-*`) and border |
| `empty-message` | `string` | Shown when there are no rows |
| `flush` | `boolean` | For grid cells |

Light-DOM children (e.g. `<lia-key-value>`) are appended after the data-driven rows. Exported helper `infoEntriesToText(entries)` is the same serialisation the copy button uses.

```ts
html`<lia-info-card title="System" icon="fa-solid fa-gears" copyable flush
  .entries=${[{ label: 'Hostname', value: 'node-01' }, { label: 'Runtime', value: '8.3.4', href: '/system/runtime' }]}></lia-info-card>`
```

### `lia-activity-list` — icon + text + right-aligned meta chip rows

| Prop | Type | Notes |
|---|---|---|
| `items` | `ActivityItem[]` | `{ id?, icon?, text, html?, meta?, metaVariant?, variant?, href?, description? }` |
| `title`, `icon`, `card` | | Setting `title` (or `card`) wraps the list in a card |
| `interactive` | `boolean` | Rows without `href` become buttons emitting `lia-activity-select`. Off by default — nothing looks clickable that isn't |
| `flush-list` | `boolean` | Borderless list group for dropping into an existing card |
| `flush`, `empty-message`, `label` | | As elsewhere |

Event: `lia-activity-select` — `CustomEvent<{ item: ActivityItem; index: number }>`.

```ts
html`<lia-activity-list title="Recent activity" card flush interactive .items=${items}
  @lia-activity-select=${(e) => open(e.detail.item)}></lia-activity-list>`
```

### `lia-chart` — lazy, theme-aware Chart.js wrapper

| Prop | Type | Notes |
|---|---|---|
| `type` | `'line'\|'bar'\|'pie'\|'doughnut'\|'polarArea'\|'radar'\|'bubble'\|'scatter'` | Changing it rebuilds the chart |
| `data` | `ChartData` | `{ labels?, datasets: [{ label?, data, ...chartjs keys }] }` |
| `options` | `ChartOptions` | Merged over `{ responsive: true, maintainAspectRatio: false }` |
| `height` | `number` | Canvas wrapper height in px (default 260); width follows the grid cell |
| `label`, `summary` | `string` | Canvas is opaque to AT — always set `label`; `summary` is a visually-hidden text alternative |
| `loading-label`, `error-message` | `string` | Spinner text / message when Chart.js is unavailable |
| `no-theme-sync` | `boolean` | Skip the rebuild on `lia-theme-change` |

`chart.js` is imported dynamically and is external to the build — install it as a dependency only if you draw charts; without it the element degrades to `error-message`, never an empty box. `element.instance` exposes the live Chart.js object; `redraw()` rebuilds.

```ts
html`<lia-chart type="bar" height="280" label="Transfer per month"
  .data=${{ labels: months, datasets: [{ label: 'Inbound', data: inbound }] }}></lia-chart>`
```

### `lia-widget-grid` — declarative dashboard layout

Props: `widgets: DashboardWidget[]`, `gutter` (0–5, default 3), `default-span`, `label`. Each widget: `{ id?, span? (1–12 at lg, default 12), spanMd?, content? (anything Lit renders), html? (trusted markup), class?, visible? }`. Below `lg` the grid degrades itself: narrow widgets pair up on tablets, everything stacks on phones. Plain-HTML children work too, sized by `data-span` / `data-span-md` attributes.

```ts
html`<lia-widget-grid label="Dashboard" .widgets=${[
  { id: 'traffic', span: 8, content: html`<lia-chart type="bar" .data=${traffic} label="Traffic"></lia-chart>` },
  { id: 'jobs', span: 4, content: html`<lia-activity-list title="Jobs" card flush .items=${jobs}></lia-activity-list>` },
]}></lia-widget-grid>`
```

## Patterns and pitfalls

- **Composition:** `lia-stat-row` above, `lia-widget-grid` below; put `flush` on every card-like widget inside a grid cell so it stretches to `h-100` and drops its bottom margin — otherwise rows of unequal-height cards look ragged.
- **Colour discipline:** stat-card `variant` defaults to `'off'` (neutral) on purpose. A KPI row should tint at most the one card that means something (`danger` for failures); tinting everything spends the palette on decoration.
- **`visible: false`** keeps a widget in the definition without rendering it — use it for feature-flagged or draft panels instead of filtering the array.
- **`html` fields** (`InfoEntry.html`, `ActivityItem.html`, `DashboardWidget.html`) are trusted markup — never feed them user input. For interactive activity rows, still set `text` as the accessible/plain fallback.
- **Rows with `href` are links; the rest only become buttons under `interactive`.** Don't set `interactive` unless you listen for `lia-activity-select`.
- **Charts:** always pair a chart with a real `label` and a `summary` (or a table nearby) so the figures survive without colour or canvas. Theme colours come from Bootstrap tokens; the chart rebuilds on `lia-theme-change`, so dark mode works with no extra code.
- **Empty states are first-class:** every element renders an overridable `empty-message` — a day-one dashboard should look deliberate, not broken.
