import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import Rama from './components/Rama'
import SpeechBubble from './components/SpeechBubble'
import { dialogue, randomFrom, getGreeting, type RamaMood } from './data/dialogue'
import { createRamaChat } from './data/chat'
import { todayKey, formatDay, loadToday, saveToday, moveTask, type TodayTask } from './data/todayTasks'

interface Task {
  id: number
  text: string
  done: boolean
}

interface EnjoyItem {
  id: number
  text: string
}

export default function App() {
  const [message, setMessage]      = useState('')
  const [bubbleVisible, setBubble] = useState(false)
  const [mood, setMood]            = useState<RamaMood>('idle')

  const [tasks, setTasks]         = useState<Task[]>([])
  const [taskInput, setTaskInput] = useState('')

  const [enjoys, setEnjoys]         = useState<EnjoyItem[]>([])
  const [enjoyInput, setEnjoyInput] = useState('')

  // Today's plan — an ordered list tied to the calendar day it was written on.
  const [dayKey, setDayKey]       = useState(todayKey)
  const [today, setToday]         = useState<TodayTask[]>(() => loadToday(todayKey()))
  const [todayInput, setTodayInput] = useState('')

  const [userInput, setUserInput] = useState('')

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

  // Tasks
  const addTask = () => {
    const text = taskInput.trim()
    if (!text) return
    setTasks(prev => [...prev, { id: Date.now(), text, done: false }])
    setTaskInput('')
    showMessage(randomFrom(dialogue.taskAdded), 'happy', 5000)
  }

  const toggleTask = (id: number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (!task.done) showMessage(randomFrom(dialogue.taskCompleted), 'amused', 5000)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const removeTask = (id: number) => setTasks(prev => prev.filter(t => t.id !== id))

  // Enjoy list
  const addEnjoy = () => {
    const text = enjoyInput.trim()
    if (!text) return
    setEnjoys(prev => [...prev, { id: Date.now(), text }])
    setEnjoyInput('')
  }

  const removeEnjoy = (id: number) => setEnjoys(prev => prev.filter(e => e.id !== id))

  // Today's plan — persisted under the day it belongs to
  useEffect(() => saveToday(dayKey, today), [dayKey, today])

  // If the app is left open past midnight, the plan on screen stops being
  // today's. Roll over to the new day and start it clean.
  useEffect(() => {
    const rollover = setInterval(() => {
      const key = todayKey()
      if (key === dayKey) return
      setDayKey(key)
      setToday(loadToday(key))
    }, 30000)
    return () => clearInterval(rollover)
  }, [dayKey])

  const addTodayTask = () => {
    const text = todayInput.trim()
    if (!text) return
    setToday(prev => [...prev, { id: Date.now(), text, done: false }])
    setTodayInput('')
    showMessage(randomFrom(dialogue.taskAdded), 'happy', 5000)
  }

  const toggleTodayTask = (id: number) => {
    const task = today.find(t => t.id === id)
    if (!task) return
    const next = today.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setToday(next)
    if (task.done) return
    // Finishing the last one is a bigger moment than finishing any other.
    const finished = next.every(t => t.done)
    showMessage(
      randomFrom(finished ? dialogue.dayComplete : dialogue.taskCompleted),
      finished ? 'happy' : 'amused',
      finished ? 6500 : 5000,
    )
  }

  const removeTodayTask = (id: number) => setToday(prev => prev.filter(t => t.id !== id))

  const reorderTodayTask = (id: number, delta: -1 | 1) => setToday(prev => moveTask(prev, id, delta))

  // Talk to Rama — a short thinking pause, then a reply to what was said.
  // The mind is async so a slower one can be swapped in; the pause is a
  // floor, not a fixed wait, so a reply that takes longer simply lands when
  // it is ready rather than being rushed on screen.
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
        pendingTasks: tasks.filter(t => !t.done).map(t => t.text),
        doneTasks: tasks.filter(t => t.done).length,
        enjoys: enjoys.map(e => e.text),
        todayTasks: today.filter(t => !t.done).map(t => t.text),
      }),
      new Promise(resolve => setTimeout(resolve, pause)),
    ])

    if (turn !== turnRef.current) return
    showMessage(reply.text, 'speaking', reply.hold)
  }

  // The first unfinished step is the one the whole panel points at.
  const nextStep = today.findIndex(t => !t.done)
  const doneToday = today.filter(t => t.done).length

  const handleRamaClick = () => {
    if (!bubbleVisible && !busyRef.current) showMessage(randomFrom(dialogue.idle), 'thinking', 5000)
  }

  return (
    <div className="app-shell">

      {/* LEFT PANEL — focus tasks */}
      <div className="task-panel left">
        <h2 className="panel-title">Focus</h2>

        <div className="panel-input-row">
          <input
            className="panel-input"
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add a task..."
          />
          <button className="panel-add-btn" onClick={addTask}>+</button>
        </div>

        <ul className="panel-list">
          {tasks.map(task => (
            <li key={task.id} className={`panel-item ${task.done ? 'panel-item--done' : ''}`}>
              <button className="item-check" onClick={() => toggleTask(task.id)} aria-label="Toggle task">
                {task.done ? '✓' : ''}
              </button>
              <span className="item-text">{task.text}</span>
              <button className="item-remove" onClick={() => removeTask(task.id)} aria-label="Remove">×</button>
            </li>
          ))}
        </ul>
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
          {enjoys.map(item => (
            <li key={item.id} className="panel-item">
              <span className="item-bullet">◆</span>
              <span className="item-text">{item.text}</span>
              <button className="item-remove" onClick={() => removeEnjoy(item.id)} aria-label="Remove">×</button>
            </li>
          ))}
        </ul>
      </div>


      {/* BOTTOM PANEL — today's plan, in the order it should be done */}
      <div className="task-panel today">
        <div className="today-head">
          <h2 className="panel-title">Today · in order</h2>
          <span className="today-date">{formatDay(dayKey)}</span>
        </div>

        <div className="panel-input-row">
          <input
            className="panel-input"
            value={todayInput}
            onChange={e => setTodayInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodayTask()}
            placeholder="Next thing to do today..."
          />
          <button className="panel-add-btn" onClick={addTodayTask}>+</button>
        </div>

        {today.length === 0 ? (
          <p className="today-empty">Nothing planned yet. Name the first thing you mean to do today.</p>
        ) : (
          <ol className="panel-list today-list">
            {today.map((task, index) => (
              <li
                key={task.id}
                className={`panel-item today-item${task.done ? ' panel-item--done' : ''}${index === nextStep ? ' today-item--next' : ''}`}
              >
                <span className="today-step">{index + 1}</span>
                <button className="item-check" onClick={() => toggleTodayTask(task.id)} aria-label="Toggle task">
                  {task.done ? '✓' : ''}
                </button>
                <span className="item-text">{task.text}</span>
                <span className="today-move">
                  <button
                    className="today-move-btn"
                    onClick={() => reorderTodayTask(task.id, -1)}
                    disabled={index === 0}
                    aria-label="Move earlier"
                  >▲</button>
                  <button
                    className="today-move-btn"
                    onClick={() => reorderTodayTask(task.id, 1)}
                    disabled={index === today.length - 1}
                    aria-label="Move later"
                  >▼</button>
                </span>
                <button className="item-remove" onClick={() => removeTodayTask(task.id)} aria-label="Remove">×</button>
              </li>
            ))}
          </ol>
        )}

        {today.length > 0 && (
          <div className="today-progress">{doneToday} of {today.length} done</div>
        )}
      </div>

    </div>
  )
}
