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
import { installReactScan } from './shared/performance/installReactScan'
import { installWebVitalsReporting } from './shared/performance/reportWebVitals'

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  installWebVitalsReporting()
}

async function bootstrap() {
  await installReactScan()
  if (await bootstrapAuth()) mountApp()
}

bootstrap()
