import { useState, useEffect, useCallback } from 'react'
import './App.css'
import Rama from './components/Rama'
import SpeechBubble from './components/SpeechBubble'
import { dialogue, randomFrom, getGreeting, matchKeyword } from './data/dialogue'

type RamaMood = 'idle' | 'happy' | 'thinking' | 'amused' | 'speaking'

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

  const [userInput, setUserInput] = useState('')

  const showMessage = useCallback((text: string, ramaMood: RamaMood = 'speaking', duration = 5000) => {
    setMessage(text)
    setMood(ramaMood)
    setBubble(true)
    setTimeout(() => {
      setBubble(false)
      setTimeout(() => setMood('idle'), 400)
    }, duration)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      showMessage(getGreeting(), 'speaking', 6000)
    }, 1200)
    return () => clearTimeout(timer)
  }, [showMessage])

  useEffect(() => {
    const idleTimer = setInterval(() => {
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

  // Talk to Rama
  const talkToRama = () => {
    const text = userInput.trim()
    if (!text) return
    const response = matchKeyword(text) ?? randomFrom(dialogue.idle)
    showMessage(response, 'speaking', 7000)
    setUserInput('')
  }

  const handleRamaClick = () => {
    if (!bubbleVisible) showMessage(randomFrom(dialogue.idle), 'thinking', 5000)
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
        <SpeechBubble message={message} visible={bubbleVisible} />

        <div className="rama-clickable" onClick={handleRamaClick} title="Click for wisdom">
          <Rama mood={mood} />
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

    </div>
  )
}
