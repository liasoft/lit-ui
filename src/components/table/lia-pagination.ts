import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, uid } from '../../core/utils.js';
import type { PaginationState, Size } from '../../core/types.js';
import { flag } from '../layout/flag.js';

/* ------------------------------------------------------------------ *
 * Page-number maths
 * ------------------------------------------------------------------ */

/** A gap in the numbered page list. */
export const ELLIPSIS = 'ellipsis';

/** One entry of the numbered page list: a page number or a gap marker. */
export type PageItem = number | typeof ELLIPSIS;

function range(from: number, to: number): number[] {
  const result: number[] = [];
  for (let page = from; page <= to; page += 1) result.push(page);
  return result;
}

/**
 * The numbered page links to show, with `'ellipsis'` where pages are skipped.
 *
 * The first and last page are always reachable, `siblings` pages sit on either
 * side of the current one, and the list has a stable length so the control
 * does not jump around as the user pages through.
 *
 * @example
 * ```ts
 * paginationRange(5, 10);  // [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 * paginationRange(1, 4);   // [1, 2, 3, 4]
 * ```
 */
export function paginationRange(current: number, last: number, siblings = 1): PageItem[] {
  const total = Math.max(0, Math.floor(last));
  if (total <= 0) return [];
  const page = Math.min(Math.max(1, Math.floor(current)), total);
  const side = Math.max(0, Math.floor(siblings));

  // first + last + current + siblings on both sides + both gap markers
  if (total <= side * 2 + 5) return range(1, total);

  const left = Math.max(page - side, 1);
  const right = Math.min(page + side, total);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;
  const edgeCount = side * 2 + 3;

  if (!showLeftGap && showRightGap) return [...range(1, edgeCount), ELLIPSIS, total];
  if (showLeftGap && !showRightGap) return [1, ELLIPSIS, ...range(total - edgeCount + 1, total)];
  return [1, ELLIPSIS, ...range(left, right), ELLIPSIS, total];
}

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

/** Every string `<lia-pagination>` can render. */
export interface PaginationLabels {
  /** Accessible name of the `<nav>`. */
  nav: string;
  first: string;
  previous: string;
  next: string;
  last: string;
  /** Accessible name of a numbered link; `{page}` is substituted. */
  page: string;
  /** Announced for the active page; `{page}` and `{total}` are substituted. */
  currentPage: string;
  /** Skipped-pages marker, announced to assistive technology. */
  ellipsis: string;
  /** Row summary; `{from}`, `{to}` and `{total}` are substituted. */
  summary: string;
  /** Page summary used when the total row count is unknown. */
  pageSummary: string;
  /** Label of the rows-per-page selector. */
  perPage: string;
}

/** The English defaults. Override individual entries via the `labels` property. */
export const DEFAULT_PAGINATION_LABELS: Readonly<PaginationLabels> = Object.freeze({
  nav: 'Pagination',
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
  page: 'Page {page}',
  currentPage: 'Page {page} of {total}',
  ellipsis: 'Skipped pages',
  summary: '{from}–{to} of {total}',
  pageSummary: 'Page {page} of {total}',
  perPage: 'Per page',
});

/** Substitute `{token}` placeholders in a label. */
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/** Detail of the `lia-per-page-change` event. */
export interface PerPageChangeDetail {
  perPage: number;
}

/* ------------------------------------------------------------------ *
 * Element
 * ------------------------------------------------------------------ */

/**
 * Pager for a listing: first / previous / numbered links / next / last, plus an
 * optional row summary and rows-per-page selector.
 *
 * The reference panel only offered four arrows; this adds the numbered links
 * with ellipsis truncation, real `<button>`s (so the control is keyboard
 * operable and disabled states are honoured), `aria-current="page"` on the
 * active entry and a live summary of the visible range.
 *
 * Activating a page emits `lia-page-change`. Set `.pageHref` to render real
 * anchors as well — useful for server-rendered listings that must keep working
 * without JavaScript; the event still fires so a router can intercept it.
 *
 * @example
 * ```html
 * <lia-pagination page="3" last-page="12"></lia-pagination>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-pagination
 *   .state=${listing.pagination}
 *   show-summary
 *   show-per-page
 *   .perPageOptions=${[10, 20, 50, 100]}
 *   @lia-page-change=${(e: CustomEvent) => load({ page: e.detail.page })}
 *   @lia-per-page-change=${(e: CustomEvent) => load({ perPage: e.detail.perPage })}
 * ></lia-pagination>`;
 * ```
 */
