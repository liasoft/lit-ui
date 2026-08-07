import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LiaElement } from '../../core/base-element.js';
import { copyToClipboard, cx } from '../../core/utils.js';
import type { IconName, Size, Variant } from '../../core/types.js';

/** Detail of the `lia-copy` event. */
export interface CopyEventDetail {
  /** The text that was put on the clipboard (or attempted). */
  text: string;
  /** Whether the copy succeeded. */
  ok: boolean;
}

declare global {
  interface HTMLElementEventMap {
    'lia-copy': CustomEvent<CopyEventDetail>;
  }
}

/** How long the "copied" confirmation stays on screen. */
const FEEDBACK_MS = 1600;

/**
 * Copy-to-clipboard button.
 *
 * Copies either a literal `text` or the trimmed `textContent` of the element
 * named by `source-id` — the pattern used for the hidden "system info" blocks
 * that sit next to a card header. Success flips the icon to a tick and
 * announces the result in a live region; it also emits `lia-copy`.
 *
 * Unlike the jQuery original the button is not hidden outside secure contexts:
 * `copyToClipboard()` falls back to a hidden textarea when the async Clipboard
 * API is unavailable.
 *
 * @example
 * ```html
 * <div id="sysinfo" class="d-none">host: node-01</div>
 * <lia-copy-button source-id="sysinfo" title="Copy system info"></lia-copy-button>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-copy-button
 *   .text=${apiKey}
 *   label="Copy key"
 *   variant="outline-primary"
 *   @lia-copy=${(e: CustomEvent) => toast(e.detail.ok ? 'Copied' : 'Copy failed')}
 * ></lia-copy-button>`;
 * ```
 */
@customElement('lia-copy-button')
export class LiaCopyButton extends LiaElement {
  /** Literal text to copy. Wins over {@link sourceId}. */
  @property({ type: String }) text = '';

  /** Id of the element whose trimmed `textContent` is copied. */
  @property({ type: String, attribute: 'source-id' }) sourceId = '';

  /** Native tooltip and accessible name while idle. */
  @property({ type: String }) override title = 'Copy to clipboard';

  /** Accessible name and announcement after a successful copy. */
  @property({ type: String, attribute: 'copied-title' }) copiedTitle = 'Copied';

  /** Announcement after a failed copy. */
  @property({ type: String, attribute: 'failed-title' }) failedTitle = 'Copying failed';

  /** Optional visible label next to the icon. */
  @property({ type: String }) label = '';

  @property({ type: String }) size: Size = 'sm';

  @property({ type: String }) variant: Variant | `outline-${Variant}` = 'outline-secondary';

  /** Idle icon. */
  @property({ type: String }) icon: IconName = 'fa-solid fa-copy';

  /** Icon shown while the confirmation is visible. */
  @property({ type: String, attribute: 'copied-icon' }) copiedIcon: IconName = 'fa-solid fa-check';

  @property({ type: Boolean }) disabled = false;

  @state() private status: 'idle' | 'copied' | 'failed' = 'idle';

  private timer?: ReturnType<typeof setTimeout>;

  override disconnectedCallback(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    super.disconnectedCallback();
  }

  /** Resolve the text to copy from `text` or the referenced source element. */
  private resolveText(): string {
    if (this.text) return this.text;
    if (!this.sourceId) return '';
    const root = this.getRootNode();
    const scope: ParentNode =
      root instanceof Document || root instanceof ShadowRoot ? root : document;
    const source = scope.querySelector(`#${CSS.escape(this.sourceId)}`);
    return (source?.textContent ?? '').trim();
  }

  /** Copy, show the transient confirmation and emit `lia-copy`. */
  async copy(): Promise<boolean> {
    const text = this.resolveText();
    const ok = text ? await copyToClipboard(text) : false;
    this.status = ok ? 'copied' : 'failed';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.status = 'idle';
      this.timer = undefined;
    }, FEEDBACK_MS);
    this.emit<CopyEventDetail>('lia-copy', { text, ok });
    return ok;
  }

  private get currentTitle(): string {
    if (this.status === 'copied') return this.copiedTitle;
    if (this.status === 'failed') return this.failedTitle;
    return this.title;
  }

  override render(): TemplateResult {
    const copied = this.status === 'copied';
    return html`<button
        type="button"
        class=${cx(
          'btn',
          `btn-${copied ? 'success' : this.variant}`,
          this.size !== 'md' && `btn-${this.size}`
        )}
        title=${this.currentTitle}
        aria-label=${ifDefined(this.label ? undefined : this.currentTitle)}
        ?disabled=${this.disabled}
        @click=${() => void this.copy()}
      >
        <i class=${copied ? this.copiedIcon : this.icon} aria-hidden="true"></i>
        ${this.label ? html`<span class="ms-1">${this.label}</span>` : ''}
      </button>
      <span class="visually-hidden" role="status" aria-live="polite"
        >${this.status === 'idle' ? '' : this.currentTitle}</span
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-copy-button': LiaCopyButton;
  }
}
