// Today's plan — the short, ordered list of things meant to be done on the
// calendar day the user is currently on.
//
// It is deliberately not the Focus list: Focus is open-ended and unordered,
// this is a sequence that belongs to exactly one day. It is stored locally so
// a reload during the day keeps the plan, and anything written under an
// earlier date is dropped rather than carried forward.

export interface TodayTask {
  id: number
  text: string
  done: boolean
}

interface StoredDay {
  date: string
  tasks: TodayTask[]
}

const STORAGE_KEY = 'present-flow.today'

// The local calendar day, never UTC — "today" is the user's today.
export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  })
}

// Returns the stored plan only if it was written for `key`; a new day always
// starts empty. Storage can be unavailable or hold anything at all, so every
// field is checked before it is trusted.
export function loadToday(key: string): TodayTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as StoredDay | null
    if (!stored || stored.date !== key || !Array.isArray(stored.tasks)) return []
    return stored.tasks
      .filter(task => task && typeof task.text === 'string' && typeof task.id === 'number')
      .map(task => ({ id: task.id, text: task.text, done: Boolean(task.done) }))
  } catch {
    return []
  }
}

export function saveToday(key: string, tasks: TodayTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: key, tasks } satisfies StoredDay))
  } catch {
    // Private mode or a full quota — the plan simply lives for this session.
  }
}

// Move one task a single place up or down, leaving the rest of the order
// untouched. Out-of-range moves return the list unchanged.
export function moveTask(tasks: TodayTask[], id: number, delta: -1 | 1): TodayTask[] {
  const from = tasks.findIndex(task => task.id === id)
  const to = from + delta
  if (from === -1 || to < 0 || to >= tasks.length) return tasks
  const next = [...tasks]
  next[from] = tasks[to]
  next[to] = tasks[from]
  return next
}
