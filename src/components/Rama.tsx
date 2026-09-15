// Rama component — interactive avatar
// A single hand-built SVG face rig, framed like an app-icon badge.
// Eyes track the cursor, the character blinks on its own, and the
// mouth animates while Rama is speaking — all driven imperatively via
// refs so idle tracking never triggers a React re-render.
//
// Proportions follow a realistic head: eyes on the vertical midline of
// the head and one eye-width apart, brow / nose base / chin splitting the
// face in thirds, ears spanning brow to nose. Rendering is matte cel
// shading — thin line art, one soft shadow tone, almost no highlights.
// Soft shading is painted as plain shapes inside one blurred group clipped
// to the face, so it costs a single blur pass.

import { useEffect, useRef, useState } from 'react'
import './Rama.css'

type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

interface RamaProps {
  mood?: RamaMood
}

// ── Mouth ─────────────────────────────────────────────────────
// Each mouth is described by its two corners and the control points of
// the upper line (`top`) and the bottom of the opening (`bottom`). Every
// lip layer is derived from those same numbers on every frame, so the
// lips can never drift apart. Moods are just target values: the rig
// eases the current numbers towards them in JS, which is smooth in every
// browser (CSS `d` transitions are Chromium-only).
type MouthShape = {
  x1: number
  y1: number
  x2: number
  y2: number
  top: number
  bottom: number
  cx: number
}

const MOUTH_KEYS = ['x1', 'y1', 'x2', 'y2', 'top', 'bottom', 'cx'] as const

