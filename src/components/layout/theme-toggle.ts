import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Dropdown } from 'bootstrap';
import { LiaElement } from '../../core/base-element.js';
import { uid } from '../../core/utils.js';
import { applyScheme, getPreferredScheme, type ColorScheme } from '../../core/theme.js';

const ICONS: Record<ColorScheme, string> = {
  light: 'fa-solid fa-sun',
  dark: 'fa-solid fa-moon',
  auto: 'fa-solid fa-circle-half-stroke',
};

/**
 * Light / dark / auto colour-scheme switcher, wired to `core/theme.ts`.
 *
 * Picking an entry stamps `data-bs-theme` on `<html>`, persists the choice and
 * fires `lia-theme-change` on `window`; the control also follows changes made
 * elsewhere on the page. Every label is a property, so the switcher can be
 * localised.
 *
 * @example
 * ```html
 * <lia-theme-toggle
 *   light-label="Hell"
 *   dark-label="Dunkel"
 *   auto-label="System"
 * ></lia-theme-toggle>
 * ```
 *
 * @example
 * ```ts
 * html`<lia-theme-toggle variant="button" .navLink=${false}></lia-theme-toggle>`
 * ```
 */
@customElement('lia-theme-toggle')
export class LiaThemeToggle extends LiaElement {
  /** `dropdown` offers all three modes; `button` cycles light → dark → auto. */
  @property({ type: String }) variant: 'dropdown' | 'button' = 'dropdown';

  /** Style the trigger as a navbar link rather than a button. */
  @property({ type: Boolean, attribute: 'nav-link' }) navLink = false;

  @property({ type: String, attribute: 'light-label' }) lightLabel = 'Light';
  @property({ type: String, attribute: 'dark-label' }) darkLabel = 'Dark';
  @property({ type: String, attribute: 'auto-label' }) autoLabel = 'Auto';

  /** Accessible name of the trigger. */
  @property({ type: String }) label = 'Colour scheme';

  /** Show the active scheme's name next to the icon (hidden below `xl`). */
  @property({ type: Boolean, attribute: 'show-label' }) showLabel = false;

  @state() private scheme: ColorScheme = 'auto';

  private readonly menuId = uid('lia-theme');
  private dropdown?: Dropdown;

  private readonly onExternalChange = (): void => {
    this.scheme = getPreferredScheme();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheme = getPreferredScheme();
    window.addEventListener('lia-theme-change', this.onExternalChange);
    if (this.hasUpdated) this.initDropdown();
  }

  override disconnectedCallback(): void {
    window.removeEventListener('lia-theme-change', this.onExternalChange);
    this.dropdown?.dispose();
    this.dropdown = undefined;
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    this.initDropdown();
  }

  private initDropdown(): void {
    if (this.variant !== 'dropdown' || this.dropdown) return;
    const toggle = this.querySelector<HTMLElement>('[data-bs-toggle="dropdown"]');
    if (toggle) this.dropdown = Dropdown.getOrCreateInstance(toggle);
  }

  private select(scheme: ColorScheme): void {
    this.scheme = scheme;
    applyScheme(scheme);
  }

  private cycle(): void {
    const order: ColorScheme[] = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(this.scheme) + 1) % order.length];
    this.select(next ?? 'auto');
  }

  private labelFor(scheme: ColorScheme): string {
    if (scheme === 'light') return this.lightLabel;
    if (scheme === 'dark') return this.darkLabel;
    return this.autoLabel;
  }

  private get triggerClass(): string {
    return this.navLink ? 'nav-link' : 'btn btn-sm btn-outline-secondary';
  }

  protected override render(): unknown {
    const current = this.scheme;
    const face = html`<i class="${ICONS[current]}" aria-hidden="true"></i>${this.showLabel
      ? html`<span class="d-none d-xl-inline ms-1">${this.labelFor(current)}</span>`
      : nothing}`;

    if (this.variant === 'button') {
      return html`<button
        type="button"
        class="${this.triggerClass}"
        title="${this.label}: ${this.labelFor(current)}"
        aria-label="${this.label}: ${this.labelFor(current)}"
        @click="${() => this.cycle()}"
      >
        ${face}
      </button>`;
    }

    return html`<div class="dropdown">
      <button
        type="button"
        class="${this.triggerClass} dropdown-toggle"
        id="${this.menuId}-toggle"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="${this.label}: ${this.labelFor(current)}"
        title="${this.label}"
      >
        ${face}
      </button>
      <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="${this.menuId}-toggle">
        ${(['light', 'dark', 'auto'] as ColorScheme[]).map(
          (scheme) => html`<li>
            <button
              type="button"
              class="dropdown-item d-flex align-items-center gap-2 ${scheme === current
                ? 'active'
                : ''}"
              aria-current="${scheme === current ? 'true' : 'false'}"
              @click="${() => this.select(scheme)}"
            >
              <i class="${ICONS[scheme]}" aria-hidden="true"></i>
              <span>${this.labelFor(scheme)}</span>
            </button>
          </li>`
        )}
      </ul>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-theme-toggle': LiaThemeToggle;
  }
}
