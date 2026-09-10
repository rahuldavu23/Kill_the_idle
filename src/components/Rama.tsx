// Rama component — interactive chibi avatar
// A single hand-built SVG face rig, framed like an app-icon badge.
// Eyes track the cursor, the character blinks on its own, and the
// mouth animates while Rama is speaking — all driven imperatively via
// refs so idle tracking never triggers a React re-render.

import { useEffect, useRef, useState } from 'react'
import './Rama.css'

type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

interface RamaProps {
  mood?: RamaMood
}

// Mouth shapes per mood. `shape` is the mouth opening — it is both the
// filled interior and the clip for the teeth/tongue layers, so those
// never need per-mood geometry of their own. `line` is the upper lip,
// and `open` says whether the mouth parts far enough for teeth and
// tongue to be in shot; a barely-parted smile is just a dark sliver.
type MouthShape = { shape: string; line: string; open: boolean }

const MOUTH: Record<string, MouthShape> = {
  idle: {
    shape: 'M139 196 Q160 212 181 196 Q160 202 139 196 Z',
    line: 'M139 196 Q160 202 181 196',
    open: false,
  },
  happy: {
    shape: 'M132 190 Q160 250 188 190 Q160 202 132 190 Z',
    line: 'M132 190 Q160 202 188 190',
    open: true,
  },
  thinking: {
    shape: 'M147 199 Q158 208 171 197 Q158 194 147 199 Z',
    line: 'M147 199 Q158 194 171 197',
    open: false,
  },
  amused: {
    shape: 'M130 188 Q160 250 190 188 Q160 206 130 188 Z',
    line: 'M130 188 Q160 206 190 188',
    open: true,
  },
  talkOpen: {
    shape: 'M142 191 Q160 241 178 191 Q160 201 142 191 Z',
    line: 'M142 191 Q160 201 178 191',
    open: true,
  },
  talkMid: {
    shape: 'M143 194 Q160 218 177 194 Q160 202 143 194 Z',
    line: 'M143 194 Q160 202 177 194',
    open: true,
  },
  talkClosed: {
    shape: 'M140 197 Q160 209 180 197 Q160 203 140 197 Z',
    line: 'M140 197 Q160 203 180 197',
    open: false,
  },
}

const TALK_CYCLE = ['talkOpen', 'talkMid', 'talkClosed', 'talkMid'] as const

