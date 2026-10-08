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
      reject(new Error(`${bin} failed with exit code ${code}`))
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
  validateReleaseIdentity({ app, releaseDate, gitSha })
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

export const validateReleaseIdentity = ({ app, releaseDate, gitSha }) => {
  if (typeof app !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(app)
      || typeof releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)
      || !Number.isFinite(Date.parse(`${releaseDate}T00:00:00Z`))
      || new Date(`${releaseDate}T00:00:00Z`).toISOString().slice(0, 10) !== releaseDate
      || typeof gitSha !== 'string' || !/^[a-f0-9]{7,40}$/i.test(gitSha)) {
    throw new Error('Invalid release identity')
  }
}

export const resolveRestoreDirectory = (root, identity) => {
  validateReleaseIdentity(identity)
  const target = path.resolve(root, identity.app, identity.releaseDate, identity.gitSha)
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Restore path escapes root')
  return target
}

export const assertNoRestoreSymlinks = async (root, target) => {
  if (!path.resolve(target).startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Restore path escapes root')
  for (let current = target; current !== path.resolve(root); current = path.dirname(current)) {
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Restore path contains a symlink')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

export const buildOssCommand = (args) => {
  const remote = (value) => value.startsWith('oss://') ? `focusgo_oss:${value.slice(6)}` : value
  if (args[0] === 'cp' && args.length >= 3) return ['copyto', remote(args[1]), remote(args[2]), ...(args.includes('--update') ? ['--update'] : [])]
  if (args[0] === 'stat' && args.length === 2) return ['lsjson', remote(args[1]), '--stat']
  throw new Error('Unsupported OSS operation')
}

// rclone is installed through the OS package manager. Credentials are confined
// to this subprocess environment, never embedded in argv or error messages.
export const ossCommand = (args) => exec(optionalEnv('RCLONE_BIN', 'rclone'), buildOssCommand(args), {
  env: {
    ...process.env,
    RCLONE_CONFIG_FOCUSGO_OSS_TYPE: 's3',
    RCLONE_CONFIG_FOCUSGO_OSS_PROVIDER: 'Alibaba',
    RCLONE_CONFIG_FOCUSGO_OSS_ENDPOINT: requireEnv('OSS_ENDPOINT'),
    RCLONE_CONFIG_FOCUSGO_OSS_ACCESS_KEY_ID: requireEnv('OSS_ACCESS_KEY_ID'),
    RCLONE_CONFIG_FOCUSGO_OSS_SECRET_ACCESS_KEY: requireEnv('OSS_ACCESS_KEY_SECRET'),
  },
})

export const ensurePathExists = async (targetPath, message) => {
  try {
    await fs.access(targetPath)
  } catch {
    throw new Error(message)
  }
}
