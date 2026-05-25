import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Box,
  Brain,
  Clapperboard,
  Download,
  FileText,
  Image,
  MessageSquare,
  Mic,
  PackageCheck,
  Play,
  Save,
  Send,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Page } from "../components/ui";
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
} from "../lib/workflowGraph";
import {
  getWorkflowNodeDefinition,
  isWorkflowNodeType,
  listWorkflowNodeDefinitions,
} from "../lib/workflowNodeCatalog";

const nodeTypes = {
  workflowNode: WorkflowCanvasNode,
};

const nodeIcons = {
  runner: Play,
  comment: MessageSquare,
  media: Upload,
  llm: Brain,
  ai_agent: Sparkles,
  image_generation: Image,
  video_generation: Video,
  audio_generation: Mic,
  lipsync: WandSparkles,
  native_slideshow_planner: FileText,
  native_slideshow_renderer: Clapperboard,
  ai_video_editor: Clapperboard,
  post_compiler: PackageCheck,
  export: Download,
  auto_post: Send,
} satisfies Record<WorkflowNodeType, typeof Play>;

type WorkflowCanvasNodeData = Record<string, unknown> & {
  label: string;
  type: WorkflowNodeType;
};

type WorkflowFlowNode = Node<WorkflowCanvasNodeData>;

const paletteSections = [
  { category: "control", label: "Control" },
  { category: "input", label: "Input" },
  { category: "language", label: "Language" },
  { category: "agent", label: "Agents" },
  { category: "generation", label: "Generation" },
  { category: "assembly", label: "Assembly" },
  { category: "output", label: "Output" },
  { category: "utility", label: "Utility" },
] as const;

function WorkflowCanvasNode({ data }: NodeProps<WorkflowFlowNode>) {
  const definition = getWorkflowNodeDefinition(data.type);
  const Icon = nodeIcons[data.type] ?? Box;

  return (
    <div className={`workflow-node workflow-node-${definition.role}`}>
      {definition.inputPorts.map((port, index) => (
        <Handle
          className="workflow-port workflow-port-input"
          id={port.id}
          key={port.id}
          position={Position.Left}
          style={{ top: `${portOffset(index, definition.inputPorts.length)}%` }}
          type="target"
        />
      ))}

      <div className="workflow-node-header">
        <span className="workflow-node-icon">
          <Icon size={16} />
        </span>
        <span>{data.label}</span>
      </div>
      <p>{definition.description}</p>
      <div className="workflow-node-meta">
        <span>{definition.category}</span>
        <span>{definition.configSchemaMode.replace(/_/g, " ")}</span>
      </div>

      {definition.outputPorts.map((port, index) => (
        <Handle
          className="workflow-port workflow-port-output"
          id={port.id}
          key={port.id}
          position={Position.Right}
          style={{ top: `${portOffset(index, definition.outputPorts.length)}%` }}
          type="source"
        />
      ))}
    </div>
  );
}

function portOffset(index: number, count: number): number {
  if (count <= 1) return 50;
  const available = 68;
  return 16 + (available / (count - 1)) * index;
}

function toFlowNodes(graph: WorkflowGraph): WorkflowFlowNode[] {
  return graph.nodes
    .filter((node) => isWorkflowNodeType(node.type))
    .map((node) => ({
      id: node.id,
      type: "workflowNode",
      position: node.position,
      data: {
        label: node.label,
        type: node.type,
      },
    }));
}

function toFlowEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePort,
    target: edge.targetNodeId,
    targetHandle: edge.targetPort,
    animated: false,
    type: "smoothstep",
  }));
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function nextNodeId(type: WorkflowNodeType, nodes: WorkflowFlowNode[]): string {
  const baseId = type.replace(/_/g, "-");
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = 1;

  while (usedIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

function nextNodePosition(nodes: WorkflowFlowNode[]) {
  const index = Math.max(0, nodes.length - 1);

  return {
    x: 140 + (index % 3) * 300,
    y: 120 + Math.floor(index / 3) * 210,
  };
}

function toWorkflowGraph(
  sourceGraph: WorkflowGraph,
  nodes: WorkflowFlowNode[],
  edges: Edge[]
): WorkflowGraph {
  const sourceNodes = new Map(sourceGraph.nodes.map((node) => [node.id, node]));

  return {
    ...sourceGraph,
    nodes: nodes.map((node) => {
      const existingNode = sourceNodes.get(node.id);
      const definition = getWorkflowNodeDefinition(node.data.type);
      const graphNode: WorkflowNode = {
        id: node.id,
        type: node.data.type,
        label: node.data.label,
        position: node.position,
        config: existingNode?.config ?? cloneConfig(definition.defaultConfig),
        retention: existingNode?.retention ?? definition.defaultRetention,
      };

      if (existingNode?.provider) graphNode.provider = existingNode.provider;
      if (existingNode?.model) graphNode.model = existingNode.model;
      if (existingNode?.inputBindings) graphNode.inputBindings = existingNode.inputBindings;

      return graphNode;
    }),
    edges: edges.map((edge) => {
      const graphEdge: WorkflowEdge = {
        id: edge.id,
        sourceNodeId: edge.source,
        sourcePort: String(edge.sourceHandle ?? "output"),
        targetNodeId: edge.target,
        targetPort: String(edge.targetHandle ?? "input"),
      };

      return graphEdge;
    }),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unable to save workflow graph.";
}

export function WorkflowCanvasPage() {
  const { workflowId } = useParams();
  const workflow = useQuery(
    api.workflows.definitions.get,
    workflowId ? { id: workflowId as Id<"workflows"> } : "skip"
  );
  const updateGraph = useMutation(api.workflows.definitions.updateGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const flowNodes = useMemo(
    () => (workflow ? toFlowNodes(workflow.graph as WorkflowGraph) : []),
    [workflow]
  );
  const flowEdges = useMemo(
    () => (workflow ? toFlowEdges(workflow.graph as WorkflowGraph) : []),
    [workflow]
  );
  const hasRunnerNode = nodes.some((node) => node.data.type === "runner");
  const paletteDefinitions = useMemo(() => listWorkflowNodeDefinitions(), []);

  useEffect(() => {
    if (!workflow) return;

    setNodes(flowNodes);
    setEdges(flowEdges);
    setIsDirty(false);
    setSaveStatus("");
  }, [flowEdges, flowNodes, setEdges, setNodes, workflow]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      if (changes.some((change) => change.type === "position" || change.type === "dimensions")) {
        setIsDirty(true);
        setSaveStatus("");
      }

      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleAddNode = useCallback(
    (type: WorkflowNodeType) => {
      const definition = getWorkflowNodeDefinition(type);

      if (type === "runner" && hasRunnerNode) return;

      setNodes((currentNodes) => [
        ...currentNodes,
        {
          id: nextNodeId(type, currentNodes),
          type: "workflowNode",
          position: nextNodePosition(currentNodes),
          data: {
            label: definition.label,
            type,
          },
        },
      ]);
      setIsDirty(true);
      setSaveStatus("");
    },
    [hasRunnerNode, setNodes]
  );

  const handleSaveGraph = useCallback(async () => {
    if (!workflow) return;

    setIsSaving(true);
    setSaveStatus("");

    try {
      const graph = toWorkflowGraph(workflow.graph as WorkflowGraph, nodes, edges);
      await updateGraph({ id: workflow._id, graph });
      setIsDirty(false);
      setSaveStatus("Saved");
    } catch (error) {
      setSaveStatus(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [edges, nodes, updateGraph, workflow]);

  if (!workflowId) {
    return (
      <Page title="Workflow" description="No workflow was selected.">
        <Link className="secondary-button workflow-back-link" to="/workflows">
          <ArrowLeft size={16} />
          Back to workflows
        </Link>
      </Page>
    );
  }

  if (workflow === undefined) {
    return <div className="workflow-canvas-loading">Loading workflow canvas...</div>;
  }

  if (workflow === null) {
    return (
      <Page title="Workflow not found" description="This workflow may have been deleted or belongs to another account.">
        <Link className="secondary-button workflow-back-link" to="/workflows">
          <ArrowLeft size={16} />
          Back to workflows
        </Link>
      </Page>
    );
  }

  return (
    <section className="workflow-detail-page">
      <header className="workflow-canvas-header">
        <div>
          <Link className="workflow-back-link" to="/workflows">
            <ArrowLeft size={16} />
            Workflows
          </Link>
          <h1>{workflow.name}</h1>
          <p>{workflow.description || `${workflow.contentFormat} workflow`}</p>
        </div>
        <div className="workflow-canvas-stats">
          <span>{nodes.length} nodes</span>
          <span>{edges.length} edges</span>
          <span>{workflow.isActive ? "Active" : "Paused"}</span>
        </div>
        <div className="workflow-canvas-actions">
          {saveStatus ? <span>{saveStatus}</span> : null}
          <button
            className="primary-button"
            disabled={!isDirty || isSaving}
            onClick={() => {
              void handleSaveGraph();
            }}
            type="button"
          >
            <Save size={16} />
            {isSaving ? "Saving" : "Save graph"}
          </button>
        </div>
      </header>

      <div className="workflow-canvas-layout">
        <aside className="workflow-node-palette" aria-label="Workflow node palette">
          <div className="workflow-node-palette-header">
            <h2>Add node</h2>
            <span>{paletteDefinitions.length} types</span>
          </div>

          {paletteSections.map((section) => {
            const sectionDefinitions = paletteDefinitions.filter(
              (definition) => definition.category === section.category
            );

            if (!sectionDefinitions.length) return null;

            return (
              <section className="workflow-palette-section" key={section.category}>
                <h3>{section.label}</h3>
                <div className="workflow-palette-list">
                  {sectionDefinitions.map((definition) => {
                    const Icon = nodeIcons[definition.type] ?? Box;
                    const isDisabled = definition.type === "runner" && hasRunnerNode;

                    return (
                      <button
                        className="workflow-palette-button"
                        disabled={isDisabled}
                        key={definition.type}
                        onClick={() => handleAddNode(definition.type)}
                        type="button"
                      >
                        <span className="workflow-palette-icon">
                          <Icon size={15} />
                        </span>
                        <span>
                          <strong>{definition.label}</strong>
                          <small>
                            {isDisabled ? "Already on canvas" : definition.providerRequirement}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </aside>

        <div className="workflow-canvas-shell">
          <ReactFlowProvider>
            <ReactFlow
              colorMode="light"
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.35 }}
              maxZoom={1.4}
              minZoom={0.35}
              nodes={nodes}
              nodeTypes={nodeTypes}
              nodesDraggable
              nodesFocusable
              onEdgesChange={onEdgesChange}
              onNodesChange={handleNodesChange}
              panOnScroll
              proOptions={{ hideAttribution: true }}
            >
              <Background color="oklch(75% 0.034 220)" gap={22} size={1.2} />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </section>
  );
}
