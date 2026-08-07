import type { ComplexAttributeConverter } from 'lit';

/**
 * Boolean property converter for flags that default to **true**.
 *
 * Lit's built-in `Boolean` converter maps "attribute present" to `true` and
 * nothing else, so a flag such as `showFooter` can never be switched off from
 * plain HTML. This converter treats the strings `"false"`, `"0"` and `"off"` as
 * `false` and everything else (including the empty attribute) as `true`:
 *
 * ```html
 * <lia-app-shell></lia-app-shell>                    <!-- footer shown  -->
 * <lia-app-shell show-footer="false"></lia-app-shell><!-- footer hidden -->
 * ```
 */
export const flag: ComplexAttributeConverter<boolean> = {
  fromAttribute(value: string | null): boolean {
    if (value === null) return false;
    const normalised = value.trim().toLowerCase();
    return !(normalised === 'false' || normalised === '0' || normalised === 'off');
  },
  toAttribute(value: boolean): string {
    return value ? '' : 'false';
  },
};
