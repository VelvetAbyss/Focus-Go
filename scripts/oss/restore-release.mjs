import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  exec,
  optionalEnv,
  ossBaseArgs,
  ossutilBin,
  requireEnv,
  resolveOssPath,
  resolveReleaseIdentity,
} from './_shared.mjs'

const sanitizeManifestPath = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid manifest entry: file path must be a non-empty string')
  }

  const normalized = path.posix.normalize(value.replaceAll('\\', '/'))
  if (normalized === '.' || normalized === '..') {
    throw new Error(`Invalid manifest entry path: ${value}`)
  }

  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Refusing to restore path outside target directory: ${value}`)
  }

  return normalized
}

const main = async () => {
  const identity = await resolveReleaseIdentity()
  const bucket = requireEnv('OSS_BUCKET')
  const bin = ossutilBin()
  const baseArgs = ossBaseArgs()

  const restoreTarget = path.resolve(optionalEnv('RESTORE_TARGET_DIR', '.artifacts/restore'))

  const releaseOssPath = resolveOssPath({
    bucket,
    releasePrefix: identity.releasePrefix,
    app: identity.app,
    releaseDate: identity.releaseDate,
    gitSha: identity.gitSha,
  })

  const targetDir = path.join(restoreTarget, identity.app, identity.releaseDate, identity.gitSha)
  await fs.rm(targetDir, { recursive: true, force: true })
  await fs.mkdir(targetDir, { recursive: true })

  const manifestPath = path.join(targetDir, 'manifest.json')
  await exec(bin, ['cp', `${releaseOssPath}manifest.json`, manifestPath, '--force', ...baseArgs])
  const manifestRaw = await fs.readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw)

  for (const file of manifest.files) {
    const safePath = sanitizeManifestPath(file.path)
    const localPath = path.resolve(targetDir, safePath)
    if (!localPath.startsWith(`${targetDir}${path.sep}`)) {
      throw new Error(`Refusing to restore path outside target directory: ${file.path}`)
    }

    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await exec(bin, ['cp', `${releaseOssPath}${safePath}`, localPath, '--force', ...baseArgs])
  }

  await fs.access(manifestPath)

  const distIndex = path.join(targetDir, 'apps', 'web', 'dist', 'index.html')
  await fs.access(distIndex)

  console.log('Release restored successfully')
  console.log(`- releasePath: ${releaseOssPath}`)
  console.log(`- localPath: ${targetDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
