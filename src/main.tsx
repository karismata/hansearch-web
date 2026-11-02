import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AccountGate } from './components/AccountGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountGate><App /></AccountGate>
  </StrictMode>,
)
