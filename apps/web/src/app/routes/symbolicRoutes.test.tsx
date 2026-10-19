// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach,it,expect,vi } from 'vitest'
import { cleanup,render,screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const state=vi.hoisted(()=>({ready:true,installed:false}))
vi.mock('../../features/labs/LabsContext',()=>({useLabs:()=>({ready:state.ready,catalog:[{featureKey:'bazi',state:state.installed?'installed':'available'}]})}))
vi.mock('../../features/bazi/BaziPage',()=>({default:()=> <div>Calculated BaZi page</div>}))
vi.mock('../../features/labs/pages/LabsPage',()=>({default:()=> <div>Install from Labs</div>}))
import AppRoutes from './AppRoutes'
afterEach(cleanup)
it('redirects an uninstalled symbolic route to Labs',async()=>{
  state.installed=false;render(<MemoryRouter initialEntries={['/bazi']}><AppRoutes/></MemoryRouter>)
  expect(await screen.findByText('Install from Labs')).toBeInTheDocument();expect(screen.queryByText('Calculated BaZi page')).not.toBeInTheDocument()
})
it('opens an installed symbolic route',async()=>{
  state.installed=true;render(<MemoryRouter initialEntries={['/bazi']}><AppRoutes/></MemoryRouter>)
  expect(await screen.findByText('Calculated BaZi page')).toBeInTheDocument()
})
