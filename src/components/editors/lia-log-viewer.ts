import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import type { CodeBlockLabels, CodeLine, LiaCodeBlock } from './lia-code-block.js';
import './lia-code-block.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/** Severity of a log entry. */
export type LogLevel = 'error' | 'warning' | 'info' | 'debug';

/** One structured log entry. */
export interface LogLine {
  /** Timestamp — a `Date`, epoch milliseconds, or an already-formatted string. */
  ts?: string | number | Date;
  level?: LogLevel;
  /** The message itself. */
  text: string;
  /** Where the entry came from — a unit, host or component name. */
  source?: string;
}

/** What {@link LiaLogViewer.lines} accepts: structured entries or raw strings. */
export type LogInput = LogLine | string;

/** Every string `<lia-log-viewer>` renders on its own behalf. */
export interface LogViewerLabels {
  /** Accessible name of the log region. */
  region: string;
  filter: string;
  filterPlaceholder: string;
  clearFilter: string;
  levels: string;
  follow: string;
  followHint: string;
  empty: string;
  noMatches: string;
  loading: string;
  /** `{shown}` and `{total}` are replaced. */
  summary: string;
  /** `{count}` is replaced. */
  truncated: string;
  levelNames: Record<LogLevel, string>;
}

/** The defaults behind {@link LiaLogViewer.labels}. */
export const DEFAULT_LOG_VIEWER_LABELS: Readonly<LogViewerLabels> = Object.freeze({
  region: 'Log output',
  filter: 'Filter lines',
  filterPlaceholder: 'Filter…',
  clearFilter: 'Clear the filter',
  levels: 'Severity',
  follow: 'Follow',
  followHint: 'Keep the newest line in view',
  empty: 'No output yet.',
  noMatches: 'No line matches the current filter.',
  loading: 'Loading log…',
  summary: '{shown} of {total} lines',
  truncated: 'Older lines were dropped — showing the newest {count}.',
  levelNames: {
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    debug: 'Debug',
  },
});

/** Detail of `lia-log-filter-change`. */
export interface LogFilterDetail {
  /** The free-text filter. */
  text: string;
  /** The severities currently shown. */
  levels: LogLevel[];
}

/** Detail of `lia-log-follow-change`. */
export interface LogFollowDetail {
  follow: boolean;
}

declare global {
  interface HTMLElementEventMap {
    'lia-log-filter-change': CustomEvent<LogFilterDetail>;
    'lia-log-follow-change': CustomEvent<LogFollowDetail>;
  }
}

/** Every severity, in the order the filter shows them. */
export const LOG_LEVELS: readonly LogLevel[] = Object.freeze([
  'error',
  'warning',
  'info',
  'debug',
] as const);

/** Bootstrap text colour per severity. `info` deliberately stays body-coloured. */
const LEVEL_TEXT: Readonly<Record<LogLevel, string>> = Object.freeze({
  error: 'text-danger-emphasis fw-semibold',
  warning: 'text-warning-emphasis',
  info: '',
  debug: 'text-body-secondary',
});

/** Bootstrap button variant per severity, for the filter toggles. */
const LEVEL_VARIANT: Readonly<Record<LogLevel, string>> = Object.freeze({
  error: 'danger',
  warning: 'warning',
  info: 'info',
  debug: 'secondary',
});

/**
 * Guessed severity, in priority order. Matched against the whole line, which
 * is how syslog, Apache and systemd output all end up classified correctly.
 */
const LEVEL_PATTERNS: ReadonlyArray<readonly [LogLevel, RegExp]> = Object.freeze([
  ['error', /\b(?:error|err|crit|critical|alert|emerg|fatal|panic|failed|failure)\b/i],
  ['warning', /\b(?:warn|warning|notice)\b/i],
  ['debug', /\b(?:debug|trace|verbose)\b/i],
  ['info', /\b(?:info|information)\b/i],
] as const);

