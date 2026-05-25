interface PetSpeechBubbleProps {
  text: string
  orbX: number
  orbY: number
  orbSize: number
}

export function PetSpeechBubble({ text, orbX, orbY, orbSize }: PetSpeechBubbleProps) {
  return (
    <div
      className="pet-speech-bubble"
      style={{
        left: orbX + orbSize / 2,
        top: orbY - 14,
      }}
    >
      <span className="pet-speech-text">{text}</span>
    </div>
  )
}
