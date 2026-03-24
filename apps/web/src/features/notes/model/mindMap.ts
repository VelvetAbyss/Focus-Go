import type { NoteMindMapDocument } from '../../../data/models/types'

export const createInitialMindMap = (): NoteMindMapDocument => ({
  nodes: [
    {
      id: 'root',
      position: { x: 0, y: 0 },
      data: { label: 'New Mind Map' },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
})

export const getMindMapPrimaryLabel = (mindMap?: NoteMindMapDocument | null) => {
  if (!mindMap?.nodes.length) return ''
  const root = mindMap.nodes.find((node) => node.id === 'root') ?? mindMap.nodes[0]
  return root?.data.label?.trim() ?? ''
}

export const mindMapToPlainText = (mindMap?: NoteMindMapDocument | null) =>
  mindMap?.nodes
    .map((node) => node.data.label.trim())
    .filter(Boolean)
    .join('\n') ?? ''
