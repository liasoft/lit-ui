/**
 * The asynchronous half of the form system: rules that have to ask a server,
 * and option lists that are derived from — or fetched for — another field.
 *
 * Both are **declarative**. A field says what it needs
 * ({@link FormField.asyncRules}, {@link FormField.optionsFor},
 * {@link FormField.optionsLoader}) in exactly the place it already says
 * `showWhen` and `requiredWhen`; `<lia-form>` owns the machinery. Nothing in
 * this module touches the DOM, so it can be unit-tested or reused by a
 * different renderer.
 *
 * ### The race these controllers exist for
 *
 * Type `ada`, then `adam`. Two requests are in flight; the one for `ada` may
 * well answer last. Every run here carries a monotonic id and its own
 * {@link AbortController}: a verdict whose id is no longer the current one is
 * *dropped on the floor*, and the request behind it is aborted the moment it
 * stops being interesting. A slow earlier answer can never overwrite a newer
 * one, and a field that unmounts cancels everything it started.
 *
 * @example
 * ```ts
 * const validation = new AsyncValidationController({
 *   values: () => form.getValues(),
 *   notify: () => form.requestUpdate(),
 * });
 * validation.retain(asyncRuleFields(definition, values));
 * validation.schedule('loginname', 'change');
 * await validation.settle();
 * console.log(validation.errors()); // → { loginname: 'That name is already taken.' }
 * ```
 */

import type {
  AsyncRule,
  FormDefinition,
  FormErrors,
  FormField,
  FormValues,
  SelectOption,
} from '../../core/types.js';
import {
  flattenFields,
  isFieldDisabled,
  isSingleToggle,
  STATIC_FIELD_TYPES,
  toValueArray,
  type ExtendedFormField,
} from './field-model.js';

/* ------------------------------------------------------------------ *
 * Shared vocabulary
 * ------------------------------------------------------------------ */

/** When an {@link AsyncRule} fires. */
export type AsyncTrigger = 'blur' | 'change';

/** Debounce used by a `triggerOn: 'change'` rule that does not state one. */
export const DEFAULT_ASYNC_DEBOUNCE = 300;

/** How many settle/recompute rounds a single update may take before giving up. */
const MAX_PASSES = 5;

/**
 * The per-field async state a renderer needs: which fields are busy, which
 * have come back clean, and what their choices currently are.
 *
 * `<lia-form>` builds one of these per update and threads it down to
 * `<lia-form-field>`, which turns it into a spinner, an `is-valid` mark and a
 * fresh `<option>` list.
 */
export interface AsyncFieldState {
  /** Fields with an {@link AsyncRule} queued or in flight. */
  validating: ReadonlySet<string>;
  /** Fields whose every async rule has come back happy for the current value. */
  clean: ReadonlySet<string>;
  /** Fields waiting for an {@link OptionsLoader}. */
  loadingOptions: ReadonlySet<string>;
  /** Resolved choices, overriding the field's own `options` / `values`. */
  options: ReadonlyMap<string, SelectOption[]>;
}

/** An {@link AsyncFieldState} with nothing going on — the default. */
export const EMPTY_ASYNC_FIELD_STATE: AsyncFieldState = {
  validating: new Set<string>(),
  clean: new Set<string>(),
  loadingOptions: new Set<string>(),
  options: new Map<string, SelectOption[]>(),
};

/** Are this field's choices derived from, or fetched for, other values? */
export function hasDependentOptions(field: FormField): boolean {
  return field.optionsFor !== undefined || field.optionsLoader !== undefined;
}

/** Does anything in this field need the async machinery at all? */
export function hasAsyncBehaviour(field: FormField): boolean {
  return (field.asyncRules?.length ?? 0) > 0 || hasDependentOptions(field);
}

/** The watch list of a field, normalised to an array. */
export function dependencyNames(field: FormField): string[] {
  if (field.dependsOn === undefined) return [];
  return Array.isArray(field.dependsOn) ? field.dependsOn : [field.dependsOn];
}

/**
 * Every field of a definition that carries {@link FormField.asyncRules}.
 *
 * Hidden and disabled fields are left out, exactly as `validateForm` leaves
 * them out: a check the user cannot see must not fire requests, and must never
 * block a submit.
 */
