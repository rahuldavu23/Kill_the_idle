// All of Rama's dialogue organized by trigger type
// This dataset will grow over time — add more lines freely

export type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

// What Rama can see of the app when replying.
export interface ChatContext {
  pendingTasks: string[]
  doneTasks: number
  enjoys: string[]
  // Whatever is still undone in today's plan, in the order it was arranged.
  todayTasks: string[]
}

// A topic Rama can recognise in what the user types.
//
// Patterns are written naturally ("can't sleep", "procrastinat*") and are
// normalised the same way as the user's message, then matched on whole
// words — a trailing * matches any word starting with that stem. A pattern
// may carry an explicit weight: [pattern, weight]. By default longer
// phrases weigh more, and a phrase consumes its words so they can't also
// count towards a shorter, vaguer pattern.
// A situation inside a topic. "work" is a subject; "a boss who humiliated
// you" and "a deadline closing in" are situations, and they do not share
// answers. Cues are matched like patterns; the strongest-scoring facet
// replies, and an intent with no matching facet uses its general lines.
export interface Facet {
  id: string
  cues: (string | [string, number])[]
  responses: string[]
  // Used instead when the user stays on this facet — a second message
  // about the same thing deserves more than the first line reworded.
  deeper?: string[]
}

export interface Intent {
  id: string
  patterns: (string | [string, number])[]
  responses: string[]
  facets?: Facet[]
  deeper?: string[]
  // Whether Rama may open by naming what the user mentioned ("Your father.").
  // Off for topics where echoing would sound glib.
  reflects?: boolean
  // Short lead-in used when this (social) intent comes paired with a
  // weightier one, e.g. "Hi, I'm stressed".
  acks?: string[]
  // Greetings, thanks, agreement — answered only when nothing weightier
  // was said.
  social?: boolean
  // Emotional statements flip or drop when negated ("not happy").
  negatable?: boolean
  negatedTo?: string
  // Only match messages this short — for words that are meaningless
  // inside a longer sentence ("ok", "why").
  maxWords?: number
  // Wins over any other match regardless of score.
  priority?: number
  // Replies with app-aware text when it can; returns null to fall back
  // to the static responses.
  dynamic?: (ctx: ChatContext) => string | null
  // How long the bubble stays up, in ms. Defaults to a reading-time estimate.
  hold?: number
}

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

  // Fires when the last task in today's plan is checked off
  dayComplete: [
    "Every thing you set for today is done. Let the rest of the day be yours.",
    "The plan is finished. Notice that you did it — then set it down.",
    "You named the day's work and you completed it. That is a whole life in miniature.",
    "Nothing left on today's list. Rest is not idleness when the work is done.",
    "The day asked, and you answered in full. Well done, friend.",
  ],

  // Time-of-day greetings fired once on app load
  greetings: {
    morning:   "Good morning. The day is fresh and unwritten. What shall we do with it?",
    afternoon: "The afternoon is here. How goes the journey so far?",
    evening:   "Evening falls. Reflect on what was done — and let go of what was not.",
    night:     "The night is for rest and stillness. But since you are here — what weighs on your mind?",
  },

  // When nothing in the message is recognised
  // Openers that name what the user mentioned, so the reply begins with
  // evidence of having listened. {it} becomes "your father", "your exam".
  reflections: [
    "{it}.",
    "Ah — {it}.",
    "So it is {it} that weighs on you.",
    "{it}. I hear you.",
  ],

  fallbacks: {
    question: [
      "That is a question worth sitting with. What does your own heart say?",
      "I will not pretend to know everything. But tell me why you ask — the reason often holds the answer.",
      "Some questions are answered by thinking, others by walking. Which kind is this?",
      "Ask it again, slowly, in your own mind. Often the question changes before the answer comes.",
      "I hear the question. Tell me a little more of what surrounds it.",
    ],
    statement: [
      "I am listening. Tell me more of what lies beneath that.",
      "Hm. Go on — say it plainly, as you would to a friend.",
      "I hear you. And how does that sit with you?",
      "Speak freely. There is no judgement here, only attention.",
      "Let us look at that together. What matters most to you in it?",
      "Words are the surface of the water. What moves below?",
    ],
    // He caught who or what it concerns, but not what is happening. Naming
    // it and asking is far warmer than a wise-sounding guess.
    aboutSubject: [
      "{it}. Tell me what has happened.",
      "Something about {it}, then. Say more — I am listening.",
      "{it}. Go on. I would rather hear it in your own words.",
      "So this concerns {it}. What is weighing on you there?",
    ],
    // When the user asks to go on but there is nothing to continue
    nothingToContinue: [
      "More of what, friend? Tell me what is on your mind.",
      "We have only just begun. What would you like to speak of?",
    ],
  },
}

// Pick a random item from any array
export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Get the right greeting based on current hour
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5  && hour < 12) return dialogue.greetings.morning
  if (hour >= 12 && hour < 17) return dialogue.greetings.afternoon
  if (hour >= 17 && hour < 21) return dialogue.greetings.evening
  return dialogue.greetings.night
}

