// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { BirthProfile } from '../symbolic/types'
import AstrologyPage from './AstrologyPage'
import AstrologyWidget from './AstrologyWidget'
import BaziPage from '../bazi/BaziPage'
import BaziWidget from '../bazi/BaziWidget'
import { clearAstrologySelection, readAstrologySelection, resolveAstrologySource, saveAstrologySelection } from './useAstrologySelection'
const state=vi.hoisted(()=>({owner:'reading-test-a',profile:null as BirthProfile|null}))
vi.mock('../symbolic/useSymbolic',()=>({
  useSymbolic:()=>({owner:state.owner,ready:true,error:false,data:{profile:state.profile,profiles:state.profile?[state.profile]:[],versions:[],readings:[],sessions:[],timeZone:'Asia/Shanghai'}}),
  useSymbolicCopy:()=>({language:'zh',zh:true,text:(...args:[string,string])=>args[0]}),
  useSymbolicNow:()=>new Date('2026-10-12T15:30:00Z'),
}))
vi.mock('../symbolic/BirthWorkspace',()=>({
  BirthWorkspace:({children}:{children:(p:BirthProfile,v:BirthProfile[])=>ReactNode})=>state.profile?<>{children(state.profile,[])}</>:<p>创建出生档案</p>,
  ProfileVersions:()=>null,
}))
vi.mock('../symbolic/SymbolicWidget',()=>({SymbolicWidget:({children,module}:{children:ReactNode;module:string})=><section data-testid={module+'-widget'}>{children}</section>,WidgetStatus:()=>null}))
const profile:BirthProfile={name:'测试档案',date:'2005-12-23',calendar:'solar',leapMonth:false,time:'08:37',timeZone:'Asia/Shanghai',latitude:31.23,longitude:121.47,direction:'male',zi:1,version:'test-v1',id:'test-id',savedAt:1}
afterEach(cleanup)
beforeEach(()=>{state.owner='reading-test-a';state.profile=null;localStorage.clear()})
describe('rebuilt reading flows',()=>{
  it('offers all signs without a birth profile and shares a chosen source with the widget',()=>{
    render(<MemoryRouter><AstrologyPage/><AstrologyWidget/></MemoryRouter>)
    expect(screen.getByRole('heading',{name:'先选你的太阳星座'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'天秤'}))
    expect(readAstrologySelection(state.owner)).toEqual({source:'sign',sign:6})
    const widget=screen.getByTestId('astrology-widget')
    expect(within(widget).getByText(/十二星座 · 天秤/)).toBeInTheDocument()
    expect(within(widget).getByLabelText('今日分项评分')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'周运'}))
    expect(screen.getByRole('heading',{name:/太阳星座速览 · 本周/})).toBeInTheDocument()
    expect(within(widget).getByLabelText('今日分项评分')).toBeInTheDocument()
  })
  it('starts a saved personal chart on today and allows the complete natal report',()=>{
    state.profile=profile
    render(<MemoryRouter><AstrologyPage/></MemoryRouter>)
    expect(screen.getByRole('button',{name:'今日运势'})).toHaveAttribute('aria-pressed','true')
    expect(screen.getByRole('heading',{name:'个人星盘行运 · 今日'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'星盘与解读'}))
    expect(screen.getByRole('heading',{name:'个人星盘与完整解读'})).toBeInTheDocument()
    expect(screen.getByRole('heading',{name:'性格与优势短板'})).toBeInTheDocument()
  })
  it('keeps the early-Zi date in the BaZi page and widget',()=>{
    state.profile=profile
    render(<MemoryRouter><BaziPage/><BaziWidget/></MemoryRouter>)
    expect(screen.getByLabelText('运势日期')).toHaveValue('2026-10-13')
    expect(within(screen.getByTestId('bazi-widget')).getByText(/2026-10-13/)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'今日运势'})).toHaveAttribute('aria-pressed','true')
    fireEvent.click(screen.getByRole('button',{name:'命盘与解读'}))
    expect(screen.getByRole('heading',{name:'五行、日主与喜忌'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'阶段运势'}))
    expect(screen.getByRole('button',{name:'大运'})).toBeInTheDocument()
  })
  it('disables luck cycles outside the supported forecast date range',()=>{
    state.profile={...profile,date:'2050-01-01'}
    render(<MemoryRouter><BaziPage/></MemoryRouter>)
    fireEvent.click(screen.getByRole('button',{name:'阶段运势'}))
    const outside=screen.getAllByRole('button',{name:/超出1901—2100支持范围/})
    expect(outside.length).toBeGreaterThan(0)
    outside.forEach(button=>expect(button).toBeDisabled())
  })
  it('isolates source and sign preference by account with explicit initial defaults',()=>{
    saveAstrologySelection('account-a',{source:'sign',sign:8})
    expect(readAstrologySelection('account-b')).toEqual({source:null,sign:null})
    expect(resolveAstrologySource(readAstrologySelection('account-b'),true)).toBe('personal')
    expect(resolveAstrologySource(readAstrologySelection('account-b'),false)).toBe('sign')
    saveAstrologySelection('account-b',{source:'personal',sign:1})
    expect(readAstrologySelection('account-a')).toEqual({source:'sign',sign:8})
    clearAstrologySelection('account-a')
    expect(readAstrologySelection('account-a')).toEqual({source:null,sign:null})
    expect(readAstrologySelection('account-b')).toEqual({source:'personal',sign:1})
  })
})
