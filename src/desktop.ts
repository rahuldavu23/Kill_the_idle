// Whether the app is running inside its desktop shell rather than a plain
// browser tab. Tauri injects this before any of our code runs, so it is
// safe to read at module scope — and everything that touches the window
// (dragging it, pinning it, putting it away) has to be gated on it.
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
