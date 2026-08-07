import { html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import type {
  ActionDescriptor,
  BadgeCellValue,
  BooleanWithInfoCellValue,
  CellRenderer,
  DomainWithSanCellValue,
  IconName,
  LinkCellValue,
  ProgressCellValue,
  TableColumn,
  Variant,
} from '../../core/types.js';
import { cx, formatBytes, get, renderRich } from '../../core/utils.js';
import { renderBadge } from '../primitives/lia-badge.js';
import { renderActions } from '../primitives/render-action.js';
import '../primitives/lia-progress.js';

/* ------------------------------------------------------------------ *
 * Formatting options
 * ------------------------------------------------------------------ */

/**
 * Every piece of text and every glyph a cell renderer can emit on its own.
 *
 * Nothing here is baked in: a table in another language (or another icon set)
 * overrides the entries it cares about and inherits the rest.
 */
export interface CellFormatOptions {
  /** BCP-47 tag for date and number formatting. Defaults to the browser locale. */
  locale?: string;
  /** Shown for `null`, `undefined` and empty strings. */
  emptyText?: string;
  /** Shown for a zero timestamp — the "this never happened" case. */
  neverText?: string;
  /** Accessible name of the `boolean` tick. */
  trueLabel?: string;
  /** Accessible name of the `boolean` cross. */
  falseLabel?: string;
  trueIcon?: IconName;
  falseIcon?: IconName;
  /** Contextual colour of the tick. */
  trueVariant?: Variant;
  /** Contextual colour of the cross. */
  falseVariant?: Variant;
  /** Decimals passed to {@link formatBytes}. */
  byteDecimals?: number;
  /** `Intl.DateTimeFormat` options for the `date` renderer. */
  dateOptions?: Intl.DateTimeFormatOptions;
  /** `Intl.DateTimeFormat` options for the `datetime` renderer. */
  datetimeOptions?: Intl.DateTimeFormatOptions;
  /** Accessible name of the (i) trigger on a progress cell. */
  infoLabel?: string;
  /** Prefix of the second line of a `domainWithSan` cell. */
  sanLabel?: string;
}

/** The defaults every renderer falls back to. */
export const DEFAULT_CELL_FORMAT: Readonly<Required<Omit<CellFormatOptions, 'locale'>>> =
  Object.freeze({
    emptyText: '—',
    neverText: 'Never',
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueIcon: 'fa-solid fa-circle-check',
    falseIcon: 'fa-solid fa-circle-xmark',
    trueVariant: 'success',
    falseVariant: 'danger',
    byteDecimals: 2,
    dateOptions: { dateStyle: 'medium' } as Intl.DateTimeFormatOptions,
    datetimeOptions: { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions,
    infoLabel: 'More information',
    sanLabel: 'SAN',
  });

/** Everything a renderer needs besides the value itself. */
export interface CellRenderContext<Row = Record<string, unknown>> {
  /** The column being rendered — supplies the label, classes and `render()`. */
  column: TableColumn<Row>;
  /** The whole row, handed to `column.render()` and to row actions. */
  row?: Row;
  /** Position of the row on the current page. */
  index?: number;
  /** Element the `lia-action` event of an `actions` cell is dispatched from. */
  host?: EventTarget;
  /** Overrides for the built-in strings and glyphs. */
  format?: CellFormatOptions;
}

/* ------------------------------------------------------------------ *
 * Value coercion
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Loose truthiness: booleans, `0`/`1`, and the usual `"y"`/`"yes"`/`"true"` strings. */
export function toCellBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    return (
      normalised === '1' ||
      normalised === 'y' ||
      normalised === 'yes' ||
      normalised === 'true' ||
      normalised === 'on'
    );
  }
  return Boolean(value);
}

