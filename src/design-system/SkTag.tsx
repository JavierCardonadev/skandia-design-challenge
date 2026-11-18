export interface SkTagProps {
  tone?: 'info' | 'success' | 'warning' | 'error';
  size?: 'large' | 'small';
  children: string;
}

/** Decorative status label. The inner span keeps text updates inside the projected node. */
export function SkTag({ tone = 'info', size = 'small', children }: SkTagProps) {
  return (
    <sk-tag sk-style={tone} size={size}>
      <span>{children}</span>
    </sk-tag>
  );
}
