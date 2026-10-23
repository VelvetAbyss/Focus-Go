import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'apps/web/dist/website')
async function check(t, transform) {
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname
    let status = 200, html
    try { html = await readFile(path.join(output, route, 'index.html'), 'utf8') } catch { status = 404; html = await readFile(path.join(output, '404.html'), 'utf8') }
    const next = transform({ route, status, html })
    res.writeHead(next.status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(next.html)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/`
  return exec(process.execPath, ['--experimental-strip-types', 'scripts/verify-discovery.mjs', '--base-url', base], { cwd: root, timeout: 20000 })
}
test('accepts JSON-LD and CDN scripts outside unchanged static articles', async t => {
  const result = await check(t, response => ({ ...response, html: response.html.replace('</body>', '<script src="/cdn-cgi/email-decode.js"></script></body>') }))
  const publishedRoutes = JSON.parse(await readFile(path.join(output, 'public-pages.json'), 'utf8'))
  assert(result.stdout.includes(`PASS ${publishedRoutes.length} public routes`))
})
test('rejects policy text that differs from the verified build', async t => {
  await assert.rejects(check(t, response => ({ ...response, html: response.route === '/privacy/' ? response.html.replace('</article>', '<p>Unexpected policy change</p></article>') : response.html })), error => /static body differs/.test(error.stderr))
})
test('rejects a missing-page response that returns HTTP 200', async t => {
  await assert.rejects(check(t, response => ({ ...response, status: response.status === 404 ? 200 : response.status })), error => /Unknown URL must return HTTP 404/.test(error.stderr))
})
test('rejects a Chinese page canonicalized to English', async t => {
  await assert.rejects(check(t, response => ({ ...response, html: response.route === '/zh/' ? response.html.replace('rel="canonical" href="https://nestflow.art/zh/"', 'rel="canonical" href="https://nestflow.art/"') : response.html })), error => /canonical mismatch/.test(error.stderr))
})

test('rejects an identity page whose main entity is an unrelated product', async t => {
  await assert.rejects(check(t, response => ({ ...response, html: response.route === '/about/' ? response.html.replace('"mainEntity":{"@id":"https://nestflow.art/#application"}', '"mainEntity":{"@id":"https://example.invalid/other"}') : response.html })), error => /main identity/.test(error.stderr))
})
