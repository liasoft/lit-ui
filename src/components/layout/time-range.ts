import { html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Dropdown } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import type { TimeRangePreset, TimeRangeValue } from '../../core/types.js';
import { uid } from '../../core/utils.js';

/** The presets an application gets without describing any: the ones every dashboard offers. */
export const DEFAULT_TIME_RANGE_PRESETS: TimeRangePreset[] = [
  { id: '15m', label: 'Last 15 minutes' },
  { id: '1h', label: 'Last hour' },
  { id: '6h', label: 'Last 6 hours' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
];

/** `datetime-local` wants a local wall-clock string, not the ISO instant a `Date` stringifies to. */
function toLocalInput(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * The time picker a dashboard is scoped by: named presets, or an absolute pair.
 *
 * **It resolves nothing.** Picking "Last hour" emits `{ preset: '1h' }`, not two timestamps, and the
 * element then displays whatever `value` comes back. That is deliberate: a preset means *now* minus
 * something, "now" moves, and an element that froze the bounds when the user clicked would quietly
 * answer a stale question an hour later. The application owns the clock — and with it whether a
 * preset is re-resolved per query, whether the choice is persisted, and what "last 30 days" means
 * against its own retention.
 *
 * Events, both `bubbles: true`:
 * - `lia-range-change` — `{ preset }` for a preset, `{ from, to, preset: null }` for an absolute pair.
 * - `lia-refresh` — the reload button, when `show-refresh` is set. Carries no detail; re-resolving a
 *   preset against the current clock is the application's business.
 *
 * @example
 * ```ts
 * html`<lia-time-range
 *   .value=${{ from, to, preset: '24h', label: 'Last 24 hours' }}
 *   show-refresh
 *   @lia-range-change=${(e: CustomEvent) => store.set(e.detail)}
 *   @lia-refresh=${() => store.refresh()}
 * ></lia-time-range>`;
 * ```
 */
@customElement('lia-time-range')
export class LiaTimeRange extends LiaElement {
  /** The named ranges offered above the absolute form. Empty leaves only the absolute form. */
  @property({ attribute: false }) presets: TimeRangePreset[] = DEFAULT_TIME_RANGE_PRESETS;

  /** What is in force. `label` is what the button reads; `preset` marks the active entry. */
  @property({ attribute: false }) value?: TimeRangeValue;

  /** Also render a reload button, which emits `lia-refresh`. */
  @property({ type: Boolean, attribute: 'show-refresh' }) showRefresh = false;

  @property({ type: String }) applyLabel = 'Apply';

  @property({ type: String }) fromLabel = 'From';

  @property({ type: String }) toLabel = 'To';

  @property({ type: String }) refreshLabel = 'Reload';

  /** Shown on the button when `value` carries no label of its own. */
  @property({ type: String }) placeholder = 'Time range';

  private readonly instanceId = uid('lia-time-range');

  private dropdown?: Dropdown;

  override disconnectedCallback(): void {
    this.dropdown?.dispose();
    this.dropdown = undefined;
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    // Instantiated rather than left to Bootstrap's data-api, because Lit owns this markup and may
    // replace the toggle between renders.
    const toggle = this.querySelector<HTMLElement>('[data-bs-toggle="dropdown"]');
    if (toggle) this.dropdown = Dropdown.getOrCreateInstance(toggle);
  }

  private choose(preset: string): void {
    this.emit('lia-range-change', { preset, from: undefined, to: undefined });
  }

  private applyAbsolute(event: Event): void {
    event.preventDefault();

    const from = this.querySelector<HTMLInputElement>(`#${this.instanceId}-from`)?.value ?? '';
    const to = this.querySelector<HTMLInputElement>(`#${this.instanceId}-to`)?.value ?? '';
    if (!from || !to || new Date(from) >= new Date(to)) return;

    this.emit('lia-range-change', { preset: null, from: new Date(from), to: new Date(to) });
  }

  override render(): TemplateResult {
    const value = this.value;

    return html`
      <div class="dropdown">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary dropdown-toggle"
          data-bs-toggle="dropdown"
          data-bs-auto-close="outside"
          aria-expanded="false"
        >
          <i class="fa-solid fa-clock-rotate-left me-2" aria-hidden="true"></i>${value?.label ??
          this.placeholder}
        </button>
        <ul class="dropdown-menu dropdown-menu-end p-0">
          ${this.presets.map(
            (preset) => html`<li>
              <button
                type="button"
                class="dropdown-item ${preset.id === value?.preset ? 'active' : ''}"
                @click=${() => this.choose(preset.id)}
              >
                ${preset.label}
              </button>
            </li>`
          )}
          ${this.presets.length > 0 ? html`<li><hr class="dropdown-divider my-1" /></li>` : nothing}
          <li>
            <form
              class="px-3 pb-3 pt-1 d-flex flex-column gap-2"
              style="min-width: 17rem"
              @submit=${this.applyAbsolute}
            >
              <label class="form-label small mb-0" for="${this.instanceId}-from">
                ${this.fromLabel}
                <input
                  type="datetime-local"
                  id="${this.instanceId}-from"
                  class="form-control form-control-sm"
                  .value=${toLocalInput(value?.from)}
                />
              </label>
              <label class="form-label small mb-0" for="${this.instanceId}-to">
                ${this.toLabel}
                <input
                  type="datetime-local"
                  id="${this.instanceId}-to"
                  class="form-control form-control-sm"
                  .value=${toLocalInput(value?.to)}
                />
              </label>
              <button type="submit" class="btn btn-sm btn-primary">${this.applyLabel}</button>
            </form>
          </li>
        </ul>
      </div>

      ${this.showRefresh
        ? html`<button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            title=${this.refreshLabel}
            aria-label=${this.refreshLabel}
            @click=${() => this.emit('lia-refresh')}
          >
            <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
          </button>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-time-range': LiaTimeRange;
  }

  interface HTMLElementEventMap {
    'lia-range-change': CustomEvent<{ preset: string | null; from?: Date; to?: Date }>;
    'lia-refresh': CustomEvent<void>;
  }
}