// Idle is a closed, warm smile: corners lifted ~3.5 units above the
// centre of the lip line — clearly pleasant, nowhere near a grin.
const MOUTH: Record<'idle' | 'happy' | 'thinking' | 'amused' | 'talkClosed' | 'talkOpen', MouthShape> = {
  idle: { x1: 141, y1: 206, x2: 179, y2: 206, top: 213, bottom: 217, cx: 160 },
  happy: { x1: 138, y1: 203.5, x2: 182, y2: 203.5, top: 212, bottom: 226, cx: 160 },
  thinking: { x1: 148, y1: 209, x2: 172, y2: 207.5, top: 208, bottom: 213, cx: 158 },
  amused: { x1: 137, y1: 202.5, x2: 183, y2: 202.5, top: 213, bottom: 229, cx: 160 },
  talkClosed: { x1: 143, y1: 207, x2: 177, y2: 207, top: 211.5, bottom: 214.5, cx: 160 },
  talkOpen: { x1: 145.5, y1: 206.5, x2: 174.5, y2: 206.5, top: 210.5, bottom: 226, cx: 160 },
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const f = (n: number) => n.toFixed(2)

function mouthPaths({ x1, y1, x2, y2, top, bottom, cx }: MouthShape) {
  // A quadratic's midpoint sits at ¼·start + ½·control + ¼·end.
  const lineMid = (y1 + y2) / 4 + top / 2
  const openMid = (y1 + y2) / 4 + bottom / 2
  // How far the lips are parted drives teeth visibility and lip thinning
  // continuously, so opening and closing never pops.
  const parted = clamp01((openMid - lineMid - 2.5) / 3.5)
  const upperThick = 3.3 - 0.5 * parted
  const lowerThick = 4.2 - 0.6 * parted
  const bow = lineMid - upperThick
  // On-curve centre of the lower lip's outer edge (not a control point).
  const lowerOuter = openMid + lowerThick + 0.5
  const hl = openMid + lowerThick * 0.5
  const sh = openMid + lowerThick + 3

  return {
    parted,
    paths: {
      shape: `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(bottom)} ${f(x2)} ${f(y2)} Q${f(cx)} ${f(top)} ${f(x1)} ${f(y1)} Z`,
      line: `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(top)} ${f(x2)} ${f(y2)}`,
      upper:
        `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(top)} ${f(x2)} ${f(y2)} ` +
        `C${f(x2 - 5)} ${f(y2 - 1.2)} ${f(cx + 9)} ${f(bow)} ${f(cx + 3.6)} ${f(bow)} ` +
        `Q${f(cx)} ${f(bow + 1.3)} ${f(cx - 3.6)} ${f(bow)} ` +
        `C${f(cx - 9)} ${f(bow)} ${f(x1 + 5)} ${f(y1 - 1.2)} ${f(x1)} ${f(y1)} Z`,
      // The lower lip's outer edge is a cubic pulled in from the corners,
      // so it tapers into them instead of ending in a blunt crescent.
      lower:
        `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(bottom)} ${f(x2)} ${f(y2)} ` +
        `C${f(x2 - 4)} ${f(y2 + 2)} ${f(cx + 9)} ${f(lowerOuter - 0.5)} ${f(cx)} ${f(lowerOuter - 0.5)} ` +
        `C${f(cx - 9)} ${f(lowerOuter - 0.5)} ${f(x1 + 4)} ${f(y1 + 2)} ${f(x1)} ${f(y1)} Z`,
      lowerLight: `M${f(cx - 5)} ${f(hl)} Q${f(cx)} ${f(hl + 1.2)} ${f(cx + 5)} ${f(hl)}`,
      shadow: `M${f(cx - 8)} ${f(sh)} Q${f(cx)} ${f(sh + 3)} ${f(cx + 8)} ${f(sh)}`,
      // Small upturned creases at the corners carry the smile.
      corners:
        `M${f(x1 + 1.4)} ${f(y1 - 1.8)} Q${f(x1 - 1.6)} ${f(y1 - 0.4)} ${f(x1 + 0.2)} ${f(y1 + 2.2)} ` +
        `M${f(x2 - 1.4)} ${f(y2 - 1.8)} Q${f(x2 + 1.6)} ${f(y2 - 0.4)} ${f(x2 - 0.2)} ${f(y2 + 2.2)}`,
    },
  }
}

type MouthPart = keyof ReturnType<typeof mouthPaths>['paths']
const IDLE_MOUTH = mouthPaths(MOUTH.idle)

// ── Static geometry ───────────────────────────────────────────
// Cheekbones at the widest point, then near-straight planes down to a
// sharp jaw angle and a squared chin.
const FACE_PATH =
  'M160 84 C200 84 215 112 215 150 C215 172 213 188 209 199 C207.5 204 205 208 200 212.5 ' +
  'L179 231 C173 236 167 238 160 238 C153 238 147 236 141 231 L120 212.5 ' +
  'C115 208 112.5 204 111 199 C107 188 105 172 105 150 C105 112 120 84 160 84 Z'

// Top-knot with a scalloped, wavy silhouette.
const BUN_PATH = (() => {
  const lobes = 10
  const cx = 160
  const cy = 48
  const r = 26.5
  const pt = (a: number, rad: number) => `${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)}`
  let d = ''
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / lobes) * Math.PI * 2 - Math.PI / 2
    if (i === 0) d += `M${pt(a0, r)} `
    d += `Q${pt((a0 + a1) / 2, r + 6)} ${pt(a1, r)} `
  }
  return d + 'Z'
})()

const NECK_PATH =
  'M137 205 L137 238 C136 252 126 262 104 270 L104 292 L216 292 L216 270 ' +
  'C194 262 184 252 183 238 L183 205 Z'

const ROBE_PATH = 'M20 320 C28 284 70 266 118 262 Q160 300 202 262 C250 266 292 284 300 320 Z'
const NECKLINE = 'M118 262 Q160 300 202 262'
const SASH_PATH =
  'M214 262 C188 282 138 300 110 320 L172 320 C196 304 232 292 266 284 C252 272 234 264 214 262 Z'
const SASH_EDGE_A = 'M214 262 C188 282 138 300 110 320'
const SASH_EDGE_B = 'M172 320 C196 304 232 292 266 284'

// Almond eye, in left-eye coordinates. Right eye is the mirror image.
const EYE_X = 137
const EYE_Y = 158
const EYE_PATH =
  'M125.5 158.5 C128.5 154 132.5 152.5 137 152.5 C142 152.5 145.5 155 148.5 159.5 ' +
  'C145 162.5 141 163.8 137 163.8 C132 163.8 128 162 125.5 158.5 Z'

const BROW_PATH =
  'M151 147 C150 142.5 146 140.5 140 140 C133 139.5 126 141 120 145.5 C119 146.5 120 147.8 121.5 147.2 ' +
  'C127 145 133 144.5 140 145.2 C145 145.6 148.5 147 150.5 148.8 C151.3 149.5 151.5 148 151 147 Z'

