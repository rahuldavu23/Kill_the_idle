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
export interface Intent {
  id: string
  patterns: (string | [string, number])[]
  responses: string[]
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
    patterns: [
      'exam*', ['test', 0.8], 'study', 'studying', 'homework', 'assignment', 'deadline*', 'boss', ['job', 0.9], ['work', 0.8],
      'interview', ['project', 0.8], 'presentation', 'essay', 'college', 'school', 'career', 'coworker*', 'meeting',
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
    patterns: [
      'family', 'parents', ['mom', 0.9], ['mum', 0.9], ['dad', 0.9], ['brother', 0.9], ['sister', 0.9], ['friend', 0.8], 'friends',
      'argument', 'fight', 'fighting', 'forgive*', 'betray*', 'jealous*', 'envy', 'envious', 'toxic', 'drama',
    ],
    responses: [
      "Family can wound, and family can heal. Speak your truth without a weapon in your voice.",
      "Forgiveness is not agreement. It is setting down a stone you were never meant to carry.",
      "My own stepmother sent me to the forest, and still I bore her no hatred. Hatred would have exiled me twice.",
      "Envy measures your life with someone else's ruler. Put it down — walk your own path.",
      "Before the next argument, ask: do I want to win, or do I want peace?",
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
]
