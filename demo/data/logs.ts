/**
 * Log, code and diff fixtures for the editors demos.
 *
 * The log lines cover all four severities plus a few unclassified ones, so the
 * viewer's level filter and its auto-classification both have something to do.
 */

import type { LogLine } from '@liasoft/lit-ui';

const START = Date.UTC(2026, 6, 1, 4, 12, 0);

function at(secondsIn: number): number {
  return START + secondsIn * 1000;
}

/**
 * Structured log entries — a plausible morning on a control-plane host.
 *
 * @example
 * ```ts
 * html`<lia-log-viewer .lines=${demoLogLines} follow></lia-log-viewer>`;
 * ```
 */
export const demoLogLines: LogLine[] = [
  { ts: at(0), level: 'info', source: 'orbit-agent', text: 'starting agent 4.12.0 (linux/arm64)' },
  { ts: at(1), level: 'info', source: 'orbit-agent', text: 'loaded configuration from /etc/orbit/agent.toml' },
  { ts: at(1), level: 'debug', source: 'orbit-agent', text: 'telemetry interval set to 15s' },
  { ts: at(2), level: 'info', source: 'orbit-agent', text: 'registered host host-eu-central-014 in region eu-central' },
  { ts: at(4), level: 'info', source: 'scheduler', text: 'reconciling 31 services' },
  { ts: at(5), level: 'debug', source: 'scheduler', text: 'service checkout: desired=6 running=6 draining=0' },
  { ts: at(5), level: 'debug', source: 'scheduler', text: 'service ledger: desired=4 running=3 draining=0' },
  { ts: at(6), level: 'warning', source: 'scheduler', text: 'service ledger is below its desired replica count' },
  { ts: at(7), level: 'info', source: 'scheduler', text: 'scheduling ledger-7c9f on host-eu-central-021' },
  { ts: at(12), level: 'info', source: 'scheduler', text: 'service ledger: desired=4 running=4' },
  { ts: at(30), level: 'info', source: 'backup', text: 'nightly backup started (snapshot 2026-07-01T02:15Z)' },
  { ts: at(38), level: 'debug', source: 'backup', text: 'volume vol-eu-central-041: 780 GiB, 41 231 objects' },
  { ts: at(94), level: 'warning', source: 'backup', text: 'volume vol-eu-central-058 is still attached; using a crash-consistent snapshot' },
  { ts: at(760), level: 'info', source: 'backup', text: 'nightly backup completed: 1.61 TiB written in 12m40s' },
  { ts: at(802), level: 'error', source: 'edge', text: 'upstream 10.0.4.18:8443 returned 502 for GET /v2/checkout/session' },
  { ts: at(803), level: 'error', source: 'edge', text: 'upstream 10.0.4.18:8443 returned 502 for POST /v2/checkout/confirm' },
  { ts: at(804), level: 'warning', source: 'edge', text: 'marking upstream 10.0.4.18:8443 unhealthy after 5 consecutive failures' },
  { ts: at(805), level: 'info', source: 'edge', text: 'draining traffic to 10.0.4.19:8443 and 10.0.4.20:8443' },
  { ts: at(806), level: 'error', source: 'alerting', text: 'alert "edge 5xx rate" fired: 0.61% over 5m (threshold 0.5%)' },
  { ts: at(830), level: 'info', source: 'alerting', text: 'notified 3 recipients over email, 1 over webhook' },
  { ts: at(910), level: 'info', source: 'edge', text: 'upstream 10.0.4.18:8443 passed 3 health checks; restoring' },
  { ts: at(915), level: 'info', source: 'alerting', text: 'alert "edge 5xx rate" resolved after 1m49s' },
  { ts: at(1_400), level: 'debug', source: 'orbit-agent', text: 'gc: 41 MiB reclaimed in 3.2ms' },
  { ts: at(1_800), level: 'info', source: 'api', text: 'POST /v2/members 201 in 84ms (actor a.okonkwo)' },
  { ts: at(1_801), level: 'info', source: 'api', text: 'DELETE /v2/keys/key_9f21c7 204 in 22ms (actor a.okonkwo)' },
  { ts: at(1_940), level: 'warning', source: 'api', text: 'rate limit reached for token key_2b71ef (600 req/60s)' },
  { ts: at(2_100), level: 'info', source: 'scheduler', text: 'release checkout v2.31.0: rollout 25%' },
  { ts: at(2_160), level: 'info', source: 'scheduler', text: 'release checkout v2.31.0: rollout 50%' },
  { ts: at(2_220), level: 'info', source: 'scheduler', text: 'release checkout v2.31.0: rollout 100%' },
  { ts: at(2_400), level: 'debug', source: 'orbit-agent', text: 'heartbeat ok (rtt 11ms)' },
];

