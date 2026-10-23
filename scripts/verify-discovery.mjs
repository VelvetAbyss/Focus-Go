import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGAL_DOCUMENTS } from '../apps/web/src/shared/legal/policies.ts'
import { POLICY_VERSION, POLICY_OPERATOR } from '../apps/web/focus-go-api/legal/policyManifest.js'
import { escape } from './website-schema.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'apps/web/dist/website')
const routes = JSON.parse(await readFile(path.join(output, 'public-pages.json'), 'utf8'))
const baseIndex = process.argv.indexOf('--base-url')
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : null
if (baseIndex >= 0) assert(base, 'Missing --base-url value')
const titles = new Set(), descriptions = new Set()
const article = html => html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1]
const strip = text => text.replace(/<[^>]*>/g, '').trim()
const homes = new Map()
for (const route of routes) {
  const local = await readFile(path.join(output, route, 'index.html'), 'utf8')
  let html = local
  if (base) {
    const response = await fetch(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200, `${route}: HTTP status`)
    assert(/^text\/html\b/i.test(response.headers.get('content-type') ?? ''), `${route}: content type`)
    html = await response.text()
  }
  const zh = route.startsWith('/zh/'), lang = zh ? 'zh' : 'en'
  const home = route === '/' || route === '/zh/'
  const policy = /\/(privacy|terms)\/$/.exec(route)?.[1]
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1]
  assert(title && /Focus(?:&amp;|&)go/.test(title), `${route}: product identity missing`)
  assert(!titles.has(title), `${route}: duplicate title`)
  assert(description && description.length >= 40, `${route}: missing useful description`)
  assert(!descriptions.has(description), `${route}: duplicate description`)
  titles.add(title); descriptions.add(description)
  assert(html.includes(`rel="canonical" href="https://nestflow.art${route}"`), `${route}: canonical mismatch`)
  assert(html.includes(`<html lang="${zh ? 'zh-CN' : 'en'}"`), `${route}: wrong document language`)
  const en = route === '/zh/' ? '/' : route.replace(/^\/zh\//, '/')
  for (const [code, alternate] of [['en', en], ['zh-CN', en === '/' ? '/zh/' : `/zh${en}`], ['x-default', en]]) {
    assert(html.includes(`hreflang="${code}" href="https://nestflow.art${alternate}"`), `${route}: wrong ${code} alternate`)
  }
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)]
  assert.equal(h1s.length, 1, `${route}: expected one H1`)
  assert(strip(h1s[0][1]).length >= (policy ? 4 : 8), `${route}: empty H1`)
  assert(!/<meta name="robots" content="[^"]*noindex/.test(html), `${route}: public content marked noindex`)
  if (home) {
    homes.set(lang, html)
    assert(html.includes('id="maintainer"'), `${route}: maintainer reference needs a visible target`)
    assert(html.includes(`id="langToggle" href="${zh ? '/' : '/zh/'}"`), `${route}: language switch must be a crawlable link`)
    assert(!html.includes("localStorage.getItem('nestflow.lang')"), `${route}: language must follow URL`)
    assert(!/\b(?:src|href|poster)="assets\//.test(html), `${route}: nested home needs absolute asset URLs`)
  } else {
    assert(article(html) && strip(article(html)).length >= 300, `${route}: thin article`)
    assert.equal(article(html), article(local), `${route}: static body differs from verified build`)
    assert(!/<script\b/i.test(article(html)), `${route}: answer body must not depend on JavaScript`)
    const executable = [...local.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/type="application\/ld\+json"/.test(attrs))
    assert.equal(executable.length, 1, `${route}: only the disclosed counter module may execute`)
    assert(/type="module"/.test(executable[0][1]) && /src="\/assets\/anonymous-counts\.js\?v=(?:[a-f0-9]{7,40}|local)"/.test(executable[0][1]), `${route}: unexpected executable script`)
    // A CDN can inject email decoding or security scripts outside the article.
    // Compare the raw answer with the build rather than rejecting all scripts.
    assert(html.includes('class="breadcrumbs"'), `${route}: missing visible breadcrumbs`)
  }
  for (const [, target] of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"/g)) assert(routes.includes(target), `${route}: unlisted internal destination ${target}`)
  const json = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  assert.equal(json.length, 1, `${route}: missing or duplicate JSON-LD graph`)
  const data = JSON.parse(json[0][1]); assert.equal(data['@context'], 'https://schema.org')
  assert(Array.isArray(data['@graph']), `${route}: graph missing`)
  const graph = data['@graph'], typed = type => graph.find(node => [node['@type']].flat().includes(type))
  assert.equal(new Set(graph.map(node => node['@id'])).size, graph.length, `${route}: duplicate entity IDs`)
  assert.equal(typed('Person')?.name, POLICY_OPERATOR, `${route}: incorrect operator`)
  assert.equal(typed('WebSite')?.name, 'Focus&go')
  assert.equal(typed('WebPage')?.url, `https://nestflow.art${route}`)
  assert.equal(typed('WebPage')?.inLanguage, zh ? 'zh-CN' : 'en')
  assert(!typed('Organization'), `${route}: must not invent a company`)
  assert(!graph.some(node => node.aggregateRating || node.review), `${route}: no unverified reviews or rating counts`)
  if (!policy) {
    const app = typed('SoftwareApplication')
    assert.equal(app?.name, 'Focus&go'); assert.equal(app?.isAccessibleForFree, true)
    assert.equal(app?.offers?.price, 0); assert.equal(app?.offers?.priceCurrency, 'USD')
    assert.equal(app?.publisher?.['@id'], typed('Person')['@id'])
  }
  if (!home) {
    const trail = typed('BreadcrumbList')?.itemListElement
    assert.equal(trail?.length, 2); assert.equal(trail[0].position, 1); assert.equal(trail[1].position, 2)
    assert.equal(trail[0].item, `https://nestflow.art${zh ? '/zh/' : '/'}`)
    assert.equal(trail[1].item, `https://nestflow.art${route}`)
  }
  if (/\/about\/$/.test(route)) {
    assert(typed('AboutPage'), `${route}: official identity page type missing`)
    assert.equal(typed('AboutPage').mainEntity?.['@id'], typed('SoftwareApplication')['@id'], `${route}: main identity must reference the official app`)
    assert(typed('SoftwareApplication').sameAs.includes('https://github.com/VelvetAbyss/Focus-Go'))
    for (const link of ['https://nestflow.art/', 'https://app.nestflow.art/', 'https://github.com/VelvetAbyss/Focus-Go']) assert(html.includes(`href="${link}"`), `${route}: visible official link missing`)
  }
  if (policy) {
    const key = policy === 'privacy' ? 'privacy-policy' : 'terms-of-service', document = LEGAL_DOCUMENTS[lang][key]
    assert(html.includes(`data-policy-version="${POLICY_VERSION}"`), `${route}: policy version changed`)
    assert(local.includes('<!--email_off--><article') && local.includes('</article><!--/email_off-->'), `${route}: public policy text must survive email obfuscation`)
    for (const section of document.sections) {
      assert(html.includes(`<h2>${escape(section.heading)}</h2>`), `${route}: policy heading changed`)
      for (const paragraph of section.paragraphs) assert(html.includes(`<p>${escape(paragraph)}</p>`), `${route}: policy text drifted`)
    }
  }
  console.log(`PASS discovery: ${route}`)
}
assert(homes.get('zh')?.includes('任务、专注与笔记。'), 'Chinese home must be translated without JavaScript')
for (const value of ['20', '75', '301']) for (const html of homes.values()) assert(html.includes(`class="n">${value}</span>`), `Static research figure missing: ${value}`)
const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8')
assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), routes.map(route => `https://nestflow.art${route}`))
const notFound = await readFile(path.join(output, '404.html'), 'utf8')
assert(notFound.includes('name="robots" content="noindex"'), '404 document must not be indexed')
if (base) {
  const response = await fetch(new URL('/seo-check-nonexistent-20261022', base), { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  assert.equal(response.status, 404, 'Unknown URL must return HTTP 404')
  const html = await response.text()
  assert(html.includes('404') && html.includes('name="robots" content="noindex"'), 'Missing useful noindex 404 body')
}
console.log(`PASS ${routes.length} public routes, static language pairs, policy parity, JSON-LD and 404 contract`)
