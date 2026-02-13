import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  copyDir,
  ensurePathExists,
  resolveReleaseIdentity,
  sha256File,
  toPosixRelative,
  walkFiles,
} from './_shared.mjs'

const includesRaw = process.env.RELEASE_INCLUDE_PATHS ?? 'dist,public'
const includePaths = includesRaw
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean)

if (includePaths.length === 0) {
  throw new Error('RELEASE_INCLUDE_PATHS resolved to empty list')
}

const main = async () => {
  const identity = await resolveReleaseIdentity()

  await fs.rm(identity.releaseDir, { recursive: true, force: true })
  await fs.mkdir(identity.releaseDir, { recursive: true })

  for (const relPath of includePaths) {
    const src = path.resolve(relPath)
    await ensurePathExists(src, `Required release input path does not exist: ${relPath}`)
    const dest = path.join(identity.releaseDir, relPath)
    await copyDir(src, dest)
  }

  const absoluteFiles = await walkFiles(identity.releaseDir)
  const filteredFiles = absoluteFiles.filter((file) => !file.endsWith('/manifest.json') && !file.endsWith('manifest.json'))

  const manifestFiles = []
  for (const filePath of filteredFiles) {
    const stats = await fs.stat(filePath)
    const relativePath = toPosixRelative(identity.releaseDir, filePath)
    const sha256 = await sha256File(filePath)
    manifestFiles.push({
      path: relativePath,
      sizeBytes: stats.size,
      sha256,
    })
  }

  manifestFiles.sort((a, b) => a.path.localeCompare(b.path))

  const totalBytes = manifestFiles.reduce((sum, item) => sum + item.sizeBytes, 0)
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    app: identity.app,
    releaseDate: identity.releaseDate,
    gitSha: identity.gitSha,
    totalFiles: manifestFiles.length,
    totalBytes,
    includes: includePaths,
    files: manifestFiles,
  }

  const manifestPath = path.join(identity.releaseDir, 'manifest.json')
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log('Release bundle ready')
  console.log(`- releaseDir: ${identity.releaseDir}`)
  console.log(`- totalFiles: ${manifestFiles.length}`)
  console.log(`- totalBytes: ${totalBytes}`)
  console.log(`- manifest: ${manifestPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
