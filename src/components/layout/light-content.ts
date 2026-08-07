/**
 * Light-DOM content projection for the layout family.
 *
 * The kit renders into the light DOM, so there is no `<slot>`: whatever a
 * consumer writes inside `<lia-app-shell>` or `<lia-page>` lives in exactly the
 * same node tree the component itself renders into. Lit would happily render
 * *around* those nodes, but it cannot render *through* them — the authored
 * children would end up outside the content `<section>`.
 *
 * {@link LightContent} solves that by moving the authored children into a
 * stable holder element once, and handing that holder to the template as a
 * plain DOM value. The holder is styled `display: contents`, so it disappears
 * from layout and the projected markup behaves as if it were written directly
 * inside the section.
 *
 * Lifecycle a host component must honour:
 *
 * ```ts
 * private readonly content = new LightContent(this);
 *
 * connectedCallback() { super.connectedCallback(); this.content.adopt(); }
 * willUpdate()        { this.content.pause(); }
 * updated()           { this.content.resume(); }
 * disconnectedCallback() { this.content.disconnect(); super.disconnectedCallback(); }
 *
 * render() { return html`<section>${this.content.holder}</section>`; }
 * ```
 */
export class LightContent {
  /** The stable element every projected node lives in. */
  readonly holder: HTMLDivElement;

  private readonly host: HTMLElement;
  /** Nodes the host's own template owns — never projected. */
  private readonly own = new WeakSet<Node>();
  private observer?: MutationObserver;
  private adopted = false;

  constructor(host: HTMLElement, className = 'lia-content-slot') {
    this.host = host;
    this.holder = document.createElement('div');
    this.holder.className = className;
  }

  /**
   * Move the children the consumer authored inside the tag into the holder.
   * Call from `connectedCallback()`; it is a no-op on later reconnects.
   */
  adopt(): void {
    if (this.adopted) return;
    this.adopted = true;
    this.move(Array.from(this.host.childNodes));
  }

  /** Append content programmatically, e.g. after the first render. */
  append(node: Node): void {
    this.holder.appendChild(node);
  }

  /** Remove every projected node. */
  clear(): void {
    this.holder.replaceChildren();
  }

  /** The projected element children — handy for content-aware layout tweaks. */
  get elements(): Element[] {
    return Array.from(this.holder.children);
  }

  /** True when at least one element (not just whitespace) was projected. */
  get hasContent(): boolean {
    return Array.from(this.holder.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim() !== ''
    );
  }

  /**
   * Stop watching while the host re-renders its own markup. Records queued but
   * not yet delivered are flushed first, so content appended in the same task
   * as a property change is still projected rather than stranded.
   */
  pause(): void {
    if (!this.observer) return;
    this.handle(this.observer.takeRecords());
    this.observer.disconnect();
    this.observer = undefined;
  }

  /**
   * Record the nodes the template just rendered, then watch for late children
   * — frameworks that append after insertion still get their markup projected.
   */
  resume(): void {
    for (const node of Array.from(this.host.childNodes)) this.own.add(node);
    this.observe();
  }

  /** Tear the observer down. Call from `disconnectedCallback()`. */
  disconnect(): void {
    this.pause();
  }

  private observe(): void {
    if (this.observer || typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver((records) => this.handle(records));
    this.observer.observe(this.host, { childList: true });
  }

  private handle(records: MutationRecord[]): void {
    const strays: Node[] = [];
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (!this.own.has(node) && node.parentNode === this.host) strays.push(node);
      }
    }
    if (strays.length > 0) this.move(strays);
  }

  private move(nodes: Node[]): void {
    for (const node of nodes) {
      if (node === this.holder) continue;
      this.holder.appendChild(node);
    }
  }
}
