/**
 * Shared data contracts for the whole kit.
 *
 * Every component in @liasoft/lit-ui is *data driven*: you describe a page as
 * plain objects (navigation tree, table listing, form definition) and hand
 * them to a component.
 */

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Bootstrap contextual colours. */
export type Variant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

export type Size = 'sm' | 'md' | 'lg';

/** A Font Awesome (or any icon-font) class string, e.g. `fa-solid fa-user`. */
export type IconName = string;

/**
 * A button or link rendered somewhere in a bar, table cell or heading.
 * `href` makes it an anchor, otherwise it is a button that emits an event.
 */
export interface ActionDescriptor {
  /** Stable identifier, surfaced in the `lia-action` event detail. */
  id?: string;
  label?: string;
  icon?: IconName;
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  title?: string;
  variant?: Variant | `outline-${Variant}`;
  size?: Size;
  /** Hide the action without removing it from the definition. */
  visible?: boolean;
  disabled?: boolean;
  /** Show a confirmation dialog before emitting the action. */
  confirm?: ConfirmDescriptor;
  /** Open this modal instead of emitting an action. */
  modal?: ModalDescriptor;
  /** Hide the label below `lg`, keeping the icon. Defaults to `true` in toolbars. */
  labelResponsive?: boolean;
  /**
   * Step back through the browser's history when triggered — the "go back"
   * button of an error screen. Ignored when {@link href} is set, and skipped
   * when a listener cancels the `lia-action` event.
   */
  back?: boolean;
  /** Arbitrary payload echoed back in the `lia-action` event. */
  data?: Record<string, unknown>;
}

export interface ConfirmDescriptor {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

export interface ModalDescriptor {
  id: string;
  title: string;
  /** Trusted HTML body. */
  body?: string;
  size?: 'modal-sm' | 'modal-lg' | 'modal-xl' | 'modal-fullscreen';
  centered?: boolean;
  scrollable?: boolean;
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

export interface NavItem {
  id?: string;
  label: string;
  url?: string;
  icon?: IconName;
  active?: boolean;
  visible?: boolean;
  /** Renders an external-link marker and opens in a new tab. */
  external?: boolean;
  /** A "+" shortcut rendered on the right of the row (e.g. "add domain"). */
  addUrl?: string;
  /** Counter badge on the right of the row. */
  badge?: { text: string | number; variant?: Variant };
  /** Nested entries turn this into a collapsible group. */
  items?: NavItem[];
}

export interface UserMenuItem {
  id?: string;
  label: string;
  icon?: IconName;
  href?: string;
  external?: boolean;
  /** Render a horizontal rule *before* this item. */
  divider?: boolean;
  visible?: boolean;
}

export interface UserInfo {
  loginname: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

/** A named range offered by `<lia-time-range>`; resolving it to instants is the application's job. */
export interface TimeRangePreset {
  id: string;
  label: string;
}

/** The range in force, as `<lia-time-range>` displays it. */
export interface TimeRangeValue {
  from?: Date;
  to?: Date;
  /** Id of the active preset, or null for an absolute pair. */
  preset?: string | null;
  /** What the button reads. Falls back to the element's `placeholder`. */
  label?: string;
}

/** A hit in the global navbar search. */
export interface SearchResult {
  label: string;
  description?: string;
  url: string;
  icon?: IconName;
  group?: string;
}

/* ------------------------------------------------------------------ *
 * Tables / listings
 * ------------------------------------------------------------------ */

/**
 * How a cell's value should be rendered.
 * `text` is the default; `html` renders trusted markup.
 */
export type CellRenderer =
  | 'text'
  | 'html'
  | 'boolean'
  | 'booleanWithInfo'
  | 'progressbar'
  | 'link'
  | 'badge'
  | 'badges'
  | 'actions'
  | 'bytes'
  | 'date'
  | 'datetime'
  | 'code'
  | 'domainWithSan'
  | 'custom';

export interface ProgressCellValue {
  percent: number;
  /** Text under the bar, e.g. "1.2 GiB / 10 GiB". */
  text?: string;
  /** Bootstrap bg-* class for the bar. */
  style?: string;
  /** Extra detail shown in a popover behind an (i) icon. */
  infotext?: string;
}

export interface LinkCellValue {
  href: string;
  text?: string;
  icon?: IconName;
  title?: string;
  target?: string;
  class?: string;
}

export interface BadgeCellValue {
  text: string;
  variant?: Variant;
  icon?: IconName;
}

export interface DomainWithSanCellValue {
  domain: string;
  san?: string;
}

export interface BooleanWithInfoCellValue {
  checked: boolean;
  info?: string;
}

export interface TableColumn<Row = Record<string, unknown>> {
  /** Key into the row object; supports dotted paths. */
  key: string;
  label: string;
  renderer?: CellRenderer;
  /** Extra classes on both `<th>` and `<td>`. */
  class?: string;
  /** Column may be sorted server-side; emits `lia-sort`. */
  sortable?: boolean;
  /** Column may be picked in the search modal. */
  searchable?: boolean;
  /** Pre-selected field in the search modal. */
  defaultSearchField?: boolean;
  /** Visible by default in the column manager. */
  checked?: boolean;
  /** Never hideable via the column manager. */
  locked?: boolean;
  /** Fully custom rendering; wins over `renderer`. */
  render?: (row: Row, column: TableColumn<Row>) => unknown;

