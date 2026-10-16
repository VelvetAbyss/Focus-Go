import { expect, test, type Page } from '@playwright/test'

const storage = 'focusgo.dashboard.desk'
const pose = { a1: -0.18, a2: 1.59, a3: -1.51 }
const seed = async (page: Page, items: object[]) => {
  await page.route('**/api/auth/get-session', r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))
  await page.addInitScript(({ storage, items, pose }) => {
    if (!sessionStorage.getItem('desk-seeded')) {
      localStorage.setItem(storage, JSON.stringify({ lampOn: false, lampX: 1.95, pose, items, note: false }))
      sessionStorage.setItem('desk-seeded', '1')
    }
  }, { storage, items, pose })
  await page.goto('/')
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status', 'ready')
}
const settings = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storage)
const point = (page: Page, x: number, y: number) => page.locator('.dash-desk').evaluate((el, {x,y}) => {
  const desk = el as HTMLElement, r = desk.getBoundingClientRect(), h = desk.closest('header')!
  const zoom = r.width / desk.offsetWidth, unit = Math.round(Math.min(60, desk.offsetHeight / 2.45) * 100) / 100
  return { x: h.getBoundingClientRect().left + Math.round(h.offsetWidth / 2) * zoom + x * unit * zoom,
    y: r.bottom - (3.5 + y * unit) * zoom }
}, {x,y})

test('window opens, moves in two axes, resizes and restores its crop after reload', async ({ page }) => {
  await seed(page, [{ id:'window-a',kind:'window',x:-2.2,picture:{width:3,height:1.5,y:0.5,source:'mediterranean'} }])
  const p = await point(page,-2.2,1.25)
  await page.mouse.click(p.x,p.y)
  const selection = page.locator('.desk-picture-selection[data-kind="window"]')
  await expect(selection).toBeVisible()
  await expect.poll(async()=>(await settings(page)).items[0].picture.open).toBe(true)
  await page.waitForTimeout(500)
  await page.screenshot({path:'.artifacts/desk-window-open.png'})
  await selection.getByRole('button',{name:'Close window',exact:true}).click()
  await expect.poll(async()=>(await settings(page)).items[0].picture.open).toBe(false)
  await page.mouse.move(p.x,p.y)
  await page.mouse.down()
  await page.mouse.move(p.x-35,p.y+8,{steps:12})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).items[0].x).toBeLessThan(-2.6)
  expect((await settings(page)).items[0].picture.y).toBeLessThan(0.5)
  const resize = selection.locator('.desk-picture-selection__resize')
  const r = await resize.boundingBox()
  await page.mouse.move(r!.x+10,r!.y+10)
  await page.mouse.down()
  await page.mouse.move(r!.x+35,r!.y,{steps:10})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).items[0].picture.width).toBeGreaterThan(3.3)
  await selection.locator('button').nth(2).click()
  await page.locator('.desk-picture-editor__gallery button').nth(3).click()
  await expect.poll(async()=>(await settings(page)).items[0].picture.source).toBe('neon')
  await page.keyboard.press('Escape')
  const saved = (await settings(page)).items[0]
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).items[0]).toEqual(saved)
})

test('frame imports a local image, persists it offline, and duplicates independently', async ({ page }) => {
  await seed(page,[{id:'frame-a',kind:'frame',x:-2,picture:{width:1.6,height:1.5,source:'monet'}}])
  const p=await point(page,-2,1.2)
  await page.mouse.click(p.x,p.y)
  const selection=page.locator('.desk-picture-selection[data-kind="frame"]')
  await selection.locator('button').nth(1).click()
  await page.getByRole('tab').filter({hasText:'My images'}).click()
  await page.locator('.desk-picture-editor input[type="file"]').setInputFiles('public/desk-pictures/bedroom.jpg')
  await expect.poll(async()=>(await settings(page)).items[0].picture.source).toMatch(/^local:/)
  await expect(page.locator('.desk-picture-selection__status')).toHaveCount(0)
  const source=(await settings(page)).items[0].picture.source
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('focusgo.desk.media');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    const data = await new Promise<{blob:Blob;width:number;height:number}[]>((resolve)=>{const r=db.transaction('images').objectStore('images').getAll();r.onsuccess=()=>resolve(r.result)})
    db.close(); return data.map(i=>({size:i.blob.size,width:i.width,height:i.height}))
  })
  expect(saved[0].size).toBeGreaterThan(1000)
  expect(Math.max(saved[0].width,saved[0].height)).toBeLessThanOrEqual(2560)
  await page.keyboard.press('Escape')
  await selection.getByRole('button',{name:'Duplicate',exact:true}).click()
  await expect.poll(async()=>(await settings(page)).items.length).toBe(2)
  expect((await settings(page)).items.every((i:{picture:{source:string}})=>i.picture.source===source)).toBe(true)
  await selection.getByRole('button',{name:'Remove',exact:true}).click()
  await expect.poll(async()=>(await settings(page)).items.length).toBe(1)
  await page.route('https://**/*',r=>r.abort())
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  await page.mouse.click(p.x,p.y)
  await expect(page.locator('.desk-picture-selection__status')).toHaveCount(0)
  expect((await settings(page)).items[0].picture.source).toBe(source)
  await page.screenshot({path:'.artifacts/desk-custom-art.png'})
})

