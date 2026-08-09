// Tool palette icons (§B.6 rule 5): 24×24 SVG, monochrome — they inherit the
// toolbar's currentColor, so active/hover states come from tokens for free.
// Hand glyph adapted from Lucide (ISC license).
interface ToolIconProps {
  className?: string;
}

function ToolIcon({ className, children }: ToolIconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconSelect({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <path d='M4.5 3.5 11.5 20.5 14 14 20.5 11.5Z' />
    </ToolIcon>
  );
}

export function IconPlaceWall({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <rect x='3' y='8' width='18' height='10' />
      <path d='M3 13h18M9 8v5M15 13v5' />
    </ToolIcon>
  );
}

export function IconPlaceBar({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <path d='M5 15v-3M5 15h14M19 15v-3' />
      <circle cx='12' cy='6.5' r='2.5' />
    </ToolIcon>
  );
}

export function IconSectionCut({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <path d='M12 3v18' strokeDasharray='3 2.5' />
      <path d='M12 5.5 17 3.75v3.5Z' fill='currentColor' stroke='none' />
      <path d='M12 18.5 17 16.75v3.5Z' fill='currentColor' stroke='none' />
    </ToolIcon>
  );
}

export function IconPan({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <path d='M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2' />
      <path d='M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6' />
      <path d='M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8' />
      <path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' />
    </ToolIcon>
  );
}

export function IconOrbit({ className }: ToolIconProps) {
  return (
    <ToolIcon className={className}>
      <path d='M20.5 12a8.5 8.5 0 1 1-2.5-6' />
      <path d='M21 3v5h-5' />
    </ToolIcon>
  );
}
