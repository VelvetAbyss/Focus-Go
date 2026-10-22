import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildContentPages } from './website-pages.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(root, 'apps/web/website')
const output = path.join(root, 'apps/web/dist/website')

// Keep the marketing site in the same release tarball as the app. Its vhost
// serves current/website, while app.nestflow.art continues to serve current.
// Copy only public assets, never design documents or hosting credentials.
await mkdir(output, { recursive: true })
for (const entry of ['index.html', 'robots.txt', 'sitemap.xml', 'assets']) {
  await cp(path.join(source, entry), path.join(output, entry), { recursive: true })
}
await cp(path.join(root, 'apps/web/public/favicon.ico'), path.join(output, 'favicon.ico'))

// Fail the build rather than packaging a marketing page from the wrong source.
const release = process.env.VITE_RELEASE_SHA || process.env.GITHUB_SHA || 'local'
if (!/^(?:[a-f0-9]{7,40}|local)$/i.test(release)) throw new Error('Invalid website release identifier')
const html = (await readFile(path.join(output, 'index.html'), 'utf8'))
  .replace('</head>', `<meta name="focusgo-site-release" content="${release}">\n</head>`)
await writeFile(path.join(output, 'index.html'), html)
await writeFile(path.join(output, 'release.json'), JSON.stringify({ version: release }))
await cp(path.join(root, 'apps/web/public/fonts/InstrumentSerif-regular.woff2'), path.join(output, 'assets/InstrumentSerif-regular.woff2'))
const routes = await buildContentPages(output, release)
await writeFile(path.join(output, 'public-pages.json'), JSON.stringify(['/', ...routes]))
await cp(path.join(source, '404.html'), path.join(output, '404.html'))
if (!html.includes('Every current feature is free.')) {
  throw new Error('Website build is missing the current free-feature policy')
}
console.log(`Website included in web release: ${output}`)
