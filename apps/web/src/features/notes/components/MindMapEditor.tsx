import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeParams,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, Trash2 } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { NoteMindMapDocument } from '../../../data/models/types'
import { createInitialMindMap } from '../model/mindMap'

type MindMapEditorProps = {
  value?: NoteMindMapDocument | null
  theme?: 'paper' | 'graphite'
  onChange: (next: NoteMindMapDocument) => void
}

type MindMapNodeData = {
  label: string
  onLabelChange: (id: string, label: string) => void
  onAddChild: (id: string) => void
}

type MindMapFlowNode = Node<MindMapNodeData, 'mindMapNode'>

const toFlowNodes = (
  value?: NoteMindMapDocument | null,
  handlers?: Pick<MindMapNodeData, 'onLabelChange' | 'onAddChild'>,
): MindMapFlowNode[] =>
  (value?.nodes.length ? value.nodes : createInitialMindMap().nodes).map((node) => ({
    id: node.id,
    position: node.position,
    type: 'mindMapNode',
    data: {
      label: node.data.label,
      onLabelChange: handlers?.onLabelChange ?? (() => {}),
      onAddChild: handlers?.onAddChild ?? (() => {}),
    },
  }))

const toFlowEdges = (value?: NoteMindMapDocument | null): Edge[] =>
  (value?.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: false,
  }))

const MindMapNodeCard = memo(({ id, data, selected, isConnectable }: NodeProps<MindMapFlowNode>) => (
  <div className={`mind-map-node${selected ? ' is-selected' : ''}`}>
    <Handle type="target" position={Position.Left} className="mind-map-node__handle" isConnectable={isConnectable} />
    <input
      className="mind-map-node__input nodrag nopan"
      value={data.label}
      onChange={(event) => data.onLabelChange(id, event.target.value)}
      placeholder="Node"
    />
    <button type="button" className="mind-map-node__add nodrag nopan" onClick={() => data.onAddChild(id)} aria-label="Add child node">
      <Plus size={14} />
    </button>
    <Handle type="source" position={Position.Right} className="mind-map-node__handle" isConnectable={isConnectable} />
  </div>
))

MindMapNodeCard.displayName = 'MindMapNodeCard'

const MindMapCanvas = ({ value, theme = 'paper', onChange }: MindMapEditorProps) => {
  const emitRef = useRef(onChange)
  const viewportRef = useRef<Viewport>(value?.viewport ?? { x: 0, y: 0, zoom: 1 })
  const lastAppliedRef = useRef('')
  const lastEmittedRef = useRef('')
  const [selected, setSelected] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] })

  useEffect(() => {
    emitRef.current = onChange
  }, [onChange])

  const [nodes, setNodes, onNodesChange] = useNodesState<MindMapFlowNode>(
    toFlowNodes(value, { onLabelChange: () => {}, onAddChild: () => {} }),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(value))

  function updateNodeLabel(nodeId: string, label: string) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { ...node.data, label },
            }
          : node,
      ),
    )
  }

  function addChildNode(parentId: string) {
    const createdId = crypto.randomUUID()
    let createdPosition = { x: 180, y: 0 }

    setNodes((current) => {
      const parent = current.find((node) => node.id === parentId)
      const siblings = current.filter((node) => node.id !== parentId && node.position.x > (parent?.position.x ?? 0))
      createdPosition = {
        x: (parent?.position.x ?? 0) + 220,
        y: (parent?.position.y ?? 0) + siblings.length * 96 - 32,
      }
      return [
        ...current,
        {
          id: createdId,
          position: createdPosition,
          type: 'mindMapNode',
          data: {
            label: 'New node',
            onLabelChange: updateNodeLabel,
            onAddChild: addChildNode,
          },
        },
      ]
    })

    setEdges((current) =>
      addEdge(
        {
          id: crypto.randomUUID(),
          source: parentId,
          target: createdId,
        },
        current,
      ),
    )
  }

  useEffect(() => {
    const nextNodes = toFlowNodes(value, { onLabelChange: updateNodeLabel, onAddChild: addChildNode })
    const nextEdges = toFlowEdges(value)
    const nextSnapshot = JSON.stringify({
      nodes: nextNodes.map((node) => ({ id: node.id, position: node.position, label: node.data.label })),
      edges: nextEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      viewport: value?.viewport ?? { x: 0, y: 0, zoom: 1 },
    })
    if (lastAppliedRef.current === nextSnapshot) return
    lastAppliedRef.current = nextSnapshot
    setNodes(nextNodes)
    setEdges(nextEdges)
    viewportRef.current = value?.viewport ?? { x: 0, y: 0, zoom: 1 }
  }, [setEdges, setNodes, value])

  useEffect(() => {
    const nextDoc = {
      nodes: nodes.map((node) => ({
        id: node.id,
        position: node.position,
        data: {
          label: node.data.label,
        },
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
      viewport: viewportRef.current,
    }
    const nextSnapshot = JSON.stringify(nextDoc)
    if (lastEmittedRef.current === nextSnapshot) return
    lastEmittedRef.current = nextSnapshot
    emitRef.current(nextDoc)
  }, [edges, nodes])

  const nodeTypes = useMemo(() => ({ mindMapNode: MindMapNodeCard }), [])

  return (
    <div className={`mind-map-editor mind-map-editor--${theme}`}>
      <div className="mind-map-editor__toolbar">
        <button type="button" className="mind-map-editor__toolbar-button" onClick={() => addChildNode(selected.nodes[0]?.id ?? 'root')}>
          <Plus size={14} />
          <span>Add child</span>
        </button>
        <button
          type="button"
          className="mind-map-editor__toolbar-button"
          onClick={() => {
            if (selected.nodes.length > 0) {
              const selectedNodeIds = new Set(selected.nodes.map((node) => node.id))
              setNodes((current) => current.filter((node) => !selectedNodeIds.has(node.id) || node.id === 'root'))
              setEdges((current) =>
                current.filter((edge) => !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)),
              )
              return
            }
            if (selected.edges.length > 0) {
              const selectedEdgeIds = new Set(selected.edges.map((edge) => edge.id))
              setEdges((current) => current.filter((edge) => !selectedEdgeIds.has(edge.id)))
            }
          }}
          disabled={selected.nodes.length === 0 && selected.edges.length === 0}
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      </div>
      <div className="mind-map-editor__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(connection: Connection) =>
            setEdges((current) =>
              addEdge(
                {
                  ...connection,
                  id: crypto.randomUUID(),
                },
                current,
              ),
            )
          }
          onMoveEnd={(_, viewport) => {
            viewportRef.current = viewport
            emitRef.current({
              nodes: nodes.map((node) => ({
                id: node.id,
                position: node.position,
                data: { label: node.data.label },
              })),
              edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
              })),
              viewport,
            })
          }}
          onSelectionChange={setSelected}
          minZoom={0.2}
          maxZoom={1.5}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          defaultViewport={value?.viewport ?? { x: 0, y: 0, zoom: 1 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Background color={theme === 'graphite' ? 'rgba(245, 243, 240, 0.1)' : 'rgba(58, 55, 51, 0.08)'} gap={24} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

const MindMapEditor = (props: MindMapEditorProps) => (
  <ReactFlowProvider>
    <MindMapCanvas {...props} />
  </ReactFlowProvider>
)

export default MindMapEditor
