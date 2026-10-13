import { useLayoutEffect, type RefObject } from "react";

/** The phone layout's breakpoint (src/ui/device/device.css). */
const PHONE = "(max-width: 640px)";

/**
 * On a phone the page opens scrolled just past the header, so the calculator has the whole screen
 * (device.css sizes it for that); scrolling up brings the header's switches back. Only on a load at the
 * top: a scroll position the browser restores is kept. Runs before the first paint, so nothing jumps.
 */
export function useScrollPastHeader(header: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const el = header.current;
    if (!el || window.scrollY !== 0 || !window.matchMedia(PHONE).matches) return;
    window.scrollTo(0, Math.ceil(el.getBoundingClientRect().bottom));
  }, [header]);
}
