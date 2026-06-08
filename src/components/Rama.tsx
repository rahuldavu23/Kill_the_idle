// Rama component — uses an AI generated PNG with CSS animations
// Handles idle float, glow aura, and mood-based image swapping

import './Rama.css'

// Import the idle image directly — Vite handles the path resolution
import ramaIdle from '../assets/rama-idle.png'

// Define the possible moods Rama can be in
// We'll add more images for each mood later
type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused'

// Props the parent component can pass in to control Rama's mood
interface RamaProps {
  mood?: RamaMood
}

export default function Rama({ mood = 'idle' }: RamaProps) {
  // For now all moods use the idle image
  // Later we swap this for mood-specific PNGs
  const getImage = () => {
    switch (mood) {
      case 'happy':    return ramaIdle // replace with ramaHappy later
      case 'thinking': return ramaIdle // replace with ramaThinking later
      case 'amused':   return ramaIdle // replace with ramaAmused later
      default:         return ramaIdle
    }
  }

  return (
    // Outer wrapper drives the float animation
    <div className="rama-wrapper">

      {/* Aura glow layer sits behind Rama */}
      {/* The mood class changes the glow color based on his state */}
      <div className={`rama-aura rama-aura--${mood}`} />

      {/* The actual Rama image */}
      <img
        src={getImage()}
        alt="Lord Rama"
        className={`rama-img rama-img--${mood}`}
      />

    </div>
  )
}