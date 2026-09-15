// Rama component — interactive semi-realistic avatar
// A single hand-built SVG face rig, framed like an app-icon badge.
// Eyes track the cursor, the character blinks on its own, and the
// mouth animates while Rama is speaking — all driven imperatively via
// refs so idle tracking never triggers a React re-render.
//
// Lighting convention: one key light from the upper left. Soft shading
// is painted as plain shapes inside two blurred groups (shadow and
// highlight) clipped to the face, so the whole face costs two blur passes
// rather than one per shape.

import { useEffect, useRef, useState } from 'react'
import './Rama.css'

type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

interface RamaProps {
  mood?: RamaMood
}

// ── Mouth ─────────────────────────────────────────────────────
// Each mouth is described by its two corners and the control points of
// the upper line (`top`) and the bottom of the opening (`bottom`). Every
// lip layer is derived from those numbers, so all layers keep the same
// path structure between moods and CSS can tween `d` between them.
// `open` says whether the mouth parts far enough for teeth and tongue.
type MouthShape = {
  x1: number
  y1: number
  x2: number
  y2: number
  top: number
  bottom: number
  cx?: number
  open: boolean
}

const MOUTH: Record<string, MouthShape> = {
  idle: { x1: 139, y1: 196, x2: 181, y2: 196, top: 202, bottom: 212, open: false },
  happy: { x1: 132, y1: 190, x2: 188, y2: 190, top: 202, bottom: 240, open: true },
  thinking: { x1: 147, y1: 199, x2: 171, y2: 197, top: 194, bottom: 208, cx: 158, open: false },
  amused: { x1: 130, y1: 188, x2: 190, y2: 188, top: 206, bottom: 240, open: true },
  talkOpen: { x1: 142, y1: 191, x2: 178, y2: 191, top: 201, bottom: 236, open: true },
  talkMid: { x1: 143, y1: 194, x2: 177, y2: 194, top: 202, bottom: 218, open: true },
  talkClosed: { x1: 140, y1: 197, x2: 180, y2: 197, top: 203, bottom: 209, open: false },
}

const TALK_CYCLE = ['talkOpen', 'talkMid', 'talkClosed', 'talkMid'] as const

function mouthPaths({ x1, y1, x2, y2, top, bottom, cx = 160, open }: MouthShape) {
  const upperThick = open ? 5 : 6.5
  const lowerThick = open ? 4.5 : 6
  // A quadratic's midpoint sits at ¼·start + ½·control + ¼·end.
  const lineMid = (y1 + y2) / 4 + top / 2
  const openMid = (y1 + y2) / 4 + bottom / 2
  const bow = lineMid - upperThick
  const hl = openMid + lowerThick * 0.45
  const sh = openMid + lowerThick + 3.5

  return {
    shape: `M${x1} ${y1} Q${cx} ${bottom} ${x2} ${y2} Q${cx} ${top} ${x1} ${y1} Z`,
    line: `M${x1} ${y1} Q${cx} ${top} ${x2} ${y2}`,
    upper:
      `M${x1} ${y1} Q${cx} ${top} ${x2} ${y2} ` +
      `C${x2 - 5} ${y2 - 3.5} ${cx + 10} ${bow} ${cx + 4.5} ${bow} ` +
      `Q${cx} ${bow + 2.2} ${cx - 4.5} ${bow} ` +
      `C${cx - 10} ${bow} ${x1 + 5} ${y1 - 3.5} ${x1} ${y1} Z`,
    upperLight:
      `M${cx - 9} ${bow - 1.2} Q${cx - 4.5} ${bow - 2.4} ${cx} ${bow + 0.6} ` +
      `Q${cx + 4.5} ${bow - 2.4} ${cx + 9} ${bow - 1.2}`,
    lower: `M${x1} ${y1} Q${cx} ${bottom} ${x2} ${y2} Q${cx} ${bottom + lowerThick * 2} ${x1} ${y1} Z`,
    lowerLight: `M${cx - 6} ${hl} Q${cx} ${hl + 1.6} ${cx + 6} ${hl}`,
    shadow: `M${cx - 11} ${sh} Q${cx} ${sh + 4} ${cx + 11} ${sh}`,
    corners:
      `M${x1 + 1.5} ${y1 - 3} Q${x1 - 2.5} ${y1} ${x1 + 1.5} ${y1 + 3} ` +
      `M${x2 - 1.5} ${y2 - 3} Q${x2 + 2.5} ${y2} ${x2 - 1.5} ${y2 + 3}`,
  }
}

type MouthPart = keyof ReturnType<typeof mouthPaths>
const IDLE_MOUTH = mouthPaths(MOUTH.idle)

// ── Static geometry ───────────────────────────────────────────
const FACE_PATH =
  'M160 66 C204 66 222 100 222 146 C222 178 213 199 197 213 C185 223 172 229 160 229 ' +
  'C148 229 135 223 123 213 C107 199 98 178 98 146 C98 100 116 66 160 66 Z'

