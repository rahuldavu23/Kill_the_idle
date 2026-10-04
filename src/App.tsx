import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import Rama from './components/Rama'
import SpeechBubble from './components/SpeechBubble'
import { dialogue, randomFrom, getGreeting, type RamaMood } from './data/dialogue'
import { createRamaChat } from './data/chat'
import {
  loadData,
  saveData,
  todayKey,
  shiftDay,
  formatDay,
  dayTasks,
  previousDayWithContent,
  moveTask,
  newId,
  type AppData,
  type Task,
} from './data/store'

export default function App() {
  const [message, setMessage]      = useState('')
  const [bubbleVisible, setBubble] = useState(false)
  const [mood, setMood]            = useState<RamaMood>('idle')

  // Everything persisted lives in one document, so there is a single place
  // that is read on open and a single place that is written on change.
  const [data, setData] = useState<AppData>(loadData)

  // The real calendar day, and the day being looked at. They are the same
  // until the user browses back through history.
  const [liveDay, setLiveDay] = useState(todayKey)
  const [viewDay, setViewDay] = useState(todayKey)

  const [projectInput, setProjectInput] = useState('')
  const [enjoyInput, setEnjoyInput]     = useState('')
  const [dayInput, setDayInput]         = useState('')
  const [userInput, setUserInput]       = useState('')

  // One chat engine for the session, so it remembers the last topic and
  // which lines it has used recently.
  const [chat] = useState(createRamaChat)

  // Every pending bubble/mood timer lives here, so a new message cancels
  // the old one's timers instead of being hidden early by them.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // True while Rama is "thinking" about a reply — idle chatter and clicks
  // must not talk over it.
  const busyRef = useRef(false)
  // Counts exchanges, so a reply that arrives after the user has already
  // said something else is discarded instead of overwriting the newer one.
  const turnRef = useRef(0)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const showMessage = useCallback((text: string, ramaMood: RamaMood = 'speaking', duration = 5000) => {
    clearTimers()
    busyRef.current = false
    setMessage(text)
    setMood(ramaMood)
    setBubble(true)
    later(() => {
      setBubble(false)
      later(() => setMood('idle'), 400)
    }, duration)
  }, [clearTimers, later])

  useEffect(() => {
    const timer = setTimeout(() => {
      showMessage(getGreeting(), 'speaking', 6000)
    }, 1200)
    return () => clearTimeout(timer)
  }, [showMessage])

  useEffect(() => {
    const idleTimer = setInterval(() => {
      if (busyRef.current) return
      setBubble(current => {
        if (!current) showMessage(randomFrom(dialogue.idle), 'idle', 6000)
        return current
      })
    }, 35000)
    return () => clearInterval(idleTimer)
  }, [showMessage])

  // ─── Persistence ───────────────────────────────────────────────────────

  // Written on every change, including the first — which is what commits a
  // migration from an older format to disk.
  useEffect(() => saveData(data), [data])

  // If the app is left open past midnight the plan on screen stops being
  // today's. Follow the new day, but only drag the view along if it was
  // sitting on the day that just ended rather than on history.
  useEffect(() => {
    const rollover = setInterval(() => {
      const key = todayKey()
      if (key === liveDay) return
      setLiveDay(key)
      setViewDay(current => (current === liveDay ? key : current))
    }, 30000)
    return () => clearInterval(rollover)
  }, [liveDay])

  // ─── Projects — long-term, carried forward until finished ──────────────

  const addProject = () => {
    const text = projectInput.trim()
    if (!text) return
    setData(prev => ({
      ...prev,
      projects: [...prev.projects, { id: newId(), text, done: false, addedOn: liveDay, doneOn: null }],
    }))
    setProjectInput('')
    showMessage(randomFrom(dialogue.taskAdded), 'happy', 5000)
  }

  const toggleProject = (id: string) => {
    const project = data.projects.find(p => p.id === id)
    if (!project) return
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.id === id ? { ...p, done: !p.done, doneOn: p.done ? null : liveDay } : p,
      ),
    }))
    if (!project.done) showMessage(randomFrom(dialogue.taskCompleted), 'amused', 5000)
  }

  const removeProject = (id: string) =>
    setData(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== id) }))

  const clearFinishedProjects = () =>
    setData(prev => ({ ...prev, projects: prev.projects.filter(p => !p.done) }))

  // ─── Enjoy — a standing list, not tied to any day ──────────────────────

  const addEnjoy = () => {
    const text = enjoyInput.trim()
    if (!text) return
    setData(prev => ({ ...prev, enjoys: [...prev.enjoys, { id: newId(), text }] }))
    setEnjoyInput('')
  }

  const removeEnjoy = (id: string) =>
    setData(prev => ({ ...prev, enjoys: prev.enjoys.filter(e => e.id !== id) }))

  // ─── The day's plan — one ordered list per calendar day ────────────────

  // Every day edit goes through here, so a day that empties out is removed
  // rather than left behind as a stored empty list.
  const setDay = (key: string, update: (tasks: Task[]) => Task[]) =>
    setData(prev => {
      const next = update(prev.days[key] ?? [])
      const days = { ...prev.days }
      if (next.length > 0) days[key] = next
      else delete days[key]
      return { ...prev, days }
    })

  const viewTasks = dayTasks(data, viewDay)
  const isToday = viewDay === liveDay

  const addDayTask = () => {
    const text = dayInput.trim()
    if (!text || !isToday) return
    setDay(viewDay, tasks => [...tasks, { id: newId(), text, done: false }])
    setDayInput('')
    showMessage(randomFrom(dialogue.taskAdded), 'happy', 5000)
  }

  const toggleDayTask = (id: string) => {
    const task = viewTasks.find(t => t.id === id)
    if (!task) return
    const next = viewTasks.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    setDay(viewDay, () => next)
    if (task.done) return
    // Finishing the last one is a bigger moment than finishing any other —
    // but only while the day in question is still the one being lived.
    const finished = isToday && next.every(t => t.done)
    showMessage(
      randomFrom(finished ? dialogue.dayComplete : dialogue.taskCompleted),
      finished ? 'happy' : 'amused',
      finished ? 6500 : 5000,
    )
  }

  const removeDayTask = (id: string) =>
    setDay(viewDay, tasks => tasks.filter(t => t.id !== id))

  const reorderDayTask = (id: string, delta: -1 | 1) =>
    setDay(viewDay, tasks => moveTask(tasks, id, delta))

  // ─── Talking to Rama ───────────────────────────────────────────────────

  // A short thinking pause, then a reply to what was said. The mind is
  // async so a slower one can be swapped in; the pause is a floor, not a
  // fixed wait, so a reply that takes longer simply lands when it is ready
  // rather than being rushed on screen.
  const talkToRama = async () => {
    const text = userInput.trim()
    if (!text) return
    setUserInput('')

    clearTimers()
    busyRef.current = true
    setBubble(false)
    setMood('thinking')

    // This exchange's token — a newer message makes an older reply stale.
    const turn = ++turnRef.current
    const pause = 600 + Math.min(700, text.length * 8)

    const [reply] = await Promise.all([
      chat.reply(text, {
        pendingTasks: data.projects.filter(p => !p.done).map(p => p.text),
        doneTasks: data.projects.filter(p => p.done).length,
        enjoys: data.enjoys.map(e => e.text),
        // Always the real today, whatever day is being looked at.
        todayTasks: dayTasks(data, liveDay).filter(t => !t.done).map(t => t.text),
      }),
      new Promise(resolve => setTimeout(resolve, pause)),
    ])

    if (turn !== turnRef.current) return
    showMessage(reply.text, 'speaking', reply.hold)
  }

  const handleRamaClick = () => {
    if (!bubbleVisible && !busyRef.current) showMessage(randomFrom(dialogue.idle), 'thinking', 5000)
  }

  // ─── Derived view state ────────────────────────────────────────────────

  // The first unfinished step is the one the whole panel points at.
  const nextStep = viewTasks.findIndex(t => !t.done)
  const doneCount = viewTasks.filter(t => t.done).length
  const finishedProjects = data.projects.filter(p => p.done).length
  const jumpBack = previousDayWithContent(data, viewDay)

  return (
    <div className="app-shell">

      {/* LEFT PANEL — projects that outlive a single day */}
      <div className="task-panel left">
        <h2 className="panel-title">Projects</h2>

        <div className="panel-input-row">
          <input
            className="panel-input"
            value={projectInput}
            onChange={e => setProjectInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProject()}
            placeholder="Something ongoing..."
          />
          <button className="panel-add-btn" onClick={addProject}>+</button>
        </div>

        <ul className="panel-list">
          {data.projects.map(project => (
            <li key={project.id} className={`panel-item ${project.done ? 'panel-item--done' : ''}`}>
              <button className="item-check" onClick={() => toggleProject(project.id)} aria-label="Toggle project">
                {project.done ? '✓' : ''}
              </button>
              <span className="item-text">
                {project.text}
                {/* Carried forward — worth seeing how long it has been waiting. */}
                {!project.done && project.addedOn !== liveDay && (
                  <span className="item-since">since {formatDay(project.addedOn)}</span>
                )}
              </span>
              <button className="item-remove" onClick={() => removeProject(project.id)} aria-label="Remove">×</button>
            </li>
          ))}
        </ul>

        {finishedProjects > 0 && (
          <button className="panel-foot-btn" onClick={clearFinishedProjects}>
            Clear {finishedProjects} finished
          </button>
        )}
      </div>

      {/* CENTER STAGE */}
      <div className="avatar-stage">
        <div className="rama-anchor">
          <SpeechBubble message={message} visible={bubbleVisible} />

          <div className="rama-clickable" onClick={handleRamaClick} title="Click for wisdom">
            <Rama mood={mood} />
          </div>
        </div>

        <div className="rama-chat">
          <input
            className="rama-chat-input"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && talkToRama()}
            placeholder="Speak to Rama..."
          />
          <button className="rama-chat-btn" onClick={talkToRama}>→</button>
        </div>
      </div>

      {/* RIGHT PANEL — enjoy list */}
      <div className="task-panel right">
        <h2 className="panel-title">Enjoy</h2>

        <div className="panel-input-row">
          <input
            className="panel-input"
            value={enjoyInput}
            onChange={e => setEnjoyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEnjoy()}
            placeholder="Add something to enjoy..."
          />
          <button className="panel-add-btn" onClick={addEnjoy}>+</button>
        </div>

        <ul className="panel-list">
          {data.enjoys.map(item => (
            <li key={item.id} className="panel-item">
              <span className="item-bullet">◆</span>
              <span className="item-text">{item.text}</span>
              <button className="item-remove" onClick={() => removeEnjoy(item.id)} aria-label="Remove">×</button>
            </li>
          ))}
        </ul>
      </div>

      {/* BOTTOM PANEL — one day's plan, in the order it should be done */}
      <div className={`task-panel today${isToday ? '' : ' today--past'}`}>
        <div className="today-head">
          <h2 className="panel-title">{isToday ? 'Today · in order' : 'That day · in order'}</h2>

          <div className="day-nav">
            <button
              className="day-nav-btn"
              onClick={() => setViewDay(shiftDay(viewDay, -1))}
              aria-label="Previous day"
            >◀</button>
            <span className="today-date">{formatDay(viewDay)}</span>
            <button
              className="day-nav-btn"
              onClick={() => setViewDay(shiftDay(viewDay, 1))}
              disabled={isToday}
              aria-label="Next day"
            >▶</button>
            {!isToday && (
              <button className="day-nav-today" onClick={() => setViewDay(liveDay)}>Today</button>
            )}
          </div>
        </div>

        {isToday ? (
          <div className="panel-input-row">
            <input
              className="panel-input"
              value={dayInput}
              onChange={e => setDayInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDayTask()}
              placeholder="Next thing to do today..."
            />
            <button className="panel-add-btn" onClick={addDayTask}>+</button>
          </div>
        ) : (
          // A finished day can still be ticked off, but not added to — new
          // work belongs to the day you are actually in.
          <p className="today-readonly">
            Looking back. You can still tick these off; new items go on today's list.
          </p>
        )}

        {viewTasks.length === 0 ? (
          <p className="today-empty">
            {isToday
              ? 'Nothing planned yet. Name the first thing you mean to do today.'
              : 'Nothing was written down for this day.'}
            {jumpBack && (
              <button className="today-jump" onClick={() => setViewDay(jumpBack)}>
                ◀ {formatDay(jumpBack)}
              </button>
            )}
          </p>
        ) : (
          <ol className="panel-list today-list">
            {viewTasks.map((task, index) => (
              <li
                key={task.id}
                className={`panel-item today-item${task.done ? ' panel-item--done' : ''}${index === nextStep && isToday ? ' today-item--next' : ''}`}
              >
                <span className="today-step">{index + 1}</span>
                <button className="item-check" onClick={() => toggleDayTask(task.id)} aria-label="Toggle task">
                  {task.done ? '✓' : ''}
                </button>
                <span className="item-text">{task.text}</span>
                {/* Reordering a day that is already over has no meaning. */}
                {isToday && (
                  <span className="today-move">
                    <button
                      className="today-move-btn"
                      onClick={() => reorderDayTask(task.id, -1)}
                      disabled={index === 0}
                      aria-label="Move earlier"
                    >▲</button>
                    <button
                      className="today-move-btn"
                      onClick={() => reorderDayTask(task.id, 1)}
                      disabled={index === viewTasks.length - 1}
                      aria-label="Move later"
                    >▼</button>
                  </span>
                )}
                <button className="item-remove" onClick={() => removeDayTask(task.id)} aria-label="Remove">×</button>
              </li>
            ))}
          </ol>
        )}

        {viewTasks.length > 0 && (
          <div className="today-progress">{doneCount} of {viewTasks.length} done</div>
        )}
      </div>

    </div>
  )
}
