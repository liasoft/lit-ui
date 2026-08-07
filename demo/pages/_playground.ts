/**
 * Shared furniture for the *interactive* demos.
 *
 * `_kit.ts` gives every page its layout (sections, example cards, snippets).
 * This module gives the pages the two things a **working** sample needs on top
 * of that:
 *
 * 1. an **event log** — proof that the click really did emit something, with
 *    the detail payload spelled out, and
 * 2. a **value dump** — the state a component produced, rendered as JSON next
 *    to the component that produced it.
 *
 * Both are plain functions over immutable arrays, so a demo element only needs
 * one `@state()` field and one call to keep a live transcript.
 *
 * @example
 * ```ts
 * @state() private events: readonly LoggedEvent[] = [];
 *
 * private onAction(event: CustomEvent<ActionEventDetail>): void {
 *   this.events = logEvent(this.events, 'lia-action', event.detail);
 * }
 *
 * render() {
 *   return html`${eventLog(this.events)}`;
 * }
 * ```
 */

import { html, nothing, type TemplateResult } from 'lit';
import type { Variant } from '@liasoft/lit-ui';

/* ------------------------------------------------------------------ *
 * Event transcript
 * ------------------------------------------------------------------ */

/** One line of an {@link eventLog}. */
export interface LoggedEvent {
  /** Monotonic id, so Lit can key the list. */
  key: number;
  /** Wall-clock time the entry was recorded. */
  time: string;
  /** Event name, e.g. `lia-sort`. */
  type: string;
  /** The detail, already stringified. */
  detail: string;
}

let logCounter = 0;

function clockTime(): string {
  const now = new Date();
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(
    now.getMilliseconds(),
    3
  )}`;
}

/**
 * Render a value the way a transcript wants it: short, one line, and never
 * throwing on a circular structure or a function.
 *
 * @example
 * ```ts
 * describeDetail({ field: 'name', order: 'asc' }); // → '{ field: "name", order: "asc" }'
 * ```
 */
export function describeDetail(detail: unknown): string {
  if (detail === undefined) return '';
  if (detail === null) return 'null';
  if (typeof detail === 'string') return detail;
  if (typeof detail !== 'object') return String(detail);

  const seen = new WeakSet<object>();
  const replacer = (_key: string, value: unknown): unknown => {
    if (typeof value === 'function') return '[function]';
    if (typeof value === 'bigint') return `${value}n`;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[circular]';
      seen.add(value);
    }
    return value;
  };

  try {
    const json = JSON.stringify(detail, replacer);
    if (json === undefined) return String(detail);
    return json.length > 220 ? `${json.slice(0, 217)}…` : json;
  } catch {
    return String(detail);
  }
}

/**
 * Append an entry to a transcript, newest first, capped at `max` lines.
 *
 * Returns a **new** array so it can be assigned straight to a `@state()`
 * field.
 *
 * @example
 * ```ts
 * this.events = logEvent(this.events, 'lia-page-change', { page: 3 });
 * ```
 */
export function logEvent(
  entries: readonly LoggedEvent[],
  type: string,
  detail?: unknown,
  max = 8
): LoggedEvent[] {
  logCounter += 1;
  const entry: LoggedEvent = {
    key: logCounter,
    time: clockTime(),
    type,
    detail: describeDetail(detail),
  };
  return [entry, ...entries].slice(0, max);
}

/** Options of {@link eventLog}. */
export interface EventLogOptions {
  /** Heading above the list. Defaults to `Events`. */
  title?: string;
  /** Shown while nothing has happened yet. */
  placeholder?: string;
  /** Contextual colour of the event-name chips. Defaults to `secondary`. */
  variant?: Variant;
}

/**
 * The live transcript of what a sample emitted — the thing that turns a
 * screenshot into a demonstration.
 *
 * It is an `aria-live="polite"` log, so a screen reader hears each new line
 * without losing its place on the page.
 *
 * @example
 * ```ts
 * eventLog(this.events, { title: 'What the table emitted' });
 * ```
 */
export function eventLog(
  entries: readonly LoggedEvent[],
  options: EventLogOptions = {}
): TemplateResult {
  const variant = options.variant ?? 'secondary';
  return html`
    <div class="card bg-body-tertiary border-0 mt-3">
      <div class="card-body p-2 p-sm-3">
        <p class="text-uppercase small fw-semibold text-body-secondary mb-2">
          <i class="fa-solid fa-satellite-dish me-2" aria-hidden="true"></i>${options.title ??
          'Events'}
        </p>
        <ol class="list-unstyled mb-0 font-monospace small" role="log" aria-live="polite">
          ${entries.length === 0
            ? html`<li class="text-body-secondary">
                ${options.placeholder ?? 'Nothing yet — interact with the sample above.'}
              </li>`
            : entries.map(
                (entry) => html`<li class="d-flex flex-wrap gap-2 align-items-baseline py-1">
                  <span class="text-body-tertiary">${entry.time}</span>
                  <span class="badge text-bg-${variant} fw-normal">${entry.type}</span>
                  ${entry.detail
                    ? html`<span class="text-body-secondary text-break">${entry.detail}</span>`
                    : nothing}
                </li>`
              )}
        </ol>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ *
 * Value dump
 * ------------------------------------------------------------------ */

/**
 * Show the state a component just produced — form values, a selection, a
 * record set — as pretty-printed JSON in a `<lia-code-block>`.
 *
 * @example
 * ```ts
 * valueDump(this.submitted, { title: 'Submitted values' });
 * ```
 */
export function valueDump(
  value: unknown,
  options: { title?: string; empty?: string; maxHeight?: string } = {}
): TemplateResult {
  if (value === undefined) {
    return html`<p class="text-body-secondary small mb-0 mt-3">
      <i class="fa-regular fa-clipboard me-2" aria-hidden="true"></i>${options.empty ??
      'Nothing captured yet.'}
    </p>`;
  }

  let json: string;
  try {
    json = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    json = String(value);
  }

  return html`<div class="mt-3">
    <lia-code-block
      .code=${json}
      language="json"
      label=${options.title ?? 'Captured value'}
      filename=${options.title ?? ''}
      max-height=${options.maxHeight ?? '18rem'}
      wrap-toggle
    ></lia-code-block>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Small labels
 * ------------------------------------------------------------------ */

/** Every Bootstrap contextual colour, in the order the docs list them. */
export const VARIANTS: readonly Variant[] = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'light',
  'dark',
];

/**
 * A caption under a sample, for the one sentence that explains what to try.
 *
 * @example
 * ```ts
 * tryIt('Click a column header twice: ascending, descending, then unsorted.');
 * ```
 */
export function tryIt(text: string): TemplateResult {
  return html`<p class="small text-body-secondary mb-3">
    <i class="fa-solid fa-hand-pointer me-2" aria-hidden="true"></i>${text}
  </p>`;
}

/**
 * A labelled swatch row — a caption above an arbitrary sample, used when a
 * cluster of variants needs each item named.
 *
 * @example
 * ```ts
 * labelled('outline-danger', html`<lia-button variant="outline-danger" label="Delete"></lia-button>`);
 * ```
 */
export function labelled(label: string, content: unknown): TemplateResult {
  return html`<div class="d-flex flex-column gap-1">
    <span class="small text-body-secondary font-monospace">${label}</span>
    <div>${content}</div>
  </div>`;
}
