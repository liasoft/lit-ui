import { html, nothing, render, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Popover } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import { LightContent } from '../layout/light-content.js';
import type { InfoEntry } from '../../core/types.js';
import type { OverlayPlacement } from './overlay-base.js';
import { renderSpinner } from './lia-spinner.js';
import './lia-key-value.js';

/**
 * A picture in a lookup's detail, described rather than marked up.
 *
 * Everything here is a *value* the element interpolates itself - there is no slot for a caller's
 * markup, for the same reason {@link LookupDetail} has none. `src` is bound to an attribute, so a
 * `javascript:` URL is inert in an `img` and a caller-supplied path cannot become a tag.
 */
export interface LookupImage {
  src: string;
  /** Required, not optional: a thumbnail with no accessible name is a decoration pretending to be data. */
  alt: string;
  /** A word or two under the image - what this one *is*, when there are several. */
  caption?: string;
  /** Where this particular image leads, when the rows' own `href` is about something else. */
  href?: string;
}

/**
 * What {@link LiaLookup.load} resolves to.
 *
 * An array is the rows, which is what every caller wrote before pictures existed and still works. The
 * object form adds {@link LookupImage} thumbnails above them, for the lookups where the answer is
 * partly *visual* - a card's artwork, a product shot, an avatar - and where a list of key/value rows
 * describes something the reader would recognise instantly if only they could see it.
 */
export type LookupDetail = InfoEntry[] | { rows: InfoEntry[]; images?: LookupImage[] };

/** Loads the detail for one value. Called at most once per element. */
export type LookupLoader = () => Promise<LookupDetail>;

/**
 * An identifier that can say what it is.
 *
 * A listing is full of values that identify something without describing it — an opaque id, a host
 * name, a user name. The name is usually all there is room for, and going and looking the thing up is
 * a page away. This marks such a value with a dotted underline and, the first time somebody hovers or
 * focuses it, loads its detail and shows it in a popover.
 *
 * `load` is called **at most once per element** and only on demand, so a table of five hundred rows
 * costs nothing until somebody asks a question about one of them. Sharing a cache between elements —
 * the same id appears on many rows — is the consumer's business, not this element's: it holds one
 * value's answer, not a store.
 *
 * ### Why the detail is data rather than markup
 *
 * `load` resolves to {@link InfoEntry} rows, and the element renders them itself. It deliberately
 * does **not** take an HTML string the way `<lia-popover content html>` does, because the values worth
 * looking up are exactly the ones that came from somewhere else — a directory, an agent, a log — and
 * a popover built by string concatenation is an injection waiting for the right process name. Every
 * row here goes through Lit interpolation, and the rendered container is handed to Bootstrap as an
 * `Element`, so the plugin never sees markup to parse.
 *
 * ### The same identifier, as a way in
 *
 * Set {@link href} and the trigger is rendered as an anchor rather than as a button: the summary on
 * hover, the page on click. That is one element rather than a link sitting next to an explainer,
 * which is what the alternative would be — a popover is not somewhere a reader can click, since it
 * disappears when the pointer leaves the thing that opened it, so a link *inside* the detail cannot
 * be reached. It is also the reason this is a property here and not an anchor wrapped around the
 * element by the caller: an interactive control nested inside another interactive control is one
 * accessible name over two focus stops, and a screen reader announces the pair as neither.
 *
 * @example
 * ```ts
 * html`<lia-lookup
 *   label=${row.application}
 *   heading="Application"
 *   href="/applications/performance/${row.appId}"
 *   .load=${() => describeApplication(row.appId)}
 * ></lia-lookup>`;
 * ```
 */
@customElement('lia-lookup')
export class LiaLookup extends LiaElement {
  /** The text on the page. Light-DOM children win over it. */
  @property({ type: String }) label = '';

  /** Popover title. Leave empty for a headless popover. */
  @property({ type: String }) heading = '';

  /** Loads the detail rows, on first hover or focus. */
  @property({ attribute: false }) load?: LookupLoader;

  /**
   * Where the identifier leads. Empty leaves the trigger a button that only explains itself.
   *
   * An anchor is focusable and activated by Enter on its own, so the button semantics below are
   * dropped for this branch rather than added to it.
   */
  @property({ type: String }) href = '';