const ROBE_PATH = 'M40 320 C44 262 88 240 128 232 Q160 272 192 232 C232 240 276 262 280 320 Z'
const SASH_PATH = 'M204 234 C176 256 120 282 92 320 L150 320 C176 290 220 270 256 258 C240 244 222 236 204 234 Z'

// Almond ("lotus") eye, in left-eye coordinates.
const EYE_X = 127
const EYE_Y = 153
const EYE_PATH =
  'M103 150 C109 140.5 118 137 128.5 137 C139 137 146 143 150 155 ' +
  'C143 163 135 166.5 126 166.5 C116 166.5 108 160 103 150 Z'

function quadPoint(t: number, p0: number[], p1: number[], p2: number[]) {
  const u = 1 - t
  return {
    x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  }
}

// Radial fibres of the iris, as one path.
const IRIS_FIBERS = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2
  const r1 = 6.4
  const r2 = 13 - (i % 3) * 1.6
  const p = (r: number) =>
    `${(EYE_X + Math.cos(a) * r).toFixed(2)} ${(EYE_Y + Math.sin(a) * r).toFixed(2)}`
  return `M${p(r1)} L${p(r2)}`
}).join(' ')

// Pearl mala, leaving a gap at the centre for the pendant.
const PEARLS = Array.from({ length: 19 }, (_, i) => i / 18)
  .filter((t) => Math.abs(t - 0.5) > 0.06)
  .map((t) => quadPoint(t, [124, 236], [160, 302], [196, 236]))

// Jasmine string wound round the top-knot.
const JASMINE = Array.from({ length: 9 }, (_, i) =>
  quadPoint(i / 8, [134, 48], [160, 68], [186, 48]),
)

const MIRROR = 'translate(320,0) scale(-1,1)'
const SHADOW = '#2d5b8a'

// ── Eye ───────────────────────────────────────────────────────
// Drawn in left-eye coordinates. The right eye reuses the exact geometry
// mirrored about the face centre line (x = 160), which keeps the halves
// symmetrical. Specular highlights are the exception: they must sit on the
// same side on screen in both eyes, so their x is un-mirrored.
function Eye({
  irisRef,
  closed,
  mirrored = false,
}: {
  irisRef: React.RefObject<SVGGElement | null>
  closed: boolean
  mirrored?: boolean
}) {
  const hx = (dx: number) => (mirrored ? EYE_X - dx : EYE_X + dx)

  return (
    <g
      className={`rama-eye ${closed ? 'rama-eye--closed' : ''}`}
      transform={mirrored ? MIRROR : undefined}
    >
      {/* Socket shading on the upper lid */}
      <ellipse cx="128" cy="134" rx="26" ry="10" fill="url(#ramaLidShade)" />

      {/* Lid crease — stops short of the corners so it never rings the eye */}
      <path
        className="rama-crease"
        d="M109 132 C116 126.5 126 125 135 126 C142 127 147 131 149.5 137"
      />

      <g clipPath="url(#ramaEyeClip)">
        {/* Sclera, greying towards the corners */}
        <path d={EYE_PATH} fill="url(#ramaEyeWhite)" />

        {/* Caruncle — the pink inner corner */}
        <ellipse cx="148" cy="155" rx="2.6" ry="3.2" fill="#d990a6" opacity="0.55" />

        {/* Iris — this group is what tracks the cursor. It is slightly
            taller than the opening, so both lids rest on it. */}
        <g ref={irisRef} className="rama-iris">
          <circle cx={EYE_X} cy={EYE_Y} r="14.5" fill="url(#ramaIris)" />
          <path d={IRIS_FIBERS} className="rama-iris-fibers" />
          {/* Light bouncing up through the lower half of the iris */}
          <ellipse cx={EYE_X} cy={EYE_Y + 7} rx="9" ry="5" fill="#f0b877" opacity="0.4" />
          {/* Collarette and limbal ring */}
          <circle cx={EYE_X} cy={EYE_Y} r="7.4" fill="none" stroke="#e0a868" strokeWidth="1.3" opacity="0.45" />
          <circle cx={EYE_X} cy={EYE_Y} r="13.4" fill="none" stroke="#1a0d05" strokeWidth="1.8" opacity="0.7" />
          <circle cx={EYE_X} cy={EYE_Y} r="5.4" fill="#0e0704" />
          {/* Specular highlights: a window-shaped key light and a small fill */}
          <ellipse cx={hx(-5.4)} cy={EYE_Y - 6.4} rx="3.8" ry="3.2" fill="#ffffff" opacity="0.95" />
          <circle cx={hx(6)} cy={EYE_Y + 6} r="1.7" fill="#ffffff" opacity="0.7" />
        </g>

        {/* Shadow the upper lid casts on the eyeball */}
        <rect x="100" y="134" width="54" height="15" fill="url(#ramaLidCast)" />

        {/* Blink lid — scales down from the top, clipped to the eye */}
        <rect
          className={`rama-eyelid ${closed ? 'rama-eyelid--closed' : ''}`}
          x="100" y="132" width="54" height="40"
          fill="url(#ramaSkin)"
        />
      </g>

      {/* Lower lid */}
      <path
        className="rama-lid-lower"
        d="M108 158 C114 165.5 121 168.8 129 168.8 C137 168.8 144 165 149.5 158.5"
      />

      {/* Upper lash line — a heavier overdraw on the outer third fakes the
          taper of a brush stroke, and a few lashes grow out of it. */}
      <path
        className="rama-lash"
        d="M101.5 150.5 C108 139 117 135 128.5 135 C140 135 147.5 142 151.5 156"
      />
      <path className="rama-lash rama-lash--outer" d="M101.5 150.5 C105 143 110 138.5 118 136.2" />
      <path
        className="rama-lash rama-lash--single"
        d="M104.5 147 L97.5 142.5 M108.5 142 L103 136.8 M113.5 138.4 L110.5 132.6"
      />

      {/* Closed-eye curve, cross-faded in on a blink */}
      <path
        className={`rama-eye-closed ${closed ? 'rama-eye-closed--on' : ''}`}
        d="M102 151 C112 161 138 163.5 151 156"
      />
    </g>
  )
}

