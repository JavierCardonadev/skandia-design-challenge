import { useRef } from 'react';
import { useCustomEvent } from './useCustomEvent';

export interface SkButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'large' | 'small';
  /** PrimeIcons class, e.g. `pi pi-arrow-right`. */
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function SkButton({
  label,
  variant = 'primary',
  size = 'large',
  icon,
  iconPosition,
  disabled = false,
  loading = false,
  onClick,
}: SkButtonProps) {
  const ref = useRef<HTMLElement>(null);
  useCustomEvent(ref, 'skClick', onClick);

  return (
    <sk-button
      ref={ref}
      label={label}
      sk-type={variant}
      size={size}
      icon={icon}
      icon-pos={iconPosition}
      disabled={disabled}
      loading={loading}
    />
  );
}