  /**
   * Names the row field this column's value should be *identified* by, when that is not `key`.
   *
   * Only the installed `CellDecorator` reads it — the table itself does not. It is how a column that
   * shows a resolved name says which raw field the name came from, so a decorator can act on the
   * identifier while the reader still sees the label.
   */
  lookup?: string;
}

export type SortOrder = 'asc' | 'desc';

export interface SortState {
  field: string;
  order: SortOrder;
}

export interface PaginationState {
  currentPage: number;
  lastPage: number;
  perPage?: number;
  total?: number;
}

/**
 * What a listing needs explaining about it — column meanings, how to read the numbers, caveats.
 *
 * It is a dialog behind a `?` in the tab strip rather than prose above the table, because this is
 * reference material: it is read once, and a permanent block of it pushes the data off the screen for
 * everybody who already knows. Same reasoning as the search and column affordances beside it.
 */
export interface TableHelp {
  /** Dialog heading. Defaults to the `helpTitle` label. */
  title?: string;
  /** Lead paragraph, above the column list. */
  description?: string;
  /** What each column means. `column` matches a {@link TableColumn.key}; unknown keys are ignored. */
  columns?: { column: string; text: string }[];
  /** Everything that is not a column: how to read the table, where the numbers come from, limits. */
  notes?: { title?: string; text: string }[];
}

/** A complete listing definition — the input of `<lia-table>`. */
export interface TableListing<Row = Record<string, unknown>> {
  /** Unique id; used for modal ids and column-preference storage. */
  id: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  /** Reference material behind a `?` in the tab strip. Absent hides the affordance. */
  help?: TableHelp;
  /** Per-row action buttons rendered in a trailing column. */
  rowActions?: (row: Row) => ActionDescriptor[];
  /** Extra classes for a whole row, e.g. `deactivated`. */
  rowClass?: (row: Row) => string | undefined;
  pagination?: PaginationState;
  sort?: SortState;
  /** Shown instead of the table when `rows` is empty. */
  emptyMessage?: string;
  emptyTitle?: string;
  /** Hide the search affordance. */
  noSearch?: boolean;
  /** Hide the column-manager affordance. */
  noColumnManager?: boolean;
  /** Enable per-row checkboxes and the bulk-action bar. */
  selectable?: boolean;
  bulkActions?: ActionDescriptor[];
  /** Row identity for selection and expansion; defaults to the array index. */
  rowKey?: (row: Row) => string | number;
  /**
   * Content for a row's expanded detail region, rendered full width beneath the row.
   *
   * Absent means the table has no expansion at all and nothing about it changes. Which rows are open
   * is the consumer's state (`expandedKeys`), reported back through `lia-row-toggle` — the same
   * controlled shape as `selectedKeys` / `lia-selection-change`.
   *
   * The detail region is an *annotation on a row*, not a row of the result: it is never sorted,
   * searched or paginated, and because it is keyed on {@link TableListing.rowKey} it follows its row
   * through a re-sort rather than staying at the position it opened in.
   */
  rowDetail?: (row: Row) => unknown;
}

export interface TableSearchState {
  field: string;
  text: string;
}

/* ------------------------------------------------------------------ *
 * Forms
 * ------------------------------------------------------------------ */

export type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'email'
  | 'url'
  | 'tel'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'file'
  | 'hidden'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'switch'
  /** Number input with an "unlimited" (-1) toggle. */
  | 'textul'
  /** Read-only plain text rendered as form-control-plaintext. */
  | 'label'
  /** Static informational text, optionally with fields beside it. */
  | 'infotext'
  /** Long copyable text block with a copy-to-clipboard button. */
  | 'longtext'
  /** A hyperlink rendered in the value column. */
  | 'link'
  /** A list of static entries, each optionally a link. */
  | 'itemlist'
  /** Image upload with preview and a delete toggle. */
  | 'image'
  /** Free-form slot: renders `field.render()`. */
  | 'custom';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  /** Renders inside an `<optgroup>` of this name. */
  group?: string;
}

/* ------------------------------------------------------------------ *
 * Conditional fields
 * ------------------------------------------------------------------ */

/**
 * A test against one entry of the form's value model.
 *
 * Every property given must hold, so `{ field: 'mode', notEquals: 'off',
 * truthy: true }` reads as *"mode is set and is not `off`"*. Scalars are
 * compared as strings, so `1` matches `'1'` — form values arrive from the DOM
 * as strings more often than not.
 */
export interface FieldConditionClause {
  /** Name of the field to look at. */
  field: string;
  /** The value must equal this. */
  equals?: unknown;
  /** The value must not equal this. */
  notEquals?: unknown;
  /** The value must be one of these (or, for a multi-value field, contain one). */
  in?: unknown[];
  /** The value must be none of these. */
  notIn?: unknown[];
  /** `true` requires a truthy value, `false` a falsy one — checkbox conventions. */
  truthy?: boolean;
  /** `true` requires an empty value (`''`, `[]`, `null`, `false`), `false` a filled one. */
  empty?: boolean;
  /** Numeric bounds, applied only when the value parses as a number. */
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  /** The value's string form must match. A string is anchored, like `pattern`. */
  matches?: string | RegExp;
}

/** Boolean composition of conditions. Exactly one key is honoured per object. */
export interface FieldConditionGroup {
  /** Every condition must hold. */
  all?: FieldCondition[];
  /** At least one condition must hold. */
  any?: FieldCondition[];
  /** The condition must not hold. */
  not?: FieldCondition;
}

/** An arbitrary predicate over the whole value model. */
export type FieldConditionFn = (values: FormValues) => boolean;

/**
 * When a field or section applies. An **array is an AND**; the object forms
 * cover a single clause, boolean composition, or an escape hatch to code.
 *
 * @example
 * ```ts
 * // Show the spam thresholds only while the bypass switch is off.
 * { type: 'number', label: 'Tag level', showWhen: { field: 'bypassSpam', truthy: false } }
 * ```
 *
 * @example
 * ```ts
 * // Hide the whole HTTP section for a mail-only entry.
 * { title: 'HTTP', hideWhen: { field: 'mailOnly', truthy: true }, fields: { … } }
 * ```
 */
export type FieldCondition =
  | FieldConditionClause
  | FieldConditionGroup
  | FieldConditionFn
  | FieldCondition[];

/* ------------------------------------------------------------------ *
 * Asynchronous field work
 * ------------------------------------------------------------------ */

/**
 * A validation rule that has to ask something outside the form — "is this
 * login name still free?", "does this IP already serve that port?".
 *
 * It is the asynchronous sibling of the synchronous validators: same place in
 * the definition, same `FormErrors` key, same message column. The form runs it
 * debounced, hands it an {@link AbortSignal} and **cancels the previous run
 * whenever the value changes again**, so a slow early answer can never
 * overwrite a newer one.
 *
 * Resolve with `null` to accept the value and with a message to reject it. A
 * rejected promise is treated as *"could not tell"* and leaves the field
 * unmarked — a flaky endpoint must not invent validation errors. An aborted
 * run is dropped entirely.
 *
 * @example
 * ```ts
 * const loginTaken: AsyncRule = {
 *   id: 'login-taken',
 *   debounce: 400,
 *   async validate(value, _values, signal) {
 *     const name = String(value ?? '').trim();
 *     if (name === '') return null; // let `mandatory` speak for empty values
 *     const response = await fetch(`/api/logins/${encodeURIComponent(name)}`, { signal });
 *     return response.ok ? 'That name is already taken.' : null;
 *   },
 * };
 * ```
 */
export interface AsyncRule {
  /**
   * Stable identifier of the rule, unique within its field. Two rules with the
   * same id on one field share a slot, so the id must not be generated per
   * render.
   */
  id: string;
  /**
   * The check itself. Return `null` to accept, a message to reject. `signal`
   * aborts as soon as the answer stops being interesting — pass it straight to
   * `fetch`.
   */
  validate(value: unknown, values: FormValues, signal: AbortSignal): Promise<string | null>;
  /**
   * Milliseconds of quiet before the rule runs. Defaults to `300` for
   * `triggerOn: 'change'` and to `0` for `triggerOn: 'blur'`.
   */
  debounce?: number;
  /**
   * When the rule fires. `'change'` (the default) runs it debounced while the
   * user types; `'blur'` waits until the control is left.
   */
  triggerOn?: 'blur' | 'change';
}

/**
 * Load the options of a select or group from somewhere else — the async half
 * of {@link FormField.optionsFor}.
 *
 * Called whenever a watched field ({@link FormField.dependsOn}) changes, with
 * an {@link AbortSignal} that fires as soon as a newer load starts. Rejecting
 * leaves the previous options in place.
 */
export type OptionsLoader = (
  values: FormValues,
  signal: AbortSignal
) => Promise<SelectOption[]>;

export interface FieldLabel {
  title: string;
  description?: string;
}

export interface ItemListEntry {
  item: string;
  href?: string;
  label?: string;
  class?: string;
}

export interface FormField {
  type: FieldType;
  /** Plain string, or a title plus a small description below it. */
  label?: string | FieldLabel;
  value?: unknown;
  placeholder?: string;
  /** Small helper text under the control. */
  note?: string;
  /** Small description under the label. */
  desc?: string;
  /** Heading rendered above the row. */
  priorInfotext?: string;
  mandatory?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  visible?: boolean;

