import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  ossCommand,
  validateReleaseIdentity,
  optionalEnv,
  requireEnv,
  resolveLatestPointerPath,
} from './_shared.mjs'

const main = async () => {
  const app = optionalEnv('APP_NAME', 'focus-go')
  const releasePrefix = optionalEnv('OSS_PREFIX', 'releases')
  const bucket = requireEnv('OSS_BUCKET')

  const latestPointer = resolveLatestPointerPath({ bucket, releasePrefix, app })
  const tmpDir = path.join(process.cwd(), '.artifacts', 'latest')
  await fs.mkdir(tmpDir, { recursive: true })
  const localPointer = path.join(tmpDir, `${app}.LATEST.json`)

  await ossCommand(['cp', latestPointer, localPointer, '--force'])

  const raw = await fs.readFile(localPointer, 'utf8')
  const parsed = JSON.parse(raw)

  validateReleaseIdentity({ app, releaseDate: parsed.releaseDate, gitSha: parsed.gitSha })

  console.log(`RELEASE_DATE=${parsed.releaseDate}`)
  console.log(`GIT_SHA=${parsed.gitSha}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
