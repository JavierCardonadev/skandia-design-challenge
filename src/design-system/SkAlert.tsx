import { useRef } from 'react';
import { useCustomEvent } from './useCustomEvent';

export interface SkAlertProps {
  /** `warning` and `error` are announced as alerts by screen readers: use them only when urgent. */
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  /** Called when the person dismisses the alert. Omit it for a fixed, non-closable alert. */
  onClose?: () => void;
}

export function SkAlert({ tone = 'info', title, message, onClose }: SkAlertProps) {
  const ref = useRef<HTMLElement>(null);
  useCustomEvent(ref, 'skClose', onClose);

  return (
    <sk-alert
      ref={ref}
      type={tone}
      title={title}
      message={message}
      closable={onClose ? undefined : 'false'}
    />
  );
}
