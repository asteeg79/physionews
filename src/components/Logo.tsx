import type { SVGProps } from 'react';

interface LogoIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

/**
 * Reines Symbol-Logo: abgerundetes Brand-Quadrat mit Pulswellen-Motiv.
 * Übernimmt die Farbe vom umgebenden `text-*`-Style (currentColor).
 */
export function LogoIcon({ size = 32, ...props }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Brand-Quadrat */}
      <rect width="32" height="32" rx="9" fill="currentColor" />
      {/* Pulswelle in Weiß — symbolisiert Bewegung + Aktualität */}
      <path
        d="M 5 16 L 10 16 L 12 11 L 15 23 L 18 9 L 21 18 L 23 16 L 27 16"
        stroke="white"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface LogoProps {
  /** Verbirgt die Wortmarke, zeigt nur das Icon (z.B. für sehr schmale Layouts) */
  iconOnly?: boolean;
  /** Größenmodifier für den Header (Default md) */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Volles Logo: Symbol + Wortmarke "PhysioNews" in Slab-Schrift.
 * „Physio" in Brand-Grün, „News" in Foreground für klare Lesbarkeit auch im Dark Mode.
 */
export function Logo({ iconOnly = false, size = 'md', className }: LogoProps) {
  const sizes = {
    sm: { icon: 22, text: 'text-base' },
    md: { icon: 26, text: 'text-lg' },
    lg: { icon: 36, text: 'text-2xl' },
  };
  const cfg = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoIcon size={cfg.icon} className="text-brand shrink-0" />
      {!iconOnly && (
        <span className={`font-heading font-bold tracking-tight ${cfg.text} leading-none`}>
          <span className="text-brand">Physio</span>
          <span className="text-foreground">News</span>
        </span>
      )}
    </span>
  );
}