function quadPoint(t: number, p0: number[], p1: number[], p2: number[]) {
  const u = 1 - t
  return {
    x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  }
}

// Rudraksha mala across the chest.
const BEADS = Array.from({ length: 17 }, (_, i) =>
  quadPoint(i / 16, [120, 266], [160, 322], [200, 266]),
)

const MIRROR = 'translate(320,0) scale(-1,1)'
const SHADOW = '#2d5b8a'

// ── Eye ───────────────────────────────────────────────────────
// Drawn in left-eye coordinates. The right eye reuses the exact geometry
// mirrored about the face centre line (x = 160), which keeps the halves
// symmetrical. The catch-light is the exception: it must sit on the same
// side on screen in both eyes, so its x is un-mirrored.
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
      {/* Socket shading under the brow ridge */}
      <ellipse cx="139" cy="153" rx="15" ry="7" fill="url(#ramaLidShade)" />

      {/* Lid crease */}
      <path className="rama-crease" d="M127.5 153 C131 148.8 135 147.8 139 148 C143 148.3 146 150 148 153" />

      <g clipPath="url(#ramaEyeClip)">
        <path d={EYE_PATH} fill="url(#ramaEyeWhite)" />

        {/* Caruncle — the inner corner */}
        <ellipse cx="148" cy="159.3" rx="1.6" ry="2" fill="#c98a9c" opacity="0.5" />

        {/* Iris — this group is what tracks the cursor. It is taller than
            the opening, so both lids rest on it. */}
        <g ref={irisRef} className="rama-iris">
          <circle cx={EYE_X} cy={EYE_Y} r="5.6" fill="url(#ramaIris)" />
          <ellipse cx={EYE_X} cy={EYE_Y + 2.4} rx="3.2" ry="1.8" fill="#c08a52" opacity="0.25" />
          <circle cx={EYE_X} cy={EYE_Y} r="5.2" fill="none" stroke="#1a0f08" strokeWidth="0.8" opacity="0.7" />
          <circle cx={EYE_X} cy={EYE_Y} r="2.3" fill="#0e0805" />
          <circle cx={hx(-1.9)} cy={EYE_Y - 2} r="1.1" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Shadow the upper lid casts on the eyeball */}
        <rect x="122" y="152" width="30" height="5" fill="url(#ramaLidCast)" />

        {/* Blink lid — scales down from the top, clipped to the eye */}
        <rect
          className={`rama-eyelid ${closed ? 'rama-eyelid--closed' : ''}`}
          x="122" y="150" width="30" height="16"
          fill="url(#ramaSkin)"
        />
      </g>

      <path
        className="rama-lid-lower"
        d="M127.5 161.5 C131 164.5 134 165.5 137.5 165.5 C141 165.5 144 164 147.5 161.5"
      />
      <path
        className="rama-lash"
        d="M124.5 158.8 C128 153.2 132.5 151.2 137 151.2 C142.5 151.2 146 154 149.5 159.5"
      />

      {/* Closed-eye curve, cross-faded in on a blink */}
      <path
        className={`rama-eye-closed ${closed ? 'rama-eye-closed--on' : ''}`}
        d="M125 158.5 C131 161.8 143 162.2 149 159.5"
      />
    </g>
  )
}