// One eye, drawn in left-eye coordinates. The right eye reuses the exact
// same geometry mirrored about the face centre line (x = 160), which keeps
// the two halves perfectly symmetrical.
function Eye({
  irisRef,
  closed,
  mirrored = false,
}: {
  irisRef: React.RefObject<SVGGElement | null>
  closed: boolean
  mirrored?: boolean
}) {
  return (
    <g
      className={`rama-eye ${closed ? 'rama-eye--closed' : ''}`}
      transform={mirrored ? 'translate(320,0) scale(-1,1)' : undefined}
    >
      <g clipPath="url(#ramaEyeClip)">
        {/* Sclera */}
        <path
          d="M106.5 153 C107 136 114.5 128 127.5 128 C140.5 128 147.5 136 148 153
             C148 167.5 139.5 175.5 127.5 175.5 C115.5 175.5 106.5 167.5 106.5 153 Z"
          fill="url(#ramaEyeWhite)"
        />

        {/* Iris — this group is what tracks the cursor */}
        <g ref={irisRef} className="rama-iris">
          <circle cx="127.5" cy="152" r="13.5" fill="url(#ramaIris)" />
          {/* Light bouncing up through the lower half of the iris */}
          <ellipse cx="127.5" cy="159.5" rx="8.6" ry="4.6" fill="#f0b877" opacity="0.42" />
          <circle cx="127.5" cy="152" r="13.5" fill="none" stroke="#1d1006" strokeWidth="2.2" opacity="0.6" />
          <ellipse cx="127.5" cy="152.5" rx="5.8" ry="7.4" fill="#140b05" />
          {/* Specular highlights — one large, one small and opposite */}
          <circle cx="121.8" cy="145.2" r="4.6" fill="#ffffff" opacity="0.95" />
          <circle cx="133.4" cy="159.4" r="2.2" fill="#ffffff" opacity="0.75" />
        </g>

        {/* Shadow cast by the upper lid */}
        <rect x="102" y="124" width="52" height="11" fill="#20203a" opacity="0.2" />

        {/* Blink lid — scales down from the top, clipped to the eye */}
        <rect
          className={`rama-eyelid ${closed ? 'rama-eyelid--closed' : ''}`}
          x="102" y="124" width="52" height="56"
          fill="url(#ramaSkin)"
        />
      </g>

      {/* Lower lid line */}
      <path
        className="rama-lid-lower"
        d="M110 168.5 C117 175 139 174.5 146 165.5"
      />

      {/* Upper lash line — a second, heavier stroke over the outer half
          fakes the taper of a brush stroke. */}
      <path
        className="rama-lash"
        d="M105.5 154 C106 134 114.5 125.5 127.5 125.5 C140.5 125.5 148.7 134 149.2 152"
      />
      <path
        className="rama-lash rama-lash--outer"
        d="M105.5 154 C106 139 110 129.5 118 126.8"
      />
      <path className="rama-lash rama-lash--flick" d="M105.9 151.5 L100.5 145" />

      {/* Closed-eye curve, cross-faded in on a blink */}
      <path
        className={`rama-eye-closed ${closed ? 'rama-eye-closed--on' : ''}`}
        d="M107.5 149 C114.5 164.5 140.5 164.5 147.5 149"
      />
    </g>
  )
}

