import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

registerSW({ immediate: true })

// Ping periódico para evitar cold starts en Render.com (plan free)
setInterval(() => {
  fetch(`${import.meta.env.VITE_API_URL}/health`).catch(() => { });
}, 10 * 60 * 1000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
