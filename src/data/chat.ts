// Rama's local mind — understands a typed message well enough to answer the
// situation, not merely the subject. Runs fully offline.
//
// Pipeline: normalise the text (case, contractions, slang) → match intent
// patterns on whole words, longest phrases first → apply negation → pick the
// winning intent → pick a *facet* inside it, so "my dad is in the hospital"
// and "my dad and I argued" get different answers → name what the user
// mentioned → choose a line that hasn't been used recently.

import { dialogue, intents, type ChatContext, type Facet, type Intent } from './dialogue'
import type { ChatReply, RamaMind } from './mind'

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

// A pattern is written naturally ("can't sleep", "procrastinat*") and is
// normalised the same way the user's message is. A trailing * matches any
// word with that stem; a pair carries an explicit weight.
function compilePattern(p: string | [string, number]) {
  const [raw, explicit] = typeof p === 'string' ? [p, undefined] : p
  const star = raw.endsWith('*')
  const words = tokenize(star ? raw.slice(0, -1) : raw)
  if (star) words[words.length - 1] += '*'
  return { words, weight: explicit ?? 1 + 0.5 * (words.length - 1) }
}

const compiled: CompiledPattern[] = intents
  .flatMap((intent) => intent.patterns.map((p) => ({ ...compilePattern(p), intent })))
  // Longest, then strongest, patterns claim their words first.
  .sort((a, b) => b.words.length - a.words.length || b.weight - a.weight)

const wordMatches = (pattern: string, token: string) =>
  pattern.endsWith('*') ? token.startsWith(pattern.slice(0, -1)) : pattern === token

// Does this sequence of pattern words appear in the message?
function containsPattern(words: string[], tokens: string[]): boolean {
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (words.every((w, j) => wordMatches(w, tokens[i + j]))) return true
  }
  return false
}

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

// ── Facets ──────────────────────────────────────────────────────
// An intent names the subject; a facet names the situation. "work" covers
// both a crushing deadline and a boss who humiliated you, and those need
// different answers — so each facet's cues are scored separately and the
// strongest one replies. No cue matching means the intent's general lines.

const facetCues = new WeakMap<Facet, { words: string[]; weight: number }[]>()

function cuesFor(facet: Facet) {
  let c = facetCues.get(facet)
  if (!c) {
    c = facet.cues.map(compilePattern)
    facetCues.set(facet, c)
  }
  return c
}

function chooseFacet(intent: Intent, tokens: string[]): Facet | null {
  if (!intent.facets) return null
  let best: Facet | null = null
  let bestScore = 0
  for (const facet of intent.facets) {
    let score = 0
    for (const cue of cuesFor(facet)) {
      if (containsPattern(cue.words, tokens)) score += cue.weight
    }
    if (score > bestScore) {
      best = facet
      bestScore = score
    }
  }
  return bestScore > 0 ? best : null
}

// ── Naming what was said ────────────────────────────────────────
// Echoing a fragment of the user's own words is the difference between
// being answered and being processed. Only nouns that follow "my" are
// echoed, and only from a known list, so Rama never parrots something
// mangled back at someone who is upset.

const POSSESSED: Record<string, string> = {
  mom: 'your mother', mother: 'your mother', mum: 'your mother', mama: 'your mother',
  dad: 'your father', father: 'your father', papa: 'your father', pop: 'your father',
  brother: 'your brother', sister: 'your sister', parents: 'your parents',
  son: 'your son', daughter: 'your daughter', child: 'your child', kid: 'your child',
  wife: 'your wife', husband: 'your husband', partner: 'your partner',
  girlfriend: 'your girlfriend', boyfriend: 'your boyfriend',
  friend: 'your friend', friends: 'your friends', grandmother: 'your grandmother',
  grandma: 'your grandmother', grandfather: 'your grandfather', grandpa: 'your grandfather',
  boss: 'your boss', manager: 'your manager', teacher: 'your teacher',
  job: 'your job', work: 'your work', career: 'your career', team: 'your team',
  exam: 'your exam', exams: 'your exams', test: 'your test', interview: 'your interview',
  thesis: 'your thesis', project: 'your project', presentation: 'your presentation',
  deadline: 'your deadline', degree: 'your degree',
  dog: 'your dog', cat: 'your cat', pet: 'your pet',
  health: 'your health', body: 'your body', family: 'your family',
}

// "my dad is in the hospital" → "your father"
function nameSubject(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== 'my') continue
    const named = POSSESSED[tokens[i + 1]]
    if (named) return named
  }
  return null
}

// The subject is stored lowercase ("your father") because most templates
// embed it mid-sentence; capitalise it when it opens one.
function fillSubject(template: string, subject: string): string {
  const named = template.startsWith('{it}')
    ? subject.charAt(0).toUpperCase() + subject.slice(1)
    : subject
  return template.replace('{it}', named)
}

const MIN_SCORE = 0.5