test('pictures render every preset in reduced motion and fit a narrower header', async ({ page }) => {
  const errors:string[]=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL|GL_INVALID/.test(m.text())) errors.push(m.text())})
  await page.emulateMedia({reducedMotion:'reduce'})
  await seed(page,[{id:'window-a',kind:'window',x:-2.5,picture:{width:3.4,height:1.7,y:.4,source:'mediterranean'}},{id:'frame-a',kind:'frame',x:.3,picture:{width:1.3,height:1.4,source:'monet'}}])
  for(const [x,y,kind,count] of [[-2.5,1.2,'window',4],[.3,1.2,'frame',3]] as const){
    const p=await point(page,x,y)
    await page.mouse.click(p.x,p.y)
    const selection=page.locator(`.desk-picture-selection[data-kind="${kind}"]`)
    await selection.locator('button').nth(kind==='window'?2:1).click()
    for(let i=0;i<count;i++) {
      await page.locator('.desk-picture-editor__gallery button').nth(i).click()
      await expect(page.locator('.desk-picture-selection__status')).toHaveCount(0)
    }
    await page.keyboard.press('Escape')
  }
  await page.setViewportSize({width:1280,height:900})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  await page.screenshot({path:'.artifacts/desk-pictures-narrow.png'})
  expect(errors).toEqual([])
})

test('wall frame moves horizontally and vertically, and restores its hanging height', async ({page})=>{
  await seed(page,[{id:'wall-art',kind:'frame',x:-2,picture:{width:1.5,height:1.2,y:.5,source:'wave'}}])
  const p=await point(page,-2,1)
  await page.mouse.move(p.x,p.y)
  await page.mouse.down()
  await page.mouse.move(p.x-30,p.y-12,{steps:12})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).items[0].picture.y).toBeGreaterThan(.65)
  expect((await settings(page)).items[0].x).toBeLessThan(-2.4)
  const saved=(await settings(page)).items[0]
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).items[0]).toEqual(saved)
  await page.screenshot({path:'.artifacts/desk-wall-frame.png'})
})

test('all production models render, animate, and switch ink theme without shader errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGL|GL_INVALID/.test(m.text())) errors.push(m.text()) })
  await page.goto('/e2e/fixtures/desk-models.html')
  await page.waitForFunction(() => 'deskAudit' in window)
  await expect(page.locator('#labels span')).toHaveCount(10)
  await page.locator('#act').click()
  await page.waitForTimeout(900)
  await page.locator('#angle').click()
  await page.locator('#theme').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '.artifacts/desk-models-dark.png' })
  await page.locator('#theme').click()
  await page.locator('#angle').click()
  await page.screenshot({ path: '.artifacts/desk-models-side.png' })
  expect(errors).toEqual([])
})