@customElement('lia-pagination')
export class LiaPagination extends LiaElement {
  /** A whole {@link PaginationState}; the individual properties still win. */
  @property({ attribute: false }) state?: PaginationState;

  /** Current page, 1-based. */
  @property({ type: Number }) page?: number;

  /** Number of the last page. `-1` (or `0`) means "unknown / unpaged". */
  @property({ type: Number, attribute: 'last-page' }) lastPage?: number;

  /** Total number of rows across all pages, for the summary. */
  @property({ type: Number }) total?: number;

  /** Rows per page, for the summary and the selector. */
  @property({ type: Number, attribute: 'per-page' }) perPage?: number;

  /** Choices offered by the rows-per-page selector. */
  @property({ attribute: false }) perPageOptions: number[] = [10, 25, 50, 100];

  /** Show the rows-per-page selector. */
  @property({ type: Boolean, attribute: 'show-per-page' }) showPerPage = false;

  /** Show the "1–20 of 137" summary. */
  @property({ type: Boolean, attribute: 'show-summary' }) showSummary = false;

  /** Show the numbered page links. Set `numbered="false"` for arrows only. */
  @property({ converter: flag, attribute: 'numbered' }) numbered = true;

  /** Show the first/last jump buttons. */
  @property({ converter: flag, attribute: 'show-edges' }) showEdges = true;

  /** Pages shown on either side of the current one. */
  @property({ type: Number }) siblings = 1;

  /** Control size; `md` renders no size class. */
  @property({ type: String }) size: Size = 'md';

  /** Render the pager even when there is only one page. */
  @property({ type: Boolean, attribute: 'always-visible' }) alwaysVisible = false;

  /** Every string the control renders. Merged over {@link DEFAULT_PAGINATION_LABELS}. */
  @property({ attribute: false }) labels: Partial<PaginationLabels> = {};

  /**
   * Turns the page controls into real links. Receives the target page and
   * returns its URL; the `lia-page-change` event is emitted as well.
   */
  @property({ attribute: false }) pageHref?: (page: number) => string;

  private readonly perPageId = uid('lia-per-page');

  /** The resolved current page, clamped into range. */
  get currentPage(): number {
    const value = this.page ?? this.state?.currentPage ?? 1;
    const last = this.pageCount;
    if (last <= 0) return Math.max(1, Math.floor(value));
    return Math.min(Math.max(1, Math.floor(value)), last);
  }

  /** The resolved number of pages; `0` when unknown. */
  get pageCount(): number {
    const value = this.lastPage ?? this.state?.lastPage ?? 0;
    return value > 0 ? Math.floor(value) : 0;
  }

  private get text(): PaginationLabels {
    return { ...DEFAULT_PAGINATION_LABELS, ...this.labels };
  }

  private get resolvedTotal(): number | undefined {
    return this.total ?? this.state?.total;
  }

  private get resolvedPerPage(): number | undefined {
    return this.perPage ?? this.state?.perPage;
  }

  /** Move to `page`, clamped into range. Emits `lia-page-change`. */
  goTo(page: number): void {
    const last = this.pageCount;
    const wanted = Math.max(1, Math.floor(page));
    const target = last > 0 ? Math.min(wanted, last) : wanted;
    if (target === this.currentPage) return;
    this.emit<{ page: number }>('lia-page-change', { page: target });
  }

  private handleActivate(page: number, event: Event): void {
    // With `pageHref` the anchor navigates on its own; without it we must not
    // let the placeholder href scroll the page to the top.
    if (!this.pageHref) event.preventDefault();
    this.goTo(page);
  }

