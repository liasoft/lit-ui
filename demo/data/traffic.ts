/**
 * Usage-over-time fixtures for `<lia-traffic-view>`.
 *
 * Three granularities over the same two metrics, so the period selector has
 * something real to switch between, plus a single-metric variant for the
 * "one series is enough" case.
 */

import type { UsageMetric, UsagePeriod, UsageSeriesPoint } from '@liasoft/lit-ui';

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

/** The two measured quantities. Colours come from the component's palette. */
export const usageMetrics: UsageMetric[] = [
  { key: 'in', label: 'Inbound' },
  { key: 'out', label: 'Outbound' },
];

/** A third metric, for the "how does a chart cope with more series?" example. */
export const usageMetricsExtended: UsageMetric[] = [
  { key: 'in', label: 'Inbound' },
  { key: 'out', label: 'Outbound' },
  { key: 'cache', label: 'Served from cache' },
];

/** The period selector — the same three granularities the data provides. */
export const usagePeriods: UsagePeriod[] = [
  { value: 'day', label: 'Last 30 days' },
  { value: 'month', label: 'Last 12 months' },
  { value: 'year', label: 'Last 5 years' },
];

/* ------------------------------------------------------------------ *
 * Series
 * ------------------------------------------------------------------ */

/** Deterministic pseudo-random sequence, so the charts never jitter. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_103_515_245 + 12_345) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function buildDays(count: number): UsageSeriesPoint[] {
  const random = seeded(0xc0ffee);
  const end = Date.UTC(2026, 6, 1);
  const points: UsageSeriesPoint[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const factor = weekend ? 0.55 : 1;
    const inbound = Math.round((14 + random() * 10) * factor * GIB);
    const outbound = Math.round((38 + random() * 22) * factor * GIB);
    points.push({
      label: date.toISOString().slice(5, 10).replace('-', '/'),
      values: {
        in: inbound,
        out: outbound,
        cache: Math.round(outbound * (0.55 + random() * 0.2)),
      },
    });
  }
  return points;
}

/** 30 daily buckets. */
export const usageByDay: UsageSeriesPoint[] = buildDays(30);

/** 12 monthly buckets, matching the dashboard's transfer chart. */
export const usageByMonth: UsageSeriesPoint[] = [
  { label: 'Aug 25', values: { in: 2.1 * 1024 * GIB, out: 5.4 * 1024 * GIB, cache: 3.1 * 1024 * GIB } },
  { label: 'Sep 25', values: { in: 2.4 * 1024 * GIB, out: 5.9 * 1024 * GIB, cache: 3.4 * 1024 * GIB } },
  { label: 'Oct 25', values: { in: 2.2 * 1024 * GIB, out: 5.6 * 1024 * GIB, cache: 3.2 * 1024 * GIB } },
  { label: 'Nov 25', values: { in: 2.8 * 1024 * GIB, out: 6.8 * 1024 * GIB, cache: 4.0 * 1024 * GIB } },
  { label: 'Dec 25', values: { in: 3.4 * 1024 * GIB, out: 8.1 * 1024 * GIB, cache: 5.1 * 1024 * GIB } },
  { label: 'Jan 26', values: { in: 2.9 * 1024 * GIB, out: 7.2 * 1024 * GIB, cache: 4.4 * 1024 * GIB } },
  { label: 'Feb 26', values: { in: 3.1 * 1024 * GIB, out: 7.6 * 1024 * GIB, cache: 4.6 * 1024 * GIB } },
  { label: 'Mar 26', values: { in: 3.6 * 1024 * GIB, out: 8.4 * 1024 * GIB, cache: 5.2 * 1024 * GIB } },
  { label: 'Apr 26', values: { in: 3.9 * 1024 * GIB, out: 9.1 * 1024 * GIB, cache: 5.7 * 1024 * GIB } },
  { label: 'May 26', values: { in: 4.2 * 1024 * GIB, out: 9.8 * 1024 * GIB, cache: 6.2 * 1024 * GIB } },
  { label: 'Jun 26', values: { in: 4.0 * 1024 * GIB, out: 9.4 * 1024 * GIB, cache: 5.9 * 1024 * GIB } },
  { label: 'Jul 26', values: { in: 4.4 * 1024 * GIB, out: 10.2 * 1024 * GIB, cache: 6.5 * 1024 * GIB } },
];

/** Five yearly buckets. */
export const usageByYear: UsageSeriesPoint[] = [
  { label: '2022', values: { in: 9 * 1024 * GIB, out: 21 * 1024 * GIB, cache: 11 * 1024 * GIB } },
  { label: '2023', values: { in: 17 * 1024 * GIB, out: 44 * 1024 * GIB, cache: 26 * 1024 * GIB } },
  { label: '2024', values: { in: 24 * 1024 * GIB, out: 61 * 1024 * GIB, cache: 37 * 1024 * GIB } },
  { label: '2025', values: { in: 33 * 1024 * GIB, out: 82 * 1024 * GIB, cache: 51 * 1024 * GIB } },
  { label: '2026', values: { in: 22 * 1024 * GIB, out: 56 * 1024 * GIB, cache: 35 * 1024 * GIB } },
];

/** The series a period identifier selects. */
export const usageByPeriod: Record<string, UsageSeriesPoint[]> = {
  day: usageByDay,
  month: usageByMonth,
  year: usageByYear,
};

/** Look a period up, falling back to the monthly series. */
export function usageFor(period: string): UsageSeriesPoint[] {
  return usageByPeriod[period] ?? usageByMonth;
}

/* ------------------------------------------------------------------ *
 * Non-byte usage
 * ------------------------------------------------------------------ */

/** Plain counts rather than bytes — the `format: 'number'` case. */
export const requestMetrics: UsageMetric[] = [
  { key: 'ok', label: 'Successful' },
  { key: 'client', label: 'Client errors' },
  { key: 'server', label: 'Server errors' },
];

/** Requests per day for the same 30-day window. */
export const requestsByDay: UsageSeriesPoint[] = usageByDay.map((point, index) => {
  const total = 3_400_000 + ((index * 137_000) % 900_000);
  const server = index === 22 ? 21_400 : 900 + ((index * 311) % 1_600);
  const client = 41_000 + ((index * 977) % 12_000);
  return {
    label: point.label,
    values: { ok: total - client - server, client, server },
  };
});

/** A small series for a compact example. */
export const requestsCompact: UsageSeriesPoint[] = requestsByDay.slice(-7);

/** An empty series, so the empty state can be demonstrated. */
export const usageEmpty: UsageSeriesPoint[] = [];

/** Storage growth in megabytes, for a single-metric chart. */
export const storageGrowth: UsageSeriesPoint[] = [
  { label: 'Feb', values: { used: 940_000 * MIB } },
  { label: 'Mar', values: { used: 1_020_000 * MIB } },
  { label: 'Apr', values: { used: 1_180_000 * MIB } },
  { label: 'May', values: { used: 1_390_000 * MIB } },
  { label: 'Jun', values: { used: 1_520_000 * MIB } },
  { label: 'Jul', values: { used: 1_655_000 * MIB } },
];

/** The single metric {@link storageGrowth} carries. */
export const storageMetrics: UsageMetric[] = [{ key: 'used', label: 'Stored' }];
