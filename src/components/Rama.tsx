// Rama component — cutout animation system
// Each body part is a separate PNG layer positioned absolutely
// CSS animations drive each layer independently

import './Rama.css'

import ramaHead from '../assets/rama-head.png'
import ramaTorso from '../assets/rama-torso.png'
import ramaArmBow from '../assets/rama-arm-bow.png'
import ramaArmFree from '../assets/rama-arm-free.png'
import ramaDhoti from '../assets/rama-dhoti.png'

type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

interface RamaProps {
  mood?: RamaMood
}

export default function Rama({ mood = 'idle' }: RamaProps) {
  return (
    <div
      className={`rama-root rama-root--${mood}`}
      role="img"
      aria-label="Interactive Lord Rama avatar"
    >
      <div className="rama-body">
        {/* Aura belongs inside the body so it scales/centers with the rig */}
        <div
          className={`rama-aura rama-aura--${mood}`}
          aria-hidden="true"
        />

        {/* Lower body */}
        <img
          src={ramaDhoti}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="rama-layer rama-dhoti"
        />

        {/* Free arm sits slightly behind torso depending on z-index */}
        <img
          src={ramaArmFree}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="rama-layer rama-arm-free"
        />

        {/* Torso should overlap both arms/dhoti to hide seams */}
        <img
          src={ramaTorso}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="rama-layer rama-torso"
        />

        {/* Bow arm sits near/front of torso depending on z-index */}
        <img
          src={ramaArmBow}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="rama-layer rama-arm-bow"
        />

        {/* Head should be last/top layer */}
        <img
          src={ramaHead}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="rama-layer rama-head"
        />
      </div>
    </div>
  )
}