/**
 * The same kind of output as one blob of unstructured text — what a viewer
 * gets when it tails a file rather than a structured stream.
 */
export const demoLogText = [
  '2026-07-01T04:12:00Z  INFO  orbit-agent  starting agent 4.12.0 (linux/arm64)',
  '2026-07-01T04:12:02Z  INFO  orbit-agent  registered host host-eu-central-014',
  '2026-07-01T04:12:06Z  WARN  scheduler    service ledger is below its desired replica count',
  '2026-07-01T04:25:22Z  ERROR edge         upstream 10.0.4.18:8443 returned 502 for GET /v2/checkout/session',
  '2026-07-01T04:25:26Z  ERROR alerting     alert "edge 5xx rate" fired: 0.61% over 5m',
  '2026-07-01T04:27:15Z  INFO  alerting     alert "edge 5xx rate" resolved after 1m49s',
  '2026-07-01T04:43:20Z  DEBUG orbit-agent  gc: 41 MiB reclaimed in 3.2ms',
].join('\n');

/** A short stack trace, for the report form and the code block. */
export const demoStackTrace = [
  'RequestError: upstream returned 502',
  '    at Gateway.forward (/srv/orbit/edge/gateway.js:184:15)',
  '    at async Router.handle (/srv/orbit/edge/router.js:92:20)',
  '    at async Server.<anonymous> (/srv/orbit/edge/server.js:41:5)',
  '  caused by: SocketError: other side closed',
  '    at TLSSocket.onceEndNT (node:internal/streams/readable:1400:12)',
].join('\n');

/* ------------------------------------------------------------------ *
 * Code & diffs
 * ------------------------------------------------------------------ */

/** A configuration file, before an edit. */
export const configBefore = [
  '[agent]',
  'id      = "host-eu-central-014"',
  'region  = "eu-central"',
  'token   = "REPLACE_ME"',
  '',
  '[telemetry]',
  'metrics  = true',
  'logs     = true',
  'traces   = false',
  'interval = "30s"',
  '',
  '[limits]',
  'max_memory = "256MiB"',
  'max_cpu    = 0.5',
  '',
  '[log]',
  'level = "info"',
].join('\n');

/** The same file, after the edit the diff demo shows. */
export const configAfter = [
  '[agent]',
  'id      = "host-eu-central-014"',
  'region  = "eu-central"',
  'token   = "orbit_agent_2f8c41d0a97b"',
  '',
  '[telemetry]',
  'metrics  = true',
  'logs     = true',
  'traces   = true',
  'interval = "15s"',
  'sample   = 0.25',
  '',
  '[limits]',
  'max_memory = "512MiB"',
  'max_cpu    = 1.0',
  '',
  '[log]',
  'level  = "debug"',
  'format = "json"',
].join('\n');

/** A TypeScript sample for the syntax-free code block. */
export const codeSample = [
  "import { createCrudController } from '@liasoft/lit-ui';",
  '',
  'const crud = createCrudController<Member>({',
  "  id: 'members',",
  '  columns,',
  '  fetch: ({ page, search, signal }) =>',
  '    api.members({ page, q: search?.text }, signal),',
  '  onChange: () => host.requestUpdate(),',
  '  autoLoad: true,',
  '});',
].join('\n');