export const intents: Intent[] = [
  // ── Safety first ──────────────────────────────────────────────
  {
    id: 'crisis',
    priority: 100,
    hold: 16000,
    patterns: [
      ['kill myself', 5], ['killing myself', 5], ['suicide', 5], ['suicidal', 5],
      ['end my life', 5], ['want to die', 5], ['wanna die', 5], ['better off dead', 5],
      ['self harm', 5], ['hurt myself', 5], ['harm myself', 5], ['cut myself', 5],
      ["don't want to live", 5], ["don't want to be alive", 5], ['no reason to live', 5],
      // Passive phrasings. People rarely reach for the explicit words first,
      // and a platitude in reply to one of these is the worst thing he could
      // do — so these are matched with the same weight.
      ['nobody would notice if i', 5], ['no one would notice if i', 5],
      ['better off without me', 5], ['everyone would be better off', 5],
      ['wish i was dead', 5], ['wish i were dead', 5], ['wish i had never been born', 5],
      ["don't want to be here", 5], ['do not want to wake up', 5], ["don't want to wake up", 5],
      ['tired of living', 5], ['tired of being alive', 5], ['done with life', 5],
      ['not worth living', 5], ['no point in living', 5], ['want it to stop', 4],
      ['want to disappear', 4], ['wish i could disappear', 5], ['give up on life', 5],
    ],
    responses: [
      "I hear how much pain you are carrying, and I am glad you said it. Please reach out right now to someone who can be with you — in the US, call or text 988; elsewhere, your local emergency number or a crisis line. You deserve that support.",
      "What you feel matters, and you do not have to face it alone. Please contact a crisis line now — call or text 988 in the US, or your local emergency number — and tell someone you trust tonight.",
    ],
  },

  // ── Social ────────────────────────────────────────────────────
  {
    id: 'greeting',
    social: true,
    patterns: [
      'hi', 'hello', 'hey', 'hiya', 'yo', 'namaste', 'namaskar', 'pranam', 'greetings',
      'jai shri ram', 'jai siya ram', 'ram ram', "what's up", 'sup', 'howdy',
      'good morning', 'good afternoon', 'good evening',
    ],
    acks: ["Namaste.", "Welcome, friend.", "I am glad you came."],
    responses: [
      "Namaste. I am here — what is on your mind?",
      "Welcome, friend. Sit a while. What brings you?",
      "Jai Siya Ram. How is your heart today?",
      "Ah, you have come. Speak — I am listening.",
      "Greetings. Tell me, what are you working towards today?",
    ],
  },
  {
    id: 'farewell',
    social: true,
    patterns: [
      'bye', 'goodbye', 'good night', 'goodnight', 'see you', 'see ya', 'later', 'cya',
      'gotta go', 'got to go', 'i am leaving', 'talk later', 'signing off',
    ],
    acks: ["Before you go —"],
    responses: [
      "Go well. Carry the calm with you.",
      "Farewell for now. Return whenever you need a quiet word.",
      "Rest when you must, act when you can. Until next time.",
      "May your path be clear. I will be here.",
    ],
  },
  {
    id: 'thanks',
    social: true,
    patterns: ['thank*', 'thanks', 'thx', 'ty', 'appreciate it', 'appreciate you', 'grateful for you', 'dhanyavad'],
    acks: ["You are welcome.", "Gladly."],
    responses: [
      "You are welcome. The effort was yours — I only walked beside you.",
      "Gratitude is a good sign. It means you are paying attention.",
      "No thanks are needed between friends. Go on, now.",
      "It is my joy. Keep going.",
    ],
  },
  {
    id: 'agreement',
    social: true,
    maxWords: 4,
    patterns: ['ok', 'okay', 'k', 'yes', 'yeah', 'yep', 'sure', 'alright', 'got it', 'i will', 'makes sense', 'true', 'fair', 'right', 'will do', 'understood'],
    responses: [
      "Good. Now let the understanding become action.",
      "Then it is settled. Take the first step.",
      "Hm. Agreement is easy — let us see it in what you do next.",
      "Well said. Onward.",
    ],
  },
  {
    id: 'followUp',
    social: true,
    maxWords: 5,
    patterns: ['why', 'how', 'tell me more', 'more', 'go on', 'explain', 'elaborate', 'what do you mean', 'meaning', 'and', 'really', 'such as', 'like what'],
    responses: [],
  },

  // ── About Rama ────────────────────────────────────────────────
  {
    id: 'howAreYou',
    patterns: [['how are you', 3], ['how r you', 3], ['how are things', 2.5], ['how is it going', 2.5], ['how do you feel', 2.5], ['you ok', 2], ['how have you been', 3]],
    responses: [
      "I am well — steady, as the mountain is steady. And you?",
      "Content. There is nothing I lack in this moment. How are you, truly?",
      "At peace, thank you for asking. Few do. Now tell me of yourself.",
      "Calm as still water. But I would rather hear how you are.",
    ],
  },
  {
    id: 'whoAreYou',
    patterns: [
      ['who are you', 3], ['what are you', 3], ['your name', 2.5], ['are you real', 3],
      ['are you ai', 3], ['are you a bot', 3], ['are you god', 3], ['are you rama', 3], ['what can you do', 3],
    ],
    responses: [
      "I am Rama — or at least a small reflection of him, here to keep you company while you work.",
      "A companion for your focus. I cannot do your tasks, but I can remind you why they matter.",
      "Think of me as a steady voice beside your work. Tell me what you are facing, and I will answer as best I can.",
      "Some call me a prince of Ayodhya, some a teacher. Here, I am simply your friend at the desk.",
    ],
  },
  {
    id: 'ramaStory',
    patterns: [
      'sita', 'siya', 'hanuman', 'lakshman*', 'laxman', 'ravan*', 'ayodhya', 'lanka', 'ramayan*',
      'exile', 'vanvas', 'bharat*', 'dasharath*', 'kaikeyi', 'jatayu', 'setu', 'your bow', 'your story', 'your life',
    ],
    responses: [
      "Fourteen years in the forest taught me that a palace is not where peace lives. It lives in how you keep your word.",
      "Hanuman taught me what devotion looks like — strength that never once asked to be admired.",
      "When Sita was taken, I did not know the way to Lanka. I only knew the next step. That was enough.",
      "Lakshman chose the forest beside me when he could have stayed in comfort. Loyalty is a choice made daily.",
      "Even against Ravana, I offered peace first. Victory that could have been avoided is not glory.",
      "The bridge to Lanka was built one stone at a time, by many small hands. So is any great work.",
      "Bharat placed my sandals on the throne and ruled in my name. Humility can hold a kingdom together.",
    ],
  },
  {
    id: 'compliment',
    patterns: [
      ['you are wise', 3], ['you are cool', 3], ['you are awesome', 3], ['you are the best', 3], ['you are great', 3],
      ['love you rama', 3], ['i love you', 2], ['you are amazing', 3], ['good advice', 2.5], ['wise words', 2.5],
      ['nice one', 2], ['well said', 2], ['you are kind', 3], ['you are helpful', 3],
    ],
    responses: [
      "Ha! Kind words. But the wisdom only matters once you use it.",
      "You flatter me. Save some of that warmth for yourself.",
      "I am glad it helps. The listening was yours.",
      "Hm, careful — praise is sweet, and sweetness makes one sleepy. Back to the path!",
    ],
  },
  {
    id: 'insult',
    patterns: [
      ['shut up', 3], ['you are stupid', 3], ['you are dumb', 3], ['you are useless', 3], ['i hate you', 3],
      ['you are boring', 3], ['you suck', 3], ['go away', 2.5], ['you are annoying', 3], ['you are fake', 3],
    ],
    responses: [
      "Hm. Harsh words often come from a hard day. I am still here if you want to talk about it.",
      "You may be right. Even so — is something else troubling you?",
      "I will not take offence. The storm passes; the sky remains.",
      "Very well, I will be quiet a while. Return when you wish.",
    ],
  },
  {
    id: 'joke',
    patterns: ['joke', ['make me laugh', 3], 'funny', 'lol', 'lmao', 'haha', 'hahaha'],
    responses: [
      "A joke? Very well. Why did the arrow never argue? It always got straight to the point.",
      "Ravana had ten heads, and not one of them could agree on dinner.",
      "Hanuman once carried a whole mountain because he could not find one herb. We have all over-prepared for an exam.",
      "Ha! Laughter is good medicine. Take a full dose, then back to work.",
    ],
  },

  // ── Feelings ──────────────────────────────────────────────────
  {
    id: 'heartbreak',
    patterns: [
      ['broke up', 3], ['breakup', 3], ['break up', 3], 'heartbreak*', 'heartbroken', 'girlfriend', 'boyfriend',
      'relationship', 'crush', ['my ex', 3], ['miss her', 3], ['miss him', 3], ['miss them', 2.5], ['love life', 2.5], 'dumped', 'divorce',
    ],
    responses: [
      "Attachment is the root of suffering — not love itself. Love freely, cling to nothing.",
      "They were a chapter, not the whole story. Turn the page with grace.",
      "Even Rama faced separation from Sita. It is not weakness to grieve. It is human. But do not live there.",
      "The heart that has loved deeply is not broken — it is expanded. Give it time.",
      "Let them go like the river lets go of the shore. It does not stop flowing.",
    ],
  },
  {
    id: 'anxiety',
    negatable: true,
    patterns: [
      'anxious', 'anxiety', 'nervous', 'worried', 'worry', 'worrying', 'overwhelm*', 'stressed', 'stress', 'panic*',
      ['on edge', 2], ['overthinking', 2], ['over thinking', 2], 'tense', ['freaking out', 2.5],
    ],
    responses: [
      "Breathe. The present moment cannot overwhelm you — only thoughts of the future can.",
      "You are not the storm. You are the sky that holds it. Observe, do not become.",
      "Anxiety lives in tomorrow. You live in now. Come back here.",
      "Even the mightiest warrior feels fear. Courage is acting anyway.",
      "One thing. Do one small thing. The rest will follow.",
      "Put your hand on your chest and take three slow breaths. Then tell me the single thing that worries you most.",
    ],
  },
  {
    id: 'fear',
    negatable: true,
    patterns: ['afraid', 'scared', 'fear', 'fearful', 'terrified', 'frightened', ['need courage', 2.5], 'brave', 'courage'],
    responses: [
      "Fear is a guard at the gate, not the master of the house. Thank it, and walk through.",
      "Courage is not the absence of fear. It is deciding something matters more.",
      "Name the fear out loud. Named things grow smaller.",
      "I stood before an ocean with no boat. I began anyway. What is your ocean?",
    ],
  },
  {
    id: 'sadness',
    negatable: true,
    patterns: [
      'sad', 'unhappy', 'depressed', 'depression', 'miserable', 'hopeless', 'crying', 'cry', 'cried', 'grief', 'grieving',
      ['feel down', 2.5], ['feeling down', 2.5], ['feel low', 2.5], ['feeling low', 2.5], ['feel empty', 2.5], ['bad day', 2.5],
      'upset', 'hurt', 'heavy', 'blue',
    ],
    responses: [
      "I am sorry it is heavy today. You do not have to carry it quickly — only gently.",
      "Sadness is not a failure. It is the heart telling the truth. Let it speak, then let it rest.",
      "Clouds cover the sun; they do not destroy it. This too will move.",
      "Be kind to yourself today as you would be to a friend. Small comforts are not small.",
      "Is there someone you could talk to today? Sorrow shared is sorrow halved.",
    ],
  },
  {
    id: 'anger',
    negatable: true,
    patterns: ['angry', 'anger', 'mad', 'furious', 'pissed', 'rage', 'annoyed', 'irritated', 'frustrated', 'frustrating', ['fed up', 2.5], ['sick of', 2]],
    responses: [
      "Anger is fire. It can cook your food or burn your house. Wait before you act on it.",
      "Take a breath before your next word. The wise speak after the fire, not during it.",
      "What you are angry at matters to you. Find what it is protecting — act for that instead.",
      "Even my bow waits for a steady hand. Let the heat pass, then aim.",
    ],
  },
  {
    id: 'lonely',
    negatable: true,
    patterns: ['lonely', 'loneliness', 'alone', 'isolated', ['no friends', 3], ['nobody cares', 3], ['no one cares', 3], ['left out', 2.5], ['no one to talk', 3]],
    responses: [
      "You are not as alone as it feels — you are here, and I am listening.",
      "In the forest I had few companions, yet each one mattered. Seek one true connection, not many.",
      "Loneliness is a call to reach out, not a verdict. Send one message today.",
      "Be your own good company first. Others are drawn to a warm fire.",
    ],
  },
  {
    id: 'tired',
    negatable: true,
    patterns: [
      'tired', 'exhausted', 'burnout', ['burnt out', 3], ['burned out', 3], 'drained', 'sleepy', 'fatigue*', 'worn out',
      ["can't sleep", 3], 'insomnia', ['no energy', 3], ['no sleep', 3],
    ],
    responses: [
      "Rest is not laziness. Even the sun sets each day to rise again.",
      "You cannot pour from an empty vessel. Restore yourself — it is not optional.",
      "The body speaks. Listen before it shouts.",
      "Sleep is the great reset. Honor it.",
      "Close the lists for tonight. Tomorrow's work needs today's rest.",
    ],
  },
  {
    id: 'joy',
    negatable: true,
    negatedTo: 'sadness',
    patterns: [
      'happy', 'great', 'amazing', 'awesome', 'excited', 'glad', 'joy', 'wonderful', 'fantastic', 'proud',
      ['good day', 2.5], ['feel good', 2.5], ['feeling good', 2.5], ['doing well', 2.5], ['i did it', 3], ['good', 0.5],
      // Good news, which is rarely announced with the word "happy".
      ['i got the', 3], ['got the job', 4], ['got the promotion', 4], ['got in', 3], ['got accepted', 4],
      ['i passed', 3.5], ['we won', 3.5], ['i won', 3.5], ['it worked', 3], ['finally done', 3.5],
      ['finished it', 3], ['i finished', 3], ['celebrat*', 3],
    ],
    facets: [
      {
        id: 'achievement',
        cues: [['got the', 3], ['passed', 3], ['won', 3], ['promotion', 3.5], ['accepted', 3], ['i did it', 3.5], ['finished', 2.5], ['scared', 2.5], ['worked hard', 3]],
        responses: [
          "Then stop and feel it properly, before the mind hurries you to the next thing. You earned this one.",
          "Ha! Good. Tell someone who will be glad for you — joy grows in the telling.",
          "You did the thing you were afraid of. Remember that the fear was not a prophecy.",
          "Well done. Sit in it a moment. The next task can wait five minutes.",
        ],
        deeper: [
          "What made it possible? Name it, so you can find it again on a harder day.",
          "Hold it lightly — not to diminish it, but so the next thing is not made to carry the same weight.",
        ],
      },
    ],
    responses: [
      "This joy — hold it lightly. It is real, and it is yours right now.",
      "Ha! A good day deserves to be felt fully. Be here in it.",
      "The universe smiles back at those who smile first.",
      "Good. Now channel this energy into something meaningful.",
      "Wonderful. Remember this feeling on the harder days — it will come again.",
    ],
  },
  {
    id: 'bored',
    negatable: true,
    patterns: ['bored', 'boring', ['nothing to do', 3], ['what should i enjoy', 3], ['something fun', 2.5]],
    dynamic: (ctx) => {
      if (ctx.enjoys.length === 0) return null
      const pick = ctx.enjoys[Math.floor(Math.random() * ctx.enjoys.length)]
      return `You wrote that you enjoy "${pick}". Perhaps now is the time for it — fully, without guilt.`
    },
    responses: [
      "Boredom is the mind asking for meaning. Give it a small task, or a real rest.",
      "Add something to your Enjoy list. Joy planned is joy that actually happens.",
      "Stillness is not emptiness. But if you must move — take a walk.",
    ],
  },

  // ── Doing ─────────────────────────────────────────────────────
  {
    id: 'nextTask',
    patterns: [
      ['what should i do', 3], ['what do i do', 3], ["what's next", 3], ['what next', 3], ['what now', 3],
      ['where do i start', 3], ['where should i start', 3], ['my tasks', 3], ['my list', 2.5], ['to do list', 3], ['todo', 2.5],
      ['what to do', 3], ['help me focus', 3],
      ['what should i do today', 4], ['my day', 2.5], ['my plan', 2.5], ['plan for today', 3.5], ["today's plan", 3.5], ['first thing', 2.5],
    ],
    dynamic: (ctx) => {
      // Today's plan is a sequence the user chose, so it answers first.
      if (ctx.todayTasks.length > 0) {
        const rest = ctx.todayTasks.length - 1
        const extra = rest > 0 ? ` The remaining ${rest} will keep their place in line.` : ''
        return `Today begins with "${ctx.todayTasks[0]}". Only that.${extra}`
      }
      if (ctx.pendingTasks.length > 0) {
        const extra = ctx.pendingTasks.length > 1 ? ` The other ${ctx.pendingTasks.length - 1} can wait.` : ''
        return `Begin with "${ctx.pendingTasks[0]}". Only that.${extra}`
      }
      if (ctx.doneTasks > 0) return "Your lists are complete. Rest, or name the next worthy thing and add it."
      return "Your lists are empty. Put one thing in today's plan — the first thing you mean to do."
    },
    responses: [],
  },
  {
    id: 'procrastination',
    patterns: [
      'procrastinat*', 'lazy', 'unmotivated', ['no motivation', 3], ['not motivated', 3], 'distracted', ['cannot focus', 3],
      ["can't start", 3], ['cannot start', 3], ['putting off', 3], ['wasting time', 3], ['stuck', 1.5], 'motivation', ['get started', 2.5],
    ],
    responses: [
      "The hardest step is the first. Take it badly if you must — but take it.",
      "Do not wait for motivation. Motivation follows action, not the other way around.",
      "A small act done now is worth more than a perfect act imagined forever.",
      "Even I had to pick up the bow before I could loose the arrow.",
      "Start ugly. Refine later. The path cannot be walked from a standstill.",
      "Set a timer for five minutes and begin. You may stop after — you probably won't.",
    ],
  },
  {
    id: 'work',
    reflects: true,
    patterns: [
      'exam*', ['test', 0.8], 'study', 'studying', 'homework', 'assignment', 'deadline*', 'boss', ['job', 0.9], ['work', 0.8],
      'interview', ['project', 0.8], 'presentation', 'essay', 'college', 'school', 'career', 'coworker*', 'meeting',
    ],
    facets: [
      {
        id: 'mistreated',
        cues: [
          ['humiliated', 4], ['embarrassed me', 4], ['shouted at', 3.5], ['yelled at', 3.5], ['in front of everyone', 4],
          ['blamed me', 3.5], ['took credit', 4], ['belittled', 4], ['disrespected', 3.5], ['unfair', 2.5], ['bullied', 4],
        ],
        responses: [
          "That was not yours to carry, and it says more of them than of you. Set it down where it belongs.",
          "To be shamed in front of others cuts twice. Let the sting pass before you decide what to do — but do not mistake their cruelty for a verdict on your worth.",
          "A person with power who uses it to make someone small has already lost something larger.",
        ],
        deeper: [
          "Anger here is just. The question is only where to aim it — at them, or at building the thing that lets you walk away.",
          "Is this once, or is this who they are? The answer decides whether you speak to them or start planning.",
        ],
      },
      {
        id: 'unprepared',
        cues: [['tomorrow', 2.5], ['not studied', 4], ['have not studied', 4], ['no time', 3], ['running out of time', 4], ['behind', 2.5], ['last minute', 3.5], ['not ready', 3], ['not prepared', 3.5]],
        responses: [
          "Panic will not buy you the hours you did not spend. What it can still cost you is the hours you have.",
          "You cannot learn everything now. Choose the few things most likely to matter and learn those properly.",
          "One hour of calm work is worth three of frightened work. Begin with the piece you understand least.",
        ],
        deeper: [
          "Sleep is part of the preparation, not a reward for finishing it. A rested mind recalls what a tired one cannot.",
          "Do what you can tonight, then meet tomorrow as it comes. The outcome was never entirely yours to command.",
        ],
      },
      {
        id: 'overload',
        cues: [['too much', 3], ['so much to do', 3.5], ['piling up', 3.5], ['drowning', 4], ['cannot keep up', 4], ['never ends', 3.5], ['everything at once', 4]],
        responses: [
          "You cannot carry the whole mountain. Pick up one stone, move it, and look again.",
          "Much of what feels urgent is only loud. Name the one thing that would matter if nothing else got done.",
          "Break it into pieces small enough that you cannot refuse to start.",
        ],
      },
      {
        id: 'quitting',
        cues: [['quit', 3], ['resign', 3.5], ['leave my job', 4], ['new job', 3], ['hate my job', 4], ['hate this job', 4]],
        responses: [
          "Do not decide this on your worst day. Decide it on an ordinary one, when the feeling is quieter and truer.",
          "Ask what you are walking towards, not only what you are escaping. The second alone leads to the same place again.",
          "There is no honour in staying where you are diminished. But leave by choice, not by exhaustion.",
        ],
      },
    ],
    responses: [
      "Treat the work as an offering, not a burden. Do it well, and leave the result to time.",
      "Break it into pieces small enough that you cannot refuse to start.",
      "Prepare fully, then trust your preparation. Worry adds nothing to the work already done.",
      "Your worth is not your grade or your title. Do your best — that is your whole duty.",
      "The deadline is a riverbank. It gives the water direction. Flow within it.",
      "Put the most important piece on your Focus list and give it your first, freshest hour.",
    ],
  },
  {
    id: 'failure',
    patterns: [
      'failed', 'failure', 'failing', ['not good enough', 3.5], 'worthless', 'useless', ['imposter', 2.5], ['impostor', 2.5],
      ['messed up', 3], 'mistake*', 'regret*', ['give up', 3], ['giving up', 3], ['want to quit', 3], ['screwed up', 3], ['i suck', 3],
    ],
    facets: [
      {
        id: 'shame',
        cues: [
          ['drank', 3.5], ['drunk', 3], ['too much', 2], ['ashamed', 4], ['embarrassed', 3.5], ['cringe', 3],
          ['said something stupid', 4], ['should not have', 3], ['cannot believe i', 3.5], ['made a fool', 4],
        ],
        responses: [
          "You are not the first to wake up wishing for yesterday back, and you will not be the last. Make amends if any are owed, then let it close.",
          "Shame wants you to believe the act was the whole of you. It was not. It was one evening.",
          "Regret that changes tomorrow is useful. Regret that only replays last night is not — and you can tell the difference by how it feels.",
        ],
        deeper: [
          "Is there anyone you should say a plain word to? Not a speech. One honest sentence usually settles it.",
          "Ask what you were reaching for when you reached too far. That is the part worth understanding.",
        ],
      },
      {
        id: 'repeating',
        cues: [['keep', 2.5], ['again', 2], ['always', 2.5], ['every time', 3.5], ['never learn', 4], ['same mistake', 4], ['over and over', 4]],
        responses: [
          "A pattern is not a character flaw. It is a groove worn by circumstance — and grooves can be filled in.",
          "If it keeps happening, stop asking what is wrong with you and start asking what the situation keeps offering you.",
          "You notice the pattern. That is the part most people never reach. Now change one small thing in it.",
        ],
      },
    ],
    responses: [
      "A fall is not the end of the path. It is simply where you stand up again.",
      "You did not fail — you learned the price of a lesson. Now use what you paid for.",
      "Regret looks backward. Duty looks forward. Turn around, gently.",
      "The one who never errs never attempted anything. Try again, a little wiser.",
      "You are not your mistake. You are the one who will do better next.",
      "Rest if you must, but do not quit in the valley. Decide from the hilltop.",
    ],
  },
  {
    id: 'decision',
    patterns: [
      'confused', 'confusing', 'decide', 'decision', 'choice', 'choose', ['should i', 2], ['which one', 2.5], ['not sure', 2],
      ["don't know what to do", 3.5], ['torn between', 3], ['lost', 0.8], 'dilemma',
    ],
    responses: [
      "When two paths look equal, choose the one you would be proud to explain to someone you respect.",
      "Ask what is right, not what is easy. The answer is usually quieter than your fears.",
      "Sit in silence for a minute. Then imagine you already chose — which choice brings relief?",
      "No choice is perfect. A good choice, fully committed to, becomes the right one.",
      "Write both paths down. Clarity likes paper more than a crowded mind.",
    ],
  },
  {
    id: 'purpose',
    patterns: [
      ['meaning of life', 4], ['purpose', 2], ['why am i here', 4], 'dharma', ['what is life', 3.5], ['point of life', 4],
      ['point of it all', 4], ['what is the point', 3], 'karma', 'destiny', 'fate',
      // The flat, weary way the question actually gets asked.
      ['does any of this matter', 4], ['does it even matter', 4], ['does anything matter', 4],
      ['what is it all for', 4], ['why bother', 3.5], ['nothing matters', 4], ['pointless', 3],
      ['no point', 2.5], ['meaningless', 3.5],
    ],
    responses: [
      "Your dharma is not found in a book. It is found where your gifts meet the world's need.",
      "The meaning of life is not a secret to discover. It is a duty to fulfil, each day, well.",
      "Do what is yours to do, without craving the result. That freedom is the purpose.",
      "Karma is not punishment. It is the echo of your actions. Choose what you wish to hear return.",
      "Ask not what life means. Ask what you will make it mean today.",
    ],
  },
  {
    id: 'relationships',
    reflects: true,
    patterns: [
      'family', 'parents', ['mom', 0.9], ['mum', 0.9], ['dad', 0.9], ['brother', 0.9], ['sister', 0.9], ['friend', 0.8], 'friends',
      'argument', 'fight', 'fighting', 'forgive*', 'betray*', 'jealous*', 'envy', 'envious', 'toxic', 'drama',
    ],
    facets: [
      {
        id: 'illness',
        cues: [['hospital', 3], ['in hospital', 4], ['sick', 2.5], ['ill', 2], ['cancer', 4], ['dying', 4], ['surgery', 3], ['diagnosed', 4], ['intensive care', 4], ['not well', 2.5]],
        responses: [
          "That is a heavy thing to sit with, and there is no cleverness that helps. Be there, and let that be enough.",
          "When someone we love is unwell, the mind runs ahead to every ending. Bring it back. Today they are here, and so are you.",
          "You cannot heal them by worrying well. Go, sit with them, and let your presence do what words cannot.",
        ],
        deeper: [
          "Tell me — are you being looked after too? The ones who hold everyone up are the ones most often forgotten.",
          "There is grief in waiting, even before anything is lost. You are allowed to feel it now.",
        ],
      },
      {
        id: 'conflict',
        cues: [['argument', 2.5], ['argued', 3], ['fight', 2], ['fought', 3], ['shouted', 3], ['yelled', 3], ['angry at', 2.5], ['not speaking', 3], ['fell out', 3], ['said something', 2]],
        responses: [
          "Before the next word, ask: do I want to win, or do I want peace? They are rarely the same road.",
          "Speak your truth without a weapon in your voice. The truth lands better when it is not thrown.",
          "You can be right and still lose something worth more than being right.",
        ],
        deeper: [
          "What would you want them to understand, if you knew they would not argue back? Start there.",
          "My own stepmother sent me to the forest, and still I bore her no hatred. Hatred would have exiled me twice.",
        ],
      },
      {
        id: 'distance',
        cues: [['avoiding', 3], ['ignoring', 3], ['ghosted', 3], ['stopped talking', 3], ['left out', 3], ['excluded', 3], ['drifting', 3], ['grew apart', 3], ['does not reply', 3], ['never texts', 3]],
        responses: [
          "Distance is not always rejection. Often it is someone else's storm, and you are reading yourself into it.",
          "You could spend a week guessing, or you could ask them plainly. One of those ends the ache.",
          "Hold the door open without standing in it. If they come back, good. If not, you have not lost yourself waiting.",
        ],
        deeper: [
          "Send one honest message. Not an accusation — a door. Then let it be theirs to walk through.",
          "Some friendships are for a season. Ending is not the same as failing.",
        ],
      },
      {
        id: 'betrayal',
        cues: [['betray*', 3], ['lied to me', 3], ['cheated', 3], ['went behind my back', 4], ['broke my trust', 4], ['used me', 3], ['toxic', 2.5]],
        responses: [
          "Trust broken is a real wound. Do not let anyone hurry you past it.",
          "Forgiveness is not agreement, and it is not a door left open. It is setting down a stone you were never meant to carry.",
          "You may forgive and still keep your distance. Those are two separate decisions, and both are yours.",
        ],
      },
    ],
    responses: [
      "Family can wound, and family can heal. Speak your truth without a weapon in your voice.",
      "Forgiveness is not agreement. It is setting down a stone you were never meant to carry.",
      "My own stepmother sent me to the forest, and still I bore her no hatred. Hatred would have exiled me twice.",
      "Before the next argument, ask: do I want to win, or do I want peace?",
      "Tell me more of how things stand between you.",
    ],
  },
  {
    id: 'health',
    patterns: ['sick', ['ill', 0.9], 'pain', 'headache', 'exercise', 'workout', 'gym', ['diet', 0.9], ['eat', 0.7], 'eating', 'healthy', 'unhealthy', 'fitness'],
    responses: [
      "The body is the chariot for your work. Tend it, and it will carry you far.",
      "If you are unwell, rest is the task today. Everything else can wait.",
      "Move a little each day. A walk clears the mind as well as the legs.",
      "Drink water, eat simply, sleep enough. Strength is built from humble habits.",
    ],
  },
  {
    id: 'patience',
    patterns: [
      ['patience', 2], 'impatient', 'waiting', ['taking forever', 3], ['taking so long', 3], ['when will', 2.5], ['slow progress', 3], ['no progress', 3], ['not working', 2],
    ],
    responses: [
      "Fourteen years is a long exile. It ended. So will this.",
      "Seeds do not sprout because you stare at them. Water them, and walk away.",
      "Progress is often invisible until it is undeniable. Keep going.",
      "Patience is not waiting. It is maintaining peace while things unfold.",
    ],
  },
  {
    id: 'devotion',
    patterns: ['pray', 'prayer', 'praying', 'bless', 'blessing', 'blessings', ['god', 0.8], 'faith', 'mantra', 'meditat*', 'spiritual', 'bhakti', 'temple', 'om'],
    responses: [
      "Prayer is not asking. It is remembering who you are.",
      "Chant my name if it steadies you — but let the work of your hands be your truest prayer.",
      "Sit quietly for a few breaths. Stillness is the doorway every tradition points to.",
      "You have my blessing. Now bless your day with one good act.",
      "Faith is not certainty. It is taking the next step while the path is still dark.",
    ],
  },

  // ── Topics that used to fall through ──────────────────────────
  {
    id: 'grief',
    reflects: true,
    priority: 5, // Outranks 'relationships' and 'health' when someone has died.
    patterns: [
      ['passed away', 4], ['died', 3.5], ['death', 3], ['funeral', 4], ['lost my', 3], ['he is gone', 3.5],
      ['she is gone', 3.5], ['put down', 3], ['put to sleep', 3.5], ['bereaved', 4], ['mourning', 3.5],
    ],
    responses: [
      "I am sorry. There is nothing wise to say to this, and anyone who offers you cleverness now has not understood.",
      "Grief is love with nowhere left to go. It is heavy because it was real.",
      "Do not measure this against how long you think it should take. It takes what it takes.",
      "Let yourself be looked after today. You would do it for anyone else in this.",
    ],
    deeper: [
      "Tell me about them. The remembering is part of the carrying, and it helps to say it aloud.",
      "The sharpness dulls, slowly, and what stays is the having-known-them. That part does not leave.",
      "Eat something. Sleep if you can. Grief is physical, and the body is doing work you cannot see.",
    ],
  },
  {
    id: 'selfCriticism',
    patterns: [
      ['hard on myself', 4], ['hate myself', 4], ['so stupid', 3.5], ['what is wrong with me', 4],
      ['why do i keep', 3.5], ['i always ruin', 4], ['i never do anything right', 4], ['blame myself', 4],
      ['my own worst enemy', 4], ['beating myself up', 4], ['not smart enough', 3.5],
    ],
    responses: [
      "You are speaking to yourself in a voice you would never use on a friend. Notice that — it is the whole problem in one sentence.",
      "That voice is not truth, it is only loud. Loudness is not evidence.",
      "You would forgive anyone else this. Extend yourself the ordinary mercy you hand out freely.",
      "Being hard on yourself feels like discipline. It is not. It is just cruelty with better marketing.",
    ],
    deeper: [
      "Whose voice is it, when you say those things? Most people find it is not originally their own.",
      "Try this: say the same thing about the person you love most. If it is monstrous there, it is monstrous here.",
    ],
  },
  {
    id: 'comparison',
    patterns: [
      ['comparing myself', 4], ['compare myself', 4], ['everyone else is', 3.5], ['ahead of me', 3.5],
      ['behind everyone', 4], ['left behind', 3.5], ['social media', 3], ['instagram', 3], ['linkedin', 3],
      ['everyone is doing better', 4], ['falling behind', 3.5], ['my age', 2.5],
    ],
    responses: [
      "Envy measures your life with someone else's ruler. Put it down — it was never cut for your path.",
      "You are comparing everything you know of yourself against everything they chose to show. That is not a fair contest.",
      "There is no schedule. The idea that you are late is borrowed from people who are not living your life.",
      "Look at where you stood a year ago, not at where someone else stands today. That is the only honest comparison.",
    ],
    deeper: [
      "If they vanished tomorrow, would you still want the thing you are chasing? That answer tells you whether it is yours.",
      "Close the feed for a day. Much of this feeling is manufactured, and it does fade when you stop refilling it.",
    ],
  },
  {
    id: 'identity',
    patterns: [
      ['who i am', 3.5], ['do not know who i am', 4], ['lost myself', 4], ['not myself', 3.5],
      ['what i want', 3], ['pretending to be', 3.5], ['fake', 2], ['do not recognise myself', 4],
      ['who am i', 4], ['find myself', 3.5],
    ],
    responses: [
      "Not knowing is uncomfortable, but it is not the same as being lost. It is the space before a truer answer.",
      "You are not a fixed thing you must correctly identify. You are what you keep choosing.",
      "When I was stripped of throne and name, I was still the one who kept his word. Take away your titles — what remains is you.",
      "Stop asking who you are and watch what you do when no one is asking. The answer is already in your days.",
    ],
    deeper: [
      "Name one thing you did this week that felt like you, and one that did not. Start the map there.",
      "Much of this comes from living to someone else's specification. Whose approval are you still arranging your life around?",
    ],
  },
  {
    id: 'guilt',
    patterns: [
      ['guilty for', 3.5], ['feel guilty', 3.5], ['guilt', 2.5], ['selfish', 3], ['do not deserve', 3.5],
      ['should be working', 3.5], ['wasting the day', 3.5], ['lazy for resting', 4], ['taking a break', 2.5],
    ],
    responses: [
      "Rest is not a debt you must repay. You are not a machine whose idle hours need justifying.",
      "Guilt about resting is a sign you have been taught your worth is your output. It is not, and it never was.",
      "The bow that is never unstrung loses its spring. Rest is part of the work, not a theft from it.",
      "You are allowed the afternoon. Take it fully, or the rest will not restore you at all.",
    ],
    deeper: [
      "Notice you feel guilty resting but not guilty exhausting yourself. That asymmetry is worth questioning.",
      "Ask who taught you that stillness must be earned. They were probably tired too.",
    ],
  },
  {
    id: 'nostalgia',
    reflects: true,
    patterns: [
      ['miss my', 3.5], ['miss home', 4], ['homesick', 4], ['used to be', 3], ['back then', 3.5],
      ['the old days', 3.5], ['childhood', 3], ['nostalgi*', 3.5], ['wish things were', 3.5], ['simpler time', 3.5],
    ],
    responses: [
      "Missing a place is really missing the person you were in it. Both are worth honouring.",
      "I spent fourteen years away from home. What I longed for was not the walls — it was belonging. That you can rebuild anywhere.",
      "The past is warm partly because you already know how it ends. The present has no such comfort, and that is not a fault in it.",
      "Let yourself miss it without concluding that the best is behind you. Those are two different feelings.",
    ],
  },
  {
    id: 'doubtInRama',
    patterns: [
      ['you do not understand', 3.5], ['you would not understand', 4], ['you are just a', 3.5],
      ['that does not help', 3.5], ['easy for you to say', 4], ['you do not know me', 4],
      ['generic', 3], ['same thing every time', 4],
    ],
    responses: [
      "You are right to push back. I am a small voice in a window, not someone who has lived your life.",
      "Fair. Tell me what you actually need — to be advised, or simply to be heard? I will do the one you ask for.",
      "Then say it plainly and I will try again. I would rather be corrected than comfortable.",
      "I cannot know your life from here. But I can pay attention, if you will keep speaking.",
    ],
  },
  {
    id: 'wisdomRequest',
    patterns: [
      ['tell me something wise', 4], ['give me advice', 3.5], ['any advice', 3.5], ['words of wisdom', 4],
      ['inspire me', 3.5], ['motivate me', 3.5], ['something to think about', 4], ['teach me', 3],
    ],
    responses: [
      "Very well. Act well in this moment — it is the only one you are ever given to act in.",
      "Here is one: you cannot control the wind, but you can adjust your sails.",
      "Do your duty without clutching at its fruits. The work is yours; the outcome never entirely was.",
      "The river does not mourn the banks it has passed. Neither should you.",
      "Detachment is not indifference. It is clarity — caring fully, while holding loosely.",
    ],
    deeper: [
      "But wisdom borrowed is only decoration. Which of these would change what you do in the next hour?",
      "Enough aphorisms. Tell me what is actually in front of you and I will speak to that instead.",
    ],
  },
  {
    id: 'money',
    patterns: [
      ['money', 2.5], ['broke', 2.5], ['rent', 3], ['debt', 3.5], ['bills', 3], ['afford', 3],
      ['salary', 3], ['poor', 2.5], ['rich', 2.5], ['greedy', 3], ['wealth', 3],
    ],
    responses: [
      "There is no virtue in want for its own sake. Wanting enough to live without fear is not greed.",
      "Money is a tool, not a verdict on your worth. Trouble comes when we confuse the two.",
      "Worry about money is heavy precisely because it is real. What is the one practical step available this week?",
      "A kingdom did not make me content, and losing it did not make me poor. Hold it lightly — but do tend to it.",
    ],
  },
  {
    id: 'distraction',
    patterns: [
      ['scrolling', 3.5], ['on my phone', 3.5], ['keep checking', 3.5], ['youtube', 3], ['tiktok', 3],
      ['cannot stop watching', 4], ['doom scroll*', 4], ['keep getting distracted', 4], ['notifications', 3],
    ],
    responses: [
      "The feed is built to hold you. Losing to it is not a character failure — but you can make it harder to win.",
      "Put the phone in another room. Not off, not face down — another room. Distance does what willpower cannot.",
      "You are not lazy. You are being outmatched by something engineered by many clever people. Change the field, not yourself.",
      "Set a timer for five minutes on the real thing. You may stop after — you probably won't.",
    ],
    deeper: [
      "Notice what you reach for the phone to avoid. The scrolling is usually the symptom, not the sickness.",
      "What is the smallest possible version of the thing you are avoiding? Do only that.",
    ],
  },
]
