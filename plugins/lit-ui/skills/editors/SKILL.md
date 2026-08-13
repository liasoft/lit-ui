---
name: editors
description: Use when building specialised admin screens with @liasoft/lit-ui — an editable record table (DNS records, env vars, forwarders), a filterable tailing log pane, a config diff, a code/file display, a file tree, or an API-keys/credentials panel with one-time secret reveal. Covers lia-code-block, lia-log-viewer, lia-diff-view, lia-record-editor, lia-file-tree, lia-api-keys-panel and the exported diff functions.
---

# Editors — the specialised views

## When to reach for this family

Where the table and form families render *any* listing or *any* form, these are screens with a shape of their own, stripped of domain semantics:

- **List of small structured rows edited in place** (DNS records, address/port pairs, env vars, header rewrites) → `<lia-record-editor>`. Prefer it over hand-rolling a table of inputs — it already does dirty tracking, per-cell validation, add/remove, and a save/discard bar.
- **Log output** → `<lia-log-viewer>`, never a read-only `<textarea>`.
- **"What would change?"** for configs/templates → `<lia-diff-view>`. Diff two texts without rendering via the exported `diffLines`/`collapseDiff`/`pairDiff`/`diffStats`.
- **Show a file/transcript as text** → `<lia-code-block>`. It is the substrate: the log viewer composes it, and any custom viewer should hand it `CodeLine[]` rather than reimplement a `<pre>`.
- **Hierarchical navigation** (file systems, config sections, zones) → `<lia-file-tree>`.
- **Credentials with a create flow and one-time secret** → `<lia-api-keys-panel>`. It composes `<lia-table>` (a `TableListing`) and `<lia-form>` (a `FormDefinition`) from the other families; `ActionDescriptor` with `confirm:` drives revocation.

## Setup

`import '@liasoft/lit-ui'` registers everything, or `import '@liasoft/lit-ui/components/editors'` for this family only. The stylesheet loads once globally; components render in **light DOM** — Bootstrap classes and page CSS reach everything.

## Component reference

### `<lia-code-block>` — monospace text with chrome

| Prop | Type | Notes |
|---|---|---|
| `code` / `.lines` | `string` / `CodeLine[]` | `lines` wins; `CodeLine = { text, content?, class?, number?, srLabel? }` — `text` feeds copy/download, `content` replaces only what is shown |
| `language`, `filename` | string attrs | header badge + name |
| `line-numbers` | flag, default true | gutter is a pseudo-element, so selection copies code only |
| `start-line`, `.highlightLines` | number / `number[]` | excerpts; called-out lines |
| `wrap`, `wrap-toggle`, `max-height` | | default `max-height="24rem"` |
| `copyable`, `download-name` | flag / string | empty name hides download |
| `loading`, `no-header`, `no-card`, `.headerContent`, `.actions` | | `actions: ActionDescriptor[]` in the header |

Events: `lia-code-download` `{name, text}`, `lia-code-wrap-change` `{wrap}`. Methods: `scrollToBottom()`, `scrollToLine(n)`, `download()`; getters `text`, `scrollElement`.

```ts
html`<lia-code-block language="ini" filename="service.conf" download-name="service.conf"
  .code=${text} .highlightLines=${[12]} wrap-toggle></lia-code-block>`
```

### `<lia-log-viewer>` — filterable tailing log pane

`.lines` takes `LogInput[]`: structured `{ ts?, level?, text, source? }` or plain strings (severity inferred from text; `no-auto-level` disables). Levels: `error | warning | info | debug`.

| Prop | Notes |
|---|---|
| `.lines`, `loading` | oldest first |
| `max-lines` | default 2000; newest kept, `0` = unbounded |
| `follow` | tail; scrolling up turns it off, like a terminal |
| `filter`, `.activeLevels`, `.levels` | seed text filter; drive severity from outside |
| `timestamps`, `.timestampOptions`, `locale` | flag + `Intl.DateTimeFormat` options |
| `download-name` (default `log.txt`), `wrap`, `max-height` (26rem), `line-numbers`, `no-follow-toggle` | |

Events: `lia-log-filter-change` `{text, levels}`, `lia-log-follow-change` `{follow}`. Getter `visibleLines`; helpers `guessLogLevel`, `toLogLine`, `highlightLogMatches`, `splitLines` are exported.

```ts
html`<lia-log-viewer .lines=${entries} follow download-name="service.log"
  ?loading=${pending}></lia-log-viewer>`
```

### `<lia-diff-view>` — dependency-free line diff

| Prop | Notes |
|---|---|
| `original`, `modified` | the two texts |
| `original-label`, `modified-label` | column headings |
| `mode` (`unified`\|`split`), `mode-toggle` | split needs ~2× width |
| `context` (3), `collapse` (flag, true) | unchanged runs fold behind a gap marker |
| `show-stats`, `copyable`, `wrap`, `wrap-toggle`, `line-numbers`, `max-height` (28rem), `no-header` | copy produces a unified patch body (`patchText`) |