export function asyncRuleFields(
  definition: FormDefinition,
  values: FormValues
): Array<[string, AsyncRule[]]> {
  const out: Array<[string, AsyncRule[]]> = [];
  for (const [name, field] of flattenFields(definition, { visibleOnly: true, values })) {
    if (!field.asyncRules?.length) continue;
    if (STATIC_FIELD_TYPES.has(field.type)) continue;
    if (isFieldDisabled(field, values)) continue;
    out.push([name, field.asyncRules]);
  }
  return out;
}

/**
 * Every visible field whose choices are derived or loaded.
 *
 * Visible only, for the same reason: a `showWhen` the user has not reached
 * should not be firing requests on their behalf.
 */
export function dependentOptionFields(
  definition: FormDefinition,
  values: FormValues
): Array<[string, ExtendedFormField]> {
  return flattenFields(definition, { visibleOnly: true, values }).filter(([, field]) =>
    hasDependentOptions(field)
  );
}

/**
 * Every field of a definition by name, `nextTo` siblings and conditionally
 * hidden rows included — the lookup a host needs to reconcile a value it was
 * only handed the name of.
 */
export function flattenFieldIndex(definition: FormDefinition): Map<string, ExtendedFormField> {
  return new Map(flattenFields(definition, { visibleOnly: false }));
}

/* ------------------------------------------------------------------ *
 * Keys and comparison
 * ------------------------------------------------------------------ */

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const entry of a) {
    if (!b.has(entry)) return false;
  }
  return true;
}

/**
 * Are two snapshots interchangeable? The option lists are compared by
 * identity, because the controllers hand out the same array until it genuinely
 * changes — which lets `<lia-form>` keep the previous object and spare every
 * field row a re-render.
 */
export function asyncFieldStateEqual(a: AsyncFieldState, b: AsyncFieldState): boolean {
  if (a === b) return true;
  if (!setsEqual(a.validating, b.validating)) return false;
  if (!setsEqual(a.clean, b.clean)) return false;
  if (!setsEqual(a.loadingOptions, b.loadingOptions)) return false;
  if (a.options.size !== b.options.size) return false;
  for (const [name, options] of a.options) {
    if (b.options.get(name) !== options) return false;
  }
  return true;
}

function stableKey(value: unknown): string {
  if (value === null || value === undefined) return '\u0000';
  if (Array.isArray(value)) return value.map(stableKey).join('\u0001');
  if (typeof value === 'object') return '\u0000object';
  return String(value);
}

/** A comparable fingerprint of the values a field watches. */
export function dependencyKey(field: FormField, values: FormValues): string {
  return dependencyNames(field)
    .map((name) => `${name}=${stableKey(values[name])}`)
    .join('\u0002');
}

/** Are these two option lists the same list, as far as a user can tell? */
export function optionsEqual(
  a: readonly SelectOption[] | undefined,
  b: readonly SelectOption[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((option, index) => {
    const other = b[index];
    return (
      String(option.value) === String(other.value) &&
      option.label === other.label &&
      option.disabled === other.disabled &&
      option.group === other.group
    );
  });
}

/** Does this field hold an array of selections rather than a single one? */
function holdsMultipleValues(field: FormField): boolean {
  if (field.type === 'select') return field.multiple === true;
  if (field.type === 'checkbox' || field.type === 'switch') return !isSingleToggle(field);
  return false;
}

/**
 * What a field's value has to become now that its choices have changed, or
 * `undefined` when the current one is still valid.
 *
 * This is the classic dependent-select bug in one function: narrow the zone
 * list to the new region and the zone the user picked five seconds ago is
 * still sitting in the model, ready to be posted as a perfectly well-formed
 * invalid id. A single selection that fell out of the list becomes `''`; a
 * multi-selection keeps only the entries that survived.
 *
 * @example
 * ```ts
 * reconcileOptionValue({ type: 'select' }, 'eu-west-1a', [{ value: 'us-east-1a', label: '…' }]);
 * // → ''
 * reconcileOptionValue({ type: 'select' }, 'us-east-1a', [{ value: 'us-east-1a', label: '…' }]);
 * // → undefined  (nothing to do)
 * ```
 */
export function reconcileOptionValue(
  field: FormField,
  current: unknown,
  options: readonly SelectOption[]
): unknown {
  const allowed = new Set(options.map((option) => String(option.value)));

  if (holdsMultipleValues(field)) {
    const before = toValueArray(current);
    const kept = before.filter((entry) => allowed.has(String(entry)));
    return kept.length === before.length ? undefined : kept;
  }

  if (current === null || current === undefined || current === '') return undefined;
  return allowed.has(String(current)) ? undefined : '';
}

/* ------------------------------------------------------------------ *
 * Async validation
 * ------------------------------------------------------------------ */

/** One rule's slot: its debounce timer, its request, and its last verdict. */
interface RuleRun {
  timer?: ReturnType<typeof setTimeout>;
  abort?: AbortController;
  /** Monotonic; a verdict tagged with an older id is discarded. */
  runId: number;
  /** A request is out right now. */
  inFlight: boolean;
  /** A verdict exists for the value as it stands. */
  settled: boolean;
  /** The rule threw or the endpoint died: settled, but not an endorsement. */
  failed: boolean;
  /** The verdict: a message, or `null` for a pass. */
  error: string | null;
  /** The value this slot's timer, request or verdict belongs to. */
  value?: unknown;
  /** Resolves when the run in flight finishes, so a submit can await it. */
  done?: Promise<void>;
}

/** Value comparison for "is this still the thing we judged?". */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => String(entry) === String(b[index]));
  }
  return false;
}