// ── Ear with a small gold kundala (left-ear coordinates) ─────
function Ear({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? MIRROR : undefined}>
      <path
        className="rama-ear"
        d="M108 148 C100 138 89 141 89.5 155 C90 169 95 182 103 188 C106.5 190.5 109 187 109 183 Z"
        fill="url(#ramaSkin)"
      />
      <ellipse cx="101" cy="163" rx="3.2" ry="7" fill={SHADOW} opacity="0.28" />
      <path className="rama-ear-fold" d="M105 145 C97 142.5 93 148 93.5 156 C94 166 97.5 176 102 181" />

      <g className="rama-earring">
        <circle cx="101" cy="188.5" r="1.8" fill="url(#ramaGold)" />
        <circle cx="101" cy="194.5" r="4" fill="none" stroke="#7a5212" strokeWidth="2.8" />
        <circle cx="101" cy="194.5" r="4" fill="none" stroke="url(#ramaGold)" strokeWidth="1.8" />
      </g>
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
  const mouthShapeRef = useRef<MouthShape>({ ...MOUTH.idle })

  const [blinking, setBlinking] = useState(false)
  const [winking, setWinking] = useState(false)

  // ── Eyes track the cursor ──────────────────────────────────
  useEffect(() => {
    const maxOffset = 1.6
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
        const cy = rect.top + rect.height * 0.49

        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const dist = Math.hypot(dx, dy) || 1
        const ox = (dx / dist) * Math.min(maxOffset, dist / 60)
        const oy = (dy / dist) * Math.min(maxOffset, dist / 60)

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

  // ── Mouth: ease towards the mood's shape, or lip-sync while speaking ──
  // The current shape lives in a ref so a mood change picks up from
  // wherever the lips are mid-motion instead of jumping.
  useEffect(() => {
    const group = mouthRef.current
    if (!group) return
    const parts = Array.from(group.querySelectorAll<SVGPathElement>('[data-part]'))
    const cur = mouthShapeRef.current
    const speaking = mood === 'speaking'
    const rest = speaking ? MOUTH.talkClosed : MOUTH[mood]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const apply = () => {
      const { paths, parted } = mouthPaths(cur)
      mouthClipRef.current?.setAttribute('d', paths.shape)
      for (const el of parts) el.setAttribute('d', paths[el.dataset.part as MouthPart])
      mouthInnerRef.current?.setAttribute('opacity', f(parted))
    }

    let raf = 0
    let last = performance.now()
    const target = { ...rest }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // Lip-sync is small and meaningful, so it runs even with reduced
      // motion; only the easing between moods is dropped.
      if (speaking) {
        // Syllable-rate opening (~3 Hz) with a slower swell, so the
        // rhythm feels like speech rather than a metronome.
        const t = now / 1000
        const open = clamp01(0.5 + 0.5 * Math.sin(t * 19) * (0.65 + 0.35 * Math.sin(t * 4.7 + 1.3)))
        for (const k of MOUTH_KEYS) {
          target[k] = MOUTH.talkClosed[k] + (MOUTH.talkOpen[k] - MOUTH.talkClosed[k]) * open
        }
      }

      // Frame-rate independent exponential ease.
      const ease = reduceMotion ? 1 : 1 - Math.exp(-dt * (speaking ? 20 : 9))
      let remaining = 0
      for (const k of MOUTH_KEYS) {
        cur[k] += (target[k] - cur[k]) * ease
        remaining = Math.max(remaining, Math.abs(target[k] - cur[k]))
      }
      apply()

      if (speaking || remaining > 0.01) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
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
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            {/* Soft-shading blur. A user-space region so blurred edges are
                never cropped to a shape's bounding box. */}
            <filter id="ramaBlur" filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
            <filter id="ramaBlurSm" filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="320">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>

            {/* Skin runs in user space so face, ears, neck and eyelids all
                sample the same ramp and stay seamless. Kept flat — a matte
                cel look rather than a glossy one. */}
            <linearGradient id="ramaSkin" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="290">
              <stop offset="0%" stopColor="#9ccbf2" />
              <stop offset="55%" stopColor="#88bdea" />
              <stop offset="100%" stopColor="#74abdc" />
            </linearGradient>

            <radialGradient id="ramaEyeWhite" gradientUnits="userSpaceOnUse" cx="137" cy="158" r="13">
              <stop offset="0%" stopColor="#f3f5f7" />
              <stop offset="60%" stopColor="#e4e9ef" />
              <stop offset="100%" stopColor="#b3c0d0" />
            </radialGradient>
            <linearGradient id="ramaLidCast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e2a44" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1e2a44" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ramaLidShade" cx="0.55" cy="0.55" r="0.5">
              <stop offset="0%" stopColor={SHADOW} stopOpacity="0.3" />
              <stop offset="100%" stopColor={SHADOW} stopOpacity="0" />
            </radialGradient>

            <radialGradient id="ramaIris" cx="0.5" cy="0.45" r="0.55">
              <stop offset="0%" stopColor="#8f643c" />
              <stop offset="60%" stopColor="#5e3c20" />
              <stop offset="100%" stopColor="#35220f" />
            </radialGradient>

            <linearGradient id="ramaMouthInner" gradientUnits="userSpaceOnUse" x1="0" y1="204" x2="0" y2="232">
              <stop offset="0%" stopColor="#4a2230" />
              <stop offset="100%" stopColor="#2a1119" />
            </linearGradient>
            <linearGradient id="ramaTeeth" gradientUnits="userSpaceOnUse" x1="0" y1="203" x2="0" y2="214">
              <stop offset="0%" stopColor="#c9c3cc" />
              <stop offset="50%" stopColor="#f2f0f2" />
              <stop offset="100%" stopColor="#dcd7de" />
            </linearGradient>
            <linearGradient id="ramaLipUpper" gradientUnits="userSpaceOnUse" x1="0" y1="202" x2="0" y2="212">
              <stop offset="0%" stopColor="#7d6a92" />
              <stop offset="100%" stopColor="#62517a" />
            </linearGradient>
            <linearGradient id="ramaLipLower" gradientUnits="userSpaceOnUse" x1="0" y1="208" x2="0" y2="226">
              <stop offset="0%" stopColor="#6a5a86" />
              <stop offset="100%" stopColor="#8573a0" />
            </linearGradient>

            <linearGradient id="ramaHair" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="170">
              <stop offset="0%" stopColor="#24242c" />
              <stop offset="50%" stopColor="#131318" />
              <stop offset="100%" stopColor="#09090c" />
            </linearGradient>

            <linearGradient id="ramaGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2d27a" />
              <stop offset="55%" stopColor="#d4a43a" />
              <stop offset="100%" stopColor="#9a6c18" />
            </linearGradient>
            <radialGradient id="ramaBead" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0%" stopColor="#9a5c34" />
              <stop offset="70%" stopColor="#6b3b1e" />
              <stop offset="100%" stopColor="#40220f" />
            </radialGradient>

            <linearGradient id="ramaRobe" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="320">
              <stop offset="0%" stopColor="#f59a44" />
              <stop offset="100%" stopColor="#dd6a12" />
            </linearGradient>
            <linearGradient id="ramaSilk" gradientUnits="userSpaceOnUse" x1="260" y1="270" x2="110" y2="320">
              <stop offset="0%" stopColor="#f6d66e" />
              <stop offset="100%" stopColor="#e0a52c" />
            </linearGradient>

            <clipPath id="ramaFrameClip">
              <rect x="4" y="4" width="312" height="312" rx="64" />
            </clipPath>
            <clipPath id="ramaFaceClip">
              <path d={FACE_PATH} />
            </clipPath>
            <clipPath id="ramaNeckClip">
              <path d={NECK_PATH} />
            </clipPath>
            <clipPath id="ramaRobeClip">
              <path d={ROBE_PATH} />
            </clipPath>
            <clipPath id="ramaSashClip">
              <path d={SASH_PATH} />
            </clipPath>

            {/* Left-eye geometry; the mirrored right eye reuses it because a
                clip resolves in the user space of whatever references it. */}
            <clipPath id="ramaEyeClip">
              <path d={EYE_PATH} />
            </clipPath>

            <clipPath id="ramaMouthClip">
              <path ref={mouthClipRef} d={IDLE_MOUTH.paths.shape} />
            </clipPath>
          </defs>

          {/* Frame badge background */}
          <rect x="4" y="4" width="312" height="312" rx="64" fill="url(#ramaFrameBg)" />

          <g clipPath="url(#ramaFrameClip)">
            {/* Halo — a soft disc of light with a fine gilt ring */}
            <circle cx="160" cy="140" r="130" fill="url(#ramaHalo)" />
            <circle cx="160" cy="140" r="116" fill="none" stroke="#d4a43a" strokeWidth="1.2" opacity="0.35" />

            {/* ── Neck ── */}
            <path className="rama-skin-line" d={NECK_PATH} fill="url(#ramaSkin)" />
            <g clipPath="url(#ramaNeckClip)">
              <g filter="url(#ramaBlur)" fill={SHADOW}>
                {/* Jaw's cast shadow, and the side turned from the light */}
                <path d="M120 212 L141 232 Q160 246 179 232 L200 212 L200 232 L179 252 Q160 264 141 252 L120 232 Z" opacity="0.55" />
                <rect x="172" y="205" width="12" height="70" opacity="0.28" />
                <ellipse cx="160" cy="274" rx="5" ry="3.5" opacity="0.35" />
              </g>
              <path className="rama-neck-line" d="M142 222 C146 238 152 252 157 266 M178 222 C174 238 168 252 163 266" />
              <path className="rama-neck-line" d="M156 248 Q160 244 164 248" />
              <path className="rama-neck-line" d="M126 276 Q140 270 154 273 M194 276 Q180 270 166 273" />
            </g>

            {/* ── Robe ── */}
            <path d={ROBE_PATH} fill="url(#ramaRobe)" />
            <g clipPath="url(#ramaRobeClip)">
              <g filter="url(#ramaBlur)" fill="none">
                <path d="M58 320 C66 296 86 278 112 268" stroke="#9a3c00" strokeWidth="7" opacity="0.3" />
                <path d="M262 320 C256 298 240 280 216 270" stroke="#9a3c00" strokeWidth="8" opacity="0.3" />
                <path d="M78 312 C88 294 102 280 120 272" stroke="#ffd9a8" strokeWidth="4" opacity="0.25" />
                <path d={NECKLINE} stroke="#7a2c00" strokeWidth="7" opacity="0.3" />
              </g>
            </g>
            {/* Gold neckline trim */}
            <path d={NECKLINE} fill="none" stroke="#7a5212" strokeWidth="6" strokeLinecap="round" />
            <path d={NECKLINE} fill="none" stroke="url(#ramaGold)" strokeWidth="4.2" strokeLinecap="round" />

            {/* Uttariya — silk shawl over the left shoulder */}
            <path d={SASH_PATH} fill="url(#ramaSilk)" />
            <g clipPath="url(#ramaSashClip)">
              <g filter="url(#ramaBlur)" fill="none">
                <path d="M132 320 C156 300 196 286 236 276" stroke="#a06000" strokeWidth="5" opacity="0.3" />
                <path d="M118 320 C142 300 178 284 222 268" stroke="#fff2c0" strokeWidth="4" opacity="0.35" />
              </g>
              {/* Woven border */}
              <path d={SASH_EDGE_A} fill="none" stroke="#a8322a" strokeWidth="5" />
              <path d={SASH_EDGE_A} fill="none" stroke="url(#ramaGold)" strokeWidth="2.4" strokeDasharray="4 3" />
              <path d={SASH_EDGE_B} fill="none" stroke="#a8322a" strokeWidth="5" />
              <path d={SASH_EDGE_B} fill="none" stroke="url(#ramaGold)" strokeWidth="2.4" strokeDasharray="4 3" />
            </g>

            {/* Rudraksha mala */}
            <g className="rama-mala">
              {BEADS.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="3.3" fill="url(#ramaBead)" stroke="#2e1708" strokeWidth="0.6" />
                  <path
                    d={`M${(p.x - 1.6).toFixed(2)} ${p.y.toFixed(2)} L${(p.x + 1.6).toFixed(2)} ${p.y.toFixed(2)} M${p.x.toFixed(2)} ${(p.y - 1.6).toFixed(2)} L${p.x.toFixed(2)} ${(p.y + 1.6).toFixed(2)}`}
                    stroke="#2e1708" strokeWidth="0.5" opacity="0.6"
                  />
                </g>
              ))}
            </g>

            {/* ── Back of the head: hair seen behind the ears ── */}
            <path
              d="M104 170 Q97 160 101 150 Q95 138 100 126 Q96 110 106 98 Q108 80 124 72 Q138 60 160 62
                 Q182 60 196 72 Q212 80 214 98 Q224 110 220 126 Q225 138 219 150 Q223 160 216 170 Z"
              fill="url(#ramaHair)"
            />

            {/* ── Ears ── */}
            <Ear />
            <Ear mirrored />

            {/* ── Face ── */}
            <path className="rama-skin-line" d={FACE_PATH} fill="url(#ramaSkin)" />

            <g clipPath="url(#ramaFaceClip)">
              {/* Shadows: hairline, temples, cheekbone hollows, jaw, eye
                  sockets, the shaded side of the nose and its cast shadow. */}
              <g filter="url(#ramaBlur)" fill="none" stroke={SHADOW}>
                <path d="M108 150 C112 128 124 110 140 106 C150 104 170 104 180 106 C196 110 208 128 212 150" strokeWidth="8" opacity="0.3" />
                {/* Hollow under each cheekbone, running down to the jaw angle */}
                <path d="M112 178 C117 192 124 202 132 208 M208 178 C203 192 196 202 188 208" strokeWidth="6" opacity="0.26" />
                {/* Jawline: shadow tucked inside the angle and along the chin */}
                <path d="M109 182 C110 194 113 204 120 211 L141 229.5 C150 235.5 170 235.5 179 229.5 L200 211 C207 204 210 194 211 182" strokeWidth="9" opacity="0.36" />
                <ellipse cx="117" cy="203" rx="5" ry="9" stroke="none" fill={SHADOW} opacity="0.25" />
                <ellipse cx="203" cy="203" rx="5" ry="9" stroke="none" fill={SHADOW} opacity="0.32" />
                {/* Crease between lower lip and chin */}
                <path d="M152 224 Q160 221.5 168 224" strokeWidth="2.5" opacity="0.3" />
                <path d="M164 160 C166 170 167.5 178 168 186" strokeWidth="3.5" opacity="0.3" />
                <g stroke="none" fill={SHADOW}>
                  <ellipse cx="109" cy="160" rx="7" ry="26" opacity="0.22" />
                  <ellipse cx="211" cy="160" rx="8" ry="28" opacity="0.3" />
                  <ellipse cx="151" cy="154" rx="3.6" ry="7" opacity="0.25" />
                  <ellipse cx="169" cy="154" rx="3.6" ry="7" opacity="0.3" />
                  <ellipse cx="160.5" cy="197" rx="6" ry="2.4" opacity="0.35" />
                </g>
                {/* Faint lit planes — kept low so the skin stays matte */}
                <g stroke="none" fill="#ffffff">
                  <ellipse cx="150" cy="122" rx="14" ry="5" opacity="0.18" />
                  <ellipse cx="158.5" cy="172" rx="1.8" ry="9" opacity="0.2" />
                  <ellipse cx="158" cy="229" rx="6" ry="2" opacity="0.15" />
                </g>
              </g>
            </g>

            {/* ── Hair, swept back from a masculine hairline ── */}
            {/* The hairline is scalloped so the waves read at the edge too */}
            <path
              d="M106 150 C102 112 120 70 160 70 C200 70 218 112 214 150 Q213 141 209 136 Q211 128 204 122
                 Q202 113 194 110 Q188 104 180 106 Q172 101 164 105 Q160 102 156 105 Q148 101 140 106
                 Q132 104 126 110 Q118 113 116 122 Q109 128 111 136 Q107 141 106 150 Z"
              fill="url(#ramaHair)"
            />
            <g className="rama-hair-waves">
              <path
                className="rama-hair-strands"
                d="M122 116 C116 104 128 96 124 86 C122 80 130 74 140 72 M136 107 C130 96 142 88 138 80 C136 75 144 71 152 70
                   M150 104 C146 94 156 88 152 80 C150 75 156 71 160 70 M112 134 C104 120 118 110 112 98 C110 90 118 80 128 76"
              />
              <path className="rama-hair-crest" d="M117 104 Q123 97 129 99 M131 90 Q137 83 143 85 M145 94 Q150 88 155 90" />
            </g>
            <g className="rama-hair-waves" transform={MIRROR}>
              <path
                className="rama-hair-strands"
                d="M122 116 C116 104 128 96 124 86 C122 80 130 74 140 72 M136 107 C130 96 142 88 138 80 C136 75 144 71 152 70
                   M150 104 C146 94 156 88 152 80 C150 75 156 71 160 70 M112 134 C104 120 118 110 112 98 C110 90 118 80 128 76"
              />
              <path className="rama-hair-crest" d="M117 104 Q123 97 129 99 M131 90 Q137 83 143 85 M145 94 Q150 88 155 90" />
            </g>

            {/* ── Wavy top-knot with a gold band ── */}
            <g className="rama-bun">
              <path d={BUN_PATH} fill="url(#ramaHair)" />
              <path
                className="rama-hair-strands"
                d="M146 36 C154 27 170 29 174 39 C178 49 168 57 160 53 C152 49 156 41 164 43
                   M136 54 C136 64 146 72 156 72 M184 46 C186 60 178 70 166 74 M140 36 C146 28 150 30 156 24"
              />
              <path className="rama-hair-crest" d="M150 31 Q160 25 170 31 M141 58 Q145 66 151 68" />
              <path d="M136 69 Q160 81 184 69 L184 75 Q160 87 136 75 Z" fill="url(#ramaGold)" stroke="#7a5212" strokeWidth="0.8" />
              <path d="M138 72 Q160 84 182 72" fill="none" stroke="#7a5212" strokeWidth="0.8" strokeDasharray="2 2.5" opacity="0.7" />
            </g>

            {/* Tilak — Vaishnava urdhva pundra: a pale U with a red centre line */}
            <g className="rama-tilak">
              <path d="M155.5 118 C155.5 128 156 136 158 141 Q160 144 162 141 C164 136 164.5 128 164.5 118" fill="none" stroke="#f4ecd6" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M160 121 L160 138" stroke="#c42034" strokeWidth="1.8" strokeLinecap="round" />
            </g>

            {/* Eyebrows — straight and heavy, with hair strokes along the grain */}
            <g className="rama-brow">
              <path className="rama-brow-fill" d={BROW_PATH} />
              <path className="rama-brow-hairs" d="M149 146 L145 143 M143 144.6 L138.5 142 M136.5 144.6 L131.5 142.8 M129.5 145.5 L124.5 145" />
            </g>
            <g transform={MIRROR}>
              <g className="rama-brow">
                <path className="rama-brow-fill" d={BROW_PATH} />
                <path className="rama-brow-hairs" d="M149 146 L145 143 M143 144.6 L138.5 142 M136.5 144.6 L131.5 142.8 M129.5 145.5 L124.5 145" />
              </g>
            </g>

            {/* ── Eyes ── */}
            <Eye irisRef={irisLeftRef} closed={blinking || winking} />
            <Eye irisRef={irisRightRef} closed={blinking} mirrored />

            {/* ── Nose — long straight bridge, alar wings and nostrils ── */}
            <path className="rama-nose-bridge" d="M163.5 161 C164.5 171 166 179 167.5 185" />
            <path className="rama-nose-shadow" d="M153 187 C150.5 188.5 150.5 192 154 193 L166 193 C169.5 192 169.5 188.5 167 187 Z" />
            <path className="rama-nose-under" d="M152.5 186 C149.5 188 150.5 192.5 154.5 192.5 M167.5 186 C170.5 188 169.5 192.5 165.5 192.5" />
            <ellipse className="rama-nostril" cx="156.3" cy="191.6" rx="1.9" ry="0.95" />
            <ellipse className="rama-nostril" cx="163.7" cy="191.6" rx="1.9" ry="0.95" />
            <path className="rama-nose-under" d="M155.5 193.5 Q160 195.3 164.5 193.5" />

            {/* ── Mouth ── every [data-part] path is re-shaped per mood */}
            <g ref={mouthRef} className="rama-mouth-group">
              <path data-part="shadow" className="rama-lip-shadow" d={IDLE_MOUTH.paths.shadow} filter="url(#ramaBlurSm)" />
              <path data-part="lower" className="rama-lip-lower" d={IDLE_MOUTH.paths.lower} />
              <path data-part="shape" className="rama-mouth" d={IDLE_MOUTH.paths.shape} />
              <g ref={mouthInnerRef} clipPath="url(#ramaMouthClip)" opacity={f(IDLE_MOUTH.parted)}>
                {/* Tongue first, then the upper teeth over it */}
                <ellipse cx="160" cy="228" rx="12" ry="7" fill="#b85a6e" />
                <ellipse cx="160" cy="208" rx="18" ry="5.5" fill="url(#ramaTeeth)" />
                <path d="M154.5 204 L155 213 M165.5 204 L165 213" stroke="#b9b2bd" strokeWidth="0.6" opacity="0.6" />
                <rect x="136" y="200" width="48" height="5" fill="#2a1119" opacity="0.3" filter="url(#ramaBlurSm)" />
              </g>
              <path data-part="upper" className="rama-lip-upper" d={IDLE_MOUTH.paths.upper} />
              <path data-part="line" className="rama-mouth-line" d={IDLE_MOUTH.paths.line} />
              <path data-part="corners" className="rama-mouth-corner" d={IDLE_MOUTH.paths.corners} />
              <path data-part="lowerLight" className="rama-lip-light" d={IDLE_MOUTH.paths.lowerLight} />
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
