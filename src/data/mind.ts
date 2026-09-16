// What Rama answers with, and the seam a different kind of mind plugs into.
//
// The local mind is a pattern matcher: instant, private, offline. A hosted
// model would be none of those things, so the seam is async and the UI awaits
// it — swapping in a networked backend later should not touch a component.

import type { ChatContext } from './dialogue'

export interface ChatReply {
  text: string
  // Which intent answered, or null when nothing was recognised.
  intent: string | null
  // How long the bubble should stay up, in ms.
  hold: number
}

export interface RamaMind {
  reply(message: string, ctx: ChatContext): Promise<ChatReply>
}