/** What an {@link AsyncValidationController} needs from its host. */
export interface AsyncValidationHost {
  /** The live value model, read at the moment a rule actually runs. */
  values(): FormValues;
  /** Something changed — re-render. */
  notify(): void;
}

function createRun(): RuleRun {
  return { runId: 0, inFlight: false, settled: false, failed: false, error: null };
}

function defaultDebounce(rule: AsyncRule): number {
  if (typeof rule.debounce === 'number') return Math.max(0, rule.debounce);
  return (rule.triggerOn ?? 'change') === 'blur' ? 0 : DEFAULT_ASYNC_DEBOUNCE;
}

/**
 * Runs a definition's {@link AsyncRule}s: debounced, abortable, and immune to
 * out-of-order answers.
 *
 * The controller is deliberately dumb about *when* to fire — `<lia-form>`
 * calls {@link schedule} on change and blur, {@link invalidate} when a value
 * moves, and {@link settle} before a submit.
 */
export class AsyncValidationController {
  /** field name -> rule id -> slot. */
  private readonly runs = new Map<string, Map<string, RuleRun>>();

  /** The rules currently in force, in declaration order. */
  private fields = new Map<string, AsyncRule[]>();

  constructor(private readonly host: AsyncValidationHost) {}

  /**
   * Declare the fields that currently have async rules. Anything not named is
   * forgotten and its request aborted — this is what makes a field that scrolls
   * out of a `showWhen`, or a whole form that unmounts, stop talking.
   */
  retain(entries: ReadonlyArray<readonly [string, AsyncRule[]]>): void {
    const next = new Map<string, AsyncRule[]>();
    for (const [name, rules] of entries) next.set(name, rules);
    this.fields = next;

    for (const name of Array.from(this.runs.keys())) {
      if (!next.has(name)) {
        this.abortField(name);
        this.runs.delete(name);
        continue;
      }
      // A rule that disappeared from a field takes its slot with it.
      const ids = new Set((next.get(name) ?? []).map((rule) => rule.id));
      const slots = this.runs.get(name);
      if (!slots) continue;
      for (const id of Array.from(slots.keys())) {
        if (ids.has(id)) continue;
        this.cancelRun(slots.get(id));
        slots.delete(id);
      }
    }
  }

  /**
   * Drop any verdict whose value has moved behind the controller's back.
   *
   * `<lia-form>` invalidates on every edit it sees, but a host can also call
   * `setValues()` or assign `.values` — and a verdict that judged a value
   * nobody is looking at any more is worse than no verdict at all. Nothing is
   * re-queued here: the slot simply becomes unsettled, so {@link settle} picks
   * it up before the next submit.
   */
  refresh(): void {
    const values = this.host.values();
    let touched = false;
    for (const [name, rules] of this.fields) {
      const slots = this.runs.get(name);
      if (!slots) continue;
      for (const rule of rules) {
        const run = slots.get(rule.id);
        if (!run) continue;
        if (run.timer === undefined && !run.inFlight && !run.settled) continue;
        if (sameValue(run.value, values[name])) continue;
        this.cancelRun(run);
        run.settled = false;
        run.failed = false;
        run.error = null;
        touched = true;
      }
    }
    if (touched) this.host.notify();
  }

