import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Panel,
  Handle,
  Position,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  GitBranch,
  Plus,
  Trash2,
  X,
  Undo2,
  Redo2,
  AlignLeft,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import './MindMapPanel.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type MindMapNodeData = {
  label: string
  collapsed?: boolean
  // injected at render time — NOT serialized
  isSearchMatch?: boolean
  isCurrentResult?: boolean
  hasChildren?: boolean
  isRoot?: boolean
  isDropTarget?: boolean
  onToggleCollapse?: (id: string) => void
  onEditingChange?: (id: string | null) => void
  pushHistory?: () => void
}

// Module-level set: node IDs that should enter edit mode on first render.
// Set BEFORE calling setNodes so the initializer fires synchronously on mount.
const autoEditNodeIds = new Set<string>()

type SerializedNode = {
  id: string
  type?: string
  position: { x: number; y: number }
  data: { label: string; collapsed?: boolean }
}

type SerializedEdge = {
  id: string
  source: string
  target: string
  type?: string
}

type HistorySnapshot = {
  nodes: SerializedNode[]
  edges: SerializedEdge[]
}

// ─── Pure utilities ───────────────────────────────────────────────────────────

function buildChildrenMap(edges: Edge[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const e of edges) {
    if (!map.has(e.source)) map.set(e.source, [])
    map.get(e.source)!.push(e.target)
  }
  return map
}

function computeDescendants(nodeId: string, childrenMap: Map<string, string[]>): Set<string> {
  const result = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of childrenMap.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child)
        queue.push(child)
      }
    }
  }
  return result
}

function computeVisible(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
): { visibleNodes: Node<MindMapNodeData>[]; visibleEdges: Edge[] } {
  const childrenMap = buildChildrenMap(edges)
  const hiddenIds = new Set<string>()
  for (const n of nodes) {
    if (n.data.collapsed) {
      for (const id of computeDescendants(n.id, childrenMap)) {
        hiddenIds.add(id)
      }
    }
  }
  return {
    visibleNodes: nodes.filter((n) => !hiddenIds.has(n.id)),
    visibleEdges: edges.filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)),
  }
}

const NODE_W = 160
const NODE_H = 40
const X_GAP = 80
const Y_GAP = 24

function computeTreeLayout(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
): Map<string, { x: number; y: number }> {
  const childrenMap = buildChildrenMap(edges)
  const parentMap = new Map<string, string>()
  for (const e of edges) parentMap.set(e.target, e.source)

  const rootIds = nodes.filter((n) => !parentMap.has(n.id)).map((n) => n.id)
  const positions = new Map<string, { x: number; y: number }>()

  function subtreeHeight(nodeId: string): number {
    const children = childrenMap.get(nodeId) ?? []
    if (children.length === 0) return NODE_H
    const total = children.reduce((s, c) => s + subtreeHeight(c), 0) + Y_GAP * (children.length - 1)
    return Math.max(NODE_H, total)
  }

  function assignPositions(nodeId: string, x: number, centerY: number) {
    positions.set(nodeId, { x, y: centerY - NODE_H / 2 })
    const children = childrenMap.get(nodeId) ?? []
    if (children.length === 0) return
    const totalH =
      children.reduce((s, c) => s + subtreeHeight(c), 0) + Y_GAP * (children.length - 1)
    let curY = centerY - totalH / 2
    for (const child of children) {
      const h = subtreeHeight(child)
      assignPositions(child, x + NODE_W + X_GAP, curY + h / 2)
      curY += h + Y_GAP
    }
  }

  let currentY = 0
  for (const rootId of rootIds) {
    const treeH = subtreeHeight(rootId)
    assignPositions(rootId, 0, currentY + treeH / 2)
    currentY += treeH + Y_GAP * 3
  }

  return positions
}

