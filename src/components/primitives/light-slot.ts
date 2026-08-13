/**
 * Light-DOM content projection.
 *
 * The kit renders into the light DOM, which means Lit *owns* the element's
 * children: anything the consumer wrote inside the tag would be rendered
 * around, and template updates could sweep it away. `LightSlot` solves that by
 * lifting the authored children into a detached, layout-transparent host
 * element once, and then rendering that element back into the template as a
 * plain DOM node value (lit-html commits `Node` values verbatim, so the
 * children keep their identity, state and event listeners across re-renders).
 *
 * @example
 * ```ts
 * class LiaThing extends LiaElement {
 *   private slot = new LightSlot();
 *
 *   override connectedCallback(): void {
 *     this.slot.capture(this);   // must run *before* the first render
 *     super.connectedCallback();
 *   }
 *
 *   override render() {
 *     return html`<div class="box">${this.slot.node}</div>`;
 *   }
 * }
 * ```
 */
export class LightSlot {
  /** The detached element holding the captured children. */
  readonly node: HTMLElement;

  private captured = false;

  /**
   * @param display CSS `display` for the wrapper. The default `contents`
   *   removes the wrapper's own box so the captured children lay out as if
   *   they were direct children of whatever the wrapper is rendered into.
   */
  constructor(display = 'contents') {
    this.node = document.createElement('div');
    this.node.style.display = display;
  }

  /**
   * Move every child of `host` into {@link node}. Safe to call repeatedly —
   * only the first call does anything.
   *
   * Call it from `connectedCallback()` before `super.connectedCallback()`. In
   * the rare case where the element is upgraded while the parser is still
   * streaming its children (a synchronous, non-deferred definition script),
   * there is nothing to capture yet; prefer the `content` property in that
   * situation.
   */
  capture(host: HTMLElement): void {
    if (this.captured) return;
    this.captured = true;
    while (host.firstChild) this.node.appendChild(host.firstChild);
  }

  /** `true` when nothing meaningful was projected (no elements, no text). */
  get isEmpty(): boolean {
    for (const child of Array.from(this.node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) continue;
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.textContent ?? '').trim() !== '') return false;
        continue;
      }
      return false;
    }
    return true;
  }
}
