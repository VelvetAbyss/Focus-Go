import { ArrowUpDown, GripVertical, List, ListFilter, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const TaskListView = () => {
  const skeletonRows = Array.from({ length: 8 }, (_, index) => index)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3 border-b pb-3">
        <div className="flex max-w-sm flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search tasks...</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent">
            <ListFilter className="size-3" />
            Filter
          </button>
          <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent">
            <ArrowUpDown className="size-3" />
            Sort
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[32px_1fr_100px_100px_100px_80px] gap-2 border-b px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div />
        <div>Task</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Due Date</div>
        <div>Tags</div>
      </div>

      <div className="flex-1">
        {skeletonRows.map((index) => (
          <div
            key={index}
            className={cn(
              'grid grid-cols-[32px_1fr_100px_100px_100px_80px] items-center gap-2 border-b border-border/50 px-3 py-3',
              'group cursor-pointer transition-colors hover:bg-accent/30',
            )}
          >
            <div className="flex items-center justify-center">
              <GripVertical className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3.5 rounded bg-muted" style={{ width: `${60 + (index * 17) % 30}%` }} />
            </div>
            <div>
              <div className={cn('h-5 rounded-full', index % 3 === 0 ? 'w-12 bg-slate-100' : index % 3 === 1 ? 'w-14 bg-blue-50' : 'w-12 bg-emerald-50')} />
            </div>
            <div>
              <div className={cn('h-5 w-14 rounded', index % 4 === 0 ? 'bg-red-50' : index % 4 === 1 ? 'bg-orange-50' : index % 4 === 2 ? 'bg-amber-50' : 'bg-blue-50')} />
            </div>
            <div>
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
            <div className="flex gap-1">
              <div className="h-4 w-8 rounded bg-muted" />
              <div className="h-4 w-6 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
        <div className="flex max-w-xs flex-col items-center rounded-xl border bg-card px-8 py-6 text-center shadow-sm">
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
            <List className="size-5 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm text-foreground">List view coming soon</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A powerful table-based view with inline editing, drag-to-reorder, and bulk actions.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TaskListView
