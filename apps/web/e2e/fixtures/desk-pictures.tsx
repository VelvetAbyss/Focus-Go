import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DeskStage } from '../../src/features/dashboard/desk/DeskProps'
import { DEFAULT_DESK, parseDeskSettings } from '../../src/features/dashboard/desk/deskState'
import { defaultPicture } from '../../src/features/dashboard/desk/pictureTypes'
import { PreferencesProvider } from '../../src/shared/prefs/PreferencesProvider'
import { applyTheme } from '../../src/shared/theme/theme'
import { loadLanguage } from '../../src/shared/i18n/translator'
import '../../src/styles.css'
import '../../src/shared/theme/tokens.css'
import './desk-pictures.css'

const key = 'focusgo.preview.pictures'
const storage = {
  read: () => localStorage.getItem(key) ? parseDeskSettings(localStorage.getItem(key)) : {
    ...DEFAULT_DESK, lampX: 3.6,
    items: [
      { id: 'view', kind: 'window' as const, x: -2.3, picture: { ...defaultPicture('window'), width: 4, height: 2.2, y: .5 } },
      { id: 'art', kind: 'frame' as const, x: 1.1, picture: { ...defaultPicture('frame'), width: 1.6, height: 1.7 } },
      { id: 'coffee', kind: 'coffee' as const, x: -3.3 },
      { id: 'plant', kind: 'plant' as const, x: -.5 },
    ],
  },
  write: (settings: ReturnType<typeof parseDeskSettings>) => localStorage.setItem(key, JSON.stringify(settings)),
}
export function Preview() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const el=ref.current!
    const observer=new ResizeObserver(()=>{ if(el.clientWidth>0) setWidth(el.clientWidth) })
    observer.observe(el)
    return ()=>observer.disconnect()
  }, [])
  const unit = Math.min(85, width / 12)
  const height = Math.max(180, unit * 3.35)
  return <main className="picture-preview">
    <header className="picture-preview__intro"><span>FOCUS & GO / DESK STUDY 02</span><h1>窗户与相框</h1><p>给桌面添一处风景，留一幅喜欢的画。</p></header>
    <div className="picture-preview__actions"><span>第一版 · 可交互预览</span><button type="button" onClick={()=>{setDark(!dark);applyTheme(dark?'light':'dark')}}>{dark?'日间':'夜间'}</button></div>
    <div className="picture-preview__stage" ref={ref} style={{height}}><DeskStage placement={{left:0,width,height,origin:width/2,unit}} storage={storage}/></div>
    <div className="picture-preview__guide">
      <p><strong>墙上的窗与画</strong>点击窗户开关双扇窗；窗户和相框都可上下、左右拖动。</p>
      <p><strong>图片与大小</strong>选中物件后，拖右上角缩放；点设置更换图片、调整取景。</p>
      <p><strong>更多物件</strong>左上角选择器可继续添加窗户、相框与已有物件。</p>
    </div>
    <footer><span>此页独立保存摆放，不改变 Dashboard 的桌面。</span><a href="/">打开 Dashboard ↗</a><a href="/licenses/desk-pictures.txt" target="_blank" rel="noreferrer">图片来源 ↗</a></footer>
  </main>
}
await Promise.all([loadLanguage('zh'), loadLanguage('en')])
const root=createRoot(document.getElementById('root')!)
root.render(<PreferencesProvider><Preview/></PreferencesProvider>)
if(import.meta.hot) import.meta.hot.dispose(()=>root.unmount())