  /**
   * Render this field only while the condition holds. Combined with
   * {@link visible} (a static `false` always wins) and evaluated against the
   * form's live value model, so the row appears and disappears as the user
   * types. A field the condition hides keeps its value and is not validated.
   */
  showWhen?: FieldCondition;
  /** Hide this field while the condition holds — the inverse of {@link showWhen}. */
  hideWhen?: FieldCondition;
  /** Disable the control while the condition holds. */
  disabledWhen?: FieldCondition;
  /** Make the control read-only while the condition holds. */
  readonlyWhen?: FieldCondition;
  /** Demand a value only while the condition holds — a conditional {@link mandatory}. */
  requiredWhen?: FieldCondition;

  /**
   * Checks that have to go and ask somebody, run debounced by `<lia-form>`.
   *
   * They live beside the conditions on purpose: `requiredWhen` says *when* a
   * value is demanded, `asyncRules` says *what a server thinks of it*. Their
   * messages land in {@link FormErrors} under this field's name, exactly like
   * the synchronous ones, and a submit waits for them.
   *
   * @example
   * ```ts
   * {
   *   type: 'text',
   *   label: 'Login name',
   *   mandatory: true,
   *   asyncRules: [{ id: 'taken', debounce: 400, validate: checkLoginFree }],
   * }
   * ```
   */
  asyncRules?: AsyncRule[];

