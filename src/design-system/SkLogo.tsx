export interface SkLogoProps {
  /** Rendered height in pixels; the natural height is 48. */
  height?: number;
  /** Set when adjacent text already names Skandia, so the logo is hidden from assistive tech. */
  decorative?: boolean;
}

export function SkLogo({ height = 34, decorative = false }: SkLogoProps) {
  return <sk-logo style={{ height }} decorativo={decorative} />;
}
