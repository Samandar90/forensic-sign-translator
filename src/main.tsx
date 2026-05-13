import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { buildWorkspaceHydration } from './lib/persistence/hydration'

const workspaceHydration = buildWorkspaceHydration()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App workspaceHydration={workspaceHydration} />
  </StrictMode>,
)