  /**
   * Field names this one watches. A change to any of them recomputes
   * {@link optionsFor} / re-runs {@link optionsLoader}.
   *
   * With {@link optionsFor} it is an optimisation — the pure function is only
   * called again when a watched value moved. With {@link optionsLoader} it is
   * the trigger: no `dependsOn` means "load once".
   */
  dependsOn?: string | string[];

  /**
   * Derive this field's choices from the current values — the declarative form
   * of "narrow the zone list to the selected region".
   *
   * Wins over {@link options} and {@link values}. When the recomputed list no
   * longer contains the current selection the form clears it and emits
   * `lia-change`, so a stale id can never be posted.
   *
   * @example
   * ```ts
   * {
   *   type: 'select',
   *   label: 'Configuration',
   *   dependsOn: 'customerId',
   *   optionsFor: (values) => configs.filter((c) => c.owner === values.customerId),
   * }
   * ```
   */
  optionsFor?: (values: FormValues) => SelectOption[];

  /**
   * Fetch this field's choices. Same contract as {@link optionsFor}, but the
   * control shows a loading state and older requests are aborted.
   */
  optionsLoader?: OptionsLoader;

  autocomplete?: string;
  /** Validation state; `false` renders `is-invalid`. */
  valid?: boolean;
  /** Message shown when `valid === false`. */
  error?: string;

  // text / number constraints
  min?: number;
  max?: number;
  step?: number;
  maxlength?: number;
  pattern?: string;

  // textarea
  rows?: number;
  cols?: number;

  // select
  options?: SelectOption[];
  multiple?: boolean;
  selected?: unknown;

  // checkbox / radio groups
  values?: SelectOption[];
  checked?: boolean;

  // file / image
  accept?: string;

  // link
  href?: string;

  // itemlist
  items?: ItemListEntry[];

  /** Fields rendered in the same input-group, to the right of this one. */
  nextTo?: Record<string, FormField & { prefix?: string }>;

