import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import type { ActionDescriptor } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderActions } from '../primitives/render-action.js';
import { renderSpinner } from '../primitives/lia-spinner.js';
import { flag } from '../layout/flag.js';
import '../primitives/lia-copy-button.js';

/* ------------------------------------------------------------------ *
 * Model
 * ------------------------------------------------------------------ */

/**
 * One rendered line.
 *
 * `text` is always the source of truth for copy and download; `content` only
 * replaces what is *shown*, which is how the log viewer highlights matches and
 * the diff view paints added and removed lines without breaking the clipboard.
 */
export interface CodeLine {
  /** The literal line, used for copy, download and as the default rendering. */
  text: string;
  /** Rich replacement for `text` — any Lit-renderable value. */
  content?: unknown;
  /** Extra classes on the line row, e.g. `bg-danger-subtle`. */
  class?: string;
  /** Gutter number. `null` renders no number; omitted derives it from position. */
  number?: number | string | null;
  /** Announced before the line by screen readers, e.g. `Added`. */
  srLabel?: string;
}

/** Every string `<lia-code-block>` renders on its own behalf. */
export interface CodeBlockLabels {
  copy: string;
  copied: string;
  download: string;
  /** Title of the wrap toggle while lines are *not* wrapped. */
  wrapOn: string;
  /** Title of the wrap toggle while lines *are* wrapped. */
  wrapOff: string;
  loading: string;
  empty: string;
}

/** The defaults behind {@link LiaCodeBlock.labels}. */
export const DEFAULT_CODE_BLOCK_LABELS: Readonly<CodeBlockLabels> = Object.freeze({
  copy: 'Copy',
  copied: 'Copied',
  download: 'Download',
  wrapOn: 'Wrap long lines',
  wrapOff: 'Stop wrapping long lines',
  loading: 'Loading…',
  empty: 'Nothing to show.',
});

/** Detail of the `lia-code-download` event. */
export interface CodeDownloadDetail {
  /** File name offered to the browser. */
  name: string;
  /** The text that was written to the file. */
  text: string;
}

/** Detail of the `lia-code-wrap-change` event. */
export interface CodeWrapDetail {
  wrap: boolean;
}

declare global {
  interface HTMLElementEventMap {
    'lia-code-download': CustomEvent<CodeDownloadDetail>;
    'lia-code-wrap-change': CustomEvent<CodeWrapDetail>;
  }
}

