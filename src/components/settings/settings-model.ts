/**
 * The pure, DOM-free half of the settings family: what a settings *group* is,
 * how a live filter narrows one down, and how a match is marked up.
 *
 * Everything here is a plain function, so the filtering behaviour of
 * `<lia-settings-page>` can be unit-tested — or reused by a server renderer —
 * without touching a component.
 */

import type {
  FormDefinition,
  FormField,
  FormSection,
  IconName,
  NavItem,
  Variant,
} from '../../core/types.js';
import { fieldLabelDescription, fieldLabelTitle, slugifyName } from '../form/field-model.js';

/* ------------------------------------------------------------------ *
 * The group model
 * ------------------------------------------------------------------ */

/**
 * One titled block of settings — the unit `<lia-settings-page>` renders, the
 * secondary rail links to, and the filter keeps or hides as a whole.
 *
 * A group owns a complete {@link FormDefinition} rather than a bare field
 * record, so a large group can still split itself into several cards.
 */
export interface SettingsGroup {
  /** Stable key; becomes the anchor target and the nav entry's id. */
  id: string;
  /** Heading above the group's cards. Trusted HTML. */
  title: string;
  /** Icon-font class rendered before the title. */
  icon?: IconName;
  /** Explanatory line under the heading. Trusted HTML. */
  description?: string;
  /** `false` removes the group from the page and from the value model. */
  visible?: boolean;
  /**
   * `false` renders a muted "not configured" chip on the group — the state a
   * settings block is in while the feature it configures is switched off.
   */
  activated?: boolean;
  /** Extra note shown beside the title in overview layouts. Trusted HTML. */
  info?: string;
  /** Counter chip on the nav entry, e.g. the number of changed settings. */
  badge?: { text: string | number; variant?: Variant };
  /** The settings themselves. */
  form: FormDefinition;
}

/** One entry of `<lia-settings-nav>`. */
export interface SettingsNavEntry {
  id: string;
  label: string;
  icon?: IconName;
  badge?: { text: string | number; variant?: Variant };
  visible?: boolean;
}

/** Default prefix of the DOM ids `<lia-settings-group>` anchors itself with. */
export const SETTINGS_ANCHOR_PREFIX = 'settings';

/**
 * The DOM id a group's `<section>` carries — the target of its nav anchor.
 *
 * @example
 * ```ts
 * settingsGroupAnchor('system.mail'); // → 'settings-system-mail'
 * ```
 */
export function settingsGroupAnchor(id: string, prefix = SETTINGS_ANCHOR_PREFIX): string {
  const slug = slugifyName(id);
  return prefix ? `${prefix}-${slug}` : slug;
}

/** `visible !== false` — groups are shown unless explicitly hidden. */
export function isGroupVisible(group: SettingsGroup): boolean {
  return group.visible !== false;
}

/** Every field of a group, `nextTo` siblings included, in declaration order. */
export function groupFields(group: SettingsGroup): Array<[string, FormField]> {
  const result: Array<[string, FormField]> = [];
  const push = (name: string, field: FormField): void => {
    result.push([name, field]);
    for (const [siblingName, sibling] of Object.entries(field.nextTo ?? {})) {
      push(siblingName, sibling);
    }
  };
  for (const section of Object.values(group.form?.sections ?? {})) {
    for (const [name, field] of Object.entries(section.fields ?? {})) push(name, field);
  }
  return result;
}

/**
 * Fold a list of groups into one {@link FormDefinition}.
 *
 * `<lia-settings-page>` renders each group itself, but it still needs a single
 * definition to seed its value model from and to validate against; section
 * keys are namespaced with the group id so two groups may use the same one.
 */
export function settingsDefinition(groups: readonly SettingsGroup[]): FormDefinition {
  const sections: Record<string, FormSection> = {};
  for (const group of groups) {
    const hidden = !isGroupVisible(group);
    for (const [key, section] of Object.entries(group.form?.sections ?? {})) {
      sections[`${group.id}.${key}`] = hidden ? { ...section, visible: false } : section;
    }
  }
  return { sections };
}

/** Nav entries for a list of groups, skipping the hidden ones. */
export function settingsNavEntries(groups: readonly SettingsGroup[]): SettingsNavEntry[] {
  return groups.filter(isGroupVisible).map((group) => ({
    id: group.id,
    label: group.title,
    icon: group.icon,
    badge: group.badge,
  }));
}

/** Nav entries as {@link NavItem}s, ready for `<lia-sub-sidebar>`. */
export function settingsNavItems(
  entries: readonly SettingsNavEntry[],
  active: string,
  hrefPrefix = '#',
  anchorPrefix = SETTINGS_ANCHOR_PREFIX
): NavItem[] {
  return entries
    .filter((entry) => entry.visible !== false)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: entry.icon,
      badge: entry.badge,
      url: `${hrefPrefix}${settingsGroupAnchor(entry.id, anchorPrefix)}`,
      active: entry.id === active,
    }));
}

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */

/** Normalise a user-typed filter: trimmed and lower-cased. */
export function normaliseFilter(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase();
}

/** Drop tags from a trusted-HTML label so the filter matches its text. */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markSegment(text: string, needle: string): string {
  if (text === '') return text;
  const expression = new RegExp(escapeRegExp(needle), 'gi');
  return text.replace(expression, (match) => `<mark>${match}</mark>`);
}

