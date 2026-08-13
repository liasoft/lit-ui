import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LiaElement } from '../../core/base-element.js';
import type { FormErrors, FormSection, FormValues } from '../../core/types.js';
import { renderRich, uid } from '../../core/utils.js';
import {
  DEFAULT_FORM_FIELD_LABELS,
  slugifyName,
  type FormFieldLabels,
} from '../form/field-model.js';
import { renderIcon } from '../primitives/lia-icon.js';
import { SETTINGS_ANCHOR_PREFIX, settingsGroupAnchor, type SettingsGroup } from './settings-model.js';
import '../form/form-section.js';

/**
 * One titled block of a settings page: the heading with its icon, an optional
 * explanation, and the group's settings rendered as `<lia-form-section>`
 * cards.
 *
 * The element is a pure pass-through for values — it renders `values[name]`
 * into every field and lets the fields' `lia-change` events bubble up to
 * whatever owns the value model (`<lia-settings-page>`, or a `<form>` of your
 * own). It never posts and never validates.
 *
 * Its `<section>` carries the anchor id the settings rail links to and is
 * focusable (`tabindex="-1"`), so jumping to a group moves the reading
 * position as well as the scroll offset.
 *
 * @example
 * ```ts
 * html`<lia-settings-group
 *   .group=${{
 *     id: 'sessions',
 *     title: 'Sessions',
 *     icon: 'fa-solid fa-clock',
 *     description: 'How long a signed-in session stays valid.',
 *     form: {
 *       sections: {
 *         main: {
 *           fields: {
 *             session_timeout: { type: 'number', label: 'Timeout (seconds)', value: 600, min: 60 },
 *             session_allow_multi: { type: 'switch', label: 'Allow parallel sessions' },
 *           },
 *         },
 *       },
 *     },
 *   }}
 *   .values=${values}
 *   .errors=${errors}
 * ></lia-settings-group>`
 * ```
 */
@customElement('lia-settings-group')
export class LiaSettingsGroup extends LiaElement {
  /** The group definition. */
  @property({ attribute: false }) group: SettingsGroup = {
    id: '',
    title: '',
    form: { sections: {} },
  };

  /** The value model of the surrounding form. */
  @property({ attribute: false }) values: FormValues = {};

  /** Validation messages by field name. */
  @property({ attribute: false }) errors: FormErrors = {};

  /** Overridable field-level strings, passed down to every field. */
  @property({ attribute: false }) labels: FormFieldLabels = DEFAULT_FORM_FIELD_LABELS;

  /** Disable every control in the group. */
  @property({ type: Boolean }) disabled = false;

  /** Render `visible: false` fields anyway, disabled. */
  @property({ type: Boolean, attribute: 'show-hidden' }) showHidden = false;

  /** Name of a single field to mark with `<mark>`, e.g. a deep-linked one. */
  @property({ type: String }) highlight = '';

  /** Prefix of the anchor id; must match the settings rail. */
  @property({ type: String, attribute: 'anchor-prefix' }) anchorPrefix = SETTINGS_ANCHOR_PREFIX;

  /** Drop the heading — for a page that titles its groups some other way. */
  @property({ type: Boolean, attribute: 'no-heading' }) noHeading = false;

  /** Heading level, so the page keeps a sensible document outline. */
  @property({ type: Number }) level: 2 | 3 | 4 | 5 | 6 = 2;

  /** Chip rendered next to the title when `group.activated === false`. */
  @property({ type: String, attribute: 'inactive-label' }) inactiveLabel = 'Not configured';

  /** Shown when the group ends up with no rows at all. */
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No settings here.';

  private readonly instanceId = uid('lia-settings-group');

  /** DOM id of the group's `<section>` — the target of its nav anchor. */
  get anchorId(): string {
    return this.group.id
      ? settingsGroupAnchor(this.group.id, this.anchorPrefix)
      : `${this.instanceId}-section`;
  }

  private get titleId(): string {
    return `${this.anchorId}-title`;
  }

  /**
   * Prefix handed to the field rows so two groups may declare the same field
   * name without colliding on DOM ids. Slugified, so it is also safe inside a
   * CSS selector.
   */
  get fieldIdPrefix(): string {
    return this.group.id ? slugifyName(this.group.id) : this.instanceId;
  }

  /** The sections that will actually be rendered. */
  get sections(): Array<[string, FormSection]> {
    return Object.entries(this.group.form?.sections ?? {}).filter(
      ([, section]) => this.showHidden || section.visible !== false
    );
  }

  private renderHeading(): unknown {
    if (this.noHeading || !this.group.title) return nothing;
    const inner = html`${renderIcon(this.group.icon, { class: 'me-2' })}${renderRich(
      this.group.title
    )}${this.group.activated === false
      ? html` <span class="badge text-bg-light align-middle">${this.inactiveLabel}</span>`
      : nothing}
    ${this.group.info ? html`<small class="ms-2">${renderRich(this.group.info)}</small>` : nothing}`;

    const classes = 'h5 mb-1 d-flex align-items-center flex-wrap gap-1';
    switch (this.level) {
      case 3:
        return html`<h3 id=${this.titleId} class=${classes}>${inner}</h3>`;
      case 4:
        return html`<h4 id=${this.titleId} class=${classes}>${inner}</h4>`;
      case 5:
        return html`<h5 id=${this.titleId} class=${classes}>${inner}</h5>`;
      case 6:
        return html`<h6 id=${this.titleId} class=${classes}>${inner}</h6>`;
      default:
        return html`<h2 id=${this.titleId} class=${classes}>${inner}</h2>`;
    }
  }

  protected override render(): unknown {
    const sections = this.sections;
    return html`<section
      id=${this.anchorId}
      class="lia-settings-group mb-4"
      tabindex="-1"
      aria-labelledby=${this.group.title && !this.noHeading ? this.titleId : nothing}
    >
      ${this.renderHeading()}
      ${this.group.description
        ? html`<p class="text-body-secondary">${renderRich(this.group.description)}</p>`
        : nothing}
      ${sections.length === 0
        ? html`<p class="text-body-secondary fst-italic">${this.emptyMessage}</p>`
        : sections.map(
            ([key, section]) => html`<lia-form-section
              .sectionId=${key}
              .section=${section}
              .values=${this.values}
              .errors=${this.errors}
              .labels=${this.labels}
              .disabled=${this.disabled}
              .showHidden=${this.showHidden}
              .highlight=${this.highlight}
              .idPrefix=${this.fieldIdPrefix}
            ></lia-form-section>`
          )}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lia-settings-group': LiaSettingsGroup;
  }
}
