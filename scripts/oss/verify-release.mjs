import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  exec,
  ossBaseArgs,
  ossutilBin,
  requireEnv,
  resolveOssPath,
  resolveReleaseIdentity,
  sha256File,
} from './_shared.mjs'

const main = async () => {
  const identity = await resolveReleaseIdentity()
  const bucket = requireEnv('OSS_BUCKET')
  const bin = ossutilBin()
  const baseArgs = ossBaseArgs()

  const releaseOssPath = resolveOssPath({
    bucket,
    releasePrefix: identity.releasePrefix,
    app: identity.app,
    releaseDate: identity.releaseDate,
    gitSha: identity.gitSha,
  })

  const localManifestPath = path.join(identity.releaseDir, 'manifest.json')
  const localManifestRaw = await fs.readFile(localManifestPath, 'utf8')
  const localManifest = JSON.parse(localManifestRaw)

  const tmpRoot = path.join(process.cwd(), '.artifacts', 'verify', identity.app, identity.releaseDate, identity.gitSha)
  const remoteRoot = path.join(tmpRoot, 'remote')

  await fs.rm(tmpRoot, { recursive: true, force: true })
  await fs.mkdir(remoteRoot, { recursive: true })

  const remoteManifestPath = path.join(remoteRoot, 'manifest.json')
  await exec(bin, ['cp', `${releaseOssPath}manifest.json`, remoteManifestPath, '--force', ...baseArgs])
  const remoteManifestRaw = await fs.readFile(remoteManifestPath, 'utf8')

  if (localManifestRaw !== remoteManifestRaw) {
    throw new Error('Manifest mismatch between local and uploaded copy')
  }

  const failures = []
  for (const file of localManifest.files) {
    const remoteFile = path.join(remoteRoot, file.path)
    await fs.mkdir(path.dirname(remoteFile), { recursive: true })
    await exec(bin, ['cp', `${releaseOssPath}${file.path}`, remoteFile, '--force', ...baseArgs])
    let stat
    try {
      stat = await fs.stat(remoteFile)
    } catch {
      failures.push(`Missing remote file: ${file.path}`)
      continue
    }

    if (stat.size !== file.sizeBytes) {
      failures.push(`Size mismatch: ${file.path} (expected ${file.sizeBytes}, got ${stat.size})`)
      continue
    }

    const hash = await sha256File(remoteFile)
    if (hash !== file.sha256) {
      failures.push(`SHA256 mismatch: ${file.path}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Release verification failed:\n- ${failures.join('\n- ')}`)
  }

  console.log('Release verification passed')
  console.log(`- checkedFiles: ${localManifest.files.length}`)
  console.log(`- releasePath: ${releaseOssPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
