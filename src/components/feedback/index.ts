/**
 * Feedback family — everything the UI uses to talk back to the user.
 *
 * | Element                 | What it is                                          |
 * | ----------------------- | --------------------------------------------------- |
 * | `<lia-alert>`           | a contextual message with icon, actions and dismiss   |
 * | `<lia-alert-stack>`     | a list of alerts with per-item dismissal              |
 * | `<lia-banner>`          | the full-bleed strip docked above the navbar          |
 * | `<lia-modal>`           | a property-driven Bootstrap modal                     |
 * | `<lia-confirm-dialog>`  | the promise-returning "are you sure?" flow            |
 * | `<lia-toast>`           | a single Bootstrap toast                              |
 * | `<lia-toast-container>` | the fixed, stacking toast region                      |
 * | `<lia-hint>`            | the diagnostic / remediation panel                    |
 * | `<lia-error-boundary>`  | renders a hint instead of a blank area on failure     |
 *
 * Imperative escape hatches: {@link confirmAction}, {@link installConfirmHandler}
 * and {@link toast} all work without placing an element yourself.
 *
 * `./internal.js` is deliberately not re-exported: it holds implementation
 * details whose names are too generic for the root barrel.
 */

export * from './alert.js';
export * from './alert-stack.js';
export * from './banner.js';
export * from './modal-controller.js';
export * from './modal.js';
export * from './confirm-dialog.js';
export * from './toast.js';
export * from './hint.js';
export * from './error-boundary.js';