  private handlePerPage(event: Event): void {
    const select = event.currentTarget as HTMLSelectElement;
    const value = Number(select.value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.emit<PerPageChangeDetail>('lia-per-page-change', { perPage: value });
  }

  private renderControl(options: {
    page: number;
    label: string;
    icon?: string;
    content?: unknown;
    disabled: boolean;
    active?: boolean;
  }): TemplateResult {
    const { page, label, icon, disabled, active } = options;
    const content = options.content ?? html`<i class=${icon ?? ''} aria-hidden="true"></i>`;

    if (disabled) {
      return html`<li class="page-item disabled">
        <span class="page-link" aria-disabled="true" aria-label=${label}>${content}</span>
      </li>`;
    }
    if (active) {
      return html`<li class="page-item active" aria-current="page">
        <span class="page-link" aria-label=${label}>${content}</span>
      </li>`;
    }

    const href = this.pageHref?.(page);
    const onClick = (event: Event): void => this.handleActivate(page, event);

    return html`<li class="page-item">
      ${href === undefined
        ? html`<button type="button" class="page-link" aria-label=${label} @click=${onClick}>
            ${content}
          </button>`
        : html`<a class="page-link" href=${href} aria-label=${label} @click=${onClick}
            >${content}</a
          >`}
    </li>`;
  }

  private renderNumbers(): unknown {
    if (!this.numbered) return nothing;
    const last = this.pageCount;
    if (last <= 0) return nothing;
    const current = this.currentPage;
    const text = this.text;

    return paginationRange(current, last, this.siblings).map((item) => {
      if (item === ELLIPSIS) {
        return html`<li class="page-item disabled">
          <span class="page-link" aria-hidden="true">…</span>
          <span class="visually-hidden">${text.ellipsis}</span>
        </li>`;
      }
      const active = item === current;
      return this.renderControl({
        page: item,
        label: active
          ? formatLabel(text.currentPage, { page: item, total: last })
          : formatLabel(text.page, { page: item, total: last }),
        content: String(item),
        disabled: false,
        active,
      });
    });
  }

  private renderSummary(): unknown {
    if (!this.showSummary) return nothing;
    const text = this.text;
    const total = this.resolvedTotal;
    const perPage = this.resolvedPerPage;
    const current = this.currentPage;

    if (total !== undefined && perPage !== undefined && perPage > 0) {
      const from = total === 0 ? 0 : (current - 1) * perPage + 1;
      const to = Math.min(current * perPage, total);
      return html`<div class="small text-body-secondary" aria-live="polite">
        ${formatLabel(text.summary, { from, to, total })}
      </div>`;
    }
    return html`<div class="small text-body-secondary" aria-live="polite">
      ${formatLabel(text.pageSummary, { page: current, total: this.pageCount })}
    </div>`;
  }

  private renderPerPage(): unknown {
    if (!this.showPerPage) return nothing;
    const text = this.text;
    const value = this.resolvedPerPage;
    const options = this.perPageOptions.includes(value ?? 0)
      ? this.perPageOptions
      : value === undefined
        ? this.perPageOptions
        : [...this.perPageOptions, value].sort((a, b) => a - b);

    return html`<div class="d-flex align-items-center gap-2">
      <label class="form-label small text-body-secondary mb-0" for=${this.perPageId}
        >${text.perPage}</label
      >
      <select
        id=${this.perPageId}
        class="form-select form-select-sm w-auto"
        .value=${String(value ?? '')}
        @change=${(event: Event) => this.handlePerPage(event)}
      >
        ${options.map(
          (option) =>
            html`<option value=${option} ?selected=${option === value}>${option}</option>`
        )}
      </select>
    </div>`;
  }

  override render(): unknown {
    const last = this.pageCount;
    const current = this.currentPage;
    if (last <= 1 && !this.alwaysVisible && !this.showPerPage) return nothing;

    const text = this.text;
    const atStart = current <= 1;
    const atEnd = last > 0 ? current >= last : false;
    const sideContent = this.showSummary || this.showPerPage;

    const list = html`<ul
      class=${cx(
        'pagination',
        'mb-0',
        this.size !== 'md' && `pagination-${this.size}`,
        !sideContent && 'justify-content-center'
      )}
    >
      ${this.showEdges
        ? this.renderControl({
            page: 1,
            label: text.first,
            icon: 'fa-solid fa-angles-left',
            disabled: atStart,
          })
        : nothing}
      ${this.renderControl({
        page: current - 1,
        label: text.previous,
        icon: 'fa-solid fa-chevron-left',
        disabled: atStart,
      })}
      ${this.renderNumbers()}
      ${this.renderControl({
        page: current + 1,
        label: text.next,
        icon: 'fa-solid fa-chevron-right',
        disabled: atEnd,
      })}
      ${this.showEdges
        ? this.renderControl({
            page: last,
            label: text.last,
            icon: 'fa-solid fa-angles-right',
            disabled: atEnd || last <= 0,
          })
        : nothing}
    </ul>`;

    if (!sideContent) return html`<nav aria-label=${text.nav}>${list}</nav>`;

    return html`<nav aria-label=${text.nav}>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
        ${this.renderSummary()}
        <div class="d-flex flex-wrap align-items-center gap-3 ms-auto">
          ${last > 1 || this.alwaysVisible ? list : nothing}${this.renderPerPage()}
        </div>
      </div>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-pagination': LiaPagination;
  }
  interface HTMLElementEventMap {
    'lia-per-page-change': CustomEvent<PerPageChangeDetail>;
  }
}
