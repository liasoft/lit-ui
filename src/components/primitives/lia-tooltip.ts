import { customElement } from 'lit/decorators.js';
import { Tooltip } from 'bootstrap';
import { LiaOverlayBase, type OverlayInstance } from './overlay-base.js';

/**
 * Declarative wrapper around Bootstrap's tooltip plugin.
 *
 * Wrap the trigger — the element stays exactly where you put it, and the
 * plugin is attached to the first child (or to the host when there is none).
 * The instance is rebuilt when the options change and disposed on disconnect.
 *
 * Prefer a real `title`/`aria-label` on the child for anything a screen-reader
 * user must know: a tooltip is a hint, not a substitute for a label.
 *
 * @example
 * ```html
 * <lia-tooltip content="Rebuild the configuration" placement="bottom">
 *   <button class="btn btn-outline-secondary">
 *     <i class="fa-solid fa-rotate" aria-hidden="true"></i>
 *     <span class="visually-hidden">Rebuild</span>
 *   </button>
 * </lia-tooltip>
 * ```
 */
@customElement('lia-tooltip')
export class LiaTooltip extends LiaOverlayBase {
  protected override createInstance(target: HTMLElement): OverlayInstance {
    return new Tooltip(target, {
      title: this.content,
      placement: this.placement,
      trigger: this.trigger,
      html: this.html,
      container: this.container || false,
      delay: this.delay,
      customClass: this.overlayClass,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-tooltip': LiaTooltip;
  }
}
