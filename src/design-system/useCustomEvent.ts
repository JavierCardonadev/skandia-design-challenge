import { useEffect, useRef, type RefObject } from 'react';

/**
 * Subscribes to a DOM CustomEvent on a custom element and forwards its `detail`.
 * The sk-* components emit events React cannot bind through JSX props, so every
 * wrapper listens through a ref, as the kit recommends.
 */
export function useCustomEvent<Detail = unknown>(
  ref: RefObject<HTMLElement | null>,
  eventName: string,
  handler: ((detail: Detail) => void) | undefined,
): void {
  const latestHandler = useRef(handler);

  useEffect(() => {
    latestHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const listener = (event: Event) => {
      latestHandler.current?.((event as CustomEvent<Detail>).detail);
    };
    element.addEventListener(eventName, listener);
    return () => {
      element.removeEventListener(eventName, listener);
    };
  }, [ref, eventName]);
}
