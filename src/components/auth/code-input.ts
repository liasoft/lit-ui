import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import { cx, uid } from '../../core/utils.js';
import { flag } from '../layout/flag.js';
import { fill } from './internal.js';

/** Detail of `lia-code-input-change` and `lia-code-input-complete`. */
export interface CodeInputDetail {
  /** The characters entered so far, concatenated. */
  value: string;
  /** `true` once every box holds a character. */
  complete: boolean;
}

/** Strip everything the field does not accept and clamp to `length`. */
function sanitise(raw: string, alphanumeric: boolean, length: number, upper: boolean): string {
  const pattern = alphanumeric ? /[^0-9a-z]/gi : /\D/g;
  const cleaned = raw.replace(pattern, '');
  return (upper ? cleaned.toUpperCase() : cleaned).slice(0, length);
}

/**
 * A segmented one-time-code field: one box per character, with auto-advance,
 * backspace-to-previous, arrow-key navigation and paste-anywhere support.
 *
 * Boxes are the
 * better affordance for a fixed-length code — the user can see how many
 * characters are expected and correct a single digit without retyping — but
 * they must not cost accessibility, so each box carries its own label
 * ("Digit 3 of 6"), the group is a labelled `role="group"`, and the first box
 * keeps `autocomplete="one-time-code"` so platform SMS/TOTP autofill still
 * lands in the right place and is spread across the boxes.
 *
 * Use `<lia-two-factor-form simple>` when you want the plain single input.
 *
 * @example
 * ```html
 * <lia-code-input length="6" label="Verification code"></lia-code-input>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-code-input
 *   .length=${8}
 *   alphanumeric
 *   .value=${this.code}
 *   @lia-code-input-change=${(e: CustomEvent) => (this.code = e.detail.value)}
 *   @lia-code-input-complete=${() => this.verify()}
 * ></lia-code-input>`
 * ```
 */
@customElement('lia-code-input')
export class LiaCodeInput extends LiaElement {
  /** The code entered so far. Shorter than `length` means partially filled. */
  @property({ type: String }) value = '';

  /** How many boxes to render. */
  @property({ type: Number }) length = 6;

  /** Accept letters as well as digits (recovery codes, base32 secrets). */
  @property({ type: Boolean }) alphanumeric = false;

  /** Upper-case letters as they are typed. Only meaningful with `alphanumeric`. */
  @property({ type: Boolean }) uppercase = false;

  /** Accessible name of the box group. */
  @property({ type: String }) label = 'Verification code';

  /** Per-box label template; `{index}` and `{total}` are substituted. */
  @property({ type: String, attribute: 'box-label' }) boxLabel = 'Character {index} of {total}';

  @property({ type: Boolean }) disabled = false;

  /** Mark every box `is-invalid`. */
  @property({ type: Boolean }) invalid = false;

  /** Focus the first box as soon as the element renders. */
  @property({ converter: flag, attribute: 'auto-focus' }) autoFocusFirst = true;

  /** Box size: `lg` is the default, `md` renders standard-height boxes. */
  @property({ type: String }) size: 'md' | 'lg' = 'lg';

  private readonly instanceId = uid('lia-code');

  /** `true` when every box holds a character. */
  get complete(): boolean {
    return this.value.length === this.length;
  }

  /** Clear every box and put the caret back in the first one. */
  clear(): void {
    this.commit('');
    void this.updateComplete.then(() => this.focusBox(0));
  }

  /** Move focus to the first empty box, or the last one when full. */
  override focus(): void {
    this.focusBox(Math.min(this.value.length, this.length - 1));
  }

  protected override firstUpdated(): void {
    if (this.autoFocusFirst && !this.disabled) this.focusBox(0);
  }

