/**
 * A minimal scroll-spy: tell me which of these sections the reader is looking
 * at. Used by `<lia-settings-page>` to keep the secondary rail in sync with
 * the settings block currently in view.
 *
 * It is deliberately not Bootstrap's ScrollSpy: that one wants a scroll
 * container and a matching `<nav>` in the DOM, while the kit's rail is a
 * data-driven component that only needs the *id* of the active section.
 */

/** Options for {@link SectionSpy}. */
export interface SectionSpyOptions {
  /**
   * Called whenever the active section changes. `null` means nothing observed
   * is on screen (the reader is above the first section, typically).
   */
  onChange: (id: string | null) => void;
  /**
   * `rootMargin` of the underlying observer. The default shrinks the viewport
   * to its top third, so the "active" section is the one being *read* rather
   * than the one merely peeking in from the bottom.
   */
  rootMargin?: string;
  /** Scroll container. Defaults to the viewport. */
  root?: Element | Document | null;
}

/** An element the spy watches, together with the id it reports. */
export interface SpyTarget {
  id: string;
  element: Element;
}

const DEFAULT_ROOT_MARGIN = '0px 0px -66% 0px';

/**
 * Watches a list of sections and reports the topmost one that is in view.
 *
 * @example
 * ```ts
 * const spy = new SectionSpy({ onChange: (id) => (this.activeGroup = id ?? '') });
 * spy.observe([{ id: 'general', element: generalSection }]);
 * // later
 * spy.disconnect();
 * ```
 */
export class SectionSpy {
  private observer?: IntersectionObserver;

  private targets: SpyTarget[] = [];

  private readonly visible = new Set<Element>();

  private active: string | null = null;

  constructor(private readonly options: SectionSpyOptions) {}

  /** `true` when the environment cannot observe intersections (SSR, old JSDOM). */
  static get supported(): boolean {
    return typeof IntersectionObserver !== 'undefined';
  }

  /** The id currently reported as active. */
  get activeId(): string | null {
    return this.active;
  }

  /**
   * Replace the watched set. Targets are reported in the order given, which
   * should be their document order.
   */
  observe(targets: readonly SpyTarget[]): void {
    if (!SectionSpy.supported) return;
    if (this.sameTargets(targets)) return;

    this.observer?.disconnect();
    this.visible.clear();
    this.targets = [...targets];

    if (this.targets.length === 0) {
      this.observer = undefined;
      this.report(null);
      return;
    }

    this.observer = new IntersectionObserver((entries) => this.handle(entries), {
      root: this.options.root instanceof Element ? this.options.root : null,
      rootMargin: this.options.rootMargin ?? DEFAULT_ROOT_MARGIN,
      threshold: 0,
    });
    for (const target of this.targets) this.observer.observe(target.element);
  }

  /** Stop watching and forget the current state. */
  disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.visible.clear();
    this.targets = [];
    this.active = null;
  }

  /** Adopt an id without waiting for the next intersection (after a jump). */
  set(id: string | null): void {
    this.active = id;
  }

  private sameTargets(targets: readonly SpyTarget[]): boolean {
    if (targets.length !== this.targets.length) return false;
    return targets.every(
      (target, index) =>
        this.targets[index]?.element === target.element && this.targets[index]?.id === target.id
    );
  }

  private handle(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.isIntersecting) this.visible.add(entry.target);
      else this.visible.delete(entry.target);
    }
    const first = this.targets.find((target) => this.visible.has(target.element));
    // Nothing in view usually means the reader scrolled past the last section;
    // keeping the previous id is less jumpy than clearing the rail.
    if (!first) return;
    this.report(first.id);
  }

  private report(id: string | null): void {
    if (id === this.active) return;
    this.active = id;
    this.options.onChange(id);
  }
}