  /** Preferred side; Popper flips it when there is no room. */
  @property({ type: String }) placement: OverlayPlacement = 'top';

  /** Shown when {@link load} resolves to nothing. */
  @property({ type: String, attribute: 'empty-text' }) emptyText = 'Nothing further was reported.';

  /** Shown when {@link load} rejects. */
  @property({ type: String, attribute: 'error-text' }) errorText = 'The details could not be loaded.';

  /** Accessible hint on the trigger, appended to the label for screen readers. */
  @property({ type: String, attribute: 'trigger-hint' }) triggerHint = 'Show details';

  /** Renders as plain text: no underline, no popover, no request. */
  @property({ type: Boolean }) disabled = false;

  @state() private rows: InfoEntry[] | null = null;
  @state() private images: LookupImage[] = [];
  @state() private failed = false;

  /** The popover body, rendered by Lit and handed to Bootstrap as an element. */
  private readonly body = document.createElement('div');

  /**
   * The consumer's own markup, moved inside the trigger.
   *
   * This element renders into the light DOM, where `<slot>` is an unknown tag that projects nothing —
   * children written inside `<lia-lookup>` would otherwise sit *next to* the trigger rather than in
   * it, leaving the dotted underline, the pointer and the hover that loads the detail on an element
   * holding nothing but the screen-reader hint.
   */
  private readonly content = new LightContent(this, 'lia-content-slot', 'span');

