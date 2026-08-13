import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LiaElement } from '../../core/base-element.js';
import { cx } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { splitLines } from './lia-code-block.js';
import '../primitives/lia-copy-button.js';

/* ------------------------------------------------------------------ *
 * Diffing
 * ------------------------------------------------------------------ */

/** What happened to a line. */
export type DiffLineType = 'equal' | 'add' | 'remove';

/** One line of the comparison. */
export interface DiffLine {
  type: DiffLineType;
  text: string;
  /** 1-based line number on the left, absent for added lines. */
  left?: number;
  /** 1-based line number on the right, absent for removed lines. */
  right?: number;
}

/** A run of unchanged lines that was folded away. */
export interface DiffGap {
  type: 'gap';
  /** How many lines are hidden. */
  count: number;
}

/** A row of the rendered diff: a real line, or a fold marker. */
export type DiffRow = DiffLine | DiffGap;

/** One row of the side-by-side view. Either side may be empty. */
export interface DiffSplitRow {
  left?: DiffLine;
  right?: DiffLine;
  /** Set on a fold marker row; `left` and `right` are then absent. */
  gap?: number;
}

/** How many lines changed. */
export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

/**
 * Above this many DP cells the exact algorithm is skipped and the differing
 * middle is reported as one wholesale replacement. 2 M cells is ~8 MB of
 * `Uint32Array`, which is the most a UI component has any business allocating.
 */
const MAX_DIFF_CELLS = 2_000_000;

/**
 * Line-based diff of two texts — a plain longest-common-subsequence walk, with
 * no dependencies.
 *
 * Common leading and trailing lines are trimmed first, which is what makes the
 * quadratic core affordable for the usual case of a small edit inside a large
 * file. If the remaining middle is still too large the function degrades
 * gracefully: it reports the middle as a removal followed by an addition
 * rather than allocating an enormous table.
 *
 * @example
 * ```ts
 * const rows = diffLines(splitLines(before), splitLines(after));
 * const added = rows.filter((row) => row.type === 'add').length;
 * ```
 */