  /** A "requires reconfiguration of X" callout under the label. */
  requiresReconf?: string[];

  /** Only for `type: 'custom'`. */
  render?: (field: FormField, id: string) => unknown;

  /** Extra classes on the control. */
  class?: string;
}

export interface FormSection {
  title?: string;
  icon?: IconName;
  description?: string;
  visible?: boolean;
  /** Render this section only while the condition holds. */
  showWhen?: FieldCondition;
  /** Hide this section while the condition holds. */
  hideWhen?: FieldCondition;
  /** Render the section collapsed behind a toggle. */
  collapsible?: boolean;
  collapsed?: boolean;
  fields: Record<string, FormField>;
}

export interface FormButton {
  label: string;
  type?: 'submit' | 'reset' | 'button';
  variant?: Variant | `outline-${Variant}`;
  id?: string;
}

/** The input of `<lia-form>`. */
export interface FormDefinition {
  id?: string;
  title?: string;
  description?: string;
  icon?: IconName;
  sections: Record<string, FormSection>;
  buttons?: FormButton[];
  /** Hide the button bar entirely (for forms embedded in a modal). */
  noSubmit?: boolean;
  /** Link back to the listing this form belongs to. */
  backUrl?: string;
}

/** Field name -> error message. */
export type FormErrors = Record<string, string>;

/** Field name -> current value, as produced by `<lia-form>`. */
export type FormValues = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

/** A resource meter tile. */
export interface ResourceItem {
  label: string;
  /** Limit; negative means unlimited. */
  available: number;
  used: number;
  /** Optional second bar: how much of the limit is handed out to sub-accounts. */
  assigned?: number | null;
  /** Format `used`/`available` as byte sizes. */
  formatBytes?: boolean;
  /** Extra byte figure appended to the label, e.g. actual disk usage. */
  byteUsage?: number | null;
  href?: string;
}

/** A key/value row inside an info card. */
export interface InfoEntry {
  label: string;
  value?: string;
  /** Trusted HTML alternative to `value`. */
  html?: string;
  href?: string;
  icon?: IconName;
  badge?: { text: string | number; variant?: Variant };
  variant?: Variant;
}

/**
 * A stat card's icon tone.
 *
 * `off` is the quiet one and the default: a neutral chip that tints nothing. A KPI row is usually five
 * or six cards of which at most one is *about* a colour - something is failing, something is full -
 * and giving every card a contextual tint spends the whole palette on decoration, which leaves the one
 * card that means something with no way left to say so.
 */
export type StatTone = Variant | 'off';

export interface StatCardData {
  label: string;
  value: string | number;
  icon?: IconName;
  variant?: StatTone;
  /** e.g. `+12%`. */
  delta?: string;
  deltaVariant?: Variant;
  description?: string;
  href?: string;
}

export interface NewsfeedItem {
  title: string;
  link?: string;
  date?: string;
  description?: string;
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

export interface AlertMessage {
  id?: string;
  variant: Variant;
  title?: string;
  message: string;
  /** Render `message` as trusted HTML. */
  html?: boolean;
  icon?: IconName;
  dismissible?: boolean;
  /** Auto-dismiss after N ms (toasts). */
  timeout?: number;
  actions?: ActionDescriptor[];
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

/** Detail of the `lia-action` event fired by buttons, table rows and toolbars. */
export interface ActionEventDetail<Row = unknown> {
  action: ActionDescriptor;
  id?: string;
  row?: Row;
  rows?: Row[];
  index?: number;
}

/** Detail of `lia-submit` fired by `<lia-form>`. */
export interface FormSubmitDetail {
  values: FormValues;
  /** The button that triggered the submit, if identifiable. */
  button?: FormButton;
}

declare global {
  interface HTMLElementEventMap {
    'lia-action': CustomEvent<ActionEventDetail>;
    'lia-submit': CustomEvent<FormSubmitDetail>;
    'lia-change': CustomEvent<{ name: string; value: unknown; values: FormValues }>;
    'lia-sort': CustomEvent<SortState>;
    'lia-page-change': CustomEvent<{ page: number }>;
    'lia-search': CustomEvent<TableSearchState>;
    'lia-selection-change': CustomEvent<{ rows: unknown[]; keys: Array<string | number> }>;
    'lia-columns-change': CustomEvent<{ columns: string[] }>;
    'lia-navigate': CustomEvent<{ url: string; item?: NavItem }>;
    'lia-dismiss': CustomEvent<{ id?: string }>;
  }
}
