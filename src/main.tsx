import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TitleBar from './components/TitleBar.tsx'
import { isDesktop } from './desktop.ts'

// Set before the first paint, so the rounded frameless surface and the
// titlebar's height reservation are in place rather than snapping in.
if (isDesktop) document.documentElement.classList.add('desktop')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesktop && <TitleBar />}
    <App />
  </StrictMode>,
)