/** Best-effort severity for an unstructured line. */
export function guessLogLevel(text: string): LogLevel | undefined {
  for (const [level, pattern] of LEVEL_PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return undefined;
}

/** Normalise one entry, inferring the severity of plain strings. */
export function toLogLine(input: LogInput, autoLevel = true): LogLine {
  if (typeof input !== 'string') return input;
  const level = autoLevel ? guessLogLevel(input) : undefined;
  return level ? { text: input, level } : { text: input };
}

/** Split `text` around every occurrence of `query`, wrapping hits in `<mark>`. */
export function highlightLogMatches(text: string, query: string): unknown {
  if (query === '') return text;
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  const parts: unknown[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    if (at > from) parts.push(text.slice(from, at));
    parts.push(html`<mark>${text.slice(at, at + needle.length)}</mark>`);
    from = at + needle.length;
  }
  if (parts.length === 0) return text;
  if (from < text.length) parts.push(text.slice(from));
  return html`${parts}`;
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * A log pane: monospace lines with numbers, a severity filter, a highlighting
 * text filter, a follow/tail toggle that keeps the newest line in view, a wrap
 * toggle, copy and download.
 *
 * It replaces the read-only `<textarea>` the panel used to dump log files
 * into — which offered no filtering, no severity, no tail and no line numbers.
 * Entries may be structured (`{ ts, level, text }`) or plain strings, in which
 * case the severity is inferred from the text; set `no-auto-level` to switch
 * that off.
 *
 * Only the newest `max-lines` entries are kept, so a busy stream cannot grow
 * the DOM without bound. Scrolling away from the bottom by hand turns *follow*
 * off, the behaviour every terminal has.
 *
 * @example
 * ```ts
 * html`<lia-log-viewer
 *   .lines=${entries}
 *   ?loading=${pending}
 *   follow
 *   max-height="30rem"
 *   download-name="service.log"
 *   @lia-log-filter-change=${(e: CustomEvent) => console.log(e.detail.levels)}
 * ></lia-log-viewer>`;
 * ```
 *
 * @example
 * ```html
 * <lia-log-viewer max-lines="500" timestamps="false" line-numbers="false"></lia-log-viewer>
 * ```
 */
@customElement('lia-log-viewer')
export class LiaLogViewer extends LiaElement {
  /** The entries, oldest first. */
  @property({ attribute: false }) lines: LogInput[] = [];

  /** Show the loading state instead of the lines. */
  @property({ type: Boolean }) loading = false;

  /** Keep at most this many entries — the newest win. `0` keeps everything. */
  @property({ type: Number, attribute: 'max-lines' }) maxLines = 2000;

  /** Severities offered in the filter. */
  @property({ attribute: false }) levels: LogLevel[] = [...LOG_LEVELS];

  /**
   * Severities currently shown. Leave unset to let the viewer own the filter;
   * set it to drive the filter from outside.
   */
  @property({ attribute: false }) activeLevels?: LogLevel[];

  /** Initial free-text filter. The viewer owns it after the first keystroke. */
  @property({ type: String }) filter = '';

  /** Keep the newest line in view as entries arrive. */
  @property({ type: Boolean }) follow = false;

  /** Hide the follow toggle — for logs that are not live. */
  @property({ type: Boolean, attribute: 'no-follow-toggle' }) noFollowToggle = false;

  /** Wrap long lines. */
  @property({ type: Boolean }) wrap = false;

  /** Maximum height of the scroll area. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '26rem';

  /** Show the line-number gutter. */
  @property({ converter: flag, attribute: 'line-numbers' }) lineNumbers = true;

  /** Show timestamps in front of each line. */
  @property({ converter: flag, attribute: 'timestamps' }) timestamps = true;

  /** `Intl.DateTimeFormat` options for `Date`/epoch timestamps. */
  @property({ attribute: false }) timestampOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  /** Locale for timestamps. Defaults to the browser's. */
  @property({ type: String }) locale?: string;

  /** Infer the severity of plain-string entries from their text. */
  @property({ type: Boolean, attribute: 'no-auto-level' }) noAutoLevel = false;

  /** File name for the download button. Empty hides the button. */
  @property({ type: String, attribute: 'download-name' }) downloadName = 'log.txt';

  /** Short tag shown in the header. */
  @property({ type: String }) language = 'log';

  /** File name shown next to the tag. */
  @property({ type: String }) filename = '';

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<LogViewerLabels> = {};

  /** Overrides for the strings of the underlying `<lia-code-block>`. */
  @property({ attribute: false }) codeLabels: Partial<CodeBlockLabels> = {};

  @state() private query = '';
  @state() private levelSelection?: LogLevel[];

  private readonly instanceId = uid('lia-log');
  private scrollTarget?: HTMLElement;

  private readonly onScroll = (): void => {
    const element = this.scrollTarget;
    if (!element || !this.follow) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    // Anything more than a line away from the bottom is a deliberate scroll up.
    if (distance > 24) this.setFollow(false);
  };

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('filter')) this.query = this.filter;
  }

  override disconnectedCallback(): void {
    this.scrollTarget?.removeEventListener('scroll', this.onScroll);
    this.scrollTarget = undefined;
    super.disconnectedCallback();
  }

  override updated(): void {
    const block = this.querySelector<LiaCodeBlock>('lia-code-block');
    if (!block) return;
    // The child renders in its own microtask; measuring before it has laid the
    // new lines out would tail to the *previous* bottom.
    void block.updateComplete.then(() => {
      const element = block.scrollElement ?? undefined;
      if (element !== this.scrollTarget) {
        this.scrollTarget?.removeEventListener('scroll', this.onScroll);
        this.scrollTarget = element;
        this.scrollTarget?.addEventListener('scroll', this.onScroll, {
          passive: true,
        });
      }
      if (this.follow && !this.loading) block.scrollToBottom();
    });
  }

  /** Scroll the pane to the newest line. */
  scrollToBottom(): void {
    this.querySelector<LiaCodeBlock>('lia-code-block')?.scrollToBottom();
  }

  /** The entries that pass both filters, oldest first. */
  get visibleLines(): LogLine[] {
    return this.filtered();
  }

  private get strings(): LogViewerLabels {
    const merged = { ...DEFAULT_LOG_VIEWER_LABELS, ...this.labels };
    merged.levelNames = {
      ...DEFAULT_LOG_VIEWER_LABELS.levelNames,
      ...this.labels.levelNames,
    };
    return merged;
  }

  private get shownLevels(): LogLevel[] {
    return this.activeLevels ?? this.levelSelection ?? this.levels;
  }

  private normalised(): LogLine[] {
    const all = this.lines.map((line) => toLogLine(line, !this.noAutoLevel));
    if (this.maxLines > 0 && all.length > this.maxLines) return all.slice(-this.maxLines);
    return all;
  }

  private filtered(): LogLine[] {
    const active = new Set(this.shownLevels);
    const allLevelsOn = this.levels.every((level) => active.has(level));
    const needle = this.query.toLowerCase();
    return this.normalised().filter((line) => {
      // Entries without a severity are never hidden by the severity filter —
      // dropping them would silently swallow output the filter cannot classify.
      if (!allLevelsOn && line.level !== undefined && !active.has(line.level)) return false;
      if (needle === '') return true;
      return this.plainText(line).toLowerCase().includes(needle);
    });
  }

  private formatTimestamp(ts: LogLine['ts']): string {
    if (ts === undefined || ts === null) return '';
    if (typeof ts === 'string') return ts;
    const date = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(date.getTime())) return String(ts);
    return new Intl.DateTimeFormat(this.locale, this.timestampOptions).format(date);
  }

  /** The line as copy and download should see it. */
  private plainText(line: LogLine): string {
    const parts: string[] = [];
    const ts = this.timestamps ? this.formatTimestamp(line.ts) : '';
    if (ts) parts.push(ts);
    if (line.level) parts.push(`[${line.level}]`);
    if (line.source) parts.push(`${line.source}:`);
    parts.push(line.text);
    return parts.join(' ');
  }

  private toCodeLine(line: LogLine): CodeLine {
    const ts = this.timestamps ? this.formatTimestamp(line.ts) : '';
    const strings = this.strings;
    const levelName = line.level ? strings.levelNames[line.level] : '';
    return {
      text: this.plainText(line),
      class: line.level ? LEVEL_TEXT[line.level] : '',
      srLabel: levelName || undefined,
      content: html`${ts ? html`<span class="lia-log-meta">${ts} </span>` : nothing}${
        line.level
          ? html`<span class="lia-log-meta" aria-hidden="true">[${line.level}] </span>`
          : nothing
      }${
        line.source ? html`<span class="lia-log-meta">${line.source}: </span>` : nothing
      }${highlightLogMatches(line.text, this.query)}`,
    };
  }

  private setFollow(next: boolean): void {
    if (this.follow === next) return;
    this.follow = next;
    this.emit<LogFollowDetail>('lia-log-follow-change', { follow: next });
  }

  private emitFilter(): void {
    this.emit<LogFilterDetail>('lia-log-filter-change', {
      text: this.query,
      levels: [...this.shownLevels],
    });
  }

  private setQuery(text: string): void {
    this.query = text;
    this.emitFilter();
  }

  private toggleLevel(level: LogLevel): void {
    const current = new Set(this.shownLevels);
    if (current.has(level)) current.delete(level);
    else current.add(level);
    // Never leave the reader with an empty pane and no way back.
    this.levelSelection =
      current.size === 0
        ? [...this.levels]
        : this.levels.filter((candidate) => current.has(candidate));
    this.emitFilter();
  }

  private renderToolbar(): TemplateResult {
    const strings = this.strings;
    const active = new Set(this.shownLevels);
    return html`<div class="d-flex flex-wrap align-items-center gap-2">
      <div class="input-group input-group-sm" style="width: 15rem">
        <span class="input-group-text" id="${this.instanceId}-filter-icon">
          ${renderIcon('fa-solid fa-filter')}
        </span>
        <input
          type="search"
          class="form-control"
          .value=${this.query}
          placeholder=${strings.filterPlaceholder}
          aria-label=${strings.filter}
          aria-describedby="${this.instanceId}-filter-icon"
          @input=${(event: Event) => this.setQuery((event.target as HTMLInputElement).value)}
        />
        ${
          this.query
            ? html`<button
                type="button"
                class="btn btn-outline-secondary"
                title=${strings.clearFilter}
                @click=${() => this.setQuery('')}
              >
                ${renderIcon('fa-solid fa-xmark', { label: strings.clearFilter })}
              </button>`
            : nothing
        }
      </div>

      ${
        this.levels.length > 1
          ? html`<div class="btn-group btn-group-sm" role="group" aria-label=${strings.levels}>
              ${this.levels.map((level) => {
                const on = active.has(level);
                return html`<button
                  type="button"
                  class=${cx(
                    'btn',
                    on ? `btn-${LEVEL_VARIANT[level]}` : `btn-outline-${LEVEL_VARIANT[level]}`,
                  )}
                  aria-pressed=${on ? 'true' : 'false'}
                  @click=${() => this.toggleLevel(level)}
                >
                  ${strings.levelNames[level]}
                </button>`;
              })}
            </div>`
          : nothing
      }
      ${
        this.noFollowToggle
          ? nothing
          : html`<div class="form-check form-switch mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="${this.instanceId}-follow"
                .checked=${this.follow}
                @change=${(event: Event) =>
                  this.setFollow((event.target as HTMLInputElement).checked)}
              />
              <label
                class="form-check-label small"
                for="${this.instanceId}-follow"
                title=${strings.followHint}
                >${strings.follow}</label
              >
            </div>`
      }
    </div>`;
  }

  override render(): TemplateResult {
    const strings = this.strings;
    const total = this.lines.length;
    const kept = this.normalised();
    const visible = this.filtered();
    const codeLines = visible.map((line) => this.toCodeLine(line));
    const truncated = this.maxLines > 0 && total > kept.length;

    return html`<div class="lia-log-viewer">
      <lia-code-block
        language=${this.language}
        filename=${this.filename}
        label=${strings.region}
        max-height=${this.maxHeight}
        download-name=${this.downloadName}
        line-numbers=${this.lineNumbers ? 'true' : 'false'}
        ?wrap=${this.wrap}
        ?loading=${this.loading}
        wrap-toggle
        .headerContent=${this.renderToolbar()}
        .lines=${codeLines}
        .labels=${{
          loading: strings.loading,
          empty: total === 0 ? strings.empty : strings.noMatches,
          ...this.codeLabels,
        }}
      ></lia-code-block>

      <div class="d-flex flex-wrap justify-content-between gap-2 mt-1 small text-body-secondary">
        <span role="status" aria-live="polite"
          >${strings.summary
            .replace('{shown}', String(visible.length))
            .replace('{total}', String(kept.length))}</span
        >
        ${
          truncated
            ? html`<span>${strings.truncated.replace('{count}', String(kept.length))}</span>`
            : nothing
        }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-log-viewer': LiaLogViewer;
  }
}
