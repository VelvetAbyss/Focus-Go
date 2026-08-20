import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  ensurePathExists,
  exec,
  ossBaseArgs,
  ossutilBin,
  requireEnv,
  resolveLatestPointerPath,
  resolveOssPath,
  resolveReleaseIdentity,
  sha256String,
  toPosixRelative,
  walkFiles,
} from './_shared.mjs'

const main = async () => {
  const identity = await resolveReleaseIdentity()
  const bucket = requireEnv('OSS_BUCKET')
  const bin = ossutilBin()
  const baseArgs = ossBaseArgs()

  await ensurePathExists(identity.releaseDir, `Release bundle does not exist: ${identity.releaseDir}. Run build-release-bundle first.`)

  const manifestPath = path.join(identity.releaseDir, 'manifest.json')
  await ensurePathExists(manifestPath, `Missing manifest.json under ${identity.releaseDir}`)

  const releaseOssPath = resolveOssPath({
    bucket,
    releasePrefix: identity.releasePrefix,
    app: identity.app,
    releaseDate: identity.releaseDate,
    gitSha: identity.gitSha,
  })

  const manifestRemote = `${releaseOssPath}manifest.json`

  let exists = false
  try {
    await exec(bin, ['stat', manifestRemote, ...baseArgs])
    exists = true
  } catch {
    exists = false
  }

  if (exists) {
    throw new Error(`Release path already exists and is immutable: ${manifestRemote}`)
  }

  const releaseFiles = await walkFiles(identity.releaseDir)
  for (const absoluteFile of releaseFiles) {
    const rel = toPosixRelative(identity.releaseDir, absoluteFile)
    const remote = `${releaseOssPath}${rel}`
    await exec(bin, ['cp', absoluteFile, remote, '--force', '--update', ...baseArgs])
  }

  const latestPointerPath = resolveLatestPointerPath({
    bucket,
    releasePrefix: identity.releasePrefix,
    app: identity.app,
  })

  const latestPayload = {
    app: identity.app,
    releaseDate: identity.releaseDate,
    gitSha: identity.gitSha,
    releasePath: releaseOssPath,
    manifestPath: manifestRemote,
    updatedAt: new Date().toISOString(),
  }

  const latestTmp = path.join(identity.releaseDir, '.latest.json')
  const latestJson = `${JSON.stringify(latestPayload, null, 2)}\n`
  await fs.writeFile(latestTmp, latestJson, 'utf8')

  await exec(bin, ['cp', latestTmp, latestPointerPath, '--force', ...baseArgs])

  const checksumTmp = path.join(identity.releaseDir, '.latest.sha256')
  await fs.writeFile(checksumTmp, `${sha256String(latestJson)}\n`, 'utf8')
  await exec(bin, ['cp', checksumTmp, `${latestPointerPath}.sha256`, '--force', ...baseArgs])

  await fs.rm(latestTmp, { force: true })
  await fs.rm(checksumTmp, { force: true })

  console.log('OSS upload finished')
  console.log(`- releasePath: ${releaseOssPath}`)
  console.log(`- latestPointer: ${latestPointerPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