  private plugin?: Popover;
  private requested = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.content.adopt();
  }

  protected override willUpdate(): void {
    this.content.pause();
  }

  override disconnectedCallback(): void {
    this.content.disconnect();
    this.plugin?.dispose();
    this.plugin = undefined;
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    if (this.disabled) {
      return html`${this.label}${this.content.holder}`;
    }

    // A link says what it is by being one: it is focusable, Enter activates it, and the browser
    // offers it to middle-click and to a context menu - none of which a span with role="button"
    // gets, and all of which somebody reading a table of identifiers expects. The hover behaviour is
    // identical, so the detail is still one pointer away.
    if (this.href) {
      return html`<a
        class="lia-lookup"
        href=${this.href}
        @mouseenter=${this.request}
        @focus=${this.request}
        >${this.label}${this.content.holder}<span class="visually-hidden">
          ${this.triggerHint}</span
        ></a
      >`;
    }

    // The accessible name comes from the content rather than from an `aria-label`, because the content
    // is often slotted - a cell decorator wraps whatever the column already rendered - and an
    // aria-label would then have to restate something it cannot see. The hint rides along inside the
    // trigger instead, where it is part of that name for a screen reader and invisible to everybody
    // else.
    return html`<span
      class="lia-lookup"
      role="button"
      tabindex="0"
      @mouseenter=${this.request}
      @focus=${this.request}
      @keydown=${this.onKeyDown}
      >${this.label}${this.content.holder}<span class="visually-hidden">
        ${this.triggerHint}</span
      ></span
    >`;
  }

  override updated(): void {
    this.content.resume();
    this.renderBody();
    this.plugin?.update();
  }

  /**
   * Loads the detail, once.
   *
   * The popover is created here rather than in `firstUpdated` so an element nobody points at never
   * instantiates a plugin — the difference between one Popover and five hundred of them on a table
   * that is only ever read.
   *
   * It is also shown here, explicitly, and that is not redundant: the plugin is constructed *during*
   * the very event that would have opened it, so Bootstrap's own listeners were not attached when the
   * pointer arrived and the first hover would otherwise load the detail and display nothing. Every
   * later hover is Bootstrap's, including the leave that hides it — its listeners exist from
   * construction onwards regardless of who called `show`.
   */
  private request = (): void => {
    if (this.requested || this.disabled || !this.load) {
      return;
    }

    this.requested = true;
    this.ensurePopover();
    this.plugin?.show();

    this.load()
      .then(detail => {
        this.rows = Array.isArray(detail) ? detail : (detail?.rows ?? []);
        this.images = Array.isArray(detail) ? [] : (detail?.images ?? []);
      })
      .catch(() => {
        this.failed = true;
      });
  };

  private ensurePopover(): void {
    const trigger = this.querySelector<HTMLElement>('.lia-lookup');

    if (!trigger || this.plugin) {
      return;
    }

    this.renderBody();

    this.plugin = new Popover(trigger, {
      title: this.heading,
      content: this.body,

      // `html` looks alarming here and is not: it is what makes the body a *live node* rather than a
      // dead copy. Bootstrap branches on the content's type before it branches on this flag - an
      // Element goes to `_putElementInTemplate`, which appends it when `html` is set and does
      // `textContent = element.textContent` when it is not. Unset, the popover therefore showed a
      // snapshot of the container's text taken the moment it opened, which is the spinner, forever.
      // The string paths - `innerHTML` and the sanitiser - are unreachable with an Element, so this
      // buys the live node without ever letting the plugin parse markup.
      html: true,
      placement: this.placement,
      trigger: 'hover focus',
      container: 'body',
      customClass: 'lia-lookup-popover',
    });
  }

  /**
   * Renders the body into its own container.
   *
   * Lit updates the container in place, so the same node stays valid while Bootstrap has it mounted
   * inside the popover — which is what lets the spinner become the answer without rebuilding the
   * plugin or reopening the popover under the pointer.
   */
  private renderBody(): void {
    render(this.detail(), this.body);
  }

  private detail(): TemplateResult {
    if (this.failed) {
      return html`<p class="mb-0 small text-danger">${this.errorText}</p>`;
    }

    if (this.rows === null) {
      return html`<p class="mb-0 small text-body-secondary">
        ${renderSpinner('Loading details', { size: 'sm' })}
        <span class="ms-2">Loading…</span>
      </p>`;
    }

    if (this.rows.length === 0 && this.images.length === 0) {
      return html`<p class="mb-0 small text-body-secondary">${this.emptyText}</p>`;
    }

    return html`${this.thumbnails()}
      <div class="list-group list-group-flush">
        ${this.rows.map(
          entry => html`<lia-key-value .entry=${entry} class="px-0 py-1 border-0"></lia-key-value>`,
        )}
      </div>`;
  }

  /**
   * The pictures, above the rows.
   *
   * Above, because when there are any they are the answer and the rows are the footnotes: a reader
   * hovering a card number wants to see the card. They are laid out in a row that wraps, sized in `rem`
   * rather than by a viewport unit, since a popover is a small box whose width Popper decides.
   *
   * **A broken image hides itself rather than leaving a torn icon.** These URLs point at somebody
   * else's media as often as at ours, and a popover that is mostly a browser's broken-image glyph is
   * worse than one that is only its rows.
   */
  private thumbnails(): TemplateResult | typeof nothing {
    if (this.images.length === 0) {
      return nothing;
    }

    const figure = (image: LookupImage): TemplateResult => html`<figure class="m-0 text-center">
      <img
        class="lia-lookup-thumb rounded"
        src=${image.src}
        alt=${image.alt}
        loading="lazy"
        @error=${(event: Event) => {
          (event.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
      ${image.caption
        ? html`<figcaption class="small text-body-secondary mt-1">${image.caption}</figcaption>`
        : nothing}
    </figure>`;

    return html`<div class="d-flex flex-wrap justify-content-center gap-2 mb-2">
      ${this.images.map(image =>
        image.href
          ? html`<a href=${image.href} class="text-decoration-none">${figure(image)}</a>`
          : figure(image),
      )}
    </div>`;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.request();
    this.plugin?.show();
  }
}

/**
 * `lia-lookup` as a one-line template, for the table columns that are its main caller.
 *
 * Unlike `renderIcon` and `renderBadge`, this is a convenience rather than an escape from the custom
 * element — the element is what holds the per-value state, so there is nothing to render without it.
 * What it does buy is that a column's `render` stays a single expression.
 */
export function renderLookup(label: string, load: LookupLoader, heading = '', href = ''): TemplateResult {
  return html`<lia-lookup label=${label} heading=${heading} href=${href} .load=${load}></lia-lookup>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-lookup': LiaLookup;
  }
}
