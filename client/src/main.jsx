import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Ping periódico para evitar cold starts en Render.com (plan free)
setInterval(() => {
  fetch(`${import.meta.env.VITE_API_URL}/health`).catch(() => {});
}, 10 * 60 * 1000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