  private boxes(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll<HTMLInputElement>('.lia-code-input-box'));
  }

  private focusBox(index: number): void {
    const box = this.boxes()[Math.max(0, Math.min(index, this.length - 1))];
    box?.focus();
    box?.select();
  }

  /** Set the value, notify, and announce completion once. */
  private commit(next: string, focusIndex?: number): void {
    const previous = this.value;
    this.value = next;
    if (previous === next && focusIndex === undefined) return;
    const detail: CodeInputDetail = { value: next, complete: next.length === this.length };
    if (previous !== next) this.emit<CodeInputDetail>('lia-code-input-change', detail);
    if (focusIndex !== undefined) {
      void this.updateComplete.then(() => this.focusBox(focusIndex));
    }
    if (previous !== next && detail.complete) {
      this.emit<CodeInputDetail>('lia-code-input-complete', detail);
    }
  }

  /** Overwrite the characters from `index` onwards with `typed`. */
  private insertAt(index: number, typed: string): void {
    const clean = sanitise(typed, this.alphanumeric, this.length, this.uppercase);
    if (clean === '') return;
    const chars = this.value.padEnd(this.length, ' ').split('');
    for (let offset = 0; offset < clean.length && index + offset < this.length; offset += 1) {
      chars[index + offset] = clean[offset] as string;
    }
    // Trailing spaces are placeholders, not content.
    const next = chars.join('').replace(/\s+$/, '');
    this.commit(next, Math.min(index + clean.length, this.length - 1));
  }

  private handleInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value;
    // Re-render from the model even when nothing changed, so a rejected
    // character does not linger in the DOM.
    input.value = this.value[index] ?? '';
    this.insertAt(index, typed);
  }

  private handleKeydown(index: number, event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    switch (event.key) {
      case 'Backspace': {
        event.preventDefault();
        const chars = this.value.split('');
        if (input.value === '' && index > 0) {
          chars.splice(index - 1, 1);
          this.commit(chars.join(''), index - 1);
        } else {
          chars.splice(index, 1);
          this.commit(chars.join(''), index);
        }
        break;
      }
      case 'Delete': {
        event.preventDefault();
        const chars = this.value.split('');
        chars.splice(index, 1);
        this.commit(chars.join(''), index);
        break;
      }
      case 'ArrowLeft':
        event.preventDefault();
        this.focusBox(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focusBox(index + 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusBox(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusBox(this.length - 1);
        break;
      default:
        break;
    }
  }

  private handlePaste(index: number, event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (text === '') return;
    event.preventDefault();
    // A pasted code always starts at the beginning when it fills the field.
    const clean = sanitise(text, this.alphanumeric, this.length, this.uppercase);
    this.insertAt(clean.length >= this.length ? 0 : index, clean);
  }

  protected override render(): TemplateResult {
    const boxes: TemplateResult[] = [];
    for (let index = 0; index < this.length; index += 1) {
      const id = `${this.instanceId}-${index}`;
      boxes.push(html`<input
        class=${cx(
          'form-control text-center lia-code-input-box',
          this.size === 'lg' && 'form-control-lg',
          this.invalid && 'is-invalid'
        )}
        id=${id}
        type="text"
        inputmode=${this.alphanumeric ? 'text' : 'numeric'}
        autocomplete=${index === 0 ? 'one-time-code' : 'off'}
        autocapitalize=${this.uppercase ? 'characters' : 'off'}
        autocorrect="off"
        spellcheck="false"
        maxlength="1"
        .value=${this.value[index] ?? ''}
        ?disabled=${this.disabled}
        aria-label=${fill(this.boxLabel, { index: index + 1, total: this.length })}
        aria-invalid=${this.invalid ? 'true' : nothing}
        @input=${(event: Event) => this.handleInput(index, event)}
        @keydown=${(event: KeyboardEvent) => this.handleKeydown(index, event)}
        @paste=${(event: ClipboardEvent) => this.handlePaste(index, event)}
        @focus=${(event: Event) => (event.target as HTMLInputElement).select()}
      />`);
    }

    return html`<div
      class="lia-code-input d-flex justify-content-between gap-2"
      role="group"
      aria-label=${this.label}
    >
      ${boxes}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-code-input': LiaCodeInput;
  }
  interface HTMLElementEventMap {
    'lia-code-input-change': CustomEvent<CodeInputDetail>;
    'lia-code-input-complete': CustomEvent<CodeInputDetail>;
  }
}
