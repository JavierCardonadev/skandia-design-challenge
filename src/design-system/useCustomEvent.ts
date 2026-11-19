import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Subscribes to a DOM CustomEvent on a custom element and forwards its `detail`.
 * The sk-* components emit events React cannot bind through JSX props, so every
 * wrapper listens through a ref, as the kit recommends.
 *
 * It subscribes in a layout effect on purpose: the listener is in place in the same
 * commit that puts the element on screen. With a passive effect there is a moment
 * where the button is visible but not listening, and a click in it is lost.
 */
export function useCustomEvent<Detail = unknown>(
  ref: RefObject<HTMLElement | null>,
  eventName: string,
  handler: ((detail: Detail) => void) | undefined,
): void {
  const latestHandler = useRef(handler);

  useLayoutEffect(() => {
    latestHandler.current = handler;
  }, [handler]);

  useLayoutEffect(() => {
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
