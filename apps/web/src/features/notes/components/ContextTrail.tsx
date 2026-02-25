import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ContextTrailProps = {
  noteIds: string[]
  labels: Record<string, string>
  activeId: string | null
  onSelect: (id: string) => void
}

const fallbackLabel = (label?: string) => {
  const text = label?.trim()
  return text && text.length > 0 ? text : 'Untitled'
}

const ContextTrail = ({ noteIds, labels, activeId, onSelect }: ContextTrailProps) => {
  if (!noteIds.length) {
    return <p className="notes-context__empty">No navigation history yet.</p>
  }

  return (
    <div className="notes-context__rail" aria-label="Context trail">
      {noteIds.map((id, index) => (
        <Button
          key={`${id}-${index}`}
          type="button"
          variant={activeId === id ? 'secondary' : 'outline'}
          size="sm"
          className="notes-context__pill"
          onClick={() => onSelect(id)}
        >
          <Badge variant="secondary" className="notes-context__index">
            {index + 1}
          </Badge>
          {fallbackLabel(labels[id])}
        </Button>
      ))}
    </div>
  )
}

export default ContextTrail