export default function Rama({ mood = 'idle' }: RamaProps) {
  const irisLeftRef = useRef<SVGGElement>(null)
  const irisRightRef = useRef<SVGGElement>(null)
  const faceRef = useRef<SVGSVGElement>(null)
  const mouthRef = useRef<SVGPathElement>(null)
  const mouthClipRef = useRef<SVGPathElement>(null)
  const mouthLineRef = useRef<SVGPathElement>(null)
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
        const cy = rect.top + rect.height * 0.42

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
      mouthRef.current?.setAttribute('d', next.shape)
      mouthClipRef.current?.setAttribute('d', next.shape)
      mouthLineRef.current?.setAttribute('d', next.line)
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
            <linearGradient id="ramaRobe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9a3c" />
              <stop offset="100%" stopColor="#f5790f" />
            </linearGradient>

            {/* Skin runs in user space so face, ears, neck and eyelids all
                sample the same ramp and stay seamless. */}
            <linearGradient id="ramaSkin" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="234">
              <stop offset="0%" stopColor="#dcf0ff" />
              <stop offset="52%" stopColor="#bfe0fa" />
              <stop offset="100%" stopColor="#8cc2ea" />
            </linearGradient>

            <linearGradient id="ramaEyeWhite" gradientUnits="userSpaceOnUse" x1="0" y1="128" x2="0" y2="176">
              <stop offset="0%" stopColor="#dfeef8" />
              <stop offset="45%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#eaf4fb" />
            </linearGradient>

            <radialGradient id="ramaIris" cx="0.5" cy="0.36" r="0.68">
              <stop offset="0%" stopColor="#c98a45" />
              <stop offset="45%" stopColor="#8a5024" />
              <stop offset="100%" stopColor="#2f1a0c" />
            </radialGradient>

            <radialGradient id="ramaBlush" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#63b6ea" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#63b6ea" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="ramaMouthInner" gradientUnits="userSpaceOnUse" x1="0" y1="186" x2="0" y2="228">
              <stop offset="0%" stopColor="#5d1b26" />
              <stop offset="100%" stopColor="#2e0f16" />
            </linearGradient>

            <linearGradient id="ramaHairShine" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="220" y2="0">
              <stop offset="0%" stopColor="#4a4a7a" stopOpacity="0" />
              <stop offset="50%" stopColor="#5a5a92" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#4a4a7a" stopOpacity="0" />
            </linearGradient>

            <clipPath id="ramaFrameClip">
              <rect x="4" y="4" width="312" height="312" rx="64" />
            </clipPath>

            {/* Left-eye geometry; the mirrored right eye reuses it because a
                clip resolves in the user space of whatever references it. */}
            <clipPath id="ramaEyeClip">
              <path
                d="M106.5 153 C107 136 114.5 128 127.5 128 C140.5 128 147.5 136 148 153
                   C148 167.5 139.5 175.5 127.5 175.5 C115.5 175.5 106.5 167.5 106.5 153 Z"
              />
            </clipPath>

            <clipPath id="ramaMouthClip">
              <path ref={mouthClipRef} d={MOUTH.idle.shape} />
            </clipPath>
          </defs>

          {/* Frame badge background */}
          <rect
            x="4"
            y="4"
            width="312"
            height="312"
            rx="64"
            fill="url(#ramaFrameBg)"
          />

          <g clipPath="url(#ramaFrameClip)">
            {/* Shoulders / robe, peeking in at the bottom like a collar */}
            <path
              className="rama-robe"
              d="M52 320 Q56 246 130 232 L190 232 Q264 246 268 320 Z"
              fill="url(#ramaRobe)"
            />
            <path
              className="rama-robe-sash"
              d="M130 232 Q160 268 190 232 L176 232 Q160 250 144 232 Z"
              fill="#ffd27a"
            />

            {/* Neck, with the shadow the chin casts across it */}
            <rect x="142" y="196" width="36" height="46" rx="14" fill="url(#ramaSkin)" />
            <path d="M142 200 Q160 216 178 200 L178 211 Q160 225 142 211 Z" fill="#4f8cba" opacity="0.4" />

            {/* Back hair (behind head, framing the face) */}
            <path
              className="rama-hair-back"
              d="M160 46
                 Q96 50 88 118
                 Q84 168 96 224
                 Q104 248 122 232
                 Q112 176 118 130
                 Q122 88 160 82
                 Q198 88 202 130
                 Q208 176 198 232
                 Q216 248 224 224
                 Q236 168 232 118
                 Q224 50 160 46 Z"
              fill="#141425"
            />

            {/* Ears */}
            <ellipse className="rama-ear" cx="90" cy="158" rx="11" ry="15" fill="url(#ramaSkin)" stroke="#5f9bc9" strokeWidth="2.2" strokeOpacity="0.55" />
            <ellipse className="rama-ear" cx="230" cy="158" rx="11" ry="15" fill="url(#ramaSkin)" stroke="#5f9bc9" strokeWidth="2.2" strokeOpacity="0.55" />
            <path d="M88 152 Q93.5 158 88 165" fill="none" stroke="#5f9bc9" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
            <path d="M232 152 Q226.5 158 232 165" fill="none" stroke="#5f9bc9" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
            <circle className="rama-earring" cx="90" cy="176" r="6.5" fill="none" stroke="#ffcf4d" strokeWidth="3.5" />
            <circle className="rama-earring" cx="230" cy="176" r="6.5" fill="none" stroke="#ffcf4d" strokeWidth="3.5" />

            {/* Face */}
            <path
              className="rama-face-shape"
              d="M160 66
                 Q222 66 222 148
                 Q222 214 160 226
                 Q98 214 98 148
                 Q98 66 160 66 Z"
              fill="url(#ramaSkin)"
              stroke="#5f9bc9"
              strokeWidth="2.4"
              strokeOpacity="0.55"
            />

            {/* Soft shading along the jaw, kept clear of the lower lip */}
            <path d="M139 215 Q160 224 181 215 Q160 220 139 215 Z" fill="#5f9bc9" opacity="0.16" />

            {/* Cheek blush */}
            <ellipse className="rama-blush" cx="118" cy="180" rx="17" ry="11" fill="url(#ramaBlush)" />
            <ellipse className="rama-blush" cx="202" cy="180" rx="17" ry="11" fill="url(#ramaBlush)" />

            {/* Top-knot bun with red band */}
            <circle className="rama-bun" cx="160" cy="54" r="30" fill="#141425" />
            <path className="rama-bun-swirl" d="M160 34 Q176 40 172 58 Q166 48 152 50" fill="#20203a" />
            {/* Anime hair shine across the bun */}
            <path className="rama-hair-shine" d="M142 42 Q160 34 178 44 Q160 40 146 50 Z" fill="url(#ramaHairShine)" />
            <rect x="132" y="66" width="56" height="10" rx="5" fill="#e53946" />
            <rect x="132" y="66" width="56" height="4" rx="2" fill="#ff6d78" opacity="0.55" />

            {/* Tilak */}
            <path className="rama-tilak" d="M160 96 Q166 108 160 116 Q154 108 160 96 Z" fill="#e5303f" />

            {/* Eyebrows — tapered shapes rather than even strokes */}
            <path
              className="rama-brow rama-brow-left"
              d="M106.5 120 C112 108 126 103 141 108 C144.4 109.2 146 111.8 145 114.4
                 C144 117 141.2 116.6 138 115.6 C127 112 116.6 115.2 111 122.6
                 C109.4 124.8 106.4 123.6 106.5 120 Z"
            />
            <g transform="translate(320,0) scale(-1,1)">
              <path
                className="rama-brow rama-brow-right"
                d="M106.5 120 C112 108 126 103 141 108 C144.4 109.2 146 111.8 145 114.4
                   C144 117 141.2 116.6 138 115.6 C127 112 116.6 115.2 111 122.6
                   C109.4 124.8 106.4 123.6 106.5 120 Z"
              />
            </g>

            {/* Eyes */}
            <Eye irisRef={irisLeftRef} closed={blinking || winking} />
            <Eye irisRef={irisRightRef} closed={blinking} mirrored />

            {/* Nose — shadow wedge, underside line and a lit ridge, no hard outline */}
            <path
              className="rama-nose-shadow"
              d="M156.5 170.5 C156.5 164 157.6 159.5 160 159.5 C162.4 159.5 163.5 164 163.5 170.5
                 C163.5 173 156.5 173 156.5 170.5 Z"
            />
            <path className="rama-nose-under" d="M156.8 170.8 Q160 174 163.2 170.8" />
            <path className="rama-nose-light" d="M162.4 163 Q163.4 167 163 170" />

            {/* Mouth */}
            <g className="rama-mouth-group">
              {/* Lower lip: a shadow that seats the mouth, plus its lit edge.
                  Drawn first so a wide-open mouth simply covers it. */}
              <path className="rama-lip-shadow" d="M147 203 Q160 214 173 203 Q160 209 147 203 Z" />
              <path className="rama-lip-lower" d="M152 205 Q160 209.5 168 205" />

              <path ref={mouthRef} className="rama-mouth" d={MOUTH.idle.shape} />
              <g ref={mouthInnerRef} clipPath="url(#ramaMouthClip)" opacity={MOUTH.idle.open ? 1 : 0}>
                {/* Tongue first, then the upper teeth over it */}
                <ellipse cx="160" cy="226" rx="17" ry="12" fill="#e0687f" />
                <ellipse cx="160" cy="224" rx="11" ry="6.5" fill="#f08fa1" opacity="0.6" />
                <ellipse cx="160" cy="193" rx="27" ry="10" fill="#fdfdff" />
                <path d="M136 199.5 Q160 205.5 184 199.5" fill="none" stroke="#c9c2cf" strokeWidth="2" opacity="0.65" />
              </g>
              <path ref={mouthLineRef} className="rama-mouth-line" d={MOUTH.idle.line} />
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
