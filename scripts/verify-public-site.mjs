import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const allowedArgs = new Set(['--website-url', '--app-url', '--expected-release'])
assert.equal(args.length % 2, 0, 'Supply URLs as --website-url URL --app-url URL')
for (let i = 0; i < args.length; i += 2) {
  assert(allowedArgs.has(args[i]), `Unknown option: ${args[i]}`)
}
const options = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]))

if (options['--expected-release']) {
  assert(/^[a-f0-9]{7,40}$/i.test(options['--expected-release']), 'Invalid expected release')
  assert(options['--website-url'] && options['--app-url'], 'Release verification requires both site URLs')
}

const sites = [
  { name: 'website', dir: 'apps/web/dist/website', canonical: 'https://nestflow.art/', base: options['--website-url'] },
  { name: 'app', dir: 'apps/web/dist', canonical: 'https://app.nestflow.art/', base: options['--app-url'] },
]

async function load(site, filename, contentType) {
  const local = await readFile(path.join(root, site.dir, filename), 'utf8')
  if (!site.base) return local
  const url = new URL(filename, `${site.base.replace(/\/$/, '')}/`)
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  assert.equal(response.status, 200, `${url}: expected HTTP 200`)
  assert(contentType.test(response.headers.get('content-type') ?? ''), `${url}: wrong Content-Type`)
  const remote = await response.text()
  // CDN-injected HTML may differ, but crawl files must be the exact release.
  if (filename !== 'index.html') assert.equal(remote.trim(), local.trim(), `${url}: stale or rewritten file`)
  return remote
}

for (const site of sites) {
  const robots = await load(site, 'robots.txt', /^text\/plain\b/i)
  assert(!/<(?:!doctype|html)\b/i.test(robots), `${site.name}: robots.txt is HTML`)
  assert(/^User-agent:\s*\*\s*$/m.test(robots), `${site.name}: missing default crawler group`)
  assert(/^Allow:\s*\/\s*$/m.test(robots), `${site.name}: public content must remain crawlable`)
  assert(robots.includes(`Sitemap: ${site.canonical}sitemap.xml`), `${site.name}: incorrect sitemap URL`)

  const sitemap = await load(site, 'sitemap.xml', /^(?:application|text)\/xml\b/i)
  assert(!/<(?:!doctype|html)\b/i.test(sitemap), `${site.name}: sitemap.xml is HTML`)
  assert(/<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap), `${site.name}: invalid sitemap namespace`)
  assert(/<\/urlset>\s*$/.test(sitemap), `${site.name}: incomplete sitemap`)
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
  // Only published content routes belong in discovery; personal entities are excluded.
  const routes = site.name === 'website'
    ? JSON.parse(await readFile(path.join(root, site.dir, 'public-pages.json'), 'utf8'))
    : ['/']
  assert.deepEqual(locations, routes.map(route => new URL(route, site.canonical).href), `${site.name}: unexpected sitemap URLs`)
  console.log(`PASS ${site.name}: robots.txt and sitemap.xml${site.base ? ' over HTTP' : ' in release'}`)
}

const website = sites[0]
const html = await load(website, 'index.html', /^text\/html\b/i)
const pricing = html.match(/<section\b[^>]*\bid="pricing"[^>]*>[\s\S]*?<\/section>/)?.[0]
assert(pricing, 'Missing public pricing section')
assert(pricing.includes('Every current feature is free.'), 'English free-feature policy missing')
const chinese = website.base
  ? await (async () => { const response = await fetch(new URL('zh/', `${website.base.replace(/\/$/, '')}/`)); assert.equal(response.status, 200, 'Chinese homepage missing'); return response.text() })()
  : await readFile(path.join(root, website.dir, 'zh/index.html'), 'utf8')
assert(chinese.includes('所有当前功能，全部免费。'), 'Chinese free-feature policy missing')
assert(!/\$(?:4\.99|39\.99|89)\b|\bPremium\b|\bLifetime\b|\/membership\b|data-price=/i.test(pricing), 'Retired paid plan or upgrade link in pricing')
assert(!/['"]price\.(?:premium|lifetime)\b/.test(html), 'Retired plan in translations')
assert(!/href=["'][^"']*\/membership\b/i.test(html), 'Retired upgrade link on website')
const assets = {
  'favicon.ico': /^image\/(?:x-icon|vnd\.microsoft\.icon)\b/i,
  'assets/logo.png': /^image\/png\b/i,
  'assets/product-dashboard.png': /^image\/png\b/i,
  'assets/hero-demo.mp4': /^video\/mp4\b/i,
}
for (const [asset, contentType] of Object.entries(assets)) {
  const local = await readFile(path.join(root, website.dir, asset))
  assert(local.length > 0, `Missing release asset: ${asset}`)
  if (website.base) {
    const url = new URL(asset, `${website.base.replace(/\/$/, '')}/`)
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200, `${url}: missing website asset`)
    assert(contentType.test(response.headers.get('content-type') ?? ''), `${url}: wrong asset Content-Type`)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), local, `${url}: stale or rewritten asset`)
  }
}
if (options['--expected-release']) {
  for (const site of sites) {
    const response = await fetch(new URL('release.json', `${site.base.replace(/\/$/, '')}/`), { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    assert.equal(response.status, 200, `${site.name}: missing release manifest`)
    assert.equal((await response.json()).version, options['--expected-release'], `${site.name}: wrong release`)
  }
  assert(html.includes(`name="focusgo-site-release" content="${options['--expected-release']}"`), 'Website HTML release does not match manifest')
  console.log(`PASS both public sites: expected release ${options['--expected-release']}`)
}
console.log(`PASS website: free-feature policy, translations, CTA destinations and bundled assets${website.base ? ' (HTTP HTML checked)' : ''}`)
