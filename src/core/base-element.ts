import { LitElement } from 'lit';

/**
 * Base class for every component in the kit.
 *
 * The kit renders into the **light DOM** on purpose: it is a Bootstrap 5 kit,
 * and Bootstrap's stylesheet, its utility classes and its JavaScript plugins
 * (collapse, dropdown, modal, popover) all rely on being able to see and style
 * the rendered markup. Shadow DOM would cut every one of those off.
 *
 * The trade-off is that consumers must load the kit stylesheet once, globally:
 *
 * ```ts
 * import '@liasoft/lit-ui/styles.css';
 * ```
 */
export class LiaElement extends LitElement {
  /** Render into the light DOM so Bootstrap CSS and JS apply. */
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  /**
   * Dispatch a composed, bubbling `CustomEvent`. All kit events are named
   * `lia-<something>` so they never collide with native or host events.
   */
  protected emit<T = unknown>(type: string, detail?: T, options: EventInit = {}): CustomEvent<T> {
    const event = new CustomEvent<T>(type, {
      bubbles: true,
      composed: true,
      cancelable: false,
      ...options,
      detail: detail as T,
    });
    this.dispatchEvent(event);
    return event;
  }
}

/**
 * Same as {@link LiaElement} but keeps children the consumer wrote inside the
 * tag intact — used by components that project arbitrary markup and only need
 * to decorate their host (e.g. wrappers around Bootstrap behaviour).
 */
export class LiaPassthroughElement extends LiaElement {
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }
}
