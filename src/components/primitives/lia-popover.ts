import { customElement, property } from 'lit/decorators.js';
import { Popover } from 'bootstrap';
import { LiaOverlayBase, type OverlayInstance } from './overlay-base.js';

/**
 * Declarative wrapper around Bootstrap's popover plugin — a tooltip with a
 * heading and room for markup.
 *
 * Wrap the trigger; the plugin attaches to the first child (or to the host
 * when there is none), is rebuilt when the options change and disposed on
 * disconnect. Set `html` to allow markup in `content`, which is what the
 * "extra detail behind an (i)" pattern in listings needs.
 *
 * @example
 * ```html
 * <lia-popover heading="Version" trigger="hover focus" placement="bottom" html
 *              content="<b>2.1.0</b><br>Up to date">
 *   <span class="nav-link text-success">
 *     <i class="fa-solid fa-circle-check" aria-hidden="true"></i> 2.1.0
 *   </span>
 * </lia-popover>
 * ```
 */
@customElement('lia-popover')
export class LiaPopover extends LiaOverlayBase {
  /** Popover title bar. Leave empty for a headless popover. */
  @property({ type: String }) heading = '';

  protected override optionSignature(): string {
    return `${super.optionSignature()}|${this.heading}`;
  }

  protected override createInstance(target: HTMLElement): OverlayInstance {
    return new Popover(target, {
      title: this.heading,
      content: this.content,
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
    'lia-popover': LiaPopover;
  }
}