  /** Is a rule for this field queued or in flight? */
  isPending(name: string): boolean {
    const slots = this.runs.get(name);
    if (!slots) return false;
    for (const run of slots.values()) {
      if (run.timer !== undefined || run.inFlight) return true;
    }
    return false;
  }

  /** Has every rule of this field come back happy for the current value? */
  isClean(name: string): boolean {
    const rules = this.fields.get(name);
    if (!rules?.length) return false;
    if (this.isPending(name)) return false;
    return rules.every((rule) => {
      const run = this.runs.get(name)?.get(rule.id);
      return run?.settled === true && !run.failed && run.error === null;
    });
  }

  /** Every field with work queued or in flight, in definition order. */
  get pendingFields(): string[] {
    return Array.from(this.fields.keys()).filter((name) => this.isPending(name));
  }

  /** `true` while anything at all is queued or in flight. */
  get pending(): boolean {
    return this.pendingFields.length > 0;
  }

  /**
   * The verdicts as a {@link FormErrors} map. The first failing rule of a field
   * wins, matching how the synchronous engine reports the first failing
   * validator.
   */
  errors(): FormErrors {
    const errors: FormErrors = {};
    for (const [name, rules] of this.fields) {
      for (const rule of rules) {
        const run = this.runs.get(name)?.get(rule.id);
        if (run?.settled && run.error !== null) {
          errors[name] = run.error;
          break;
        }
      }
    }
    return errors;
  }

  /**
   * Queue every rule of `name` whose trigger matches. A `'blur'` pass also
   * flushes any `'change'` debounce still waiting: the user has stopped typing
   * and left, so there is nothing left to wait for.
   */
  schedule(name: string, trigger: AsyncTrigger): void {
    const rules = this.fields.get(name);
    if (!rules?.length) return;
    for (const rule of rules) {
      const ruleTrigger = rule.triggerOn ?? 'change';
      if (ruleTrigger === trigger) {
        this.queue(name, rule, defaultDebounce(rule));
      } else if (trigger === 'blur' && ruleTrigger === 'change') {
        const run = this.runs.get(name)?.get(rule.id);
        if (run?.timer !== undefined) this.queue(name, rule, 0);
      }
    }
  }

  /**
   * Throw away everything known about a field — the value it was judged
   * against is gone. In-flight requests are aborted and their answers, should
   * they arrive anyway, are ignored.
   */
  invalidate(name: string): void {
    const slots = this.runs.get(name);
    if (!slots) return;
    let touched = false;
    for (const run of slots.values()) {
      if (run.timer === undefined && !run.inFlight && !run.settled) continue;
      this.cancelRun(run);
      run.settled = false;
      run.failed = false;
      run.error = null;
      touched = true;
    }
    if (touched) this.host.notify();
  }

