// All of Rama's dialogue organized by trigger type
// This dataset will grow over time — add more lines freely

export const dialogue = {

  // Fires randomly during idle periods — wisdom unprompted
  idle: [
    "The mind is everything. What you think, you become.",
    "Do your duty without attachment to its fruits.",
    "Even the darkest night will end, and the sun will rise.",
    "A calm mind brings inner strength and self-confidence.",
    "Act well in this moment — that is all that is ever required.",
    "Detachment is not indifference. It is clarity.",
    "The river does not mourn the banks it has passed.",
    "What is yours will find you. What is not, never truly was.",
    "Patience is not waiting. It is maintaining peace while things unfold.",
    "You cannot control the wind, but you can adjust your sails.",
  ],

  // Fires when a task is added to the focus list
  taskAdded: [
    "Good. One step at a time — the path reveals itself.",
    "A task named is a task half begun. Let us proceed.",
    "The warrior prepares. Now, act with full presence.",
    "Excellent. Focus on this, and this alone.",
    "Every great journey begins with a single intention.",
  ],

  // Fires when a task is marked complete
  taskCompleted: [
    "Well done. Release the victory and move forward.",
    "This is the way — act, complete, let go.",
    "Another stone laid on the path. I am proud of you.",
    "That which needed doing, has been done. Peace.",
    "Ha! Even the gods celebrate small victories. Well done.",
  ],

  // Keyword matched responses for user messages
  keywords: [
    {
      triggers: ['ex', 'girlfriend', 'relationship', 'heartbreak', 'breakup', 'love', 'miss her', 'miss him'],
      responses: [
        "Attachment is the root of suffering — not love itself. Love freely, cling to nothing.",
        "She was a chapter, not the whole story. Turn the page with grace.",
        "Even Rama faced separation from Sita. It is not weakness to grieve. It is human. But do not live there.",
        "The heart that has loved deeply is not broken — it is expanded. Give it time.",
        "Let her go like the river lets go of the shore. It does not stop flowing.",
      ]
    },
    {
      triggers: ['anxious', 'anxiety', 'nervous', 'worried', 'overwhelmed', 'stressed'],
      responses: [
        "Breathe. The present moment cannot overwhelm you — only thoughts of the future can.",
        "You are not the storm. You are the sky that holds it. Observe, do not become.",
        "Anxiety lives in tomorrow. You live in now. Come back here.",
        "Even the mightiest warrior feels fear. Courage is acting anyway.",
        "One thing. Do one small thing. The rest will follow.",
      ]
    },
    {
      triggers: ['procrastinat', 'lazy', 'cant start', "can't start", 'stuck', 'nothing', 'idle'],
      responses: [
        "The hardest step is the first. Take it badly if you must — but take it.",
        "Do not wait for motivation. Motivation follows action, not the other way around.",
        "A small act done now is worth more than a perfect act imagined forever.",
        "Even I had to pick up the bow before I could loose the arrow.",
        "Start ugly. Refine later. The path cannot be walked from a standstill.",
      ]
    },
    {
      triggers: ['tired', 'exhausted', 'burnout', 'burnt out', 'drained', 'sleep'],
      responses: [
        "Rest is not laziness. Even the sun sets each day to rise again.",
        "You cannot pour from an empty vessel. Restore yourself — it is not optional.",
        "The body speaks. Listen before it shouts.",
        "Sleep is the great reset. Honor it.",
      ]
    },
    {
      triggers: ['happy', 'great', 'amazing', 'good day', 'feel good', 'excited'],
      responses: [
        "This joy — hold it lightly. It is real, and it is yours right now.",
        "Ha! A good day deserves to be felt fully. Be here in it.",
        "The universe smiles back at those who smile first.",
        "Good. Now channel this energy into something meaningful.",
      ]
    },
  ],

  // Time-of-day greetings fired once on app load
  greetings: {
    morning:   "Good morning. The day is fresh and unwritten. What shall we do with it?",
    afternoon: "The afternoon is here. How goes the journey so far?",
    evening:   "Evening falls. Reflect on what was done — and let go of what was not.",
    night:     "The night is for rest and stillness. But since you are here — what weighs on your mind?",
  }
}

// Pick a random item from any array
export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Match a user message against keyword triggers
// Returns a matched response or null if nothing matches
export function matchKeyword(message: string): string | null {
  const lower = message.toLowerCase()
  for (const entry of dialogue.keywords) {
    if (entry.triggers.some(trigger => lower.includes(trigger))) {
      return randomFrom(entry.responses)
    }
  }
  return null
}

// Get the right greeting based on current hour
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5  && hour < 12) return dialogue.greetings.morning
  if (hour >= 12 && hour < 17) return dialogue.greetings.afternoon
  if (hour >= 17 && hour < 21) return dialogue.greetings.evening
  return dialogue.greetings.night
}