// Find which node the dragged node is hovering over (for reparent)
function findDropTarget(
  dragged: Node<MindMapNodeData>,
  allNodes: Node<MindMapNodeData>[],
  edges: Edge[],
): Node<MindMapNodeData> | null {
  const childrenMap = buildChildrenMap(edges)
  const descendants = computeDescendants(dragged.id, childrenMap)

  const dw = dragged.measured?.width ?? NODE_W
  const dh = dragged.measured?.height ?? NODE_H
  const dragCx = dragged.position.x + dw / 2
  const dragCy = dragged.position.y + dh / 2

  for (const n of allNodes) {
    if (n.id === dragged.id) continue
    if (descendants.has(n.id)) continue // avoid cycles
    const nw = n.measured?.width ?? NODE_W
    const nh = n.measured?.height ?? NODE_H
    // Expand hit area slightly for easier dropping
    const pad = 12
    if (
      dragCx >= n.position.x - pad &&
      dragCx <= n.position.x + nw + pad &&
      dragCy >= n.position.y - pad &&
      dragCy <= n.position.y + nh + pad
    ) {
      return n
    }
  }
  return null
}

// ─── Serialization helpers ────────────────────────────────────────────────────

const storageKey = (noteId: string) => `focusgo_mindmap_${noteId}`

const serializeNodes = (nodes: Node<MindMapNodeData>[]): SerializedNode[] =>
  nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { label: n.data.label, collapsed: n.data.collapsed },
  }))

const serializeEdges = (edges: Edge[]): SerializedEdge[] =>
  edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type ?? 'default',
  }))

// ─── Custom node component ────────────────────────────────────────────────────

function MindMapNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as MindMapNodeData
  const { updateNodeData } = useReactFlow()

  const [editing, setEditing] = useState<boolean>(false)
  const [editLabel, setEditLabel] = useState(nodeData.label)
  const inputRef = useRef<HTMLInputElement>(null)
  // StrictMode-safe: check the auto-edit set inside useEffect, not the initializer.
  // (StrictMode double-invokes initializers, which would delete the id on the first call
  //  and miss it on the second, leaving editing = false.)
  const autoEditConsumedRef = useRef(false)
  useEffect(() => {
    if (!autoEditConsumedRef.current) {
      autoEditConsumedRef.current = true
      if (autoEditNodeIds.has(id)) {
        autoEditNodeIds.delete(id)
        setEditLabel(nodeData.label)
        setEditing(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Keep a stable ref to the latest onEditingChange callback
  const onEditingChangeRef = useRef(nodeData.onEditingChange)
  useEffect(() => { onEditingChangeRef.current = nodeData.onEditingChange })

  // Focus + notify panel whenever editing state turns on
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
      onEditingChangeRef.current?.(id)
    }
  }, [editing, id])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditLabel(nodeData.label)
    setEditing(true)
    // onEditingChange is called by the focus useEffect above
  }

  const saveLabel = useCallback(() => {
    const trimmed = editLabel.trim()
    if (trimmed) {
      nodeData.pushHistory?.()
      updateNodeData(id, { label: trimmed })
    }
    setEditing(false)
    onEditingChangeRef.current?.(null)
  }, [id, editLabel, updateNodeData, nodeData])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      saveLabel()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setEditLabel(nodeData.label)
      onEditingChangeRef.current?.(null)
    }
  }

  const collapsed = nodeData.collapsed ?? false

  const nodeClass = [
    'mindmap-node',
    nodeData.isRoot ? 'mindmap-node--root' : '',
    nodeData.isDropTarget ? 'mindmap-node--drop-target' : '',
    nodeData.isCurrentResult ? 'mindmap-node--current-result' : '',
    nodeData.isSearchMatch && !nodeData.isCurrentResult ? 'mindmap-node--search-match' : '',
    collapsed ? 'mindmap-node--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={nodeClass} onDoubleClick={handleDoubleClick}>
      <Handle type="target" position={Position.Left} className="mindmap-handle mindmap-handle--target" />

      {editing ? (
        <span className="mindmap-node__input-wrap">
          <input
            ref={inputRef}
            className="mindmap-node__input"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Mirror span drives the container width — input just overlays it */}
          <span className="mindmap-node__input-mirror" aria-hidden>
            {editLabel || '\u00a0'}
          </span>
        </span>
      ) : (
        <span className="mindmap-node__label">{nodeData.label}</span>
      )}

      {nodeData.hasChildren && (
        <button
          type="button"
          className="mindmap-node__collapse-btn"
          onClick={(e) => {
            e.stopPropagation()
            nodeData.onToggleCollapse?.(id)
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={9} /> : <ChevronDown size={9} />}
        </button>
      )}

      <Handle type="source" position={Position.Right} className="mindmap-handle mindmap-handle--source" />
    </div>
  )
}

