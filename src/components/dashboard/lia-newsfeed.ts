import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, renderRich } from '../../core/utils.js';
import type { IconName, NewsfeedItem } from '../../core/types.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { renderSpinner } from '../primitives/lia-spinner.js';

/** Detail of the `lia-newsfeed-load` event. */
export interface NewsfeedLoadDetail {
  /** The parsed items; empty when the request failed. */
  items: NewsfeedItem[];
  /** Present when the request or the parsing failed. */
  error?: string;
}

declare global {
  interface HTMLElementEventMap {
    'lia-newsfeed-load': CustomEvent<NewsfeedLoadDetail>;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Coerce a fetched payload into {@link NewsfeedItem}s.
 *
 * Accepts a bare array, `{ items: [...] }` or `{ entries: [...] }`, and the
 * usual field aliases (`url`/`link`, `pubDate`/`published`/`date`,
 * `content`/`summary`/`description`) so most feed-to-JSON bridges just work.
 */
export function parseNewsfeed(payload: unknown): NewsfeedItem[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : isRecord(payload) && Array.isArray(payload.entries)
        ? payload.entries
        : [];

  return list
    .filter(isRecord)
    .map((raw) => ({
      title: asText(raw.title),
      link: asText(raw.link ?? raw.url) || undefined,
      date: asText(raw.date ?? raw.pubDate ?? raw.published) || undefined,
      description: asText(raw.description ?? raw.content ?? raw.summary) || undefined,
    }))
    .filter((item) => item.title !== '');
}

/**
 * A news / changelog panel: a card whose flush list group shows a headline, a
 * date and a teaser per entry.
 *
 * Items can be handed in directly, or fetched from `src` — the JSON endpoint
 * replaces the jQuery request the original panel made, with an `AbortController`
 * so a re-target or an unmount cancels the flight. Loading, error and empty
 * states are all rendered in place, and every message is a property.
 *
 * Item descriptions are rendered as trusted HTML: only point `src` at an
 * endpoint you control.
 *
 * @example
 * ```html
 * <lia-newsfeed title="Release notes" src="/api/news.json" max-items="5"></lia-newsfeed>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-newsfeed
 *   .items=${[{ title: 'Version 2.4', date: '2025-04-01', description: 'Faster backups.' }]}
 *   ?loading=${pending}
 *   error=${failure}
 * ></lia-newsfeed>`;
 * ```
 */
@customElement('lia-newsfeed')
export class LiaNewsfeed extends LiaElement {
  /**
   * Panel heading. Prefer the property binding — a static `title="…"`
   * attribute also gives the host a native browser tooltip.
   */
  @property({ type: String }) override title = 'Newsfeed';

  /** Icon-font class string rendered before the title. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-circle-info';

  /** The entries to show. Ignored while {@link src} is set. */
  @property({ attribute: false }) items: NewsfeedItem[] = [];

  /** JSON endpoint to load the entries from. */
  @property({ type: String }) src = '';

  /** Force the loading state (when the host does the fetching). */
  @property({ type: Boolean }) loading = false;

  /** Force the error state with this message. */
  @property({ type: String }) error = '';

  /** Show at most this many entries. `0` means all of them. */
  @property({ type: Number, attribute: 'max-items' }) maxItems = 0;

  /** Text of the loading row. */
  @property({ type: String, attribute: 'loading-label' }) loadingLabel = 'Loading news…';

  /** Text of the error row; the reported reason is appended as a tooltip. */
  @property({ type: String, attribute: 'error-label' }) errorLabel = 'Could not load the news.';

  /** Text of the empty row. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No news right now.';

  /** Open entry links in a new tab. */
  @property({ type: Boolean, attribute: 'new-tab' }) newTab = true;

  /** Drop the card's bottom margin and stretch it — for use inside a grid cell. */
  @property({ type: Boolean }) flush = false;

  @state() private fetched: NewsfeedItem[] = [];
  @state() private fetching = false;
  @state() private fetchError = '';

  private controller?: AbortController;

  override updated(changed: PropertyValues<this>): void {
    if (changed.has('src')) void this.reload();
  }

  override disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = undefined;
    super.disconnectedCallback();
  }

  /** Re-request {@link src}. Resolves once the panel has settled. */
  async reload(): Promise<void> {
    this.controller?.abort();
    this.controller = undefined;

    if (!this.src) {
      this.fetched = [];
      this.fetching = false;
      this.fetchError = '';
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.fetching = true;
    this.fetchError = '';

    try {
      const response = await fetch(this.src, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = parseNewsfeed((await response.json()) as unknown);
      if (controller.signal.aborted) return;
      this.fetched = items;
      this.fetching = false;
      this.emit<NewsfeedLoadDetail>('lia-newsfeed-load', { items });
    } catch (error) {
      if (controller.signal.aborted) return;
      const reason = error instanceof Error ? error.message : String(error);
      this.fetched = [];
      this.fetching = false;
      this.fetchError = reason;
      this.emit<NewsfeedLoadDetail>('lia-newsfeed-load', { items: [], error: reason });
    }
  }

  private get visibleItems(): NewsfeedItem[] {
    const list = this.src ? this.fetched : this.items;
    return this.maxItems > 0 ? list.slice(0, this.maxItems) : list;
  }

  private renderItem(item: NewsfeedItem): TemplateResult {
    const body = html`<div class="d-flex w-100 justify-content-between gap-2">
        <b class="mb-1">${item.title}</b>
        ${item.date ? html`<small class="text-body-secondary text-nowrap">${item.date}</small>` : nothing}
      </div>
      ${item.description
        ? html`<div class="small mb-0 text-body-secondary">${renderRich(item.description)}</div>`
        : nothing}`;

    if (!item.link) {
      return html`<div class="list-group-item lia-newsfeed-item">${body}</div>`;
    }
    return html`<a
      class="list-group-item list-group-item-action lia-newsfeed-item"
      href=${item.link}
      target=${this.newTab ? '_blank' : nothing}
      rel=${this.newTab ? 'noopener noreferrer' : nothing}
      >${body}</a
    >`;
  }

  private renderBody(): TemplateResult | TemplateResult[] {
    if (this.loading || this.fetching) {
      return html`<div
        class="list-group-item d-flex justify-content-between align-items-center gap-2"
        aria-busy="true"
      >
        <span>${this.loadingLabel}</span>${renderSpinner(this.loadingLabel, { size: 'sm' })}
      </div>`;
    }

    const failure = this.error || this.fetchError;
    if (failure) {
      return html`<div class="list-group-item text-center">
        <span class="badge text-bg-warning" role="alert" title=${failure}>
          ${renderIcon('fa-solid fa-triangle-exclamation', { class: 'me-1' })}${this.errorLabel}
        </span>
      </div>`;
    }

    const items = this.visibleItems;
    if (items.length === 0) {
      return html`<div class="list-group-item text-body-secondary">${this.emptyMessage}</div>`;
    }
    return items.map((item) => this.renderItem(item));
  }

  override render(): TemplateResult {
    return html`<div class=${cx('card', this.flush && 'h-100 mb-0')}>
      ${this.title || this.icon
        ? html`<div class="card-header d-flex align-items-center gap-1">
            ${renderIcon(this.icon)}${this.title}
          </div>`
        : nothing}
      <div class="list-group list-group-flush" aria-live="polite">${this.renderBody()}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-newsfeed': LiaNewsfeed;
  }
}
