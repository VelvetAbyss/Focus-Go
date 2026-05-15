import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './shared/theme/tokens.css'
import './styles/_variables.scss'
import './styles/_keyframe-animations.scss'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './data/events/timelineProjection'
import App from './App.tsx'
import { bootstrapAuth } from './config/authBootstrap'

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

async function bootstrap() {
  if (await bootstrapAuth()) mountApp()
}

bootstrap()
