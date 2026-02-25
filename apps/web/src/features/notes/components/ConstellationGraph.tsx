import type { NoteEntity } from '../../../data/models/types'

type ConstellationGraphProps = {
  center: NoteEntity | null
  linked: NoteEntity[]
  backlinks: NoteEntity[]
  onSelect: (id: string) => void
}

type GraphNode = {
  id: string
  label: string
  x: number
  y: number
  type: 'link' | 'backlink'
}

const clampLabel = (value: string) => {
  const text = value.trim() || 'Untitled'
  return text.length <= 14 ? text : `${text.slice(0, 14)}…`
}

const buildOrbitNodes = (linked: NoteEntity[], backlinks: NoteEntity[]): GraphNode[] => {
  const unique = new Map<string, { note: NoteEntity; type: 'link' | 'backlink' }>()

  for (const note of linked) unique.set(note.id, { note, type: 'link' })
  for (const note of backlinks) {
    const current = unique.get(note.id)
    if (!current) unique.set(note.id, { note, type: 'backlink' })
  }

  const entries = Array.from(unique.values())
  const radius = 80

  return entries.map((entry, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(entries.length, 1)
    return {
      id: entry.note.id,
      label: clampLabel(entry.note.title),
      x: 110 + Math.cos(angle) * radius,
      y: 110 + Math.sin(angle) * radius,
      type: entry.type,
    }
  })
}

const ConstellationGraph = ({ center, linked, backlinks, onSelect }: ConstellationGraphProps) => {
  if (!center) {
    return <p className="notes-graph__empty">Select a note to render its constellation.</p>
  }

  const nodes = buildOrbitNodes(linked, backlinks)

  return (
    <div className="notes-graph" aria-label="Backlink constellation">
      <svg viewBox="0 0 220 220" role="img" aria-label="Notes graph">
        {nodes.map((node) => (
          <line key={`edge-${node.id}`} x1={110} y1={110} x2={node.x} y2={node.y} className="notes-graph__edge" />
        ))}

        {nodes.map((node) => (
          <g key={node.id} className="notes-graph__node-group">
            <circle
              cx={node.x}
              cy={node.y}
              r={14}
              className={`notes-graph__node notes-graph__node--${node.type}`}
              onClick={() => onSelect(node.id)}
            />
            <text x={node.x} y={node.y + 27} textAnchor="middle" className="notes-graph__label">
              {node.label}
            </text>
          </g>
        ))}

        <circle cx={110} cy={110} r={22} className="notes-graph__node notes-graph__node--center" />
        <text x={110} y={114} textAnchor="middle" className="notes-graph__center-label">
          {clampLabel(center.title)}
        </text>
      </svg>
    </div>
  )
}

export default ConstellationGraph
