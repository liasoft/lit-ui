import { property, state } from 'lit/decorators.js';
import { LiaTransparentElement } from './base-element.js';

/**
 * Base class for a component that fetches what it renders.
 *
 * Every such component repeats the same four things, and each of them is a bug when it is forgotten:
 * load when it appears, expose a busy state, expose the failure instead of rendering nothing, and
 * abandon whatever is still in flight when it goes away or reloads. That last one is the one that
 * bites — a request that lands after the component moved on will happily overwrite newer state, or
 * throw into a component that is no longer on screen.
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

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.deferLoad) void this.reload();
  }

  override disconnectedCallback(): void {
    this.controller?.abort();
    this.controller = undefined;
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
