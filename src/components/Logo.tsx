import type { SVGProps } from 'react';

interface LogoIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

/**
 * Reines Symbol-Logo: abgerundetes Brand-Quadrat mit dynamischer Figur.
 * Design „Bewegung" — Arme nach oben gestreckt, gekrümmte Wirbelsäule,
 * subtiler Halo, ausgeprägter Schwung-Bogen.
 *
 * Übernimmt die Farbe vom umgebenden `text-*`-Style (currentColor).
 * Gleiches Motiv wie die App-Icons (scripts/generate-icons.ts).
 */
export function LogoIcon({ size = 32, ...props }: Readonly<LogoIconProps>) {
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

      {/* Bewegungs-Halo */}
      <circle cx="16" cy="16" r="13" stroke="white" strokeWidth="0.7" fill="none" opacity="0.25" />

      {/* Kopf — leicht versetzt für Drehimpuls */}
      <circle cx="14.6" cy="6.4" r="2" fill="white" />

      {/* Arme nach oben/außen — Sprung-/Reichen-Geste */}
      <path
        d="M 13.5 9 Q 8 6.5, 3 4"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 15.5 9 Q 21 6, 27 5"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />

      {/* Hand-Punkte */}
      <circle cx="3.2" cy="4.2" r="1" fill="white" />
      <circle cx="27" cy="5.1" r="1.05" fill="white" />

      {/* Gekrümmte Wirbelsäule */}
      <circle cx="14.5" cy="11" r="0.65" fill="white" />
      <circle cx="14.8" cy="13.1" r="0.8" fill="white" />
      <circle cx="15.3" cy="15.2" r="0.95" fill="white" />
      <circle cx="16" cy="17.3" r="0.95" fill="white" />
      <circle cx="16.7" cy="19.3" r="0.9" fill="white" />
      <circle cx="17.4" cy="21.2" r="0.75" fill="white" />
      <circle cx="18" cy="23" r="0.6" fill="white" />

      {/* Schwung-Bogen */}
      <path
        d="M 4 27 Q 17 30.8, 28 26"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
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
export function Logo({ iconOnly = false, size = 'md', className }: Readonly<LogoProps>) {
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
