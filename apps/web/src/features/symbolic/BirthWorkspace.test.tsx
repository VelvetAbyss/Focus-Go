// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { BirthProfile } from './types'
const state=vi.hoisted(()=>({owner:'owner-a',profile:null as BirthProfile|null,profiles:[] as BirthProfile[]}))
vi.mock('./useSymbolic',()=>({useSymbolic:()=>({owner:state.owner,ready:true,error:false,data:{profile:state.profile,profiles:state.profiles,versions:[]}}),useSymbolicCopy:()=>({zh:true,language:'zh',text:(zh:string)=>zh})}))
vi.mock('./storage',()=>({saveBirthProfile:vi.fn().mockResolvedValue({}),selectBirthProfile:vi.fn().mockResolvedValue(undefined)}))
vi.mock('./SyncStatus',()=>({SymbolicSyncStatus:()=>null}))
vi.mock('./SymbolicShell',()=>({SymbolicShell:({children}:{children:React.ReactNode})=><main>{children}</main>,DataStatus:()=>null}))
import { BirthWorkspace } from './BirthWorkspace'
import { saveBirthProfile } from './storage'
const profile=(id:string,name:string):BirthProfile=>({id,name,date:'2005-12-23',time:'08:37',calendar:'solar',leapMonth:false,timeZone:'Asia/Shanghai',latitude:31.23,longitude:121.47,direction:'male',zi:2,version:'version-'+id,savedAt:1})
const page=()=> <BirthWorkspace module="bazi" title="八字" subtitle="">{p=><p>当前查看：{p.name}</p>}</BirthWorkspace>
beforeEach(()=>{state.owner='owner-a';state.profile=profile('a','测试甲');state.profiles=[state.profile];vi.clearAllMocks()})
afterEach(cleanup)
it('keeps the edited person and draft when another device changes the active profile',async()=>{
 const view=render(page());fireEvent.click(screen.getByRole('button',{name:'编辑档案'}))
 fireEvent.change(screen.getByLabelText('称呼（可选）'),{target:{value:'甲的未保存草稿'}})
 state.profile=profile('b','测试乙');state.profiles.push(state.profile);view.rerender(page())
 expect(screen.getByLabelText('称呼（可选）')).toHaveValue('甲的未保存草稿')
 fireEvent.click(screen.getByRole('button',{name:'保存并排盘'}))
 await waitFor(()=>expect(saveBirthProfile).toHaveBeenCalledWith('owner-a',expect.objectContaining({name:'甲的未保存草稿',id:'a'}),'version-a','a'))
})
it('hides an old account draft immediately after the owner changes',()=>{
 const view=render(page());fireEvent.click(screen.getByRole('button',{name:'编辑档案'}))
 fireEvent.change(screen.getByLabelText('称呼（可选）'),{target:{value:'旧账号的私密草稿'}})
 state.owner='owner-b';state.profile=profile('c','新账号示例');state.profiles=[state.profile];view.rerender(page())
 expect(screen.queryByDisplayValue('旧账号的私密草稿')).not.toBeInTheDocument()
 expect(screen.getByText('当前查看：新账号示例')).toBeInTheDocument()
})
it('keeps a newly started local draft when the first cloud profile arrives',()=>{
 state.profile=null;state.profiles=[]
 const view=render(page());const input=screen.getByLabelText('称呼（可选）')
 fireEvent.focus(input);fireEvent.change(input,{target:{value:'尚未保存的新档案'}})
 state.profile=profile('cloud','云端已有档案');state.profiles=[state.profile];view.rerender(page())
 expect(screen.getByLabelText('称呼（可选）')).toHaveValue('尚未保存的新档案')
 expect(screen.getByText('当前查看：云端已有档案')).toBeInTheDocument()
})
it('requires a new place selection or verified coordinates after a city name is edited',()=>{
 render(page());fireEvent.click(screen.getByRole('button',{name:'编辑档案'}))
 const city=screen.getByLabelText('搜索出生城市')
 fireEvent.change(city,{target:{value:'上海'}})
 fireEvent.click(screen.getByRole('button',{name:'上海'}))
 expect(screen.getByRole('button',{name:'保存并排盘'})).toBeEnabled()
 fireEvent.change(city,{target:{value:'另一个城市'}})
 expect(screen.getByRole('button',{name:'保存并排盘'})).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'展开校正'}))
 fireEvent.click(screen.getByRole('button',{name:'已核对时区与坐标'}))
 expect(screen.getByRole('button',{name:'保存并排盘'})).toBeEnabled()
})