const nodeTypes = { mindmap: MindMapNodeComponent }

// ─── Main panel ───────────────────────────────────────────────────────────────

type MindMapPanelProps = {
  open: boolean
  noteId: string | null
  onClose: () => void
}

function MindMapInner({ open, noteId, onClose }: MindMapPanelProps) {
  const { t } = useI18n()
  // getNodes/getEdges read from the ReactFlow Zustand store — always current,
  // no stale-closure risk even inside callbacks.
  const { fitView, getNodes, getEdges, getNodeConnections } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Undo/Redo
  const historyRef = useRef<HistorySnapshot[]>([])
  const historyIndexRef = useRef<number>(-1)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  // Editing guard (shared across all node components)
  const editingNodeIdRef = useRef<string | null>(null)

  // Drag-to-reparent: which node is the current drop target
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultIds, setSearchResultIds] = useState<string[]>([])
  const [searchIndex, setSearchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── History ───────────────────────────────────────────────────────────────

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    })
  }, [])

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      nodes: serializeNodes(getNodes()),
      edges: serializeEdges(getEdges()),
    }
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
    } else {
      historyIndexRef.current += 1
    }
    syncHistoryState()
  }, [getNodes, getEdges, syncHistoryState])

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const snapshot = historyRef.current[historyIndexRef.current]
    setNodes(snapshot.nodes as Node<MindMapNodeData>[])
    setEdges(snapshot.edges as Edge[])
    syncHistoryState()
  }, [setNodes, setEdges, syncHistoryState])

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    setNodes(snapshot.nodes as Node<MindMapNodeData>[])
    setEdges(snapshot.edges as Edge[])
    syncHistoryState()
  }, [setNodes, setEdges, syncHistoryState])

  // ── Load / Save ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !noteId) {
      setNodes([])
      setEdges([])
      return
    }
    historyRef.current = []
    historyIndexRef.current = -1
    syncHistoryState()

    try {
      const saved = localStorage.getItem(storageKey(noteId))
      if (saved) {
        const parsed = JSON.parse(saved) as { nodes?: SerializedNode[]; edges?: SerializedEdge[] }
        setNodes((parsed.nodes ?? []) as Node<MindMapNodeData>[])
        setEdges((parsed.edges ?? []) as Edge[])
      } else {
        setNodes([])
        setEdges([])
      }
    } catch {
      setNodes([])
      setEdges([])
    }
  }, [open, noteId, setNodes, setEdges, syncHistoryState])

  useEffect(() => {
    if (!open || !noteId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(
        storageKey(noteId),
        JSON.stringify({ nodes: serializeNodes(nodes), edges: serializeEdges(edges) }),
      )
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [nodes, edges, open, noteId])

  // ── Derived visible state ─────────────────────────────────────────────────

  const childrenMap = useMemo(() => buildChildrenMap(edges), [edges])

  const parentSet = useMemo(() => new Set(edges.map((e) => e.target)), [edges])

  const { visibleNodes, visibleEdges } = useMemo(
    () => computeVisible(nodes, edges),
    [nodes, edges],
  )

  // ── Search ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchOpen) {
      setSearchResultIds([])
      setSearchIndex(0)
      return
    }
    if (!searchQuery.trim()) {
      setSearchResultIds([])
      setSearchIndex(0)
      return
    }
    const visibleIds = new Set(visibleNodes.map((n) => n.id))
    const q = searchQuery.toLowerCase()
    const ids = nodes
      .filter((n) => visibleIds.has(n.id) && n.data.label.toLowerCase().includes(q))
      .map((n) => n.id)
    setSearchResultIds(ids)
    setSearchIndex(0)
  }, [searchQuery, nodes, visibleNodes, searchOpen])

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [searchOpen])

  const goToResult = useCallback(
    (index: number) => {
      if (searchResultIds.length === 0) return
      const norm = ((index % searchResultIds.length) + searchResultIds.length) % searchResultIds.length
      const id = searchResultIds[norm]
      if (!id) return
      setSearchIndex(norm)
      fitView({ nodes: [{ id }], padding: 0.5, duration: 400 })
    },
    [searchResultIds, fitView],
  )

  // ── Enriched nodes ────────────────────────────────────────────────────────

  const enrichedNodes = useMemo(
    () =>
      visibleNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          hasChildren: (childrenMap.get(n.id)?.length ?? 0) > 0,
          isRoot: !parentSet.has(n.id),
          isDropTarget: n.id === dropTargetId,
          isSearchMatch: searchResultIds.includes(n.id),
          isCurrentResult: searchResultIds[searchIndex] === n.id,
          onToggleCollapse: (nodeId: string) => {
            pushHistory()
            setNodes((nds) =>
              nds.map((nd) =>
                nd.id === nodeId
                  ? { ...nd, data: { ...nd.data, collapsed: !nd.data.collapsed } }
                  : nd,
              ),
            )
          },
          onEditingChange: (nodeId: string | null) => {
            editingNodeIdRef.current = nodeId
          },
          pushHistory,
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleNodes, childrenMap, parentSet, dropTargetId, searchResultIds, searchIndex, pushHistory],
  )

  // ── Toolbar actions ───────────────────────────────────────────────────────

  const handleAddRoot = useCallback(() => {
    pushHistory()
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    autoEditNodeIds.add(id)
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'mindmap',
        position: { x: 80 + prev.length * 20, y: 180 + prev.length * 15 },
        data: { label: t('notes.mindmap.rootNode') },
        selected: true,
      } as Node<MindMapNodeData>,
    ])
  }, [pushHistory, setNodes, t])

  const handleAddChild = useCallback(() => {
    const selected = getNodes().filter((n) => n.selected)
    if (selected.length !== 1) return
    const parent = selected[0]
    const childCount = getNodeConnections({ nodeId: parent.id, type: 'source' }).length
    const childId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    pushHistory()
    autoEditNodeIds.add(childId)
    setNodes((prev) => [
      ...prev.map((n) => ({ ...n, selected: false })),
      {
        id: childId,
        type: 'mindmap',
        position: {
          x: parent.position.x + 220,
          y: parent.position.y + childCount * 72,
        },
        data: { label: t('notes.mindmap.newNode') },
        selected: true,
      } as Node<MindMapNodeData>,
    ])
    setEdges((prev) => [
      ...prev,
      {
        id: `e-${parent.id}-${childId}`,
        source: parent.id,
        target: childId,
        type: 'smoothstep',
        deletable: false,
      },
    ])
  }, [getNodes, getNodeConnections, pushHistory, setNodes, setEdges, t])

  const handleAddSibling = useCallback(
    (nodeId: string) => {
      const parentConnections = getNodeConnections({ nodeId, type: 'target' })
      if (parentConnections.length === 0) {
        handleAddRoot()
        return
      }
      const parentId = parentConnections[0].source
      const currentNode = getNodes().find((n) => n.id === nodeId)
      if (!currentNode) return
      const siblingId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      pushHistory()
      autoEditNodeIds.add(siblingId)
      setNodes((prev) => [
        ...prev.map((n) => ({ ...n, selected: false })),
        {
          id: siblingId,
          type: 'mindmap',
          position: { x: currentNode.position.x, y: currentNode.position.y + 80 },
          data: { label: t('notes.mindmap.newNode') },
          selected: true,
        } as Node<MindMapNodeData>,
      ])
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${parentId}-${siblingId}`,
          source: parentId,
          target: siblingId,
          type: 'smoothstep',
          deletable: false,
        },
      ])
    },
    [getNodeConnections, getNodes, pushHistory, setNodes, setEdges, handleAddRoot, t],
  )

  const handleDeleteSelected = useCallback(() => {
    const selected = getNodes().filter((n) => n.selected)
    if (selected.length === 0) return
    const selectedIds = new Set(selected.map((n) => n.id))
    pushHistory()
    setEdges((eds) => eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)))
    setNodes((nds) => nds.filter((n) => !selectedIds.has(n.id)))
  }, [getNodes, pushHistory, setNodes, setEdges])

  const handleAutoLayout = useCallback(() => {
    const currentNodes = getNodes()
    if (currentNodes.length === 0) return
    pushHistory()
    const positions = computeTreeLayout(currentNodes, getEdges())
    setNodes((prev) =>
      prev.map((n) => {
        const pos = positions.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
    )
    requestAnimationFrame(() => fitView({ padding: 0.3, duration: 400 }))
  }, [getNodes, getEdges, pushHistory, setNodes, fitView])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', deletable: false }, eds)),
    [setEdges],
  )

  // ── Drag-to-reparent ──────────────────────────────────────────────────────

  const handleNodeDrag = useCallback(
    (_e: React.MouseEvent, draggedNode: Node<MindMapNodeData>) => {
      const target = findDropTarget(draggedNode, getNodes(), getEdges())
      setDropTargetId(target?.id ?? null)
    },
    [getNodes, getEdges],
  )

  const handleNodeDragStop = useCallback(
    (_e: React.MouseEvent, draggedNode: Node<MindMapNodeData>) => {
      setDropTargetId(null)
      const target = findDropTarget(draggedNode, getNodes(), getEdges())
      if (!target) return

      // Already a child of target — no-op
      const parentConnections = getNodeConnections({ nodeId: draggedNode.id, type: 'target' })
      if (parentConnections[0]?.source === target.id) return

      pushHistory()
      setEdges((prev) => {
        const filtered = prev.filter((e) => e.target !== draggedNode.id)
        return [
          ...filtered,
          {
            id: `e-${target.id}-${draggedNode.id}-${Date.now()}`,
            source: target.id,
            target: draggedNode.id,
            type: 'smoothstep',
            deletable: false,
          },
        ]
      })
    },
    [getNodes, getEdges, getNodeConnections, pushHistory, setEdges],
  )

  // ── Intercept onNodesChange to clean up edges on delete ───────────────────

  const handleNodesChange: OnNodesChange<Node<MindMapNodeData>> = useCallback(
    (changes: NodeChange<Node<MindMapNodeData>>[]) => {
      const removals = changes.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removals.length > 0) {
        const removedSet = new Set(removals)
        pushHistory()
        // Clean up edges connected to removed nodes (xyflow only emits node remove
        // changes on Delete key; edge cleanup is our responsibility in controlled mode).
        const currentEdges = getEdges()
        setEdges(currentEdges.filter((e) => !removedSet.has(e.source) && !removedSet.has(e.target)))
      }
      onNodesChange(changes)
    },
    [getEdges, onNodesChange, pushHistory, setEdges],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingNodeIdRef.current !== null) return

      const target = e.target as HTMLElement
      if (target.closest('.mindmap-search')) return

      const selected = getNodes().filter((n) => n.selected)

      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        if (selected.length === 1) handleAddChild()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (selected.length === 1) handleAddSibling(selected[0].id)
        return
      }
    },
    [getNodes, handleAddChild, handleAddSibling],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedNodes = visibleNodes.filter((n) => n.selected)
  const canAddChild = selectedNodes.length === 1
  const hasSelection = selectedNodes.length > 0

  if (!open) return null

  return (
    <div
      className="mindmap-panel"
      data-note-floating-panel="mindmap"
      onKeyDown={handlePanelKeyDown}
      tabIndex={-1}
    >
      {/* Header toolbar */}
      <div className="mindmap-panel__header">
        <GitBranch size={13} className="mindmap-panel__icon" />
        <span className="mindmap-panel__title">{t('notes.mindmap.title')}</span>

        <div className="mindmap-panel__actions">
          <button
            type="button"
            className="mindmap-panel__btn mindmap-panel__btn--icon"
            onClick={handleUndo}
            disabled={!historyState.canUndo}
            title={t('notes.mindmap.undo')}
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            className="mindmap-panel__btn mindmap-panel__btn--icon"
            onClick={handleRedo}
            disabled={!historyState.canRedo}
            title={t('notes.mindmap.redo')}
          >
            <Redo2 size={13} />
          </button>

          <div className="mindmap-panel__sep" />

          <button
            type="button"
            className="mindmap-panel__btn"
            onClick={handleAddRoot}
            title={t('notes.mindmap.addRoot')}
          >
            <Plus size={12} />
            <span>{t('notes.mindmap.addRoot')}</span>
          </button>

          {canAddChild && (
            <button
              type="button"
              className="mindmap-panel__btn"
              onClick={handleAddChild}
              title={`${t('notes.mindmap.addChild')} (Tab)`}
            >
              <Plus size={12} />
              <span>{t('notes.mindmap.addChild')}</span>
            </button>
          )}

          {hasSelection && (
            <button
              type="button"
              className="mindmap-panel__btn mindmap-panel__btn--danger"
              onClick={handleDeleteSelected}
              title={t('notes.mindmap.deleteNode')}
            >
              <Trash2 size={12} />
              <span>{t('notes.mindmap.deleteNode')}</span>
            </button>
          )}

          <div className="mindmap-panel__sep" />

          <button
            type="button"
            className="mindmap-panel__btn mindmap-panel__btn--icon"
            onClick={handleAutoLayout}
            title={t('notes.mindmap.autoLayout')}
          >
            <AlignLeft size={13} />
          </button>

          <button
            type="button"
            className={`mindmap-panel__btn mindmap-panel__btn--icon${searchOpen ? ' mindmap-panel__btn--active' : ''}`}
            onClick={() => setSearchOpen((v) => !v)}
            title={t('notes.mindmap.search')}
          >
            <Search size={13} />
          </button>

          <div className="mindmap-panel__sep" />

          <button
            type="button"
            className="mindmap-panel__btn mindmap-panel__btn--icon"
            onClick={onClose}
            title={t('notes.mindmap.close')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="mindmap-search">
          <Search size={12} className="mindmap-search__icon" />
          <input
            ref={searchInputRef}
            className="mindmap-search__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('notes.mindmap.searchPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); goToResult(searchIndex + 1) }
              if (e.key === 'Escape') { e.stopPropagation(); setSearchOpen(false) }
            }}
          />
          {searchQuery && (
            <span className="mindmap-search__count">
              {searchResultIds.length > 0
                ? `${searchIndex + 1} / ${searchResultIds.length}`
                : t('notes.mindmap.searchNoResults')}
            </span>
          )}
          {searchResultIds.length > 1 && (
            <>
              <button type="button" className="mindmap-search__nav" onClick={() => goToResult(searchIndex - 1)}>↑</button>
              <button type="button" className="mindmap-search__nav" onClick={() => goToResult(searchIndex + 1)}>↓</button>
            </>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="mindmap-panel__canvas">
        <ReactFlow
          nodes={enrichedNodes}
          edges={visibleEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 1.2 }}
          deleteKeyCode={['Delete', 'Backspace']}
          disableKeyboardA11y
          minZoom={0.1}
          maxZoom={2.5}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          autoPanOnNodeDrag={false}
          autoPanOnConnect={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'smoothstep', deletable: false }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.2}
            color="var(--mindmap-dot-color, #d4cfc9)"
          />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor="var(--mindmap-minimap-node, #94a3b8)"
            maskColor="var(--mindmap-minimap-mask, rgba(245,243,240,0.75))"
            style={{ borderRadius: 8 }}
          />
          {nodes.length === 0 && (
            <Panel position="top-center">
              <p className="mindmap-empty-hint">{t('notes.mindmap.empty')}</p>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  )
}

export function MindMapPanel(props: MindMapPanelProps) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  )
}