test('standalone picture preview uses the production controls and keeps dashboard settings separate', async ({page}) => {
  await page.goto('/e2e/fixtures/desk-pictures.html',{waitUntil:'domcontentloaded'})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  const p=await page.locator('.dash-desk').evaluate(el=>{
    const r=el.getBoundingClientRect(),unit=Math.min(85,r.width/12)
    return {x:r.left+r.width/2-2.3*unit,y:r.bottom-3.5-1.5*unit}
  })
  await page.mouse.click(p.x,p.y)
  await expect(page.getByRole('button',{name:'Close window',exact:true})).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({path:'.artifacts/desk-pictures-preview.png',fullPage:true})
  expect(await page.evaluate(()=>localStorage.getItem('focusgo.dashboard.desk'))).toBeNull()
  await page.getByRole('button',{name:'夜间',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await expect.poll(async()=>page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(36, 35, 32)')
  await page.screenshot({path:'.artifacts/desk-pictures-preview-dark.png',fullPage:true})
  await page.setViewportSize({width:480,height:800})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  await page.getByRole('button',{name:'Image & settings',exact:true}).click()
  await expect(page.locator('.desk-picture-editor__gallery button')).toHaveCount(4)
  await expect.poll(async()=>(await page.locator('.desk-picture-editor__panel').boundingBox())!.y).toBeGreaterThanOrEqual(0)
  await page.screenshot({path:'.artifacts/desk-pictures-preview-mobile.png',fullPage:true})
})

test('free drag saves the imported candle; pointer cancellation restores it', async ({ page }) => {
  await seed(page, [{ id:'candle-a',kind:'candle',x:-3 }])
  const from = await point(page,-3,0.38)
  await page.mouse.move(from.x,from.y)
  await page.mouse.down()
  await page.mouse.move(from.x+65,from.y,{steps:15})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).items[0].x).toBeGreaterThan(-2)
  const moved = (await settings(page)).items[0].x
  await page.reload()
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).items[0].x).toBe(moved)
  const next = await point(page,moved,0.38)
  await page.mouse.move(next.x,next.y)
  await page.mouse.down()
  await page.mouse.move(next.x-55,next.y,{steps:10})
  await page.locator('canvas.dash-desk__canvas').dispatchEvent('pointercancel',{pointerId:1})
  await page.mouse.up()
  expect((await settings(page)).items[0].x).toBe(moved)
})

test('picker accepts repeated instances of every kind and credits remain accessible', async ({ page }) => {
  await seed(page, [])
  await page.locator('.dash-desk').hover()
  await page.locator('.dash-desk__control').nth(1).click()
  const add = page.locator('[aria-labelledby="desk-picker-add"] button')
  for(let i=0;i<9;i++) await add.nth(i).click()
  await add.nth(8).click()
  await expect.poll(async()=>(await settings(page)).items.length).toBe(10)
  expect((await settings(page)).items.filter((i:{kind:string})=>i.kind==='candle')).toHaveLength(2)
  expect(new Set((await settings(page)).items.map((i:{id:string})=>i.id)).size).toBe(10)
  await expect(page.locator('a[href="/licenses/desk-models.txt"]')).toBeVisible()
  const credit = await page.request.get('/licenses/desk-models.txt')
  expect(await credit.text()).toContain('Pat Siefring')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1200)
  await page.screenshot({path:'.artifacts/desk-dashboard-all.png'})
  await page.setViewportSize({width:1280,height:900})
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  await page.screenshot({path:'.artifacts/desk-dashboard-narrow.png'})
})

test('reduced-motion timer expires independently of animation or pointer activity', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await seed(page,[{id:'timer-a',kind:'timer',x:-2,endsAt:Date.now()+8000},{id:'timer-b',kind:'timer',x:-3.4,endsAt:Date.now()+120000}])
  await expect.poll(async()=>Boolean((await settings(page)).items.find((i:{id:string})=>i.id==='timer-a').endsAt),{timeout:12000}).toBe(false)
  expect((await settings(page)).items.find((i:{id:string})=>i.id==='timer-b').endsAt).toBeGreaterThan(Date.now())
})

test('lamp hinges keep moving the shade and persist their angles', async ({ page }) => {
  await seed(page,[])
  await page.locator('.dash-desk').hover()
  await page.locator('.dash-desk__control').first().click()
  const elbow={x:1.99-Math.sin(pose.a1)*1.45,y:.11+Math.cos(pose.a1)*1.45}
  const p=await point(page,elbow.x,elbow.y)
  await page.mouse.move(p.x,p.y)
  await page.mouse.down()
  await page.mouse.move(p.x-25,p.y-5,{steps:15})
  await page.mouse.up()
  await expect.poll(async()=>(await settings(page)).pose.a1).not.toBe(pose.a1)
  const saved=(await settings(page)).pose
  await page.waitForTimeout(800)
  await page.screenshot({path:'.artifacts/desk-lamp-moved.png'})
  await page.reload()
  await expect(page.locator('.dash-desk')).toHaveAttribute('data-status','ready')
  expect((await settings(page)).pose).toEqual(saved)
  expect((await settings(page)).lampOn).toBe(true)
})
