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
  /** Accessible name when the visible label needs context, e.g. "Quitar Estrategia". */
  ariaLabel?: string;
  /** Buttons fill their container by default; set to false to size to the label. */
  fullWidth?: boolean;
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
  ariaLabel,
  fullWidth = true,
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
      aria-label={ariaLabel}
      data-width={fullWidth ? undefined : 'auto'}
    />
  );
}
