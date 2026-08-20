import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const projectRoot = process.cwd()

export const requireEnv = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const optionalEnv = (name, fallback) => {
  const value = process.env[name]
  if (value === undefined || value === null || value === '') return fallback
  return value
}

export const utcDate = () => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${now.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const exec = (bin, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const { streamOutput = true, ...spawnOpts } = opts
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], ...spawnOpts })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      if (streamOutput) process.stdout.write(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      if (streamOutput) process.stderr.write(text)
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`${bin} ${args.join(' ')} failed with exit code ${code}`))
    })
  })

export const sha256File = async (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })

export const sha256String = (content) => createHash('sha256').update(content).digest('hex')

export const walkFiles = async (rootDir) => {
  const result = []

  const walk = async (currentDir) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
      } else if (entry.isFile()) {
        result.push(absolute)
      }
    }
  }

  await walk(rootDir)
  return result
}

export const toPosixRelative = (rootDir, absolutePath) =>
  path.relative(rootDir, absolutePath).split(path.sep).join('/')

export const copyDir = async (src, dest) => {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
      continue
    }
    await fs.copyFile(srcPath, destPath)
  }
}

export const resolveReleaseIdentity = async () => {
  const app = optionalEnv('APP_NAME', 'focus-go')
  const releaseDate = optionalEnv('RELEASE_DATE', utcDate())

  let gitSha = process.env.GIT_SHA
  if (!gitSha) {
    const { stdout } = await exec('git', ['rev-parse', '--short=12', 'HEAD'], { streamOutput: false })
    gitSha = stdout.trim()
  }

  const releaseRoot = optionalEnv('RELEASE_ROOT', '.artifacts/releases')
  const releaseDir = path.join(projectRoot, releaseRoot, app, releaseDate, gitSha)
  const releasePrefix = optionalEnv('OSS_PREFIX', 'releases')

  return {
    app,
    gitSha,
    releaseDate,
    releaseRoot,
    releaseDir,
    releasePrefix,
  }
}

export const resolveOssPath = ({ bucket, releasePrefix, app, releaseDate, gitSha }) =>
  `oss://${bucket}/${releasePrefix}/${app}/${releaseDate}/${gitSha}/`

export const resolveLatestPointerPath = ({ bucket, releasePrefix, app }) =>
  `oss://${bucket}/${releasePrefix}/${app}/LATEST.json`

export const ossBaseArgs = () => {
  const endpoint = requireEnv('OSS_ENDPOINT')
  const accessKeyId = requireEnv('OSS_ACCESS_KEY_ID')
  const accessKeySecret = requireEnv('OSS_ACCESS_KEY_SECRET')
  return ['-e', endpoint, '-i', accessKeyId, '-k', accessKeySecret]
}

export const ossutilBin = () => optionalEnv('OSSUTIL_BIN', './ossutil64')

export const ensurePathExists = async (targetPath, message) => {
  try {
    await fs.access(targetPath)
  } catch {
    throw new Error(message)
  }
}