Event: `lia-diff-mode-change` `{mode}`. Getters `lines`, `stats`. Plain functions: `diffLines(a, b)` → `DiffLine[]` (`{type: 'equal'|'add'|'remove', text, left?, right?}`), `collapseDiff(lines, context)`, `pairDiff(rows)`, `diffStats(lines)`.

```ts
html`<lia-diff-view .original=${current} .modified=${proposed}
  original-label="Running config" modified-label="Generated" mode-toggle></lia-diff-view>`
```

### `<lia-record-editor>` — records edited in place, save/discard bar

`.columns: RecordColumn[]` — `{ key, label, type?: 'text'|'number'|'select'|'checkbox', options?: SelectOption[], width?, required?, readonly?, placeholder?, min/max/step/maxlength/pattern, defaultValue?, hint?, validate?(value, record, index) => string | undefined }`. `.records: RecordRow[]` (flat `Record<string, string|number|boolean|null>`).

Other props: `title`, `icon`, `description`, `add-mode` (`form` footer row | `append` blank row), `addable`/`deletable` (flags), `no-confirm-remove`, `readonly`, `saving`, `no-save-bar`, `max-height`.

Events: `lia-records-change` `{records, dirty, valid, change: {type, index?, key?}}`, `lia-records-save` `{records}`. Getters `value`, `dirty`, `valid`; methods `save()`, `discard()`, `commit()` (accept working copy as baseline without emitting), `addRecord()`, `removeRecord(i)`.

```ts
html`<lia-record-editor
  .columns=${[
    { key: 'name', label: 'Name', required: true },
    { key: 'type', label: 'Type', type: 'select', width: '8rem', options: types },
    { key: 'ttl', label: 'TTL', type: 'number', width: '7rem', defaultValue: 3600 },
  ]}
  .records=${records} ?saving=${saving}
  @lia-records-save=${(e) => persist(e.detail.records)}></lia-record-editor>`
```

### `<lia-file-tree>` — keyboard-operable ARIA tree

`.nodes: TreeNode[]` — `{ id (unique tree-wide), label, icon?, children?, meta?, badge?: {text, variant?}, disabled?, expandable? }`. Props: `selected-id`, `.expandedIds` (set = controlled, never mutated internally), `label`, `filterable`, `filter`, `folder-icon`/`folder-open-icon`/`leaf-icon`, `show-icons`, `max-height`.

Events: `lia-tree-select` `{id, node}`, `lia-tree-toggle` `{id, node, expanded}`. Full keyboard: arrows, Home/End, Enter/Space; single tab stop.

```ts
html`<lia-file-tree .nodes=${tree} .expandedIds=${['etc']} selected-id="etc/app.conf"
  filterable @lia-tree-select=${(e) => open(e.detail.node)}></lia-file-tree>`
```

### `<lia-api-keys-panel>` — credentials with one-time reveal

`.credentials: CredentialEntry[]` — `{ id, label?, identifier?, created?, lastUsed?, expires?, allowedFrom?, scopes?, disabled? }` (never the secret). `.secret?: NewCredential` — `{ secret, id?, label?, identifier?, note? }` shows the reveal box. Props: `loading`, `creating`, `can-create`/`can-revoke` (flags), `max-credentials` (0 = no limit), `masked`, `.createForm?: FormDefinition` (replaces built-in label/allowedFrom/expires form), `.rowActions?: (c) => ActionDescriptor[]`, `title`, `icon`, `description`.

Events: `lia-credential-create` `{values}` (FormValues), `lia-credential-revoke` `{id, credential}` (already confirmed), `lia-credential-dismiss` `{id?}`.

```ts
html`<lia-api-keys-panel .credentials=${keys} .secret=${justCreated} ?creating=${pending}
  @lia-credential-create=${(e) => create(e.detail.values)}
  @lia-credential-revoke=${(e) => revoke(e.detail.id)}
  @lia-credential-dismiss=${() => (justCreated = undefined)}></lia-api-keys-panel>`
```

## Patterns and pitfalls

- **Record editor owns a working copy.** It never writes back to `.records`. Persist on `lia-records-save`, then set `.records` to the saved array — re-seeding only happens when the new array *differs* from the baseline, so an equal re-render never discards pending edits. Host saves on every change? `no-save-bar` + listen to `lia-records-change`; call `commit()` after persisting yourself.
- **Secret lifecycle.** Assign `.secret` after creation succeeds (the panel closes its form itself); clear it when `lia-credential-dismiss` fires. The panel never keeps a copy. Its table hides columns no credential fills.
- **Controlled vs uncontrolled.** `expandedIds` (tree), `activeLevels` (log): unset means the element owns state; set means you do. `filter`/`wrap`/`mode` seed once, then the element takes over.
- **CodeLine `text` vs `content`**: `text` is what copy/download produce; `content` only changes rendering — that's how the log viewer highlights matches without corrupting the clipboard.
- Log entries without a severity are never hidden by the level filter; `follow` turns off on manual scroll-up.
- `diffLines` degrades gracefully on huge inputs (reports the middle as remove-then-add) rather than allocating an enormous LCS table.
- Removal (record editor) and revocation (keys panel) confirm via the kit's confirm dialog by default; `no-confirm-remove` opts out on the record editor.
