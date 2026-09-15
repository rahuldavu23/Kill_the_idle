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
  idle: { x1: 143, y1: 208, x2: 177, y2: 208, top: 211, bottom: 216, open: false },
  happy: { x1: 139, y1: 205, x2: 181, y2: 205, top: 211, bottom: 232, open: true },
  thinking: { x1: 148, y1: 210, x2: 172, y2: 208, top: 207, bottom: 214, cx: 158, open: false },
  amused: { x1: 138, y1: 204, x2: 182, y2: 204, top: 212, bottom: 232, open: true },
  talkOpen: { x1: 145, y1: 206, x2: 175, y2: 206, top: 210, bottom: 228, open: true },
  talkMid: { x1: 146, y1: 207, x2: 174, y2: 207, top: 211, bottom: 219, open: true },
  talkClosed: { x1: 144, y1: 208, x2: 176, y2: 208, top: 211, bottom: 214, open: false },
}

const TALK_CYCLE = ['talkOpen', 'talkMid', 'talkClosed', 'talkMid'] as const

function mouthPaths({ x1, y1, x2, y2, top, bottom, cx = 160, open }: MouthShape) {
  const upperThick = open ? 2.8 : 3.2
  const lowerThick = open ? 3.5 : 4
  // A quadratic's midpoint sits at ¼·start + ½·control + ¼·end.
  const lineMid = (y1 + y2) / 4 + top / 2
  const openMid = (y1 + y2) / 4 + bottom / 2
  const bow = lineMid - upperThick
  const hl = openMid + lowerThick * 0.45
  const sh = openMid + lowerThick + 3

  return {
    shape: `M${x1} ${y1} Q${cx} ${bottom} ${x2} ${y2} Q${cx} ${top} ${x1} ${y1} Z`,
    line: `M${x1} ${y1} Q${cx} ${top} ${x2} ${y2}`,
    upper:
      `M${x1} ${y1} Q${cx} ${top} ${x2} ${y2} ` +
      `C${x2 - 4} ${y2 - 2} ${cx + 8} ${bow} ${cx + 3.5} ${bow} ` +
      `Q${cx} ${bow + 1.4} ${cx - 3.5} ${bow} ` +
      `C${cx - 8} ${bow} ${x1 + 4} ${y1 - 2} ${x1} ${y1} Z`,
    upperLight:
      `M${cx - 7} ${bow - 1} Q${cx - 3.5} ${bow - 1.8} ${cx} ${bow + 0.4} ` +
      `Q${cx + 3.5} ${bow - 1.8} ${cx + 7} ${bow - 1}`,
    lower: `M${x1} ${y1} Q${cx} ${bottom} ${x2} ${y2} Q${cx} ${bottom + lowerThick * 2} ${x1} ${y1} Z`,
    lowerLight: `M${cx - 5} ${hl} Q${cx} ${hl + 1.2} ${cx + 5} ${hl}`,
    shadow: `M${cx - 8} ${sh} Q${cx} ${sh + 3} ${cx + 8} ${sh}`,
    corners:
      `M${x1 + 1} ${y1 - 2} Q${x1 - 1.8} ${y1} ${x1 + 1} ${y1 + 2} ` +
      `M${x2 - 1} ${y2 - 2} Q${x2 + 1.8} ${y2} ${x2 - 1} ${y2 + 2}`,
  }
}

type MouthPart = keyof ReturnType<typeof mouthPaths>
const IDLE_MOUTH = mouthPaths(MOUTH.idle)

// ── Static geometry ───────────────────────────────────────────
// Long oval with a defined jaw angle and a broad chin.
const FACE_PATH =
  'M160 84 C200 84 215 112 215 150 C215 180 212 196 204 209 C194 225 178 237 160 237 ' +
  'C142 237 126 225 116 209 C108 196 105 180 105 150 C105 112 120 84 160 84 Z'

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
              <stop offset="0%" stopColor="#3a2d22" />
              <stop offset="50%" stopColor="#2a2018" />
              <stop offset="100%" stopColor="#1a130e" />
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
              <path ref={mouthClipRef} d={IDLE_MOUTH.shape} />
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
                <path d="M128 205 Q160 250 192 205 L192 222 Q160 262 128 222 Z" opacity="0.5" />
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
              d="M104 168 C94 116 114 62 160 62 C206 62 226 116 216 168 C212 176 206 176 204 168 L116 168 C114 176 108 176 104 168 Z"
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
                <path d="M114 186 C122 202 134 210 146 214 M206 186 C198 202 186 210 174 214" strokeWidth="6" opacity="0.2" />
                <path d="M108 180 C114 208 138 232 160 234 C182 232 206 208 212 180" strokeWidth="10" opacity="0.3" />
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
            <path
              d="M106 150 C102 112 120 70 160 70 C200 70 218 112 214 150 C211 136 207 126 202 120
                 C196 112 190 108 184 106 C176 103 168 104.5 160 104 C152 104.5 144 103 136 106
                 C130 108 124 112 118 120 C113 126 109 136 106 150 Z"
              fill="url(#ramaHair)"
            />
            <path
              className="rama-hair-strands"
              d="M130 108 C136 92 146 80 156 74 M146 105 C150 90 154 80 158 72 M117 124 C121 100 134 84 150 75 M110 140 C110 112 124 90 144 78"
            />
            <path
              className="rama-hair-strands"
              transform={MIRROR}
              d="M130 108 C136 92 146 80 156 74 M146 105 C150 90 154 80 158 72 M117 124 C121 100 134 84 150 75 M110 140 C110 112 124 90 144 78"
            />

            {/* ── Top-knot with a gold band ── */}
            <g className="rama-bun">
              <circle cx="160" cy="48" r="28" fill="url(#ramaHair)" />
              <path
                className="rama-hair-strands"
                d="M138 56 Q138 32 162 24 M143 66 Q139 42 158 34 Q176 32 183 48 M150 73 Q176 70 185 50 M147 34 Q160 22 178 32"
              />
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
              <path data-part="shadow" className="rama-lip-shadow" d={IDLE_MOUTH.shadow} filter="url(#ramaBlurSm)" />
              <path data-part="lower" className="rama-lip-lower" d={IDLE_MOUTH.lower} />
              <path data-part="shape" className="rama-mouth" d={IDLE_MOUTH.shape} />
              <g ref={mouthInnerRef} clipPath="url(#ramaMouthClip)" opacity={MOUTH.idle.open ? 1 : 0}>
                {/* Tongue first, then the upper teeth over it */}
                <ellipse cx="160" cy="228" rx="12" ry="7" fill="#b85a6e" />
                <ellipse cx="160" cy="208" rx="18" ry="5.5" fill="url(#ramaTeeth)" />
                <path d="M154.5 204 L155 213 M165.5 204 L165 213" stroke="#b9b2bd" strokeWidth="0.6" opacity="0.6" />
                <rect x="136" y="200" width="48" height="5" fill="#2a1119" opacity="0.3" filter="url(#ramaBlurSm)" />
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
