import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useQuery } from "convex/react";
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
  Send,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Page } from "../components/ui";
import type { WorkflowGraph, WorkflowNodeType } from "../lib/workflowGraph";
import {
  getWorkflowNodeDefinition,
  isWorkflowNodeType,
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

type WorkflowCanvasNodeData = {
  label: string;
  type: WorkflowNodeType;
};

function WorkflowCanvasNode({ data }: NodeProps<Node<WorkflowCanvasNodeData>>) {
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

function toFlowNodes(graph: WorkflowGraph): Node<WorkflowCanvasNodeData>[] {
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

export function WorkflowCanvasPage() {
  const { workflowId } = useParams();
  const workflow = useQuery(
    api.workflows.definitions.get,
    workflowId ? { id: workflowId as Id<"workflows"> } : "skip"
  );

  const flowNodes = useMemo(
    () => (workflow ? toFlowNodes(workflow.graph as WorkflowGraph) : []),
    [workflow]
  );
  const flowEdges = useMemo(
    () => (workflow ? toFlowEdges(workflow.graph as WorkflowGraph) : []),
    [workflow]
  );

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
          <span>{flowNodes.length} nodes</span>
          <span>{flowEdges.length} edges</span>
          <span>{workflow.isActive ? "Active" : "Paused"}</span>
        </div>
      </header>

      <div className="workflow-canvas-shell">
        <ReactFlowProvider>
          <ReactFlow
            colorMode="light"
            defaultEdges={flowEdges}
            defaultNodes={flowNodes}
            fitView
            fitViewOptions={{ padding: 0.35 }}
            maxZoom={1.4}
            minZoom={0.35}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesFocusable
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="oklch(75% 0.034 220)" gap={22} size={1.2} />
            <MiniMap pannable zoomable />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );
}
