import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'apps/web/dist/website')
const routes = JSON.parse(await readFile(path.join(output, 'public-pages.json'), 'utf8'))
const baseIndex = process.argv.indexOf('--base-url')
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : null
if (baseIndex >= 0) assert(base, 'Missing --base-url value')
const titles = new Set()
const descriptions = new Set()
const strip = text => text.replace(/<[^>]*>/g, '').trim()
for (const route of routes) {
  let html = await readFile(path.join(output, route, 'index.html'), 'utf8')
  if (base) {
    const response = await fetch(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200, `${route}: HTTP status`)
    assert(/^text\/html\b/i.test(response.headers.get('content-type') ?? ''), `${route}: content type`)
    html = await response.text()
  }
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1]
  assert(title && /Focus(?:&amp;|&)go/.test(title), `${route}: product identity missing`)
  assert(!titles.has(title), `${route}: duplicate title`)
  assert(description && description.length >= 40, `${route}: missing useful description`)
  assert(!descriptions.has(description), `${route}: duplicate description`)
  titles.add(title); descriptions.add(description)
  assert(html.includes(`rel="canonical" href="https://nestflow.art${route}"`), `${route}: canonical mismatch`)
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)]
  assert.equal(h1s.length, 1, `${route}: expected one H1`)
  assert(strip(h1s[0][1]).length >= 8, `${route}: empty H1`)
  assert(!/<meta name="robots" content="noindex"/.test(html), `${route}: public content marked noindex`)
  if (route !== '/') {
    assert(html.includes('hreflang="en"') && html.includes('hreflang="zh-CN"'), `${route}: missing language links`)
    const en = route.replace(/^\/zh\//, '/')
    assert(html.includes(`hreflang="en" href="https://nestflow.art${en}"`), `${route}: wrong English alternate`)
    assert(html.includes(`hreflang="zh-CN" href="https://nestflow.art/zh${en}"`), `${route}: wrong Chinese alternate`)
    const article = html.match(/<article>([\s\S]*?)<\/article>/)?.[1]
    assert(article && strip(article).length >= 300, `${route}: thin article`)
    assert(!/<script\b/i.test(html), `${route}: answer text must not depend on JavaScript`)
  }
  for (const [, target] of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) {
    assert(routes.includes(target), `${route}: unlisted internal destination ${target}`)
  }
  console.log(`PASS discovery: ${route}`)
}
const home = await readFile(path.join(output, 'index.html'), 'utf8')
for (const value of ['20', '75', '301']) {
  assert(home.includes(`class="n">${value}</span>`), `Static research figure missing: ${value}`)
}
assert(!home.includes('n.textContent=Math.round'), 'Research figures must not change during reveal')
assert(home.includes('https://github.com/VelvetAbyss/Focus-Go'), 'Missing repository link')
const notFound = await readFile(path.join(output, '404.html'), 'utf8')
assert(notFound.includes('name="robots" content="noindex"'), '404 document must not be indexed')
if (base) {
  const response = await fetch(new URL('/seo-check-nonexistent-20261022', base), { redirect: 'manual' })
  assert.equal(response.status, 404, 'Unknown URL must return HTTP 404')
  assert((await response.text()).includes('404'), 'Missing useful 404 body')
}
console.log(`PASS ${routes.length} public routes, static figures, language pairs and 404 contract`)
