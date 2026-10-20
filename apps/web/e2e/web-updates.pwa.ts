import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

let oldRelease = 'aaaaaaa'
const newRelease = 'bbbbbbb'
let servedVersion = oldRelease
let server: Server
let origin: string

test.beforeAll(async () => {
  const root = resolve('dist')
  oldRelease = (await readFile(resolve(root, 'index.html'), 'utf8'))
    .match(/name="focusgo-release" content="([a-f0-9]+)"/)?.[1] ?? ''
  if (!oldRelease || oldRelease === newRelease) throw new Error('Build a distinct production release before running this test')
  servedVersion = oldRelease
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, 'http://localhost')
      response.setHeader('Cache-Control', 'no-store')
      if (url.pathname === '/release.json') {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ version: servedVersion }))
        return
      }
      const path = url.pathname === '/' ? '/index.html' : url.pathname
      if (path.includes('..') || path.startsWith('/api/')) { response.writeHead(404).end(); return }
      let body = await readFile(resolve(root, `.${path}`))
      if (path === '/index.html') {
        body = Buffer.from(body.toString().replace(`content="${oldRelease}"`, `content="${servedVersion}"`))
      }
      if (path === '/sw.js') {
        const html = (await readFile(resolve(root, 'index.html'), 'utf8'))
          .replace(`content="${oldRelease}"`, `content="${servedVersion}"`)
        const revision = createHash('md5').update(html).digest('hex')
        // Simulate a real deployment: change the precached HTML revision along with its marker.
        const sw = body.toString().replace(
          /url:"index.html",revision:"[^"]+"/g,
          `url:"index.html",revision:"${revision}"`,
        )
        body = Buffer.from(`${sw}\n// release ${servedVersion}\n`)
      }
      const mime = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css'
        : path.endsWith('.js') ? 'application/javascript' : 'application/octet-stream'
      response.setHeader('Content-Type', mime)
      response.end(body)
    } catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture server port')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })

test('an open old release updates after editing ends and keeps cookies, drafts and IndexedDB', async ({ page, context }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }))
  await context.addCookies([{ name: 'update-regression-cookie', value: 'keep', url: origin, httpOnly: true }])
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="focusgo-release"]')).toHaveAttribute('content', oldRelease)
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain(`v=${oldRelease}`)
  await expect(page.locator('#root')).not.toBeEmpty()
  await expect(page.locator('#root [aria-busy="true"]')).toHaveCount(0)
  await page.evaluate(async () => {
    localStorage.setItem('update-regression-draft', '未同步草稿')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('update-regression-data', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('drafts')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite')
      transaction.objectStore('drafts').put('offline edit', 'draft')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
    const input = document.createElement('textarea')
    input.id = 'update-regression-editor'
    document.body.appendChild(input)
    input.focus()
  })
  await page.clock.install()
  servedVersion = newRelease
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain(`v=${newRelease}`)
  await page.clock.fastForward(31_000)
  await expect(page.locator('meta[name="focusgo-release"]')).toHaveAttribute('content', oldRelease)
  await page.evaluate(() => document.querySelector('#update-regression-editor')?.remove())
  await expect.poll(async () => {
    // Let asynchronous app initialization and save promises settle between idle checks.
    await page.clock.fastForward(1000)
    return page.locator('meta[name="focusgo-release"]').getAttribute('content')
  }).toBe(newRelease)
  expect(await context.cookies()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'update-regression-cookie', value: 'keep' })]))
  expect(await page.evaluate(() => localStorage.getItem('update-regression-draft'))).toBe('未同步草稿')
  const draft = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('update-regression-data')
    open.onsuccess = () => {
      const db = open.result
      const read = db.transaction('drafts', 'readonly').objectStore('drafts').get('draft')
      read.onsuccess = () => { resolve(read.result); db.close() }
      read.onerror = () => reject(read.error)
    }
    open.onerror = () => reject(open.error)
  }))
  expect(draft).toBe('offline edit')
})
