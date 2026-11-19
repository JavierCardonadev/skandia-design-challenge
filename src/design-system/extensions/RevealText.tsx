import { useEffect, useMemo, useState } from 'react';
import styles from './RevealText.module.css';

export interface RevealTextProps {
  text: string;
  /** Wait before the first word, to reveal several texts one after another. */
  delayMs?: number;
  wordsPerSecond?: number;
}

const DEFAULT_WORDS_PER_SECOND = 24;

function prefersReducedMotion(): boolean {
  // Without matchMedia there is no way to ask, so the calmer option wins.
  if (typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Design system extension: shows a text the model wrote word by word, the way it would
 * arrive. The whole text is in the page from the start for screen readers and for
 * layout, so nothing jumps and nothing is read twice; only its visibility is animated,
 * and once it is all shown the text is ordinary text again.
 * People who ask for reduced motion get the text at once.
 */
export function RevealText({
  text,
  delayMs = 0,
  wordsPerSecond = DEFAULT_WORDS_PER_SECOND,
}: RevealTextProps) {
  // Words keep their trailing space so revealed and pending parts join without gaps.
  const words = useMemo(() => text.match(/\S+\s*/g) ?? [], [text]);
  const [isStatic] = useState(prefersReducedMotion);
  const [progress, setProgress] = useState({ text, count: 0 });

  // A new text starts from nothing in the same render, so the old count never shows it whole.
  if (progress.text !== text) setProgress({ text, count: 0 });
  const revealed = progress.text === text ? progress.count : 0;

  useEffect(() => {
    if (isStatic) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setProgress((current) => {
          if (current.count >= words.length) clearInterval(interval);
          return { ...current, count: Math.min(current.count + 1, words.length) };
        });
      }, 1000 / wordsPerSecond);
    }, delayMs);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [isStatic, words, delayMs, wordsPerSecond]);

  // Once everything is shown the text is plain again: selectable and copied only once.
  if (isStatic || revealed >= words.length) return <>{text}</>;

  return (
    <>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {words.slice(0, revealed).join('')}
        <span className={styles.pending}>{words.slice(revealed).join('')}</span>
      </span>
    </>
  );
}