// ── Ear with kundala earring (left-ear coordinates) ──────────
function Ear({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? MIRROR : undefined}>
      <path
        className="rama-ear"
        d="M99 141 C90 136 80 141 79 152 C78 163 82 171 88 175 C92 178 96 176 99 172 Z"
        fill="url(#ramaSkin)"
      />
      <ellipse cx="92.5" cy="157" rx="4.2" ry="6.5" fill={SHADOW} opacity="0.32" />
      <path className="rama-ear-fold" d="M96 144.5 C88.5 141.5 83.5 146.5 84 154 C84.5 161 87.5 166 91.5 169" />
      <path d="M88.5 150 C86.5 155 87.5 160.5 90.5 164" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />

      <g className="rama-earring">
        <circle cx="88" cy="174.5" r="3.2" fill="url(#ramaGold)" stroke="#8a5a0a" strokeWidth="0.8" />
        <circle cx="88" cy="185" r="7.2" fill="none" stroke="#8a5a0a" strokeWidth="4.4" />
        <circle cx="88" cy="185" r="7.2" fill="none" stroke="url(#ramaGold)" strokeWidth="3" />
        <path d="M84 180.5 Q86.5 178.8 89.5 179.2" fill="none" stroke="#fff6c2" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
        <ellipse cx="88" cy="195.5" rx="2.8" ry="3.8" fill="url(#ramaRuby)" stroke="#8a5a0a" strokeWidth="0.8" />
        <circle cx="88" cy="201.5" r="1.8" fill="#fbf7ee" />
      </g>
    </g>
  )
}

// ── Front lock of hair, swept from the centre parting (left side) ──
function FrontLock({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? MIRROR : undefined}>
      <path
        d="M159 68 C138 66 114 74 104 98 C99 110 97.5 124 98.5 139 C102.5 128 108 118 116 110 C126 100 141 92 158.5 88.5 Z"
        fill="url(#ramaHair)"
      />
      <path
        className="rama-hair-strands"
        d="M155 74 C136 76 118 86 108 108 M151 81 C134 85 120 96 110 118 M140 78 C124 84 112 96 104 120 M156 86 C138 90 122 100 114 112"
      />
      <path className="rama-hair-sheen" d="M150 75 C134 78 121 86 113 97" />
    </g>
  )
}

