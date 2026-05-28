import { NavLink } from 'react-router-dom'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DiscoveryNewBadge } from '../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen } from '../../shared/discovery/discoveryNewTargetActions'
import { SIDEBAR_DISCOVERY_TARGET_BY_ITEM_ID } from '../../shared/discovery/newTargets'
import type { SidebarNavItem } from './Sidebar'

type SidebarDndNavProps = {
  items: SidebarNavItem[]
  collapsed: boolean
  ariaLabel: string
  onOrderChange: (activeId: string, overId: string) => void
}

type SortableSidebarItemProps = {
  item: SidebarNavItem
  collapsed: boolean
}

const SortableSidebarItem = ({ item, collapsed }: SortableSidebarItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const discoveryTarget = SIDEBAR_DISCOVERY_TARGET_BY_ITEM_ID[item.id]
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <NavLink
      ref={setNodeRef}
      to={item.to}
      end={item.end}
      style={style}
      aria-label={item.label}
      className={({ isActive }) =>
        `focus-sidebar__item${item.extraClassName ? ` ${item.extraClassName}` : ''}${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`
      }
      onClick={() => { if (discoveryTarget) markDiscoveryNewTargetSeen(discoveryTarget) }}
      {...attributes}
      {...listeners}
    >
      <item.Icon size={18} aria-hidden="true" />
      {!collapsed ? <span>{item.label}</span> : null}
      {discoveryTarget ? <DiscoveryNewBadge target={discoveryTarget} /> : null}
    </NavLink>
  )
}

const SidebarDndNav = ({ items, collapsed, ariaLabel, onOrderChange }: SidebarDndNavProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onOrderChange(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <nav className="focus-sidebar__nav" aria-label={ariaLabel}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableSidebarItem key={item.id} item={item} collapsed={collapsed} />
          ))}
        </SortableContext>
      </nav>
    </DndContext>
  )
}

export default SidebarDndNav
