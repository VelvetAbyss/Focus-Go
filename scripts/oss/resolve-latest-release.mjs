import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  exec,
  optionalEnv,
  ossBaseArgs,
  ossutilBin,
  requireEnv,
  resolveLatestPointerPath,
} from './_shared.mjs'

const main = async () => {
  const app = optionalEnv('APP_NAME', 'focus-go')
  const releasePrefix = optionalEnv('OSS_PREFIX', 'releases')
  const bucket = requireEnv('OSS_BUCKET')
  const bin = ossutilBin()
  const baseArgs = ossBaseArgs()

  const latestPointer = resolveLatestPointerPath({ bucket, releasePrefix, app })
  const tmpDir = path.join(process.cwd(), '.artifacts', 'latest')
  await fs.mkdir(tmpDir, { recursive: true })
  const localPointer = path.join(tmpDir, `${app}.LATEST.json`)

  await exec(bin, ['cp', latestPointer, localPointer, '--force', ...baseArgs])

  const raw = await fs.readFile(localPointer, 'utf8')
  const parsed = JSON.parse(raw)

  if (!parsed.releaseDate || !parsed.gitSha) {
    throw new Error('LATEST.json does not contain releaseDate/gitSha')
  }

  console.log(`RELEASE_DATE=${parsed.releaseDate}`)
  console.log(`GIT_SHA=${parsed.gitSha}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
