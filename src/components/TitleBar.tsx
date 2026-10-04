// The window's own chrome, drawn by the app because the real one is turned
// off. It carries the only three things a widget needs: somewhere to grab
// it, a pin to keep it above other windows, and a way to quit.
//
// Rendered only inside the desktop shell — in a browser there is no window
// to drag and these controls would be dead.

import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './TitleBar.css'

export default function TitleBar() {
  const [pinned, setPinned] = useState(false)

  // The shell, not this component, owns the real state: the tray menu can
  // pin the window too, so the button reads the window rather than assuming.
  useEffect(() => {
    getCurrentWindow().isAlwaysOnTop().then(setPinned).catch(() => {})
  }, [])

  const togglePin = async () => {
    const next = !pinned
    try {
      await getCurrentWindow().setAlwaysOnTop(next)
      setPinned(next)
    } catch {
      // Leave the button showing the state the window is actually in.
    }
  }

  // The shell turns this into a real exit, so nothing is left running once
  // the window is gone. Going through close() rather than exiting from here
  // keeps that decision in one place.
  const quit = () => {
    getCurrentWindow().close().catch(() => {})
  }

  const minimize = () => {
    getCurrentWindow().minimize().catch(() => {})
  }

  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="titlebar-name" data-tauri-drag-region>Present Flow</span>

      <div className="titlebar-controls">
        <button
          className={`titlebar-btn titlebar-pin${pinned ? ' titlebar-pin--on' : ''}`}
          onClick={togglePin}
          title={pinned ? 'Unpin — let other windows cover this' : 'Pin above other windows'}
          aria-pressed={pinned}
        >Top</button>
        <button className="titlebar-btn" onClick={minimize} title="Minimize" aria-label="Minimize">—</button>
        <button
          className="titlebar-btn titlebar-btn--close"
          onClick={quit}
          title="Quit — nothing stays running"
          aria-label="Quit"
        >×</button>
      </div>
    </div>
  )
}
