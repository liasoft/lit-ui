import { property, state } from 'lit/decorators.js';
import { LiaTransparentElement } from './base-element.js';

/**
 * Base class for a component that fetches what it renders: load once when it
 * appears, expose a busy state, expose failures, and abort whatever is still
 * in flight on removal or reload.
 *
 * Subclasses implement {@link load} and read {@link loading} and {@link error} in their template:
 *
 * ```ts
 * class UserList extends LiaDataElement {
 *   @state() private users: User[] = [];
 *
 *   protected override async load(signal: AbortSignal): Promise<void> {
 *     this.users = await fetchUsers({ signal });
 *   }
 *
 *   override render() {
 *     if (this.loading) return html`<lia-spinner label-visible></lia-spinner>`;
 *     if (this.error) return html`<lia-alert variant="danger" message=${this.error}></lia-alert>`;
 *     return html`<lia-data-table .rows=${this.users}></lia-data-table>`;
 *   }
 * }
 * ```
 *
 * It is {@link LiaTransparentElement}, so a data view is not a layout box in the middle of whatever
 * lays it out.
 */
export abstract class LiaDataElement extends LiaTransparentElement {
  /** True while {@link load} is running. Starts true: the first paint is a load, not an empty state. */
  @state() protected loading = true;

  /** The message of the last failure, or the empty string. Cleared at the start of every load. */
  @state() protected error = '';

  /**
   * Do not load on connect. For a component whose inputs arrive after it is in the DOM and which
   * should wait for an explicit {@link reload}.
   */
  @property({ type: Boolean, attribute: 'defer-load' }) deferLoad = false;

  private controller?: AbortController;

  /** Whether the first load has been triggered; cleared only on a real removal. */
  private started = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.deferLoad || this.started) return;
    this.started = true;
    void this.reload();
  }

  /**
   * Aborts the load — but only if the element really went away.
   *
   * Light-DOM projection (`LightContent.adopt()` / `LightSlot.capture()`) reparents authored
   * children, and `appendChild` delivers connect → disconnect → connect in one breath; treating
   * that as a removal would abort and re-issue every request on mount. The check must be deferred
   * to a **task**, not a microtask: reinsertion happens on lit's next render, which is itself a
   * microtask, so a microtask here would still run before the element is back. The cost is that a
   * genuinely removed element keeps its request in flight for one task, where its answer is
   * discarded anyway.
   */
  override disconnectedCallback(): void {
    setTimeout(() => {
      if (this.isConnected) return;
      this.started = false;
      this.controller?.abort();
      this.controller = undefined;
    }, 0);
    super.disconnectedCallback();
  }

  /** The signal of the load in progress, for a subclass issuing its own follow-up requests. */
  protected get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  /**
   * Runs {@link load} again, abandoning whatever the previous one still had in flight.
   *
   * Never throws: a failure becomes {@link error}. An aborted load is silent, because it was
   * superseded on purpose and its component has already moved on.
   */
  async reload(): Promise<void> {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    this.loading = true;
    this.error = '';

    try {
      await this.load(signal);
    } catch (cause) {
      if (signal.aborted || (cause as Error)?.name === 'AbortError') return;
      this.error = this.describe(cause);
    } finally {
      if (!signal.aborted) this.loading = false;
    }
  }

  /**
   * Turns a thrown value into the message {@link error} carries.
   *
   * Overridable because "what went wrong" is domain knowledge: an application that knows its 401 is
   * handled elsewhere can return the empty string for it rather than showing a message beside the
   * sign-in page it is already redirecting to.
   */
  protected describe(cause: unknown): string {
    return (cause as Error)?.message ?? String(cause);
  }

  /** Fetch what the template needs, assigning to reactive properties. */
  protected abstract load(signal: AbortSignal): Promise<void>;
}