export default function Rama({ mood = 'idle' }: RamaProps) {
  const irisLeftRef = useRef<SVGGElement>(null)
  const irisRightRef = useRef<SVGGElement>(null)
  const faceRef = useRef<SVGSVGElement>(null)
  const mouthRef = useRef<SVGGElement>(null)
  const mouthClipRef = useRef<SVGPathElement>(null)
  const mouthInnerRef = useRef<SVGGElement>(null)

  const [blinking, setBlinking] = useState(false)
  const [winking, setWinking] = useState(false)

  // ── Eyes track the cursor ──────────────────────────────────
  useEffect(() => {
    const maxOffset = 3.2
    let raf = 0

    const handleMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const svg = faceRef.current
        const leftIris = irisLeftRef.current
        const rightIris = irisRightRef.current
        if (!svg || !leftIris || !rightIris) return

        const rect = svg.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height * 0.47

        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const dist = Math.hypot(dx, dy) || 1
        const ox = (dx / dist) * Math.min(maxOffset, dist / 40)
        const oy = (dy / dist) * Math.min(maxOffset, dist / 40)

        leftIris.setAttribute('transform', `translate(${ox} ${oy})`)
        // The right eye lives inside a mirrored group, so its local x axis
        // runs the other way — negate to keep both irises pointing the same
        // direction on screen.
        rightIris.setAttribute('transform', `translate(${-ox} ${oy})`)
      })
    }

    window.addEventListener('mousemove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // ── Idle blinking ───────────────────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3200
      timeout = setTimeout(() => {
        setBlinking(true)
        setTimeout(() => setBlinking(false), 140)
        scheduleBlink()
      }, delay)
    }

    scheduleBlink()
    return () => clearTimeout(timeout)
  }, [])

  // ── Mouth: mood shape, or talk-cycle while speaking ─────────
  useEffect(() => {
    const applyShape = (key: string) => {
      const next = MOUTH[key]
      const paths = mouthPaths(next)
      mouthClipRef.current?.setAttribute('d', paths.shape)
      mouthRef.current
        ?.querySelectorAll<SVGPathElement>('[data-part]')
        .forEach((el) => el.setAttribute('d', paths[el.dataset.part as MouthPart]))
      mouthInnerRef.current?.setAttribute('opacity', next.open ? '1' : '0')
    }

    if (mood !== 'speaking') {
      applyShape(mood)
      return
    }

    let frame = 0
    applyShape(TALK_CYCLE[0])
    const interval = setInterval(() => {
      frame = (frame + 1) % TALK_CYCLE.length
      applyShape(TALK_CYCLE[frame])
    }, 120)

    return () => clearInterval(interval)
  }, [mood])

  // ── Click: a quick wink, in addition to whatever the parent does ──
  const handleWink = () => {
    if (winking) return
    setWinking(true)
    setTimeout(() => setWinking(false), 320)
  }

  return (
    <div
      className={`rama-root rama-root--${mood}`}
      role="img"
      aria-label="Interactive Lord Rama avatar"
    >
      <div className={`rama-aura rama-aura--${mood}`} aria-hidden="true" />

      <div className="rama-frame" onClick={handleWink}>
        <svg
          ref={faceRef}
          className="rama-face"
          viewBox="0 0 320 320"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ramaFrameBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--rama-frame-top)" />
              <stop offset="100%" stopColor="var(--rama-frame-bottom)" />
            </linearGradient>
            <radialGradient id="ramaHalo" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            {/* Soft-shading blurs. User-space regions so blurred edges are
                never cropped to a shape's bounding box. */}
            <filter id="ramaBlur" filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
            <filter id="ramaBlurSm" filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>

            {/* Skin runs in user space so face, ears, neck and eyelids all
                sample the same ramp and stay seamless. */}
            <linearGradient id="ramaSkin" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="250">
              <stop offset="0%" stopColor="#d9eeff" />
              <stop offset="45%" stopColor="#b6dbf8" />
              <stop offset="100%" stopColor="#80b6e0" />
            </linearGradient>

            <radialGradient id="ramaEyeWhite" gradientUnits="userSpaceOnUse" cx="126" cy="152" r="26">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f3f7fb" />
              <stop offset="100%" stopColor="#b9cadd" />
            </radialGradient>
            <linearGradient id="ramaLidCast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e2a44" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1e2a44" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ramaLidShade" cx="0.55" cy="0.6" r="0.5">
              <stop offset="0%" stopColor="#4a6fa8" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#4a6fa8" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="ramaIris" cx="0.5" cy="0.4" r="0.62">
              <stop offset="0%" stopColor="#c68a4a" />
              <stop offset="40%" stopColor="#8a5226" />
              <stop offset="85%" stopColor="#4a2a12" />
              <stop offset="100%" stopColor="#24130a" />
            </radialGradient>

            <radialGradient id="ramaBlush" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#9a86e8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#9a86e8" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="ramaMouthInner" gradientUnits="userSpaceOnUse" x1="0" y1="186" x2="0" y2="228">
              <stop offset="0%" stopColor="#5d1b26" />
              <stop offset="100%" stopColor="#2e0f16" />
            </linearGradient>
            <linearGradient id="ramaTeeth" gradientUnits="userSpaceOnUse" x1="0" y1="184" x2="0" y2="204">
              <stop offset="0%" stopColor="#cfc6d6" />
              <stop offset="45%" stopColor="#fdfcff" />
              <stop offset="100%" stopColor="#e6e0ea" />
            </linearGradient>
            <linearGradient id="ramaLipUpper" gradientUnits="userSpaceOnUse" x1="0" y1="186" x2="0" y2="202">
              <stop offset="0%" stopColor="#a86a8a" />
              <stop offset="100%" stopColor="#7c3f5e" />
            </linearGradient>
            <linearGradient id="ramaLipLower" gradientUnits="userSpaceOnUse" x1="0" y1="198" x2="0" y2="222">
              <stop offset="0%" stopColor="#8e4b6c" />
              <stop offset="45%" stopColor="#b77a97" />
              <stop offset="100%" stopColor="#9a5a7a" />
            </linearGradient>

            <linearGradient id="ramaHair" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="250">
              <stop offset="0%" stopColor="#2a2a4c" />
              <stop offset="40%" stopColor="#17172b" />
              <stop offset="100%" stopColor="#0b0b16" />
            </linearGradient>
            <linearGradient id="ramaHairShine" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="220" y2="0">
              <stop offset="0%" stopColor="#6a6aa8" stopOpacity="0" />
              <stop offset="50%" stopColor="#7a7ab8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#6a6aa8" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="ramaGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff2a8" />
              <stop offset="45%" stopColor="#f3c13f" />
              <stop offset="100%" stopColor="#b27a12" />
            </linearGradient>
            <radialGradient id="ramaRuby" cx="0.38" cy="0.32" r="0.7">
              <stop offset="0%" stopColor="#ff9aa8" />
              <stop offset="40%" stopColor="#d9122f" />
              <stop offset="100%" stopColor="#6a0414" />
            </radialGradient>
            <radialGradient id="ramaPearl" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f4efe4" />
              <stop offset="100%" stopColor="#c9bfae" />
            </radialGradient>

            <linearGradient id="ramaRobe" gradientUnits="userSpaceOnUse" x1="0" y1="232" x2="0" y2="320">
              <stop offset="0%" stopColor="#ffa24a" />
              <stop offset="100%" stopColor="#e86a0a" />
            </linearGradient>
            <linearGradient id="ramaSilk" gradientUnits="userSpaceOnUse" x1="250" y1="240" x2="100" y2="320">
              <stop offset="0%" stopColor="#ffe27a" />
              <stop offset="55%" stopColor="#f9c43a" />
              <stop offset="100%" stopColor="#e39a14" />
            </linearGradient>
            <linearGradient id="ramaBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5a66" />
              <stop offset="100%" stopColor="#b81f2e" />
            </linearGradient>

            <clipPath id="ramaFrameClip">
              <rect x="4" y="4" width="312" height="312" rx="64" />
            </clipPath>
            <clipPath id="ramaFaceClip">
              <path d={FACE_PATH} />
            </clipPath>
            <clipPath id="ramaRobeClip">
              <path d={ROBE_PATH} />
            </clipPath>
            <clipPath id="ramaSashClip">
              <path d={SASH_PATH} />
            </clipPath>
            <clipPath id="ramaNeckClip">
              <path d="M143 186 L143 222 C142 236 136 248 122 256 L198 256 C184 248 178 236 177 222 L177 186 Z" />
            </clipPath>

            {/* Left-eye geometry; the mirrored right eye reuses it because a
                clip resolves in the user space of whatever references it. */}
            <clipPath id="ramaEyeClip">
              <path d={EYE_PATH} />
            </clipPath>

            <clipPath id="ramaMouthClip">
              <path ref={mouthClipRef} d={IDLE_MOUTH.shape} />
            </clipPath>
          </defs>

          {/* Frame badge background */}
          <rect x="4" y="4" width="312" height="312" rx="64" fill="url(#ramaFrameBg)" />

          <g clipPath="url(#ramaFrameClip)">
            {/* Halo — a soft disc of light with a fine gilt ring */}
            <circle cx="160" cy="134" r="128" fill="url(#ramaHalo)" />
            <circle cx="160" cy="134" r="106" fill="none" stroke="#e8b43c" strokeWidth="1.4" opacity="0.4" />
            <circle cx="160" cy="134" r="113" fill="none" stroke="#e8b43c" strokeWidth="2" strokeDasharray="0.1 7" strokeLinecap="round" opacity="0.5" />

            {/* ── Neck ── */}
            <g>
              <path
                d="M143 186 L143 222 C142 236 136 248 122 256 L198 256 C184 248 178 236 177 222 L177 186 Z"
                fill="url(#ramaSkin)"
              />
              <g clipPath="url(#ramaNeckClip)">
                <g filter="url(#ramaBlur)" fill={SHADOW}>
                  {/* Chin's cast shadow, and the side turned from the light */}
                  <path d="M136 196 Q160 232 184 196 L184 214 Q160 240 136 214 Z" opacity="0.55" />
                  <rect x="170" y="190" width="14" height="60" opacity="0.3" />
                  <ellipse cx="160" cy="246" rx="5" ry="4" opacity="0.4" />
                </g>
                <path className="rama-neck-line" d="M150 216 C152 228 155 238 158 245 M170 216 C168 228 165 238 162 245" />
                <path className="rama-neck-line" d="M134 247 Q145 242.5 155 245.5 M186 247 Q175 242.5 165 245.5" />
              </g>
            </g>

            {/* ── Robe ── */}
            <path className="rama-robe" d={ROBE_PATH} fill="url(#ramaRobe)" />
            <g clipPath="url(#ramaRobeClip)">
              <g filter="url(#ramaBlur)">
                <path d="M66 320 C72 290 90 266 116 252" fill="none" stroke="#a33f00" strokeWidth="7" opacity="0.35" />
                <path d="M254 320 C248 292 234 270 212 256" fill="none" stroke="#a33f00" strokeWidth="8" opacity="0.35" />
                <path d="M84 304 C92 282 106 266 124 256" fill="none" stroke="#ffe0b0" strokeWidth="5" opacity="0.4" />
                <ellipse cx="86" cy="262" rx="28" ry="9" fill="#ffd9a8" opacity="0.4" />
                <path d="M128 232 Q160 272 192 232" fill="none" stroke="#7a2c00" strokeWidth="8" opacity="0.3" />
              </g>
            </g>
            {/* Gold neckline trim with a beaded inner edge */}
            <path d="M128 232 Q160 272 192 232" fill="none" stroke="#8a5a0a" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M128 232 Q160 272 192 232" fill="none" stroke="url(#ramaGold)" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M128 232 Q160 272 192 232" fill="none" stroke="#fff4b8" strokeWidth="1.8" strokeDasharray="0.1 4.5" strokeLinecap="round" />

            {/* Uttariya — yellow silk shawl over the left shoulder */}
            <path d={SASH_PATH} fill="url(#ramaSilk)" />
            <g clipPath="url(#ramaSashClip)">
              <g filter="url(#ramaBlur)">
                <path d="M118 320 C140 294 178 272 224 256" fill="none" stroke="#a86400" strokeWidth="6" opacity="0.35" />
                <path d="M102 320 C124 292 160 270 208 248" fill="none" stroke="#fff6c8" strokeWidth="5" opacity="0.55" />
                <path d="M136 320 C156 300 190 282 240 262" fill="none" stroke="#fff6c8" strokeWidth="3" opacity="0.4" />
              </g>
              {/* Woven border motif */}
              <path d="M204 234 C176 256 120 282 92 320" fill="none" stroke="#c0392b" strokeWidth="6" />
              <path d="M204 234 C176 256 120 282 92 320" fill="none" stroke="url(#ramaGold)" strokeWidth="3" strokeDasharray="4 3" />
              <path d="M150 320 C176 290 220 270 256 258" fill="none" stroke="#c0392b" strokeWidth="6" />
              <path d="M150 320 C176 290 220 270 256 258" fill="none" stroke="url(#ramaGold)" strokeWidth="3" strokeDasharray="4 3" />
            </g>

            {/* ── Jewellery on the chest ── */}
            {/* Fine gold chain on the neck */}
            <path d="M140 236 Q160 258 180 236" fill="none" stroke="#8a5a0a" strokeWidth="2.6" />
            <path d="M140 236 Q160 258 180 236" fill="none" stroke="#f6cf55" strokeWidth="1.6" strokeDasharray="1.6 1.2" />
            {/* Pearl mala */}
            <g className="rama-mala">
              {PEARLS.map((p, i) => (
                <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="3.1" fill="url(#ramaPearl)" stroke="#9c8f7a" strokeWidth="0.5" />
              ))}
              <circle cx="160" cy="262.5" r="2.4" fill="none" stroke="url(#ramaGold)" strokeWidth="1.6" />
              <path
                d="M160 264 C167 270 167.5 281 160 287 C152.5 281 153 270 160 264 Z"
                fill="url(#ramaGold)" stroke="#8a5a0a" strokeWidth="1"
              />
              <ellipse cx="160" cy="276" rx="3.2" ry="4.6" fill="url(#ramaRuby)" />
              <circle cx="160" cy="289.5" r="2" fill="url(#ramaPearl)" />
            </g>

            {/* ── Back hair, falling behind the shoulders ── */}
            <g className="rama-hair-back">
              <path
                d="M160 46
                   Q96 50 88 118
                   Q84 168 94 226
                   Q102 256 124 236
                   Q112 176 118 130
                   Q122 88 160 82
                   Q198 88 202 130
                   Q208 176 196 236
                   Q218 256 226 226
                   Q236 168 232 118
                   Q224 50 160 46 Z"
                fill="url(#ramaHair)"
              />
              <path className="rama-hair-strands" d="M104 90 Q92 140 98 206 M110 104 Q100 160 106 232 M116 118 Q108 170 114 236 M98 130 Q94 176 100 224" />
              <path className="rama-hair-strands" transform={MIRROR} d="M104 90 Q92 140 98 206 M110 104 Q100 160 106 232 M116 118 Q108 170 114 236 M98 130 Q94 176 100 224" />
              <path className="rama-hair-sheen" d="M98 112 Q92 150 96 188" />
            </g>

            {/* ── Ears ── */}
            <Ear />
            <Ear mirrored />

            {/* ── Face ── */}
            <path className="rama-face-shape" d={FACE_PATH} fill="url(#ramaSkin)" />

            <g clipPath="url(#ramaFaceClip)">
              {/* Shadows: hairline, temples, cheekbones, jaw, eye sockets,
                  the shaded side of the nose and its cast shadow. */}
              <g filter="url(#ramaBlur)" fill="none" stroke={SHADOW}>
                <path d="M99 142 C104 116 124 98 158 90 M162 90 C196 98 216 116 221 142" strokeWidth="9" opacity="0.4" />
                <path d="M106 178 C114 196 128 206 142 212 M214 178 C206 196 192 206 178 212" strokeWidth="8" opacity="0.2" />
                <path d="M102 172 C110 204 136 224 160 226 C184 224 210 204 218 172" strokeWidth="11" opacity="0.32" />
                <path d="M165.5 146 C167.5 158 168.5 166 168 175" strokeWidth="4" opacity="0.38" />
                <path d="M154.5 148 C153 158 152.5 166 153 174" strokeWidth="3" opacity="0.16" />
                <g stroke="none" fill={SHADOW}>
                  <ellipse cx="104" cy="150" rx="9" ry="30" opacity="0.28" />
                  <ellipse cx="216" cy="152" rx="12" ry="34" opacity="0.36" />
                  <ellipse cx="152" cy="141" rx="5" ry="9" opacity="0.3" />
                  <ellipse cx="168" cy="141" rx="5" ry="9" opacity="0.38" />
                  <ellipse cx="161" cy="186.5" rx="7" ry="3" opacity="0.4" />
                  <ellipse cx="160" cy="189" rx="2.4" ry="4" opacity="0.2" />
                </g>
              </g>

              {/* Highlights: forehead, nose bridge and tip, cheeks, chin,
                  and a rim of light along the lit edge. */}
              <g filter="url(#ramaBlur)" fill="#ffffff">
                <ellipse cx="146" cy="104" rx="20" ry="8" opacity="0.5" />
                <ellipse cx="158.5" cy="160" rx="2.4" ry="12" opacity="0.55" />
                <ellipse cx="158.5" cy="174" rx="3.6" ry="2.6" opacity="0.7" />
                <ellipse cx="124" cy="178" rx="11" ry="6" opacity="0.4" />
                <ellipse cx="197" cy="180" rx="8" ry="4.5" opacity="0.2" />
                <ellipse cx="158" cy="223" rx="8" ry="3" opacity="0.35" />
                <path d="M101 124 C98.5 144 100 168 108 188" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.55" />
              </g>
            </g>

            {/* Cheek blush */}
            <ellipse className="rama-blush" cx="119" cy="186" rx="17" ry="10" fill="url(#ramaBlush)" />
            <ellipse className="rama-blush" cx="201" cy="186" rx="17" ry="10" fill="url(#ramaBlush)" />

            {/* ── Front hair, parted in the centre ── */}
            <FrontLock />
            <FrontLock mirrored />

            {/* ── Top-knot with jasmine and a red band ── */}
            <g className="rama-bun">
              <circle cx="160" cy="54" r="30" fill="url(#ramaHair)" />
              <path className="rama-bun-swirl" d="M160 34 Q176 40 172 58 Q166 48 152 50" fill="#22223c" />
              <path
                className="rama-hair-strands"
                d="M137 58 Q138 34 162 30 M142 68 Q138 44 158 38 Q176 36 184 52 M150 76 Q176 74 186 54 M146 40 Q160 26 178 36"
              />
              <path className="rama-hair-shine" d="M142 42 Q160 34 178 44 Q160 40 146 50 Z" fill="url(#ramaHairShine)" />
              {JASMINE.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="3" fill="#fbfaf2" stroke="#cfcab8" strokeWidth="0.6" />
                  <circle cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="0.9" fill="#f2c94c" />
                </g>
              ))}
            </g>
            <rect x="132" y="64" width="56" height="12" rx="5" fill="url(#ramaBand)" />
            <rect x="133" y="65.2" width="54" height="1.6" rx="0.8" fill="url(#ramaGold)" />
            <rect x="133" y="73.2" width="54" height="1.6" rx="0.8" fill="url(#ramaGold)" />
            <circle cx="148" cy="70" r="1.7" fill="url(#ramaPearl)" />
            <circle cx="172" cy="70" r="1.7" fill="url(#ramaPearl)" />
            <circle cx="160" cy="70" r="6" fill="url(#ramaGold)" stroke="#8a5a0a" strokeWidth="1" />
            <circle cx="160" cy="70" r="2.8" fill="url(#ramaRuby)" />

            {/* Tilak — Vaishnava urdhva pundra: a pale U with a red centre line */}
            <g className="rama-tilak">
              <path d="M154 96 C154 108 154.5 116 157 121 Q160 125 163 121 C165.5 116 166 108 166 96" fill="none" stroke="#fff5d8" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M160 100 L160 117" stroke="#d9203a" strokeWidth="2.4" strokeLinecap="round" />
            </g>

            {/* Eyebrows — tapered, with a few hair strokes along the grain */}
            <g className="rama-brow">
              <path
                className="rama-brow-fill"
                d="M102 125 C111 114 126 109.5 138 112 C143 113 146.5 115 147 118 C147.4 121 146 123 144 122
                   C136 118 122 116.5 111 121 C107 123 104 125.5 102 125 Z"
              />
              <path className="rama-brow-hairs" d="M144 120 L139 115.5 M137 117.5 L131 114 M128 117 L121 114.5 M119 118.5 L112 117.5" />
            </g>
            <g transform={MIRROR}>
              <g className="rama-brow">
                <path
                  className="rama-brow-fill"
                  d="M102 125 C111 114 126 109.5 138 112 C143 113 146.5 115 147 118 C147.4 121 146 123 144 122
                     C136 118 122 116.5 111 121 C107 123 104 125.5 102 125 Z"
                />
                <path className="rama-brow-hairs" d="M144 120 L139 115.5 M137 117.5 L131 114 M128 117 L121 114.5 M119 118.5 L112 117.5" />
              </g>
            </g>

            {/* ── Eyes ── */}
            <Eye irisRef={irisLeftRef} closed={blinking || winking} />
            <Eye irisRef={irisRightRef} closed={blinking} mirrored />

            {/* ── Nose — alar wings, nostrils and underside; no hard outline ── */}
            <path className="rama-nose-shadow" d="M152.5 176 C150 177.5 150 181.5 154 182.5 L166 182.5 C170 181.5 170 177.5 167.5 176 Z" />
            <path className="rama-nose-under" d="M151.5 175.5 C148.5 177 148.5 181.5 153 182 M168.5 175.5 C171.5 177 171.5 181.5 167 182" />
            <ellipse className="rama-nostril" cx="155.8" cy="181" rx="2.5" ry="1.3" />
            <ellipse className="rama-nostril" cx="164.2" cy="181" rx="2.5" ry="1.3" />
            <path className="rama-nose-under" d="M155 183.2 Q160 185.2 165 183.2" />

            {/* ── Mouth ── every [data-part] path is re-shaped per mood */}
            <g ref={mouthRef} className="rama-mouth-group">
              <path data-part="shadow" className="rama-lip-shadow" d={IDLE_MOUTH.shadow} filter="url(#ramaBlurSm)" />
              <path data-part="lower" className="rama-lip-lower" d={IDLE_MOUTH.lower} />
              <path data-part="shape" className="rama-mouth" d={IDLE_MOUTH.shape} />
              <g ref={mouthInnerRef} clipPath="url(#ramaMouthClip)" opacity={MOUTH.idle.open ? 1 : 0}>
                {/* Tongue first, then the upper teeth over it */}
                <ellipse cx="160" cy="228" rx="18" ry="12" fill="#d9607a" />
                <ellipse cx="160" cy="225" rx="11" ry="6" fill="#f08fa1" opacity="0.55" />
                <path d="M160 218 L160 232" stroke="#b44a62" strokeWidth="1.2" opacity="0.5" />
                <ellipse cx="160" cy="193" rx="27" ry="10" fill="url(#ramaTeeth)" />
                <path d="M152 188 L152.5 202 M168 188 L167.5 202 M144 189 L145.5 200 M176 189 L174.5 200" stroke="#c9c0cf" strokeWidth="0.9" opacity="0.6" />
                <rect x="126" y="182" width="68" height="8" fill="#2e0f16" opacity="0.3" filter="url(#ramaBlurSm)" />
              </g>
              <path data-part="upper" className="rama-lip-upper" d={IDLE_MOUTH.upper} />
              <path data-part="line" className="rama-mouth-line" d={IDLE_MOUTH.line} />
              <path data-part="corners" className="rama-mouth-corner" d={IDLE_MOUTH.corners} />
              <path data-part="upperLight" className="rama-lip-light rama-lip-light--upper" d={IDLE_MOUTH.upperLight} />
              <path data-part="lowerLight" className="rama-lip-light" d={IDLE_MOUTH.lowerLight} />
            </g>
          </g>

          {/* Frame ring */}
          <rect
            x="4" y="4" width="312" height="312" rx="64"
            fill="none" stroke="var(--rama-frame-ring)" strokeWidth="6"
          />
        </svg>
      </div>
    </div>
  )
}
