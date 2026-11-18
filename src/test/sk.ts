import { act } from '@testing-library/react';

/*
 * The sk-* elements are not defined under jsdom, so tests drive them the way the
 * real components talk to the app: through attributes and custom events.
 */

export function skElements(selector: string, root: ParentNode = document.body): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)];
}

export function skElement(selector: string, root: ParentNode = document.body): HTMLElement {
  const element = skElements(selector, root).at(-1);
  if (!element) throw new Error(`No element matches ${selector}`);
  return element;
}

export function emit(element: HTMLElement, type: string, detail?: unknown): void {
  // The wrappers subscribe to custom events in an effect. After an awaited query the DOM
  // can be ready before that effect has run, so pending effects are flushed first.
  act(() => undefined);
  act(() => {
    element.dispatchEvent(new CustomEvent(type, { detail }));
  });
}

/** Clicks the last sk-button with that label or accessible name. */
export function clickSkButton(name: string, root: ParentNode = document.body): void {
  emit(skElement(`sk-button[aria-label="${name}"], sk-button[label="${name}"]`, root), 'skClick');
}

/** Types into an sk-textarea or sk-input-text found by its label. */
export function typeIntoSk(label: string, value: string, root: ParentNode = document.body): void {
  const selector = `sk-textarea[label="${label}"], sk-input-text[label="${label}"]`;
  emit(skElement(selector, root), 'valueChange', value);
}
