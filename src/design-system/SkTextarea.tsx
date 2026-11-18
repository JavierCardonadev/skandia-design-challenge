import { useRef } from 'react';
import { useCustomEvent } from './useCustomEvent';

export interface SkTextareaProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  errorMessage?: string;
  autoResize?: boolean;
  disabled?: boolean;
}

export function SkTextarea({
  label,
  value,
  onValueChange,
  placeholder,
  helpText,
  errorMessage,
  autoResize = true,
  disabled = false,
}: SkTextareaProps) {
  const ref = useRef<HTMLElement>(null);
  useCustomEvent<unknown>(ref, 'valueChange', (detail) => {
    // The component only documents text payloads; anything else is ignored.
    if (typeof detail === 'string') onValueChange(detail);
  });

  return (
    <sk-textarea
      ref={ref}
      label={label}
      value={value}
      placeholder={placeholder}
      help-text={helpText}
      error-message={errorMessage}
      auto-resize={autoResize}
      disabled={disabled}
    />
  );
}