/**
 * Wrap every occurrence of `needle` in `<mark>`, leaving any markup in
 * `value` intact — matching happens in the text between tags only, so a label
 * that already contains `<strong>` or a link survives highlighting.
 *
 * The result is trusted HTML, exactly like the input.
 *
 * @example
 * ```ts
 * highlightMatches('Session <b>timeout</b>', 'time');
 * // → 'Session <b><mark>time</mark>out</b>'
 * ```
 */
export function highlightMatches(value: string, needle: string): string {
  if (!needle || value === '') return value;
  let result = '';
  let cursor = 0;
  for (const match of value.matchAll(/<[^>]*>/g)) {
    const index = match.index ?? 0;
    result += markSegment(value.slice(cursor, index), needle) + match[0];
    cursor = index + match[0].length;
  }
  return result + markSegment(value.slice(cursor), needle);
}

/** Everything about a field the filter looks at, flattened to plain text. */
export function fieldHaystack(name: string, field: FormField): string {
  const parts: string[] = [name, fieldLabelTitle(field), fieldLabelDescription(field) ?? ''];
  if (field.desc) parts.push(field.desc);
  if (field.note) parts.push(field.note);
  if (field.placeholder) parts.push(field.placeholder);
  if (field.priorInfotext) parts.push(field.priorInfotext);
  for (const option of field.options ?? field.values ?? []) parts.push(option.label);
  for (const [siblingName, sibling] of Object.entries(field.nextTo ?? {})) {
    parts.push(fieldHaystack(siblingName, sibling));
  }
  return stripTags(parts.join(' ')).toLowerCase();
}

/** Does a field match an already-normalised filter? */
export function fieldMatchesFilter(name: string, field: FormField, needle: string): boolean {
  if (!needle) return true;
  return fieldHaystack(name, field).includes(needle);
}

function highlightField(field: FormField, needle: string): FormField {
  const next: FormField = { ...field };
  if (typeof field.label === 'string') {
    next.label = highlightMatches(field.label, needle);
  } else if (field.label) {
    next.label = {
      ...field.label,
      title: highlightMatches(field.label.title, needle),
      description: field.label.description
        ? highlightMatches(field.label.description, needle)
        : field.label.description,
    };
  }
  if (field.desc) next.desc = highlightMatches(field.desc, needle);
  if (field.note) next.note = highlightMatches(field.note, needle);
  if (field.nextTo) {
    const siblings: Record<string, FormField & { prefix?: string }> = {};
    for (const [name, sibling] of Object.entries(field.nextTo)) {
      siblings[name] = highlightField(sibling, needle) as FormField & { prefix?: string };
    }
    next.nextTo = siblings;
  }
  return next;
}

/** Options for {@link filterSettingsGroup}. */
export interface SettingsFilterOptions {
  /** Wrap matches in `<mark>`. Defaults to `true`. */
  highlight?: boolean;
  /**
   * A group whose *title* matches keeps all of its settings instead of only
   * the individually matching ones. Defaults to `true`.
   */
  matchWholeGroup?: boolean;
}

/**
 * Narrow one group to the settings matching `needle`, or return `undefined`
 * when nothing in it matches.
 *
 * The returned group is a copy: the caller's definition is never mutated.
 */
export function filterSettingsGroup(
  group: SettingsGroup,
  needle: string,
  options: SettingsFilterOptions = {}
): SettingsGroup | undefined {
  if (!needle) return group;

  const highlight = options.highlight !== false;
  const wholeGroup =
    options.matchWholeGroup !== false && stripTags(group.title).toLowerCase().includes(needle);

  const sections: Record<string, FormSection> = {};
  let kept = 0;

  for (const [key, section] of Object.entries(group.form?.sections ?? {})) {
    const sectionMatches =
      wholeGroup || stripTags(section.title ?? '').toLowerCase().includes(needle);
    const fields: Record<string, FormField> = {};
    for (const [name, field] of Object.entries(section.fields ?? {})) {
      if (!sectionMatches && !fieldMatchesFilter(name, field, needle)) continue;
      fields[name] = highlight ? highlightField(field, needle) : field;
      kept += 1;
    }
    if (Object.keys(fields).length === 0) continue;
    sections[key] = {
      ...section,
      title: section.title && highlight ? highlightMatches(section.title, needle) : section.title,
      fields,
    };
  }

  if (kept === 0) return undefined;

  return {
    ...group,
    title: highlight ? highlightMatches(group.title, needle) : group.title,
    form: { ...group.form, sections },
  };
}

/**
 * Apply a filter to a whole list of groups. Hidden groups are dropped, empty
 * ones disappear, and an empty filter returns the list unchanged.
 *
 * @example
 * ```ts
 * const shown = filterSettingsGroups(groups, normaliseFilter(query));
 * ```
 */
export function filterSettingsGroups(
  groups: readonly SettingsGroup[],
  needle: string,
  options: SettingsFilterOptions = {}
): SettingsGroup[] {
  const visible = groups.filter(isGroupVisible);
  if (!needle) return visible;
  const result: SettingsGroup[] = [];
  for (const group of visible) {
    const filtered = filterSettingsGroup(group, needle, options);
    if (filtered) result.push(filtered);
  }
  return result;
}
