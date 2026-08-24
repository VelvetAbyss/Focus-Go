import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const apiHealthUrl = 'http://127.0.0.1:3000/health'
const localApiBase = 'http://127.0.0.1:3000'
const webAppUrl = 'http://localhost:5174'

const isApiHealthy = async () => {
  try {
    const response = await fetch(apiHealthUrl, { signal: AbortSignal.timeout(1_000) })
    return response.ok
  } catch {
    return false
  }
}

const waitForApi = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isApiHealthy()) return
    await delay(500)
  }
  throw new Error(`Focus&go API did not become healthy at ${apiHealthUrl}`)
}

const isWebAppRunning = async () => {
  try {
    await fetch(webAppUrl, { signal: AbortSignal.timeout(1_000) })
    return true
  } catch {
    return false
  }
}

let startedApi = false
let apiProcess
let webProcess
let shuttingDown = false

const stopChildren = () => {
  if (shuttingDown) return
  shuttingDown = true
  if (webProcess && !webProcess.killed) webProcess.kill('SIGTERM')
  if (startedApi && apiProcess && !apiProcess.killed) apiProcess.kill('SIGTERM')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopChildren()
    process.exit(0)
  })
}

if (await isWebAppRunning()) {
  throw new Error(
    `A web app is already listening on ${webAppUrl}. Stop it, then run this action so the replacement uses the local API.`,
  )
}

if (!(await isApiHealthy())) {
  console.log('Starting Focus&go API on http://127.0.0.1:3000…')
  startedApi = true
  apiProcess = spawn('npm', ['--prefix', 'apps/web/focus-go-api', 'start'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  })
  apiProcess.once('error', (error) => {
    console.error('Unable to start Focus&go API:', error.message)
    stopChildren()
    process.exitCode = 1
  })
  await waitForApi()
} else {
  console.log('Reusing the existing Focus&go API on http://127.0.0.1:3000.')
}

console.log('Starting Focus&go web app with the local API…')
webProcess = spawn('npm', ['run', 'dev', '--workspace', '@focus-go/web', '--', '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_API_BASE: localApiBase },
})

webProcess.once('error', (error) => {
  console.error('Unable to start Focus&go web app:', error.message)
  stopChildren()
  process.exitCode = 1
})

webProcess.once('exit', (code) => {
  stopChildren()
  process.exitCode = code ?? 1
})
