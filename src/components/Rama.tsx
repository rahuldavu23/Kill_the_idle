// This component renders Lord Rama as an animated SVG avatar
// All animation is handled via CSS classes defined in Rama.css

import './Rama.css'

export default function Rama() {
  return (
    // Outer wrapper div that applies the floating idle animation
    <div className="rama-wrapper">

      <svg
        width="220"
        height="340"
        viewBox="0 0 220 340"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── GLOW behind Rama ── */}
        {/* A soft radial gradient that gives him a divine aura */}
        <defs>
          <radialGradient id="aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
          </radialGradient>

          {/* Skin tone gradient for depth on face and hands */}
          <radialGradient id="skinGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#F4C07A" />
            <stop offset="100%" stopColor="#C8873A" />
          </radialGradient>

          {/* Robe gradient — royal blue with a darker base */}
          <linearGradient id="robeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3A6FD8" />
            <stop offset="100%" stopColor="#1A3A8F" />
          </linearGradient>

          {/* Gold trim gradient for ornaments and crown */}
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="100%" stopColor="#C89A00" />
          </linearGradient>
        </defs>

        {/* ── AURA / HALO ── */}
        <ellipse cx="110" cy="160" rx="90" ry="130" fill="url(#aura)" />
        {/* Circular halo ring behind the head */}
        <circle
          cx="110" cy="95"
          r="52"
          fill="none"
          stroke="#FFD700"
          strokeWidth="2.5"
          strokeOpacity="0.5"
          strokeDasharray="6 4"
          className="rama-halo"
        />

        {/* ── CROWN (Mukut) ── */}
        {/* Rama's royal crown — a series of triangular spires */}
        <polygon points="110,28 100,52 120,52" fill="url(#goldGrad)" />
        <polygon points="96,34 86,55 106,55"  fill="url(#goldGrad)" />
        <polygon points="124,34 114,55 134,55" fill="url(#goldGrad)" />
        {/* Crown base band */}
        <rect x="84" y="52" width="52" height="10" rx="3" fill="url(#goldGrad)" />
        {/* Jewel in the center of the crown */}
        <circle cx="110" cy="55" r="4" fill="#E84040" />

        {/* ── HEAD ── */}
        <ellipse cx="110" cy="95" rx="30" ry="33" fill="url(#skinGrad)" />

        {/* ── FACE FEATURES ── */}
        {/* Eyes — the className enables the CSS blink animation */}
        <ellipse cx="100" cy="91" rx="5" ry="5.5" fill="#2C1A0E" className="rama-eye" />
        <ellipse cx="120" cy="91" rx="5" ry="5.5" fill="#2C1A0E" className="rama-eye" />
        {/* Eye shine dots */}
        <circle cx="102" cy="89" r="1.5" fill="white" />
        <circle cx="122" cy="89" r="1.5" fill="white" />
        {/* Eyebrows */}
        <path d="M95 84 Q100 81 105 84" stroke="#5C3A1E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M115 84 Q120 81 125 84" stroke="#5C3A1E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* Nose */}
        <ellipse cx="110" cy="98" rx="3.5" ry="2.5" fill="#C8873A" />
        {/* Mouth — a gentle smile */}
        <path d="M103 107 Q110 113 117 107" stroke="#8B4513" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Tilaka — the sacred mark on the forehead */}
        <ellipse cx="110" cy="78" rx="3" ry="5" fill="#FF6B35" />
        <circle cx="110" cy="72" r="2" fill="#FFD700" />

        {/* ── NECK ── */}
        <rect x="104" y="126" width="12" height="14" rx="4" fill="url(#skinGrad)" />
        {/* Necklace */}
        <path d="M98 136 Q110 144 122 136" stroke="#FFD700" strokeWidth="2.5" fill="none" />
        <circle cx="110" cy="143" r="3" fill="#E84040" />

        {/* ── BODY / ROBE ── */}
        {/* Main robe shape covering torso */}
        <path
          d="M75 148 Q65 200 70 270 L150 270 Q155 200 145 148 Q128 138 110 138 Q92 138 75 148Z"
          fill="url(#robeGrad)"
        />
        {/* Gold border trim along the robe edges */}
        <path d="M75 148 Q65 200 70 270" stroke="#FFD700" strokeWidth="2" fill="none" />
        <path d="M145 148 Q155 200 150 270" stroke="#FFD700" strokeWidth="2" fill="none" />
        {/* Robe center line detail */}
        <line x1="110" y1="138" x2="110" y2="270" stroke="#FFE066" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* ── SHOULDERS / UPPER ARMS ── */}
        <ellipse cx="78"  cy="155" rx="14" ry="10" fill="#3A6FD8" />
        <ellipse cx="142" cy="155" rx="14" ry="10" fill="#3A6FD8" />
        {/* Gold shoulder ornaments */}
        <ellipse cx="78"  cy="150" rx="10" ry="6" fill="url(#goldGrad)" />
        <ellipse cx="142" cy="150" rx="10" ry="6" fill="url(#goldGrad)" />

        {/* ── ARMS ── */}
        {/* Left arm — slightly angled outward */}
        <path d="M68 158 Q55 185 58 215" stroke="#C8873A" strokeWidth="12" fill="none" strokeLinecap="round" />
        {/* Right arm — mirrored */}
        <path d="M152 158 Q165 185 162 215" stroke="#C8873A" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* ── HANDS ── */}
        <ellipse cx="58"  cy="218" rx="9" ry="7" fill="url(#skinGrad)" />
        <ellipse cx="162" cy="218" rx="9" ry="7" fill="url(#skinGrad)" />

        {/* ── GOLD ARMBANDS ── */}
        <rect x="52"  y="193" width="14" height="6" rx="3" fill="url(#goldGrad)" />
        <rect x="154" y="193" width="14" height="6" rx="3" fill="url(#goldGrad)" />

        {/* ── LOWER ROBE / DHOTI ── */}
        {/* The lower garment draping down */}
        <path
          d="M75 230 Q70 270 72 310 L148 310 Q150 270 145 230Z"
          fill="#1A3A8F"
        />
        {/* Dhoti gold border */}
        <path d="M75 230 Q70 270 72 310" stroke="#FFD700" strokeWidth="1.5" fill="none" />
        <path d="M145 230 Q150 270 148 310" stroke="#FFD700" strokeWidth="1.5" fill="none" />
        {/* Dhoti fold lines for fabric detail */}
        <path d="M90 240 Q110 250 130 240" stroke="#FFE066" strokeWidth="1" fill="none" strokeOpacity="0.5" />
        <path d="M88 260 Q110 272 132 260" stroke="#FFE066" strokeWidth="1" fill="none" strokeOpacity="0.5" />

        {/* ── FEET ── */}
        <ellipse cx="85"  cy="312" rx="13" ry="6" fill="url(#skinGrad)" />
        <ellipse cx="135" cy="312" rx="13" ry="6" fill="url(#skinGrad)" />
        {/* Sandal straps */}
        <line x1="78"  y1="310" x2="92"  y2="310" stroke="#8B6914" strokeWidth="2" />
        <line x1="128" y1="310" x2="142" y2="310" stroke="#8B6914" strokeWidth="2" />

      </svg>
    </div>
  )
}