/** Split a blob of text into lines, tolerating all three newline conventions. */
export function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * A monospace block for showing text as text: a config file, a zone file, a
 * command transcript, a stack trace.
 *
 * It is the shared substrate of the editors family — `<lia-log-viewer>`,
 * `<lia-diff-view>` and any "show me the file" panel hand it lines and let it
 * own the chrome: an optional header with a language tag and a file name, a
 * copy button, a download button, a wrap toggle, a bounded scroll area and a
 * gutter of line numbers.
 *
 * The gutter is drawn as a CSS pseudo-element, so selecting a range with the
 * mouse copies the code and not the numbers.
 *
 * @example
 * ```html
 * <lia-code-block
 *   language="ini"
 *   filename="service.conf"
 *   download-name="service.conf"
 *   max-height="20rem"
 *   wrap-toggle
 * ></lia-code-block>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-code-block
 *   language="text"
 *   .code=${zoneFile}
 *   .highlightLines=${[12, 13]}
 *   @lia-code-download=${(e: CustomEvent) => track(e.detail.name)}
 * ></lia-code-block>`;
 * ```
 */
@customElement('lia-code-block')
export class LiaCodeBlock extends LiaElement {
  /** The text to show. Ignored when {@link lines} is set. */
  @property({ type: String }) code = '';

  /** Pre-built lines. Wins over {@link code} — used by richer viewers. */
  @property({ attribute: false }) lines?: CodeLine[];

  /** Short tag shown in the header, e.g. `json`, `nginx`, `log`. */
  @property({ type: String }) language = '';

  /** File name shown next to the language tag. */
  @property({ type: String }) filename = '';

  /** Accessible name of the scroll region. Falls back to filename/language. */
  @property({ type: String }) label = '';

  /** Show the line-number gutter. */
  @property({ converter: flag, attribute: 'line-numbers' }) lineNumbers = true;

  /** Number of the first line, for excerpts that start part-way into a file. */
  @property({ type: Number, attribute: 'start-line' }) startLine = 1;

  /** Line numbers to call out — highlighted with a warning tint. */
  @property({ attribute: false }) highlightLines: number[] = [];

  /** Wrap long lines instead of scrolling horizontally. */
  @property({ type: Boolean }) wrap = false;

  /** Offer the reader a wrap toggle in the header. */
  @property({ type: Boolean, attribute: 'wrap-toggle' }) wrapToggle = false;

  /** Maximum height of the scroll area, as any CSS length. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '24rem';

  /** Show the copy button. */
  @property({ converter: flag }) copyable = true;

  /** File name for the download button. Empty hides the button. */
  @property({ type: String, attribute: 'download-name' }) downloadName = '';

  /** Swap the code for a spinner. */
  @property({ type: Boolean }) loading = false;

  /** Drop the header entirely. */
  @property({ type: Boolean, attribute: 'no-header' }) noHeader = false;

  /** Drop the surrounding card, leaving just the scroll area. */
  @property({ type: Boolean, attribute: 'no-card' }) noCard = false;

  /** Extra controls rendered at the start of the header — filters, tabs, counts. */
  @property({ attribute: false }) headerContent?: unknown;

  /** Extra buttons rendered at the end of the header. */
  @property({ attribute: false }) actions: ActionDescriptor[] = [];

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<CodeBlockLabels> = {};

  /** Extra classes for the `.card` wrapper. */
  @property({ type: String, attribute: 'card-class' }) cardClass = '';

  @state() private wrapping = false;

  override willUpdate(changed: PropertyValues<this>): void {
    // The property seeds the state; the toggle owns it from then on.
    if (changed.has('wrap')) this.wrapping = this.wrap;
  }

  /** The full text, exactly as copy and download produce it. */
  get text(): string {
    return this.resolvedLines()
      .map((line) => line.text)
      .join('\n');
  }

  private get strings(): CodeBlockLabels {
    return { ...DEFAULT_CODE_BLOCK_LABELS, ...this.labels };
  }

  /** Whether long lines are currently wrapped. */
  get wrapped(): boolean {
    return this.wrapping;
  }

  /** The scrolling element, so hosts can drive it (tail/follow, jump to line). */
  get scrollElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>('.lia-code-scroll');
  }

  /** Scroll to the last line. */
  scrollToBottom(): void {
    const element = this.scrollElement;
    if (element) element.scrollTop = element.scrollHeight;
  }

  /** Scroll a 1-based line into view. */
  scrollToLine(line: number): void {
    const target = this.querySelector<HTMLElement>(
      `.lia-code-line[data-line="${CSS.escape(String(line))}"]`,
    );
    target?.scrollIntoView({ block: 'center' });
  }

  /** Turn wrapping on or off and announce it. */
  toggleWrap(next = !this.wrapping): void {
    this.wrapping = next;
    this.emit<CodeWrapDetail>('lia-code-wrap-change', { wrap: next });
  }

  /** Offer the current text as a file download. */
  download(): void {
    const name = this.downloadName || 'download.txt';
    const text = this.text;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Give the browser a tick to start the transfer before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.emit<CodeDownloadDetail>('lia-code-download', { name, text });
  }

  private resolvedLines(): CodeLine[] {
    if (this.lines) return this.lines;
    return splitLines(this.code).map((text) => ({ text }));
  }

  private lineNumberOf(line: CodeLine, index: number): string | null {
    if (line.number === null) return null;
    if (line.number !== undefined) return String(line.number);
    return String(this.startLine + index);
  }

  private renderHeader(count: number): TemplateResult | typeof nothing {
    if (this.noHeader) return nothing;
    const strings = this.strings;
    const hasLeft = Boolean(this.language || this.filename || this.headerContent);
    const hasRight =
      this.copyable || this.downloadName !== '' || this.wrapToggle || this.actions.length > 0;
    if (!hasLeft && !hasRight) return nothing;

    return html`<div
      class="card-header d-flex flex-wrap align-items-center justify-content-between gap-2 py-2"
    >
      <div class="d-flex flex-wrap align-items-center gap-2 overflow-hidden">
        ${
          this.language
            ? html`<span class="badge text-bg-secondary text-uppercase">${this.language}</span>`
            : nothing
        }
        ${
          this.filename
            ? html`<span class="font-monospace small text-truncate">${this.filename}</span>`
            : nothing
        }
        ${this.headerContent ?? nothing}
      </div>
      <div class="d-flex flex-wrap align-items-center gap-1">
        ${renderActions(this.actions, { host: this, size: 'sm' })}
        ${
          this.wrapToggle
            ? html`<button
                type="button"
                class=${cx('btn btn-sm', this.wrapping ? 'btn-secondary' : 'btn-outline-secondary')}
                aria-pressed=${this.wrapping ? 'true' : 'false'}
                title=${this.wrapping ? strings.wrapOff : strings.wrapOn}
                @click=${() => this.toggleWrap()}
              >
                ${renderIcon('fa-solid fa-text-width', { label: strings.wrapOn })}
              </button>`
            : nothing
        }
        ${
          this.downloadName
            ? html`<button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                title=${strings.download}
                ?disabled=${count === 0}
                @click=${() => this.download()}
              >
                ${renderIcon('fa-solid fa-download', { label: strings.download })}
              </button>`
            : nothing
        }
        ${
          this.copyable
            ? html`<lia-copy-button
                .text=${this.text}
                title=${strings.copy}
                copied-title=${strings.copied}
                ?disabled=${count === 0}
              ></lia-copy-button>`
            : nothing
        }
      </div>
    </div>`;
  }

  private renderCode(lines: CodeLine[]): TemplateResult {
    const strings = this.strings;
    if (lines.length === 0) {
      return html`<div class="p-3 text-body-secondary small">${strings.empty}</div>`;
    }

    const numbered = this.lineNumbers;
    const widest = numbered
      ? lines.reduce((max, line, index) => {
          const value = this.lineNumberOf(line, index);
          return value ? Math.max(max, value.length) : max;
        }, 1)
      : 0;
    const highlighted = new Set(this.highlightLines.map(String));

    return html`<pre
      class=${cx('lia-code', numbered && 'lia-code-numbered')}
      style=${styleMap(numbered ? { '--lia-code-gutter': `calc(${widest}ch + 1.25rem)` } : {})}
    ><code>${lines.map((line, index) => {
      const number = numbered ? this.lineNumberOf(line, index) : null;
      return html`<span
        class=${cx(
          'lia-code-line',
          number !== null && highlighted.has(number) && 'lia-code-line-mark',
          line.class,
        )}
        data-line=${number ?? nothing}
        >${
          line.srLabel ? html`<span class="visually-hidden">${line.srLabel} </span>` : nothing
        }${line.content ?? line.text}</span
      >`;
    })}</code></pre>`;
  }

  override render(): TemplateResult {
    const lines = this.resolvedLines();
    const strings = this.strings;
    const body = html`<div
      class=${cx('lia-code-scroll', this.wrapping && 'lia-code-wrap')}
      style=${styleMap(this.maxHeight ? { maxHeight: this.maxHeight } : {})}
      tabindex="0"
      role="region"
      aria-label=${this.label || this.filename || this.language || 'Code'}
      aria-busy=${this.loading ? 'true' : 'false'}
    >
      ${
        this.loading
          ? html`<div class="d-flex align-items-center gap-2 p-3 text-body-secondary small">
              ${renderSpinner(strings.loading, { size: 'sm' })}<span>${strings.loading}</span>
            </div>`
          : this.renderCode(lines)
      }
    </div>`;

    if (this.noCard) {
      return html`<div class=${cx('lia-code-block', this.cardClass)}>
        ${this.renderHeader(lines.length)}${body}
      </div>`;
    }

    return html`<div class=${cx('lia-code-block card', this.cardClass)}>
      ${this.renderHeader(lines.length)}${body}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-code-block': LiaCodeBlock;
  }
}
