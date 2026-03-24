import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './shared/theme/tokens.css'
import './styles/_variables.scss'
import './styles/_keyframe-animations.scss'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import App from './App.tsx'

console.log('RAW URL:', window.location.href)

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const url = new URL(window.location.href)
const code = url.searchParams.get('code')

if (code) {
  console.log('FOUND CODE:', code)
  // replaceState 保留到成功后，失败时 code 留在 URL 供调试

  fetch('http://localhost:3000/auth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data) => {
      console.log('AUTH RESPONSE:', data)
      localStorage.setItem('auth', JSON.stringify(data))
      window.history.replaceState({}, '', '/')  // 成功后才清 URL
    })
    .catch((err) => {
      console.error('Auth callback failed:', err)
      // 失败时 code 保留在 URL，方便手动 copy 调试
    })
    .finally(() => {
      mountApp()
    })
} else {
  mountApp()
}
