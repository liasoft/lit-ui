import { Modal } from 'bootstrap';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Options handed to the Bootstrap `Modal` instance. */
export interface ModalControllerConfig {
  /** `true` for a dismissible backdrop, `'static'` to keep the dialog open. */
  backdrop?: boolean | 'static';
  /** Whether <kbd>Esc</kbd> closes the dialog. */
  keyboard?: boolean;
  /** Move focus into the dialog when it opens. */
  focus?: boolean;
}

/** Lifecycle callbacks the host reacts to. */
export interface ModalControllerCallbacks {
  /** Fired after Bootstrap finished the show transition. */
  onShown?: () => void;
  /** Fired after Bootstrap finished the hide transition. */
  onHidden?: () => void;
}

const SAME_CONFIG = (a: ModalControllerConfig, b: ModalControllerConfig): boolean =>
  a.backdrop === b.backdrop && a.keyboard === b.keyboard && a.focus === b.focus;

/**
 * Owns the Bootstrap `Modal` instance for a light-DOM element: creation,
 * event bridging, reconfiguration and — the part that is easy to get wrong —
 * tearing the backdrop and the `modal-open` body state down again when the
 * host is removed while the dialog is still open.
 *
 * Both `<lia-modal>` and `<lia-confirm-dialog>` are built on it, and it is
 * exported so applications can wrap their own dialog markup the same way.
 *
 * @example
 * ```ts
 * class MyDialog extends LiaElement {
 *   private modal = new ModalController(this, { keyboard: true }, {
 *     onHidden: () => { this.open = false; },
 *   });
 *
 *   firstUpdated() {
 *     this.modal.attach(this.querySelector('.modal')!);
 *   }
 * }
 * ```
 */
export class ModalController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly callbacks: ModalControllerCallbacks;
  private config: ModalControllerConfig;
  private element?: HTMLElement;
  private instance?: Modal;
  private shownState = false;

  constructor(
    host: ReactiveControllerHost,
    config: ModalControllerConfig = {},
    callbacks: ModalControllerCallbacks = {}
  ) {
    this.host = host;
    this.config = config;
    this.callbacks = callbacks;
    this.host.addController(this);
  }

  /** Whether Bootstrap currently considers the dialog visible. */
  get shown(): boolean {
    return this.shownState;
  }

  /** The Bootstrap instance, once {@link attach} has run. */
  get bootstrapModal(): Modal | undefined {
    return this.instance;
  }

  hostConnected(): void {
    /* the element is re-attached in firstUpdated/updated */
  }

  hostDisconnected(): void {
    this.destroy();
  }

  /** Bind to the rendered `.modal` element. Safe to call on every update. */
  attach(element: HTMLElement, config?: ModalControllerConfig): void {
    if (config) this.config = config;
    if (this.element === element && this.instance) return;
    this.destroy();
    this.element = element;
    element.addEventListener('shown.bs.modal', this.handleShown);
    element.addEventListener('hidden.bs.modal', this.handleHidden);
    this.instance = new Modal(element, {
      backdrop: this.config.backdrop ?? true,
      keyboard: this.config.keyboard ?? true,
      focus: this.config.focus ?? true,
    });
  }

  /**
   * Apply a new Bootstrap configuration. Recreating the instance while the
   * dialog is on screen would drop the backdrop, so a change that arrives
   * mid-flight is deferred until the dialog is closed.
   */
  configure(config: ModalControllerConfig): void {
    if (SAME_CONFIG(this.config, config)) return;
    this.config = config;
    if (!this.element || this.shownState) return;
    const element = this.element;
    this.destroy();
    this.attach(element);
  }

  show(): void {
    this.instance?.show();
  }

  hide(): void {
    this.instance?.hide();
  }

  toggle(): void {
    this.instance?.toggle();
  }

  /**
   * Dispose the Bootstrap instance and, if this was the last open dialog on
   * the page, remove the leftover backdrop and unlock the body scroll.
   */
  destroy(): void {
    const { element, instance } = this;
    this.element = undefined;
    this.instance = undefined;
    if (element) {
      element.removeEventListener('shown.bs.modal', this.handleShown);
      element.removeEventListener('hidden.bs.modal', this.handleHidden);
    }
    if (!instance) return;
    const wasShown = this.shownState;
    this.shownState = false;
    try {
      instance.dispose();
    } catch {
      /* Bootstrap throws when the element is already detached — ignore. */
    }
    if (wasShown) cleanUpModalPageState();
  }

  private readonly handleShown = (): void => {
    this.shownState = true;
    this.callbacks.onShown?.();
  };

  private readonly handleHidden = (): void => {
    this.shownState = false;
    this.callbacks.onHidden?.();
  };
}

/**
 * Remove the page-level state Bootstrap keeps outside the dialog element —
 * but only once no other modal is still open.
 */
export function cleanUpModalPageState(): void {
  if (document.querySelector('.modal.show')) return;
  document.querySelectorAll('.modal-backdrop').forEach((node) => node.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}

/** Normalise `'lg'` / `'modal-lg'` to the Bootstrap dialog size class. */
export function modalSizeClass(size: string | undefined): string {
  if (!size) return '';
  return size.startsWith('modal-') ? size : `modal-${size}`;
}
