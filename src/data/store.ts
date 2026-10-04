// Everything the user writes down, and the one place it is persisted.
//
// Two kinds of thing live here, and the difference is the whole point:
//
//   Projects  — longer-term work. They carry forward across days and stay
//               until they are ticked off or deleted. Nothing about a new
//               calendar day touches them.
//   Days      — a short, ordered plan that belongs to exactly one calendar
//               day. A new day starts empty, and every earlier day is kept
//               so it can be read back and still ticked off later.
//
// Enjoy is a plain standing list, closer to Projects than to a day.
//
// The backend is deliberately a seam: today it is localStorage (which a
// Tauri webview persists to the app's own data directory, so it survives a
// restart there too), and a file-backed one can replace it without the rest
// of the app knowing.

export interface Task {
  id: string
  text: string
  done: boolean
}

// A project also records when it entered and left the list, so "carried
// forward since Tuesday" is answerable without keeping a separate log.
export interface Project extends Task {
  addedOn: string
  doneOn: string | null
}

export interface EnjoyItem {
  id: string
  text: string
}

export interface AppData {
  projects: Project[]
  enjoys: EnjoyItem[]
  // Keyed by local calendar day, "YYYY-MM-DD".
  days: Record<string, Task[]>
}

export const emptyData = (): AppData => ({ projects: [], enjoys: [], days: {} })

// ─── Days ────────────────────────────────────────────────────────────────

// The local calendar day, never UTC — "today" is the user's today.
export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Steps whole days, so it stays correct across a month, a year and a
// daylight-saving boundary — Date normalises an out-of-range day itself.
export function shiftDay(key: string, delta: number): string {
  const date = parseDay(key)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}

export function formatDay(key: string): string {
  const today = todayKey()
  if (key === today) return 'Today'
  if (key === shiftDay(today, -1)) return 'Yesterday'
  const date = parseDay(key)
  // The year is only worth the space once it is not the current one.
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export const dayTasks = (data: AppData, key: string): Task[] => data.days[key] ?? []

// ─── Ids ─────────────────────────────────────────────────────────────────

let counter = 0

// Date.now() alone collides when two items are added inside the same
// millisecond, which is reachable by holding Enter; the counter closes that.
export function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

// ─── Reordering ──────────────────────────────────────────────────────────

// Move one task a single place up or down, leaving the rest of the order
// untouched. Out-of-range moves return the list unchanged.
export function moveTask<T extends { id: string }>(items: T[], id: string, delta: -1 | 1): T[] {
  const from = items.findIndex(item => item.id === id)
  const to = from + delta
  if (from === -1 || to < 0 || to >= items.length) return items
  const next = [...items]
  next[from] = items[to]
  next[to] = items[from]
  return next
}

// ─── Persistence ─────────────────────────────────────────────────────────

export interface StorageBackend {
  read(): string | null
  write(text: string): void
}

const KEY = 'present-flow.data'
// The pre-store format: one day's plan under its own key. Read once on a
// first run, then left in place rather than deleted, so nothing is lost if
// an older build is opened again.
const LEGACY_KEY = 'present-flow.today'

const VERSION = 1

// Storage can be absent (a non-browser host), blocked (private mode) or
// full, and none of those should take the app down with them.
const localBackend: StorageBackend = {
  read() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  write(text) {
    try {
      localStorage.setItem(KEY, text)
    } catch {
      // Nothing to do but let this session's work live in memory.
    }
  },
}

let backend: StorageBackend = localBackend

export function setBackend(next: StorageBackend): void {
  backend = next
}

// How much history to keep: long enough to look back over a year, short
// enough that the document stays small however long the app is used.
const KEEP_DAYS = 400

function pruneDays(days: Record<string, Task[]>): Record<string, Task[]> {
  const kept: Record<string, Task[]> = {}
  const keys = Object.keys(days).sort().reverse().slice(0, KEEP_DAYS)
  for (const key of keys) {
    if (days[key].length > 0) kept[key] = days[key]
  }
  return kept
}

// ─── Reading ─────────────────────────────────────────────────────────────
//
// Stored text is untrusted: it may come from an older build, have been
// hand-edited, or not be ours at all. Every field is checked, and anything
// unreadable is dropped rather than allowed to fail the whole load.

const isDayKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key)

function readTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const text = typeof source.text === 'string' ? source.text.trim() : ''
  if (!text) return null
  // Ids were numbers before this store existed.
  const id =
    typeof source.id === 'string' || typeof source.id === 'number' ? String(source.id) : newId()
  return { id, text, done: Boolean(source.done) }
}

function readProject(raw: unknown, fallbackDay: string): Project | null {
  const task = readTask(raw)
  if (!task) return null
  const source = raw as Record<string, unknown>
  const addedOn =
    typeof source.addedOn === 'string' && isDayKey(source.addedOn) ? source.addedOn : fallbackDay
  const doneOn =
    typeof source.doneOn === 'string' && isDayKey(source.doneOn) ? source.doneOn : null
  // An unfinished project must not also carry a completion date.
  return { ...task, addedOn, doneOn: task.done ? doneOn ?? addedOn : null }
}

function readLegacyDay(): Record<string, Task[]> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const stored = JSON.parse(raw) as { date?: unknown; tasks?: unknown }
    const date = typeof stored?.date === 'string' && isDayKey(stored.date) ? stored.date : null
    if (!date || !Array.isArray(stored.tasks)) return {}
    const tasks = stored.tasks.map(readTask).filter((task): task is Task => task !== null)
    return tasks.length > 0 ? { [date]: tasks } : {}
  } catch {
    return {}
  }
}

export function loadData(): AppData {
  const today = todayKey()
  let parsed: Record<string, unknown> | null
  try {
    const raw = backend.read()
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    parsed = null
  }

  // First run on this build: adopt whatever the previous one left behind.
  if (!parsed) return { ...emptyData(), days: pruneDays(readLegacyDay()) }

  const projects = Array.isArray(parsed.projects)
    ? parsed.projects
        .map(project => readProject(project, today))
        .filter((project): project is Project => project !== null)
    : []

  const enjoys = Array.isArray(parsed.enjoys)
    ? parsed.enjoys
        .map(readTask)
        .filter((item): item is Task => item !== null)
        .map(({ id, text }) => ({ id, text }))
    : []

  const days: Record<string, Task[]> = {}
  if (parsed.days && typeof parsed.days === 'object') {
    for (const [key, value] of Object.entries(parsed.days as Record<string, unknown>)) {
      if (!isDayKey(key) || !Array.isArray(value)) continue
      const tasks = value.map(readTask).filter((task): task is Task => task !== null)
      if (tasks.length > 0) days[key] = tasks
    }
  }

  return { projects, enjoys, days: pruneDays(days) }
}

export function saveData(data: AppData): void {
  backend.write(JSON.stringify({ version: VERSION, ...data, days: pruneDays(data.days) }))
}

// ─── Portability ─────────────────────────────────────────────────────────

// A plain, readable snapshot — the thing to keep if the app is ever
// reinstalled or moved to another machine.
export function exportJson(data: AppData): string {
  return JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), ...data }, null, 2)
}

// The nearest earlier day that actually holds something, so browsing back
// through a quiet week is one click rather than seven.
export function previousDayWithContent(data: AppData, from: string): string | null {
  const earlier = Object.keys(data.days)
    .filter(key => key < from && (data.days[key]?.length ?? 0) > 0)
    .sort()
  return earlier.length > 0 ? earlier[earlier.length - 1] : null
}
