import { useRef } from 'react';
import { useCustomEvent } from './useCustomEvent';

export interface SkInputTextProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  helpText?: string;
  errorMessage?: string;
}

export function SkInputText({
  label,
  value,
  onValueChange,
  helpText,
  errorMessage,
}: SkInputTextProps) {
  const ref = useRef<HTMLElement>(null);
  useCustomEvent<unknown>(ref, 'valueChange', (detail) => {
    if (typeof detail === 'string') onValueChange(detail);
  });

  return (
    <sk-input-text
      ref={ref}
      label={label}
      value={value}
      help-text={helpText}
      error-message={errorMessage}
    />
  );
}
