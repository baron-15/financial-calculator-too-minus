import { useRef } from "react";

/**
 * Counts how many times `value` has changed since mount (0 on first render).
 * Used to replay a "value changed" flash without flashing everything on page load.
 */
export function useChangeCount<T>(value: T): number {
  const ref = useRef({ value, n: 0 });
  if (!Object.is(ref.current.value, value)) ref.current = { value, n: ref.current.n + 1 };
  return ref.current.n;
}
