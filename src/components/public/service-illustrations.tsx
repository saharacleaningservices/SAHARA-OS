// Premium inline-SVG service illustrations for the booking page. Vector art —
// crisp at any size, no external images, no broken-image states, tiny payload.

type Props = { className?: string };

const wrap = "block h-full w-full";

export function HomeCleaningArt({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={`${wrap} ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="120" rx="12" fill="#e8f0fb" />
      <path d="M28 66 82 30l54 36v42a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6z" fill="#2456b0" />
      <path d="M22 68 82 28l60 40" stroke="#173e8c" strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="52" y="78" width="24" height="36" rx="2" fill="#e8f0fb" />
      <rect x="92" y="76" width="22" height="20" rx="2" fill="#bcd4f4" />
      <circle cx="122" cy="30" r="10" fill="#f6c445" />
      <path d="M110 100c6-14 20-16 30-10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="118" cy="94" r="2.5" fill="#fff" />
      <circle cx="128" cy="104" r="2" fill="#fff" />
    </svg>
  );
}

export function CommercialCleaningArt({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={`${wrap} ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="120" rx="12" fill="#e8f0fb" />
      <rect x="30" y="24" width="44" height="90" rx="4" fill="#2456b0" />
      <rect x="82" y="42" width="48" height="72" rx="4" fill="#173e8c" />
      {[34, 50, 66, 82, 98].map((y) => (
        <g key={y}>
          <rect x="38" y={y} width="12" height="10" fill="#bcd4f4" />
          <rect x="54" y={y} width="12" height="10" fill="#bcd4f4" />
        </g>
      ))}
      {[52, 68, 84, 100].map((y) => (
        <g key={y}>
          <rect x="88" y={y} width="14" height="10" fill="#9dc0ee" />
          <rect x="108" y={y} width="14" height="10" fill="#9dc0ee" />
        </g>
      ))}
      <circle cx="120" cy="34" r="8" fill="#f6c445" />
      <path d="M104 34c4-9 14-10 20-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

export function InteriorPaintingArt({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={`${wrap} ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="120" rx="12" fill="#e8f0fb" />
      <path d="M20 20h120v54H20z" fill="#2456b0" />
      <path d="M20 20h64v54H20z" fill="#173e8c" />
      <rect x="86" y="70" width="10" height="40" rx="3" fill="#8a5a2b" />
      <rect x="78" y="58" width="26" height="16" rx="3" fill="#d9d9d9" />
      <path d="M78 58h26l-3-10H81z" fill="#2456b0" />
      <path d="M112 30c10 4 10 18 0 22" stroke="#f6c445" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="128" cy="96" r="6" fill="#2456b0" />
      <circle cx="140" cy="104" r="4" fill="#2456b0" opacity="0.6" />
    </svg>
  );
}

export function PestControlArt({ className }: Props) {
  return (
    <svg viewBox="0 0 160 120" className={`${wrap} ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="120" rx="12" fill="#e8f0fb" />
      <rect x="96" y="30" width="26" height="60" rx="6" fill="#2456b0" />
      <rect x="102" y="18" width="14" height="16" rx="4" fill="#173e8c" />
      <path d="M96 44 46 62" stroke="#173e8c" strokeWidth="6" strokeLinecap="round" />
      <g fill="#2456b0">
        <ellipse cx="44" cy="70" rx="9" ry="6" />
        <circle cx="34" cy="70" r="4" />
        <path d="M52 66l8-4M52 74l8 4M40 62l-3-7M48 62l3-7" stroke="#2456b0" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {[30, 40, 50].map((x, i) => (
        <circle key={x} cx={x + 40} cy={54 - i * 4} r="2.5" fill="#9dc0ee" />
      ))}
    </svg>
  );
}

export function HeroArt({ className }: Props) {
  return (
    <svg viewBox="0 0 320 200" className={className ?? ""} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#heroSky)" />
      {/* skyline */}
      <g fill="#ffffff" opacity="0.14">
        <rect x="18" y="70" width="40" height="110" />
        <rect x="66" y="46" width="34" height="134" />
        <rect x="108" y="88" width="28" height="92" />
        <rect x="236" y="60" width="38" height="120" />
        <rect x="280" y="92" width="26" height="88" />
      </g>
      {/* cleaner figure in royal-blue uniform */}
      <g transform="translate(150 44)">
        <circle cx="24" cy="16" r="12" fill="#ffffff" />
        <path d="M14 30h20l6 42-10 3-6-26-6 26-10-3z" fill="#ffffff" />
        <path d="M7 46 34 74" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
        <path d="M34 46 58 30" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
        <rect x="6" y="118" width="60" height="10" rx="5" fill="#ffffff" />
        <path d="M58 30c14 8 14 60 8 88" stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.85" />
      </g>
      {/* sparkles */}
      {[
        [40, 40],
        [92, 30],
        [270, 44],
        [300, 120],
        [30, 150],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 -6 1.6 -1.6 6 0 1.6 1.6 0 6 -1.6 1.6 -6 0 -1.6 -1.6z" fill="#ffffff" opacity="0.9" />
        </g>
      ))}
    </svg>
  );
}
