import type { ReactNode } from 'react';

export interface SkCardProps {
  header?: string;
  subheader?: string;
  children: ReactNode;
}

/**
 * The sk-* components project their children once, when they connect. A single
 * stable wrapper keeps later React updates inside the projected node instead of
 * appending new nodes outside the component.
 */
export function SkCard({ header, subheader, children }: SkCardProps) {
  return (
    <sk-card header={header} subheader={subheader}>
      <div>{children}</div>
    </sk-card>
  );
}
