import { nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LiaPassthroughElement } from '../../core/base-element.js';

/** Placements accepted by the Bootstrap overlay plugins. */
export type OverlayPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Trigger list, space separated. `manual` means the overlay is only shown via
 * the imperative {@link LiaOverlayBase.show} / {@link LiaOverlayBase.hide} and
 * cannot be combined with the others.
 */
export type OverlayTrigger =
  | 'click'
  | 'hover'
  | 'focus'
  | 'manual'
  | 'click hover'
  | 'click focus'
  | 'hover focus'
  | 'click hover focus';

/** The slice of the Bootstrap plugin API the wrappers depend on. */
export interface OverlayInstance {
  dispose(): void;
  show(): void;
  hide(): void;
}

/**
 * Shared plumbing for the declarative Bootstrap overlay wrappers
 * (`<lia-tooltip>`, `<lia-popover>`).
 *
 * The element keeps the consumer's markup untouched and attaches the plugin to
 * the first child element — or to itself when it has no element child. The
 * plugin instance is created in `firstUpdated`, rebuilt whenever an option
 * changes and disposed on disconnect, so no listener outlives the element.
 */
export abstract class LiaOverlayBase extends LiaPassthroughElement {
  /** Overlay body. Empty content disables the overlay entirely. */
  @property({ type: String }) content = '';

  /** Preferred side; Popper flips it when there is no room. */
  @property({ type: String }) placement: OverlayPlacement = 'top';

  /** Space-separated list of `hover`, `focus`, `click` or `manual`. */
  @property({ type: String }) trigger: OverlayTrigger = 'hover focus';

  /** Render {@link content} as trusted HTML (Bootstrap still sanitises it). */
  @property({ type: Boolean }) html = false;

  /** Suppress the overlay without removing the element. */
  @property({ type: Boolean }) disabled = false;

  /** CSS selector for the element the overlay is appended to, e.g. `body`. */
  @property({ type: String }) container = '';

  /** Show/hide delay in milliseconds. */
  @property({ type: Number }) delay = 0;

  /** Extra class on the generated overlay, for one-off styling. */
  @property({ type: String, attribute: 'overlay-class' }) overlayClass = '';

  /** The live plugin instance, or `undefined` while detached/disabled. */
  protected instance?: OverlayInstance;

  private signature = '';

  /** Element the plugin is attached to: the first child, else the host. */
  protected get target(): HTMLElement {
    const child = this.firstElementChild;
    return child instanceof HTMLElement ? child : this;
  }

  /** Build the plugin instance. Implemented by the concrete wrapper. */
  protected abstract createInstance(target: HTMLElement): OverlayInstance;

  /** Everything that requires a rebuild when it changes. */
  protected optionSignature(): string {
    return JSON.stringify([
      this.content,
      this.placement,
      this.trigger,
      this.html,
      this.container,
      this.delay,
      this.overlayClass,
    ]);
  }

  override firstUpdated(_changed: PropertyValues): void {
    this.sync();
  }

  override updated(_changed: PropertyValues): void {
    this.sync();
  }

  override disconnectedCallback(): void {
    this.destroy();
    super.disconnectedCallback();
  }

  /** Show the overlay imperatively (useful with `trigger="manual"`). */
  show(): void {
    this.instance?.show();
  }

  /** Hide the overlay imperatively. */
  hide(): void {
    this.instance?.hide();
  }

  private destroy(): void {
    this.instance?.dispose();
    this.instance = undefined;
    this.signature = '';
  }

  private sync(): void {
    if (this.disabled || !this.content) {
      this.destroy();
      return;
    }
    const next = this.optionSignature();
    if (this.instance && next === this.signature) return;
    this.destroy();
    this.signature = next;
    this.instance = this.createInstance(this.target);
  }

  /** Passthrough: the consumer's children are the whole visible output. */
  override render(): typeof nothing {
    return nothing;
  }
}
