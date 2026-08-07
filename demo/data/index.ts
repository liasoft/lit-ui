/**
 * Mock data for the demo, in one import.
 *
 * Every module here is domain-neutral on purpose: the fictional subject is an
 * "Orbit" operations console, so nothing in the kit's demo reads as a port of
 * any particular product. All of it is strongly typed against `core/types.ts`
 * (and, where a family declares its own shapes, against that family's types).
 *
 * ```ts
 * import { demoUsers, everyFieldTypeForm, resourceItems } from '../data/index.js';
 * ```
 */

export * from './nav.js';
export * from './users.js';
export * from './projects.js';
export * from './forms.js';
export * from './dashboard.js';
export * from './settings.js';
export * from './logs.js';
export * from './records.js';
export * from './traffic.js';
