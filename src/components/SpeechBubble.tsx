import './SpeechBubble.css'

interface SpeechBubbleProps {
    message: string //this will represent the text to be displayed
    visible: boolean //this should be what serves as the root of whether the bubble is shown or not
}

export default function SpeechBubble({ message, visible }: SpeechBubbleProps) {
    return (    // The visible prop toggles the active class which drives the CSS fade
    <div className={`bubble-wrapper ${visible ? 'bubble-visible' : ''}`}>

      {/* The bubble itself — comic strip style box */}
      <div className="bubble-box">
        <p className="bubble-text">{message}</p>
      </div>

      {/* The tail pointing down toward Rama's head */}
      <div className="bubble-tail" />

    </div>
    )
}