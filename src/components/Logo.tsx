import type { SVGProps } from 'react';

interface LogoIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

/**
 * Reines Symbol-Logo: abgerundetes Brand-Quadrat mit stilisierter Figur
 * (ausgestreckte Arme, punktierte Wirbelsäule, Bewegungsbogen).
 * Übernimmt die Farbe vom umgebenden `text-*`-Style (currentColor).
 *
 * Gleiches Motiv wie die App-Icons (siehe scripts/generate-icons.ts).
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

      {/* Kopf */}
      <circle cx="16" cy="6.6" r="1.9" fill="white" />

      {/* Arme: leicht nach außen geschwungen */}
      <path
        d="M 14.7 10 C 11 9.2, 7 10, 4 8.6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 17.3 10 C 21 9.2, 25 10, 28 8.6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Wirbelsäule als Punktreihe — minimales Größen-Crescendo */}
      <circle cx="16" cy="12.2" r="0.6" fill="white" />
      <circle cx="16" cy="14.0" r="0.75" fill="white" />
      <circle cx="16" cy="15.9" r="0.9" fill="white" />
      <circle cx="16" cy="17.8" r="0.9" fill="white" />
      <circle cx="16" cy="19.7" r="0.85" fill="white" />
      <circle cx="16" cy="21.6" r="0.7" fill="white" />
      <circle cx="16" cy="23.4" r="0.55" fill="white" />

      {/* Bewegungsbogen */}
      <path
        d="M 5 27.2 Q 16 29.6, 27 27.2"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
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