  /**
   * Run everything that has no verdict yet, then wait for the lot.
   *
   * This is what turns `<lia-form>.validate()` into an honest answer: queued
   * debounces fire at once instead of being waited out, and the promise only
   * settles when every rule has spoken.
   */
  async settle(): Promise<void> {
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      for (const [name, rules] of this.fields) {
        for (const rule of rules) {
          const run = this.runs.get(name)?.get(rule.id);
          if (run?.timer !== undefined) {
            this.queue(name, rule, 0);
            continue;
          }
          if (!run?.inFlight && run?.settled !== true) this.start(name, rule);
        }
      }
      const inFlight: Array<Promise<void>> = [];
      for (const slots of this.runs.values()) {
        for (const run of slots.values()) {
          if (run.done) inFlight.push(run.done);
        }
      }
      if (inFlight.length === 0) return;
      await Promise.all(inFlight);
    }
  }

  /** Cancel every timer and request. Call it from `disconnectedCallback`. */
  destroy(): void {
    for (const name of Array.from(this.runs.keys())) this.abortField(name);
    this.runs.clear();
    this.fields = new Map<string, AsyncRule[]>();
  }

  /* ----- internals -------------------------------------------------- */

  private slotFor(name: string, ruleId: string): RuleRun {
    let slots = this.runs.get(name);
    if (!slots) {
      slots = new Map<string, RuleRun>();
      this.runs.set(name, slots);
    }
    let run = slots.get(ruleId);
    if (!run) {
      run = createRun();
      slots.set(ruleId, run);
    }
    return run;
  }

  /** Stop a run and make sure whatever it was doing can no longer land. */
  private cancelRun(run: RuleRun | undefined): void {
    if (!run) return;
    if (run.timer !== undefined) {
      clearTimeout(run.timer);
      run.timer = undefined;
    }
    // Bumping the id first means a resolution already on the microtask queue
    // is discarded even though `abort()` cannot un-resolve it.
    run.runId += 1;
    run.abort?.abort();
    run.abort = undefined;
    run.inFlight = false;
    run.done = undefined;
  }

  private abortField(name: string): void {
    const slots = this.runs.get(name);
    if (!slots) return;
    for (const run of slots.values()) this.cancelRun(run);
  }

  private queue(name: string, rule: AsyncRule, wait: number): void {
    const run = this.slotFor(name, rule.id);
    this.cancelRun(run);
    run.settled = false;
    run.failed = false;
    run.error = null;
    run.value = this.host.values()[name];
    if (wait <= 0) {
      this.start(name, rule);
      return;
    }
    run.timer = setTimeout(() => {
      run.timer = undefined;
      this.start(name, rule);
    }, wait);
    this.host.notify();
  }

  private start(name: string, rule: AsyncRule): void {
    const run = this.slotFor(name, rule.id);
    this.cancelRun(run);

    const runId = run.runId;
    const abort = new AbortController();
    run.abort = abort;
    run.inFlight = true;
    run.settled = false;
    run.failed = false;
    run.error = null;

    const values = this.host.values();
    run.value = values[name];
    run.done = Promise.resolve()
      .then(() => rule.validate(values[name], values, abort.signal))
      .then(
        (message) => this.finish(name, rule.id, runId, message ?? null),
        () => {
          // An abort is not a verdict; a genuine failure is "could not tell",
          // which must neither invent an error the user cannot act on nor hand
          // out the green tick a working endpoint would have had to earn.
          if (abort.signal.aborted) return;
          this.finish(name, rule.id, runId, null, true);
        }
      );
    this.host.notify();
  }

  private finish(
    name: string,
    ruleId: string,
    runId: number,
    error: string | null,
    failed = false
  ): void {
    const run = this.runs.get(name)?.get(ruleId);
    // The whole point: a verdict from a superseded run never lands.
    if (!run || run.runId !== runId) return;
    run.inFlight = false;
    run.abort = undefined;
    run.done = undefined;
    // Settled either way, so a dead endpoint cannot hold a submit hostage.
    run.settled = true;
    run.failed = failed;
    run.error = error;
    this.host.notify();
  }
}

/* ------------------------------------------------------------------ *
 * Dependent options
 * ------------------------------------------------------------------ */

interface OptionsEntry {
  /** Fingerprint of the watched values the current list belongs to. */
  key?: string;
  options?: SelectOption[];
  loading: boolean;
  /** A load has been tried for {@link key}, successfully or not. */
  attempted: boolean;
  runId: number;
  abort?: AbortController;
  done?: Promise<void>;
}

/** What a {@link DependentOptionsController} needs from its host. */
export interface DependentOptionsHost {
  /** The live value model. */
  values(): FormValues;
  /** Something changed — re-render. */
  notify(): void;
  /**
   * A field's choices are now these. The host reconciles the field's value
   * (see {@link reconcileOptionValue}) and tells the world about it.
   */
  changed(name: string, options: SelectOption[]): void;
}

/**
 * Keeps `optionsFor` / `optionsLoader` fields up to date with the values they
 * watch, with the same abort semantics as {@link AsyncValidationController}.
 */
export class DependentOptionsController {
  private readonly entries = new Map<string, OptionsEntry>();

  constructor(private readonly host: DependentOptionsHost) {}