/** Numeric value of a cell, accepting numeric strings. `undefined` when not a number. */
export function toCellNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Interpret a cell value as a point in time.
 *
 * Accepts `Date`s, ISO strings and epoch numbers — sub-`1e11` numbers are read
 * as **seconds** (the convention of most panel back-ends), larger ones as
 * milliseconds. A literal `0` is reported as `'never'` rather than 1970.
 */
export function toCellDate(value: unknown): Date | 'never' | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    if (value === 0) return 'never';
    return new Date(value < 1e11 ? value * 1000 : value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    if (/^-?\d+$/.test(trimmed)) return toCellDate(Number(trimmed));
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function toLink(value: unknown): LinkCellValue | undefined {
  if (typeof value === 'string') return value === '' ? undefined : { href: value, text: value };
  if (isRecord(value) && typeof value['href'] === 'string') return value as unknown as LinkCellValue;
  return undefined;
}

function toBadge(value: unknown): BadgeCellValue | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return value === '' ? undefined : { text: String(value) };
  }
  if (isRecord(value) && value['text'] !== undefined) {
    return {
      text: String(value['text']),
      variant: value['variant'] as Variant | undefined,
      icon: value['icon'] as IconName | undefined,
    };
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function resolveFormat(options: CellFormatOptions | undefined): Required<CellFormatOptions> {
  const resolved: Record<string, unknown> = { locale: '', ...DEFAULT_CELL_FORMAT };
  // An explicit `undefined` must not erase a default, so only defined keys win.
  for (const [key, value] of Object.entries(options ?? {})) {
    if (value !== undefined) resolved[key] = value;
  }
  return resolved as Required<CellFormatOptions>;
}

function formatDate(
  value: unknown,
  format: Required<CellFormatOptions>,
  intlOptions: Intl.DateTimeFormatOptions
): unknown {
  const date = toCellDate(value);
  if (date === undefined) return format.emptyText;
  if (date === 'never') return format.neverText;
  const locale = format.locale || undefined;
  return new Intl.DateTimeFormat(locale, intlOptions).format(date);
}

function renderBoolean(value: boolean, format: Required<CellFormatOptions>): unknown {
  const label = value ? format.trueLabel : format.falseLabel;
  const variant = value ? format.trueVariant : format.falseVariant;
  return html`<i
    class=${cx(value ? format.trueIcon : format.falseIcon, `text-${variant}`)}
    role="img"
    aria-label=${label}
    title=${label}
  ></i>`;
}

function renderProgress(
  value: unknown,
  format: Required<CellFormatOptions>,
  column: TableColumn
): unknown {
  if (!isRecord(value)) return format.emptyText;
  const data = value as unknown as ProgressCellValue;
  return html`<lia-progress
    thin
    percent=${data.percent ?? 0}
    variant=${data.style ?? ''}
    text=${data.text ?? ''}
    infotext=${data.infotext ?? ''}
    bar-label=${column.label}
    infotext-label=${format.infoLabel}
  ></lia-progress>`;
}

function renderLink(value: unknown, format: Required<CellFormatOptions>): unknown {
  const link = toLink(value);
  if (!link) return format.emptyText;
  const external = link.target === '_blank';
  return html`<a
    href=${link.href}
    class=${ifDefined(link.class)}
    target=${ifDefined(link.target)}
    rel=${ifDefined(external ? 'noopener noreferrer' : undefined)}
    title=${ifDefined(link.title)}
    >${link.icon ? html`<i class=${link.icon} aria-hidden="true"></i> ` : nothing}${link.text ??
    link.href}</a
  >`;
}

function renderDomainWithSan(value: unknown, format: Required<CellFormatOptions>): unknown {
  const data: DomainWithSanCellValue =
    typeof value === 'string'
      ? { domain: value }
      : isRecord(value)
        ? {
            domain: String(value['domain'] ?? ''),
            san: isEmpty(value['san']) ? undefined : String(value['san']),
          }
        : { domain: '' };
  if (!data.domain) return format.emptyText;
  return html`<span class="lia-cell-domain">${data.domain}</span>${data.san
      ? html`<span class="d-block small text-body-secondary">${format.sanLabel}: ${data.san}</span>`
      : nothing}`;
}

/**
 * Render one value with one {@link CellRenderer}.
 *
 * Pure and side-effect free — hand it a value and a context and it gives back
 * a renderable. That is what makes the whole cell layer unit-testable without
 * mounting a table.
 *
 * @example
 * ```ts
 * renderCellValue(1_073_741_824, 'bytes', { column: { key: 'size', label: 'Size' } });
 * // → "1 GiB"
 * ```
 */
export function renderCellValue<Row = Record<string, unknown>>(
  value: unknown,
  renderer: CellRenderer,
  context: CellRenderContext<Row>
): unknown {
  const format = resolveFormat(context.format);
  const column = context.column as TableColumn;

  switch (renderer) {
    case 'html':
      return isEmpty(value) ? format.emptyText : renderRich(String(value));

    case 'boolean':
      return renderBoolean(toCellBoolean(value), format);

    case 'booleanWithInfo': {
      const data = (isRecord(value) ? value : { checked: value }) as unknown as BooleanWithInfoCellValue;
      return html`${renderBoolean(toCellBoolean(data.checked), format)}${data.info
        ? html` <span class="ms-1">${data.info}</span>`
        : nothing}`;
    }

    case 'progressbar':
      return renderProgress(value, format, column);

    case 'link':
      return renderLink(value, format);

    case 'badge': {
      const badge = toBadge(value);
      if (!badge) return format.emptyText;
      return renderBadge(badge.text, { variant: badge.variant, icon: badge.icon });
    }

    case 'badges': {
      const list = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
      const badges = list
        .map(toBadge)
        .filter((badge): badge is BadgeCellValue => badge !== undefined);
      if (badges.length === 0) return format.emptyText;
      return html`<span class="d-inline-flex flex-wrap gap-1"
        >${badges.map((badge) =>
          renderBadge(badge.text, { variant: badge.variant, icon: badge.icon })
        )}</span
      >`;
    }

    case 'actions': {
      const actions = Array.isArray(value) ? (value as ActionDescriptor[]) : [];
      if (actions.length === 0) return nothing;
      return renderActions(actions, {
        host: context.host,
        size: 'sm',
        row: context.row,
        index: context.index,
      });
    }

    case 'bytes': {
      const bytes = toCellNumber(value);
      return bytes === undefined ? format.emptyText : formatBytes(bytes, format.byteDecimals);
    }

    case 'date':
      return formatDate(value, format, format.dateOptions);

    case 'datetime':
      return formatDate(value, format, format.datetimeOptions);

    case 'code':
      return isEmpty(value) ? format.emptyText : html`<code>${String(value)}</code>`;

    case 'domainWithSan':
      return renderDomainWithSan(value, format);

    case 'custom':
      return context.row === undefined
        ? nothing
        : (context.column.render?.(context.row, context.column) ?? nothing);

    case 'text':
    default:
      return isEmpty(value) ? format.emptyText : String(value);
  }
}

/** The raw value behind a column, resolved through its (possibly dotted) `key`. */
export function cellValue<Row>(row: Row, column: TableColumn<Row>): unknown {
  return get(row, column.key);
}

/**
 * Render the cell for one row/column pair.
 *
 * `column.render()` always wins; otherwise `column.renderer` selects one of the
 * built-ins and `text` is the fallback.
 *
 * @example
 * ```ts
 * html`<td>${renderCell(row, column, { index, host: this })}</td>`;
 * ```
 */
export function renderCell<Row = Record<string, unknown>>(
  row: Row,
  column: TableColumn<Row>,
  context: Omit<CellRenderContext<Row>, 'column' | 'row'> = {}
): unknown {
  if (column.render) return column.render(row, column) ?? nothing;
  return renderCellValue(cellValue(row, column), column.renderer ?? 'text', {
    ...context,
    column,
    row,
  });
}