export function createRamaChat(): RamaMind {
  const recent = new Map<string, number[]>()
  let lastTopic: Intent | null = null
  // The exact situation last answered. Staying on it earns the deeper
  // lines; moving from a family argument to a family illness does not,
  // even though both are the same intent.
  let lastFacet: string | null = null
  // How many messages in a row have landed on the same thing. A second
  // message about it deserves more than the first line reworded.
  let streak = 0
  // Consecutive messages he has not understood. A thread survives a couple
  // of them — "I don't know how to handle it" is still about the father in
  // hospital — but not indefinitely, or "go on" would resurrect something
  // the user left behind several messages ago.
  let unrecognised = 0
  const THREAD_PATIENCE = 2

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

  // The intent's own text, preferring the facet that fits the situation and
  // the deeper lines once the user has stayed on that exact situation.
  // Updates the thread as a side effect, so the caller's streak reflects
  // the facet that actually answered.
  // `stay` is for "go on", which carries no cues of its own but is by
  // definition a request to continue the situation already open.
  const answer = (intent: Intent, tokens: string[], ctx: ChatContext, stay = false): string => {
    const dynamic = intent.dynamic?.(ctx)
    if (dynamic) {
      lastFacet = null
      streak = 0
      return dynamic
    }

    const facet = stay
      ? intent.facets?.find((f) => f.id === lastFacet) ?? null
      : chooseFacet(intent, tokens)
    const key = facet?.id ?? null
    streak = stay || (intent === lastTopic && key === lastFacet) ? streak + 1 : 0
    lastFacet = key

    if (facet) {
      if (streak > 0 && facet.deeper?.length) return pick(`${intent.id}:${facet.id}:deeper`, facet.deeper)
      return pick(`${intent.id}:${facet.id}`, facet.responses)
    }
    if (streak > 0 && intent.deeper?.length) return pick(`${intent.id}:deeper`, intent.deeper)
    return pick(intent.id, intent.responses)
  }

  const holdFor = (text: string, intent: Intent | null) =>
    intent?.hold ?? Math.min(11000, Math.max(4500, 3000 + text.length * 50))

  const respond = (message: string, ctx: ChatContext): ChatReply => {
    const tokens = tokenize(message)
    const scores = scoreIntents(tokens)
    const ranked = [...scores.entries()]
      .filter(([, s]) => s >= MIN_SCORE)
      .sort(([a, sa], [b, sb]) => (b.priority ?? 0) - (a.priority ?? 0) || sb - sa)
      .map(([intent]) => intent)

    const topic = ranked.find((i) => !i.social)
    const social = ranked.find((i) => i.social)

    if (topic) {
      // answer() reads the thread to decide how deep to go, so it runs
      // before lastTopic moves on.
      let text = answer(topic, tokens, ctx)
      lastTopic = topic
      unrecognised = 0

      // Name the thing they mentioned, but never in front of the safety
      // response, and only when opening the subject — repeating it back
      // every turn would sound like a machine, not a listener.
      const subject = topic.reflects ? nameSubject(tokens) : null
      if (subject && !topic.priority && streak === 0) {
        text = `${fillSubject(pick('reflect', dialogue.reflections), subject)} ${text}`
      } else if (social?.acks && !topic.priority) {
        // "Hi, I'm stressed" gets a greeting and an answer.
        text = `${pick(`${social.id}:ack`, social.acks)} ${text}`
      }
      return { text, intent: topic.id, hold: holdFor(text, topic) }
    }

    if (social?.id === 'followUp') {
      if (lastTopic) {
        const previous = lastTopic
        const text = answer(previous, tokens, ctx, true)
        lastTopic = previous
        return { text, intent: previous.id, hold: holdFor(text, previous) }
      }
      const text = pick('nothingToContinue', dialogue.fallbacks.nothingToContinue)
      return { text, intent: null, hold: holdFor(text, null) }
    }

    if (social) {
      const text = answer(social, tokens, ctx)
      lastTopic = null
      lastFacet = null
      streak = 0
      return { text, intent: social.id, hold: holdFor(text, social) }
    }

    // Nothing recognised. If something is already open, stay with it —
    // a vague follow-up like "I don't know how to handle it" belongs to
    // what was just said, and answering it with a stock line is how he
    // loses the thread at the moment it matters most.
    unrecognised += 1

    // Naming someone new ("my dog") introduces a subject rather than
    // continuing the old one, so it is checked before the open thread.
    const subject = nameSubject(tokens)
    if (subject) {
      lastTopic = null
      lastFacet = null
      streak = 0
      const text = fillSubject(pick('fallback:subject', dialogue.fallbacks.aboutSubject), subject)
      return { text, intent: null, hold: holdFor(text, null) }
    }

    if (lastTopic && unrecognised <= THREAD_PATIENCE) {
      const open = lastTopic
      const text = answer(open, tokens, ctx, true)
      lastTopic = open
      return { text, intent: open.id, hold: holdFor(text, open) }
    }

    // Otherwise be curious rather than oracular — an aphorism aimed at a
    // message he did not understand is what makes him seem deaf.
    lastTopic = null
    lastFacet = null
    streak = 0
    const isQuestion = message.includes('?') || QUESTION_WORDS.has(tokens[0] ?? '')
    const text = isQuestion
      ? pick('fallback:question', dialogue.fallbacks.question)
      : pick('fallback:statement', dialogue.fallbacks.statement)
    return { text, intent: null, hold: holdFor(text, null) }
  }

  return { reply: (message, ctx) => Promise.resolve(respond(message, ctx)) }
}
