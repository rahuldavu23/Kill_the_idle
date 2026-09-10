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

// Mouth shapes per mood — swapped on the SVG path's `d` attribute.
// Speaking cycles through the `talk` frames while active.
const MOUTH = {
  idle: 'M138 196 Q160 208 182 196',
  happy: 'M134 194 Q160 218 186 194 Q160 206 134 194 Z',
  thinking: 'M142 200 Q160 198 178 200',
  amused: 'M132 192 Q160 220 188 192 Q160 202 132 192 Z',
  talkOpen: 'M140 192 Q160 216 180 192 Q160 202 140 192 Z',
  talkClosed: 'M138 198 Q160 204 182 198',
}

export default function Rama({ mood = 'idle' }: RamaProps) {
  const pupilLeftRef = useRef<SVGCircleElement>(null)
  const pupilRightRef = useRef<SVGCircleElement>(null)
  const faceRef = useRef<SVGSVGElement>(null)
  const mouthRef = useRef<SVGPathElement>(null)

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
        const leftPupil = pupilLeftRef.current
        const rightPupil = pupilRightRef.current
        if (!svg || !leftPupil || !rightPupil) return

        const rect = svg.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height * 0.42

        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const dist = Math.hypot(dx, dy) || 1
        const ox = (dx / dist) * Math.min(maxOffset, dist / 40)
        const oy = (dy / dist) * Math.min(maxOffset, dist / 40)

        leftPupil.setAttribute('transform', `translate(${ox} ${oy})`)
        rightPupil.setAttribute('transform', `translate(${ox} ${oy})`)
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
    const path = mouthRef.current
    if (!path) return

    if (mood !== 'speaking') {
      path.setAttribute('d', MOUTH[mood])
      return
    }

    let open = true
    path.setAttribute('d', MOUTH.talkOpen)
    const interval = setInterval(() => {
      open = !open
      path.setAttribute('d', open ? MOUTH.talkOpen : MOUTH.talkClosed)
    }, 150)

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
            <clipPath id="ramaFrameClip">
              <rect x="4" y="4" width="312" height="312" rx="64" />
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

            {/* Neck */}
            <rect x="142" y="196" width="36" height="46" rx="14" fill="#bfe6ff" />

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
            <ellipse className="rama-ear" cx="90" cy="158" rx="11" ry="15" fill="#bfe6ff" />
            <ellipse className="rama-ear" cx="230" cy="158" rx="11" ry="15" fill="#bfe6ff" />
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
              fill="#cdeaff"
            />

            {/* Cheek blush */}
            <ellipse className="rama-blush" cx="122" cy="182" rx="12" ry="7" fill="#7fc3ef" opacity="0.45" />
            <ellipse className="rama-blush" cx="198" cy="182" rx="12" ry="7" fill="#7fc3ef" opacity="0.45" />

            {/* Top-knot bun with red band */}
            <circle className="rama-bun" cx="160" cy="54" r="30" fill="#141425" />
            <path className="rama-bun-swirl" d="M160 34 Q176 40 172 58 Q166 48 152 50" fill="#20203a" />
            <rect x="132" y="66" width="56" height="10" rx="5" fill="#e53946" />

            {/* Tilak */}
            <path className="rama-tilak" d="M160 96 Q166 108 160 116 Q154 108 160 96 Z" fill="#e5303f" />

            {/* Eyebrows */}
            <path className="rama-brow rama-brow-left" d="M114 130 Q128 120 144 128" />
            <path className="rama-brow rama-brow-right" d="M176 128 Q192 120 206 130" />

            {/* Eyes */}
            <g className="rama-eye rama-eye-left">
              <ellipse cx="129" cy="150" rx="17" ry="19" fill="#ffffff" />
              <circle ref={pupilLeftRef} cx="129" cy="151" r="8.5" fill="#241a12" />
              <circle cx="132" cy="147" r="2.4" fill="#ffffff" opacity="0.9" />
              <rect
                className={`rama-eyelid ${blinking || winking ? 'rama-eyelid--closed' : ''}`}
                x="110" y="128" width="38" height="44"
                fill="#cdeaff"
              />
            </g>
            <g className="rama-eye rama-eye-right">
              <ellipse cx="191" cy="150" rx="17" ry="19" fill="#ffffff" />
              <circle ref={pupilRightRef} cx="191" cy="151" r="8.5" fill="#241a12" />
              <circle cx="194" cy="147" r="2.4" fill="#ffffff" opacity="0.9" />
              <rect
                className={`rama-eyelid ${blinking ? 'rama-eyelid--closed' : ''}`}
                x="172" y="128" width="38" height="44"
                fill="#cdeaff"
              />
            </g>

            {/* Nose */}
            <path className="rama-nose" d="M160 158 Q164 168 160 172" />

            {/* Mouth */}
            <path ref={mouthRef} className="rama-mouth" d={MOUTH.idle} />
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
