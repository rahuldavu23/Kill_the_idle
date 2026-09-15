// Rama's reply engine — understands a typed message well enough to pick a
// fitting line from the dialogue bank. Runs fully offline.
//
// Pipeline: normalise the text (case, contractions, slang) → match intent
// patterns on whole words, longest phrases first → apply negation → pick
// the winning intent, pairing a social opener with a weightier topic when
// both appear → choose a line that hasn't been used recently.

import { dialogue, intents, type ChatContext, type Intent } from './dialogue'

export interface ChatReply {
  text: string
  intent: string | null
  hold: number
}

// ── Normalisation ───────────────────────────────────────────────
const SLANG: Record<string, string> = {
  u: 'you', r: 'are', ur: 'your', ya: 'you', pls: 'please', plz: 'please',
  im: 'i am', ive: 'i have',
  dont: 'do not', doesnt: 'does not', didnt: 'did not', isnt: 'is not', arent: 'are not',
  wasnt: 'was not', werent: 'were not', wont: 'will not', cant: 'cannot', couldnt: 'could not',
  shouldnt: 'should not', wouldnt: 'would not', havent: 'have not', hasnt: 'has not',
  youre: 'you are', theyre: 'they are', whats: 'what is', thats: 'that is', hows: 'how is',
  idk: 'i do not know', wanna: 'want to', gonna: 'going to', gotta: 'got to', kinda: 'kind of',
  cuz: 'because', coz: 'because', bc: 'because', rn: 'right now', tbh: 'to be honest',
}

export function tokenize(text: string): string[] {
  const expanded = text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/'m\b/g, ' am')
    .replace(/'re\b/g, ' are')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    .replace(/'d\b/g, ' would')
    .replace(/'s\b/g, ' is')
    .replace(/[^a-z0-9\s]/g, ' ')

  const tokens: string[] = []
  for (const word of expanded.split(/\s+/)) {
    if (!word) continue
    const mapped = SLANG[word] ?? word
    for (const part of mapped.split(' ')) {
      // "can not" and "cannot" should read the same.
      if (part === 'not' && tokens[tokens.length - 1] === 'can') tokens[tokens.length - 1] = 'cannot'
      else tokens.push(part)
    }
  }
  return tokens
}

const QUESTION_WORDS = new Set(['what', 'why', 'how', 'who', 'when', 'where', 'which', 'can', 'could', 'should', 'would', 'is', 'are', 'do', 'does', 'will', 'am'])
const NEGATORS = new Set(['not', 'no', 'never', 'hardly', 'barely', 'cannot', 'nor', 'without'])
const NEGATION_WINDOW = 3

// ── Compiled patterns ───────────────────────────────────────────
interface CompiledPattern {
  words: string[]
  weight: number
  intent: Intent
}

const intentById = new Map(intents.map((i) => [i.id, i]))

const compiled: CompiledPattern[] = intents
  .flatMap((intent) =>
    intent.patterns.map((p) => {
      const [raw, explicit] = typeof p === 'string' ? [p, undefined] : p
      // Keep a trailing * through tokenisation.
      const star = raw.endsWith('*')
      const words = tokenize(star ? raw.slice(0, -1) : raw)
      if (star) words[words.length - 1] += '*'
      return { words, weight: explicit ?? 1 + 0.5 * (words.length - 1), intent }
    }),
  )
  // Longest, then strongest, patterns claim their words first.
  .sort((a, b) => b.words.length - a.words.length || b.weight - a.weight)

const wordMatches = (pattern: string, token: string) =>
  pattern.endsWith('*') ? token.startsWith(pattern.slice(0, -1)) : pattern === token

function scoreIntents(tokens: string[]): Map<Intent, number> {
  const used = new Array<boolean>(tokens.length).fill(false)
  const scores = new Map<Intent, number>()

  for (const p of compiled) {
    if (p.intent.maxWords && tokens.length > p.intent.maxWords) continue

    for (let i = 0; i + p.words.length <= tokens.length; i++) {
      const hit = p.words.every((w, j) => !used[i + j] && wordMatches(w, tokens[i + j]))
      if (!hit) continue
      for (let j = 0; j < p.words.length; j++) used[i + j] = true

      let target: Intent | undefined = p.intent
      if (target.negatable) {
        const negated = tokens
          .slice(Math.max(0, i - NEGATION_WINDOW), i)
          .some((t, k, arr) => NEGATORS.has(t) && !used[i - arr.length + k])
        if (negated) target = target.negatedTo ? intentById.get(target.negatedTo) : undefined
      }
      if (target) scores.set(target, (scores.get(target) ?? 0) + p.weight)
      break // each pattern counts once per message
    }
  }
  return scores
}

const MIN_SCORE = 0.5

export function createRamaChat() {
  const recent = new Map<string, number[]>()
  let lastTopic: Intent | null = null

  // Pick a line, avoiding the most recently used ones for that pool.
  const pick = (key: string, lines: string[]): string => {
    const avoid = recent.get(key) ?? []
    const fresh = lines.map((_, i) => i).filter((i) => !avoid.includes(i))
    const pool = fresh.length > 0 ? fresh : lines.map((_, i) => i)
    const index = pool[Math.floor(Math.random() * pool.length)]
    const memory = Math.min(3, lines.length - 1)
    recent.set(key, [...avoid, index].slice(-memory))
    return lines[index]
  }

  const answer = (intent: Intent, ctx: ChatContext): string =>
    intent.dynamic?.(ctx) ?? pick(intent.id, intent.responses)

  const holdFor = (text: string, intent: Intent | null) =>
    intent?.hold ?? Math.min(11000, Math.max(4500, 3000 + text.length * 50))

  const reply = (message: string, ctx: ChatContext): ChatReply => {
    const tokens = tokenize(message)
    const scores = scoreIntents(tokens)
    const ranked = [...scores.entries()]
      .filter(([, s]) => s >= MIN_SCORE)
      .sort(([a, sa], [b, sb]) => (b.priority ?? 0) - (a.priority ?? 0) || sb - sa)
      .map(([intent]) => intent)

    const topic = ranked.find((i) => !i.social)
    const social = ranked.find((i) => i.social)

    if (topic) {
      lastTopic = topic
      let text = answer(topic, ctx)
      // "Hi, I'm stressed" gets a greeting and an answer — but never
      // prefix anything to the safety response.
      if (social?.acks && !topic.priority) text = `${pick(`${social.id}:ack`, social.acks)} ${text}`
      return { text, intent: topic.id, hold: holdFor(text, topic) }
    }

    if (social?.id === 'followUp') {
      if (lastTopic && lastTopic.responses.length > 0) {
        const text = pick(lastTopic.id, lastTopic.responses)
        return { text, intent: lastTopic.id, hold: holdFor(text, lastTopic) }
      }
      const text = pick('nothingToContinue', dialogue.fallbacks.nothingToContinue)
      return { text, intent: null, hold: holdFor(text, null) }
    }

    if (social) {
      const text = answer(social, ctx)
      return { text, intent: social.id, hold: holdFor(text, social) }
    }

    // Nothing recognised: answer the shape of the message instead.
    lastTopic = null
    const isQuestion = message.includes('?') || QUESTION_WORDS.has(tokens[0] ?? '')
    const text = isQuestion
      ? pick('fallback:question', dialogue.fallbacks.question)
      : Math.random() < 0.3
        ? pick('idle', dialogue.idle)
        : pick('fallback:statement', dialogue.fallbacks.statement)
    return { text, intent: null, hold: holdFor(text, null) }
  }

  return { reply }
}