export function diffLines(
  original: readonly string[],
  modified: readonly string[],
  maxCells = MAX_DIFF_CELLS,
): DiffLine[] {
  const out: DiffLine[] = [];

  // 1. Common prefix.
  let start = 0;
  const shortest = Math.min(original.length, modified.length);
  while (start < shortest && original[start] === modified[start]) {
    out.push({
      type: 'equal',
      text: original[start],
      left: start + 1,
      right: start + 1,
    });
    start += 1;
  }

  // 2. Common suffix.
  let endA = original.length;
  let endB = modified.length;
  while (endA > start && endB > start && original[endA - 1] === modified[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const a = original.slice(start, endA);
  const b = modified.slice(start, endB);
  const m = a.length;
  const n = b.length;

  const emitRemove = (index: number): void => {
    out.push({ type: 'remove', text: a[index], left: start + index + 1 });
  };
  const emitAdd = (index: number): void => {
    out.push({ type: 'add', text: b[index], right: start + index + 1 });
  };

  if (m === 0 || n === 0 || m * n > maxCells) {
    for (let i = 0; i < m; i += 1) emitRemove(i);
    for (let j = 0; j < n; j += 1) emitAdd(j);
  } else {
    const width = n + 1;
    const lcs = new Uint32Array((m + 1) * width);
    for (let i = m - 1; i >= 0; i -= 1) {
      for (let j = n - 1; j >= 0; j -= 1) {
        lcs[i * width + j] =
          a[i] === b[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) {
        out.push({
          type: 'equal',
          text: a[i],
          left: start + i + 1,
          right: start + j + 1,
        });
        i += 1;
        j += 1;
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        emitRemove(i);
        i += 1;
      } else {
        emitAdd(j);
        j += 1;
      }
    }
    while (i < m) {
      emitRemove(i);
      i += 1;
    }
    while (j < n) {
      emitAdd(j);
      j += 1;
    }
  }

  // 3. The suffix that was trimmed in step 2.
  for (let k = 0; k < original.length - endA; k += 1) {
    out.push({
      type: 'equal',
      text: original[endA + k],
      left: endA + k + 1,
      right: endB + k + 1,
    });
  }

  return out;
}

/** Count the lines by kind. */
export function diffStats(lines: readonly DiffLine[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.type === 'add') stats.added += 1;
    else if (line.type === 'remove') stats.removed += 1;
    else stats.unchanged += 1;
  }
  return stats;
}

/**
 * Fold runs of unchanged lines longer than `2 * context + 1` into a
 * {@link DiffGap}. `context < 0` keeps everything.
 */
export function collapseDiff(lines: readonly DiffLine[], context: number): DiffRow[] {
  if (context < 0) return [...lines];
  const rows: DiffRow[] = [];
  let run: DiffLine[] = [];

  const flush = (atEnd: boolean): void => {
    if (run.length === 0) return;
    const head = rows.length === 0 ? 0 : context;
    const tail = atEnd ? 0 : context;
    if (run.length <= head + tail + 1) {
      rows.push(...run);
    } else {
      rows.push(...run.slice(0, head));
      rows.push({ type: 'gap', count: run.length - head - tail });
      if (tail > 0) rows.push(...run.slice(run.length - tail));
    }
    run = [];
  };

  for (const line of lines) {
    if (line.type === 'equal') {
      run.push(line);
      continue;
    }
    flush(false);
    rows.push(line);
  }
  flush(true);
  return rows;
}

/** Pair removals with additions so the two columns of a split view line up. */
export function pairDiff(rows: readonly DiffRow[]): DiffSplitRow[] {
  const out: DiffSplitRow[] = [];
  let removals: DiffLine[] = [];
  let additions: DiffLine[] = [];

  const flush = (): void => {
    const height = Math.max(removals.length, additions.length);
    for (let index = 0; index < height; index += 1) {
      out.push({ left: removals[index], right: additions[index] });
    }
    removals = [];
    additions = [];
  };

  for (const row of rows) {
    if (row.type === 'gap') {
      flush();
      out.push({ gap: row.count });
    } else if (row.type === 'remove') {
      removals.push(row);
    } else if (row.type === 'add') {
      additions.push(row);
    } else {
      flush();
      out.push({ left: row, right: row });
    }
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/** Every string `<lia-diff-view>` renders on its own behalf. */
export interface DiffViewLabels {
  /** Accessible caption of the diff table. */
  caption: string;
  added: string;
  removed: string;
  unchanged: string;
  /** `{count}` is replaced. */
  gap: string;
  /** `{count}` is replaced. */
  addedCount: string;
  /** `{count}` is replaced. */
  removedCount: string;
  identical: string;
  unified: string;
  split: string;
  view: string;
  wrapOn: string;
  wrapOff: string;
  copy: string;
  copied: string;
}

/** The defaults behind {@link LiaDiffView.labels}. */
export const DEFAULT_DIFF_VIEW_LABELS: Readonly<DiffViewLabels> = Object.freeze({
  caption: 'Line-by-line comparison',
  added: 'Added',
  removed: 'Removed',
  unchanged: 'Unchanged',
  gap: '{count} unchanged lines hidden',
  addedCount: '{count} added',
  removedCount: '{count} removed',
  identical: 'The two versions are identical.',
  unified: 'Unified',
  split: 'Side by side',
  view: 'Comparison layout',
  wrapOn: 'Wrap long lines',
  wrapOff: 'Stop wrapping long lines',
  copy: 'Copy the comparison',
  copied: 'Copied',
});

/** Detail of `lia-diff-mode-change`. */
export interface DiffModeDetail {
  mode: 'unified' | 'split';
}

declare global {
  interface HTMLElementEventMap {
    'lia-diff-mode-change': CustomEvent<DiffModeDetail>;
  }
}

/**
 * A dependency-free, line-based comparison of two texts — the "what would
 * change?" view for configuration files, templates and generated output.
 *
 * Two layouts: **unified**, one column with `+`/`-` markers, and **split**,
 * the two versions side by side with fillers keeping the rows aligned. Long
 * runs of unchanged lines fold away behind a marker so the changes are not
 * buried; `context` decides how much surrounding text survives the fold, and
 * `collapse="false"` keeps the whole file.
 *
 * Colour is never the only signal: every changed line also carries a marker
 * and a visually-hidden "Added"/"Removed" prefix.
 *
 * @example
 * ```ts
 * html`<lia-diff-view
 *   .original=${current}
 *   .modified=${proposed}
 *   original-label="Running config"
 *   modified-label="Generated config"
 *   mode="split"
 *   mode-toggle
 * ></lia-diff-view>`;
 * ```
 *
 * @example
 * ```html
 * <lia-diff-view context="1" max-height="20rem" wrap-toggle></lia-diff-view>
 * ```
 */
@customElement('lia-diff-view')
export class LiaDiffView extends LiaElement {
  /** The left-hand / "before" text. */
  @property({ type: String }) original = '';

  /** The right-hand / "after" text. */
  @property({ type: String }) modified = '';

  /** Column heading for the original. */
  @property({ type: String, attribute: 'original-label' }) originalLabel = 'Original';

  /** Column heading for the modification. */
  @property({ type: String, attribute: 'modified-label' }) modifiedLabel = 'Modified';

  /** Layout. `split` needs roughly twice the width. */
  @property({ type: String }) mode: 'unified' | 'split' = 'unified';

  /** Offer a layout switch in the header. */
  @property({ type: Boolean, attribute: 'mode-toggle' }) modeToggle = false;

  /** Unchanged lines kept around each change. */
  @property({ type: Number }) context = 3;

  /** Fold long runs of unchanged lines. */
  @property({ converter: flag }) collapse = true;

  /** Show the line-number gutters. */
  @property({ converter: flag, attribute: 'line-numbers' }) lineNumbers = true;

  /** Wrap long lines instead of scrolling horizontally. */
  @property({ type: Boolean }) wrap = false;

  /** Offer a wrap toggle in the header. */
  @property({ type: Boolean, attribute: 'wrap-toggle' }) wrapToggle = false;

  /** Maximum height of the scroll area. Empty means unbounded. */
  @property({ type: String, attribute: 'max-height' }) maxHeight = '28rem';

  /** Show the added/removed counters in the header. */
  @property({ converter: flag, attribute: 'show-stats' }) showStats = true;

  /** Show a button that copies the comparison as a unified patch body. */
  @property({ converter: flag }) copyable = true;

  /** Drop the header. */
  @property({ type: Boolean, attribute: 'no-header' }) noHeader = false;

  /** Overrides for the strings this element renders. */
  @property({ attribute: false }) labels: Partial<DiffViewLabels> = {};

  @state() private view: 'unified' | 'split' = 'unified';
  @state() private wrapping = false;

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('mode')) this.view = this.mode;
    if (changed.has('wrap')) this.wrapping = this.wrap;
  }

  /** The raw comparison, before folding. */
  get lines(): DiffLine[] {
    return diffLines(splitLines(this.original), splitLines(this.modified));
  }

  /** How many lines were added, removed and left alone. */
  get stats(): DiffStats {
    return diffStats(this.lines);
  }

  /** The comparison as the body of a unified patch — what the copy button copies. */
  get patchText(): string {
    return this.lines
      .map(
        (line) => `${line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}${line.text}`,
      )
      .join('\n');
  }

  /** Switch between the unified and side-by-side layouts. */
  setMode(next: 'unified' | 'split'): void {
    if (this.view === next) return;
    this.view = next;
    this.emit<DiffModeDetail>('lia-diff-mode-change', { mode: next });
  }

  private get strings(): DiffViewLabels {
    return { ...DEFAULT_DIFF_VIEW_LABELS, ...this.labels };
  }

  private rowClass(type: DiffLineType): string {
    if (type === 'add') return 'bg-success-subtle text-success-emphasis';
    if (type === 'remove') return 'bg-danger-subtle text-danger-emphasis';
    return '';
  }

  private marker(type: DiffLineType): string {
    if (type === 'add') return '+';
    if (type === 'remove') return '−';
    return ' ';
  }

  private srLabel(type: DiffLineType): string {
    const strings = this.strings;
    if (type === 'add') return strings.added;
    if (type === 'remove') return strings.removed;
    return '';
  }

  private renderHeader(stats: DiffStats): TemplateResult | typeof nothing {
    if (this.noHeader) return nothing;
    const strings = this.strings;
    return html`<div
      class="card-header d-flex flex-wrap align-items-center justify-content-between gap-2 py-2"
    >
      <div class="d-flex flex-wrap align-items-center gap-2 small">
        <span class="fw-semibold">${this.originalLabel}</span>
        ${renderIcon('fa-solid fa-arrow-right', { class: 'text-body-secondary' })}
        <span class="fw-semibold">${this.modifiedLabel}</span>
        ${
          this.showStats
            ? html`<span class="badge text-bg-success"
                  >${strings.addedCount.replace('{count}', String(stats.added))}</span
                ><span class="badge text-bg-danger"
                  >${strings.removedCount.replace('{count}', String(stats.removed))}</span
                >`
            : nothing
        }
      </div>
      <div class="d-flex flex-wrap align-items-center gap-1">
        ${
          this.modeToggle
            ? html`<div class="btn-group btn-group-sm" role="group" aria-label=${strings.view}>
                <button
                  type="button"
                  class=${cx(
                    'btn',
                    this.view === 'unified' ? 'btn-secondary' : 'btn-outline-secondary',
                  )}
                  aria-pressed=${this.view === 'unified' ? 'true' : 'false'}
                  @click=${() => this.setMode('unified')}
                >
                  ${strings.unified}
                </button>
                <button
                  type="button"
                  class=${cx('btn', this.view === 'split' ? 'btn-secondary' : 'btn-outline-secondary')}
                  aria-pressed=${this.view === 'split' ? 'true' : 'false'}
                  @click=${() => this.setMode('split')}
                >
                  ${strings.split}
                </button>
              </div>`
            : nothing
        }
        ${
          this.wrapToggle
            ? html`<button
                type="button"
                class=${cx('btn btn-sm', this.wrapping ? 'btn-secondary' : 'btn-outline-secondary')}
                aria-pressed=${this.wrapping ? 'true' : 'false'}
                title=${this.wrapping ? strings.wrapOff : strings.wrapOn}
                @click=${() => {
                  this.wrapping = !this.wrapping;
                }}
              >
                ${renderIcon('fa-solid fa-text-width', { label: strings.wrapOn })}
              </button>`
            : nothing
        }
        ${
          this.copyable
            ? html`<lia-copy-button
                .text=${this.patchText}
                title=${strings.copy}
                copied-title=${strings.copied}
              ></lia-copy-button>`
            : nothing
        }
      </div>
    </div>`;
  }

  private renderGap(count: number, columns: number): TemplateResult {
    return html`<tr class="lia-diff-gap">
      <td colspan=${columns} class="text-center small py-1">
        ${renderIcon('fa-solid fa-ellipsis', { class: 'me-1' })}${this.strings.gap.replace(
          '{count}',
          String(count),
        )}
      </td>
    </tr>`;
  }

  private renderUnified(rows: DiffRow[]): TemplateResult {
    const columns = this.lineNumbers ? 4 : 2;
    return html`<table class="table lia-diff-table">
      <caption class="visually-hidden">
        ${this.strings.caption}
      </caption>
      <tbody>
        ${rows.map((row) => {
          if (row.type === 'gap') return this.renderGap(row.count, columns);
          return html`<tr class=${this.rowClass(row.type)}>
            ${
              this.lineNumbers
                ? html`<td class="lia-diff-num">${row.left ?? ''}</td>
                    <td class="lia-diff-num">${row.right ?? ''}</td>`
                : nothing
            }
            <td class="lia-diff-marker" aria-hidden="true">${this.marker(row.type)}</td>
            <td class="lia-diff-text">
              ${
                row.type === 'equal'
                  ? nothing
                  : html`<span class="visually-hidden">${this.srLabel(row.type)}: </span>`
              }${row.text}
            </td>
          </tr>`;
        })}
      </tbody>
    </table>`;
  }

  private renderSide(line: DiffLine | undefined, side: 'left' | 'right'): TemplateResult {
    if (!line) {
      return html`${this.lineNumbers ? html`<td class="lia-diff-num lia-diff-gap"></td>` : nothing}
        <td class="lia-diff-text lia-diff-gap"></td>`;
    }
    return html`${
        this.lineNumbers
          ? html`<td class=${cx('lia-diff-num', this.rowClass(line.type))}>
              ${(side === 'left' ? line.left : line.right) ?? ''}
            </td>`
          : nothing
      }
      <td class=${cx('lia-diff-text', this.rowClass(line.type))}>
        ${
          line.type === 'equal'
            ? nothing
            : html`<span class="visually-hidden">${this.srLabel(line.type)}: </span>`
        }${line.text}
      </td>`;
  }

  private renderSplit(rows: DiffRow[]): TemplateResult {
    const columns = this.lineNumbers ? 4 : 2;
    const pairs = pairDiff(rows);
    return html`<table class="table lia-diff-table">
      <caption class="visually-hidden">
        ${this.strings.caption}
      </caption>
      <thead>
        <tr>
          ${this.lineNumbers ? html`<th scope="col" class="lia-diff-num"></th>` : nothing}
          <th scope="col" class="small fw-semibold">${this.originalLabel}</th>
          ${this.lineNumbers ? html`<th scope="col" class="lia-diff-num"></th>` : nothing}
          <th scope="col" class="small fw-semibold">${this.modifiedLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${pairs.map((pair) => {
          if (pair.gap !== undefined) return this.renderGap(pair.gap, columns);
          return html`<tr>
            ${this.renderSide(pair.left, 'left')}${this.renderSide(pair.right, 'right')}
          </tr>`;
        })}
      </tbody>
    </table>`;
  }

  override render(): TemplateResult {
    const lines = this.lines;
    const stats = diffStats(lines);
    const identical = stats.added === 0 && stats.removed === 0;
    const rows = collapseDiff(lines, this.collapse ? Math.max(0, this.context) : -1);

    return html`<div class=${cx('lia-diff-view card', this.wrapping && 'lia-diff-wrap')}>
      ${this.renderHeader(stats)}
      ${
        identical
          ? html`<div class="card-body py-2 small text-body-secondary" role="status">
              ${this.strings.identical}
            </div>`
          : html`<div
              class="lia-code-scroll"
              style=${styleMap(this.maxHeight ? { maxHeight: this.maxHeight } : {})}
              tabindex="0"
              role="region"
              aria-label=${this.strings.caption}
            >
              ${this.view === 'split' ? this.renderSplit(rows) : this.renderUnified(rows)}
            </div>`
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-diff-view': LiaDiffView;
  }
}