  /**
   * Bring every dependent field in line with the current values.
   *
   * Returns `true` when a **synchronous** list changed, so the caller can run
   * another pass — clearing one select's value can perfectly well move the
   * ground under the next one.
   */
  sync(fields: ReadonlyArray<readonly [string, ExtendedFormField]>): boolean {
    const seen = new Set<string>();
    let changed = false;

    for (const [name, field] of fields) {
      if (field.optionsFor === undefined && field.optionsLoader === undefined) continue;
      seen.add(name);
      if (this.syncField(name, field)) changed = true;
    }

    for (const name of Array.from(this.entries.keys())) {
      if (seen.has(name)) continue;
      this.cancel(this.entries.get(name));
      this.entries.delete(name);
    }

    return changed;
  }

  /** The resolved choices of a field, or `undefined` when it has none yet. */
  optionsOf(name: string): SelectOption[] | undefined {
    return this.entries.get(name)?.options;
  }

  /** Is a loader out for this field? */
  isLoading(name: string): boolean {
    return this.entries.get(name)?.loading === true;
  }

  /** Every field waiting for a loader. */
  get pendingFields(): string[] {
    return Array.from(this.entries.entries())
      .filter(([, entry]) => entry.loading)
      .map(([name]) => name);
  }

  /** `true` while any loader is out. */
  get pending(): boolean {
    return this.pendingFields.length > 0;
  }

  /** Wait for every loader in flight — a submit must not race one. */
  async settle(): Promise<void> {
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const inFlight = Array.from(this.entries.values())
        .map((entry) => entry.done)
        .filter((done): done is Promise<void> => done !== undefined);
      if (inFlight.length === 0) return;
      await Promise.all(inFlight);
    }
  }

  /** Cancel every loader. Call it from `disconnectedCallback`. */
  destroy(): void {
    for (const entry of this.entries.values()) this.cancel(entry);
    this.entries.clear();
  }

  /* ----- internals -------------------------------------------------- */

  private entryFor(name: string): OptionsEntry {
    let entry = this.entries.get(name);
    if (!entry) {
      entry = { loading: false, attempted: false, runId: 0 };
      this.entries.set(name, entry);
    }
    return entry;
  }

  private cancel(entry: OptionsEntry | undefined): void {
    if (!entry) return;
    entry.runId += 1;
    entry.abort?.abort();
    entry.abort = undefined;
    entry.loading = false;
    entry.done = undefined;
  }

  private syncField(name: string, field: ExtendedFormField): boolean {
    const values = this.host.values();
    const key = dependencyKey(field, values);
    const entry = this.entryFor(name);
    const watched = field.dependsOn !== undefined;

    if (field.optionsFor !== undefined) {
      // A pure function is cheap enough to just call again when nothing is
      // being watched; the comparison below stops it from churning.
      if (watched && entry.key === key && entry.options !== undefined) return false;
      entry.key = key;
      const next = field.optionsFor(values);
      if (entry.options !== undefined && optionsEqual(entry.options, next)) return false;
      entry.options = next;
      this.host.changed(name, next);
      return true;
    }

    if (entry.key === key && entry.attempted) return false;
    entry.key = key;
    this.load(name, field, values);
    return false;
  }

  private load(name: string, field: ExtendedFormField, values: FormValues): void {
    const loader = field.optionsLoader;
    if (!loader) return;

    const entry = this.entryFor(name);
    this.cancel(entry);
    entry.attempted = true;

    const runId = entry.runId;
    const abort = new AbortController();
    entry.abort = abort;
    entry.loading = true;

    entry.done = Promise.resolve()
      .then(() => loader(values, abort.signal))
      .then(
        (options) => this.finish(name, runId, options),
        () => {
          if (abort.signal.aborted) return;
          // A failed load leaves whatever was there; better a stale list than
          // an empty select that looks like "no choices exist".
          this.finish(name, runId, undefined);
        }
      );
    this.host.notify();
  }

  private finish(name: string, runId: number, options: SelectOption[] | undefined): void {
    const entry = this.entries.get(name);
    if (!entry || entry.runId !== runId) return;
    entry.loading = false;
    entry.abort = undefined;
    entry.done = undefined;

    if (options !== undefined) {
      const differs = entry.options === undefined || !optionsEqual(entry.options, options);
      entry.options = options;
      if (differs) this.host.changed(name, options);
    }
    this.host.notify();
  }
}
