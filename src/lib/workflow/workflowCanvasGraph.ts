import type { Connection, Edge, Node } from "@xyflow/react";
import type {
  NodeRetentionPolicy,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPort,
  WorkflowProviderName,
} from "./workflowGraph";
import {
  getWorkflowNodeDefinition,
  isWorkflowNodeType,
} from "./workflowNodeCatalog";
import {
  automaticTargetPortForSource,
  portTypesAreCompatible,
  WORKFLOW_CANVAS_INPUT_HANDLE_ID,
} from "./workflowPortMapping";
import {
  modelCategoryForNodeType,
  recommendedModelIdForNodeType,
} from "./workflowModelCatalog";

export type WorkflowCanvasNodeExecutionStatus =
  | "queued"
  | "running"
  | "failed"
  | "blocked"
  | "completed";

export type WorkflowCanvasNodeData = Record<string, unknown> & {
  config: Record<string, unknown>;
  executionStatus?: WorkflowCanvasNodeExecutionStatus;
  isSelected?: boolean;
  label: string;
  model?: string;
  provider?: WorkflowProviderName;
  retention?: NodeRetentionPolicy;
  type: WorkflowNodeType;
};

export type WorkflowFlowNode = Node<WorkflowCanvasNodeData>;

export const WORKFLOW_CANVAS_OUTPUT_HANDLE_ID = "output";

const WORKFLOW_CANVAS_RUN_TARGET_PORT: WorkflowPort = {
  id: WORKFLOW_CANVAS_INPUT_HANDLE_ID,
  label: "Run",
  dataType: "any",
};

type WorkflowConnection = {
  source: string | null;
  sourceHandle?: string | null;
  target: string | null;
  targetHandle?: string | null;
};

function edgeDataPort(
  edge: Edge,
  key: "sourcePort" | "targetPort"
): string | undefined {
  const value = edge.data?.[key];
  return typeof value === "string" && value ? value : undefined;
}

export function toFlowNodes(graph: WorkflowGraph): WorkflowFlowNode[] {
  return graph.nodes
    .filter((node) => isWorkflowNodeType(node.type))
    .map((node) => ({
      id: node.id,
      type: "workflowNode",
      position: node.position,
      data: {
        config: cloneConfig(node.config),
        label: node.label,
        model: node.model ?? recommendedModelIdForNodeType(node.type),
        provider: node.provider ?? getWorkflowNodeDefinition(node.type).defaultProvider,
        retention: node.retention,
        type: node.type,
      },
    }));
}

export function toFlowEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: WORKFLOW_CANVAS_OUTPUT_HANDLE_ID,
    target: edge.targetNodeId,
    targetHandle: WORKFLOW_CANVAS_INPUT_HANDLE_ID,
    animated: false,
    data: {
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
    },
    deletable: true,
    type: "bezier",
  }));
}

export function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

export function nextNodeId(type: WorkflowNodeType, nodes: WorkflowFlowNode[]): string {
  const baseId = type.replace(/_/g, "-");
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = 1;

  while (usedIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

export function nextNodePosition(nodes: WorkflowFlowNode[]) {
  const index = Math.max(0, nodes.length - 1);

  return {
    x: 140 + (index % 3) * 300,
    y: 120 + Math.floor(index / 3) * 210,
  };
}

function sanitizeEdgeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

export function nextEdgeId(connection: Connection, edges: Edge[]): string {
  const baseId = [
    connection.source,
    connection.sourceHandle,
    "to",
    connection.target,
    connection.targetHandle,
  ]
    .filter(Boolean)
    .map((value) => sanitizeEdgeIdPart(String(value)))
    .join("-");
  const usedIds = new Set(edges.map((edge) => edge.id));
  let edgeId = baseId;
  let index = 2;

  while (usedIds.has(edgeId)) {
    edgeId = `${baseId}-${index}`;
    index += 1;
  }

  return edgeId;
}

function findPort(
  node: WorkflowFlowNode,
  handleId: string,
  direction: "input" | "output"
): WorkflowPort | null {
  const definition = getWorkflowNodeDefinition(node.data.type);
  const ports = direction === "input" ? definition.inputPorts : definition.outputPorts;

  return ports.find((port) => port.id === handleId) ?? null;
}

function compatibleSourcePortsForTarget(
  sourceNode: WorkflowFlowNode,
  targetPort: WorkflowPort
): WorkflowPort[] {
  const sourceDefinition = getWorkflowNodeDefinition(sourceNode.data.type);
  return sourceDefinition.outputPorts.filter((sourcePort) =>
    portTypesAreCompatible(sourcePort.dataType, targetPort.dataType)
  );
}

function scoreSourceForTarget(sourcePort: WorkflowPort, targetPort: WorkflowPort): number {
  if (sourcePort.id === targetPort.id) return 120;

  const preferredByTargetId: Record<string, string[]> = {
    brand_context: ["json", "analysis", "text", "prompt"],
    caption: ["text", "script", "prompt"],
    context: ["json", "analysis", "text", "prompt", "script"],
    end_frame: ["image", "media", "artifact"],
    image: ["image", "media", "artifact"],
    input: ["post_package", "media", "video", "image", "slideshow", "artifact", "json", "text", "prompt"],
    media: ["media", "video", "image", "audio", "slideshow", "artifact"],
    metadata: ["json", "analysis", "text", "prompt"],
    post_package: ["post_package"],
    prompt: ["prompt", "text", "script", "analysis"],
    reference_image: ["image", "media", "artifact"],
    reference_video: ["video", "media", "artifact"],
    request: ["prompt", "text", "script", "analysis"],
    slide_spec: ["slide_spec"],
    slideshow: ["slideshow"],
    start_frame: ["image", "media", "artifact"],
    text: ["text", "script", "prompt"],
    video: ["video", "media", "artifact"],
  };

  const preferredIds = preferredByTargetId[targetPort.id] ?? [];
  const preferredIndex = preferredIds.indexOf(sourcePort.id);
  if (preferredIndex >= 0) return 100 - preferredIndex;
  if (sourcePort.dataType === targetPort.dataType) return 70;
  if (targetPort.required) return 60;
  return 40;
}

function sourcePortPreferenceScore(
  sourceNode: WorkflowFlowNode,
  sourcePort: WorkflowPort,
  targetPort: WorkflowPort
): number {
  if (sourceNode.data.type === "runner") {
    return sourcePort.id === "run" ? 40 : 0;
  }

  if (sourceNode.data.type === "ai_agent") {
    const agentMode = sourceNode.data.config.agentMode;
    if (
      (targetPort.id === "context" || targetPort.id === "metadata") &&
      sourcePort.id === "json"
    ) {
      return 36;
    }
    if (agentMode === "script_writer") {
      return sourcePort.id === "script" ? 36 : sourcePort.id === "text" ? 28 : 0;
    }
    if (agentMode === "analyze_input") {
      return sourcePort.id === "analysis" ? 36 : sourcePort.id === "json" ? 32 : 0;
    }
    return sourcePort.id === "prompt" ? 36 : sourcePort.id === "text" ? 24 : 0;
  }

  if (sourceNode.data.type === "llm") {
    const responseFormat = sourceNode.data.config.responseFormat;
    if (responseFormat === "json" && sourcePort.id === "json") return 36;
    return sourcePort.id === "text" ? 32 : sourcePort.id === "prompt" ? 24 : 0;
  }

  return 0;
}

function automaticSourcePortForTarget(
  sourceNode: WorkflowFlowNode,
  targetPort: WorkflowPort
): WorkflowPort | null {
  return compatibleSourcePortsForTarget(sourceNode, targetPort)
    .sort(
      (a, b) =>
        scoreSourceForTarget(b, targetPort) +
        sourcePortPreferenceScore(sourceNode, b, targetPort) -
        (scoreSourceForTarget(a, targetPort) +
          sourcePortPreferenceScore(sourceNode, a, targetPort))
    )[0] ?? null;
}

function bestInferredPortPair(
  sourceNode: WorkflowFlowNode,
  targetNode: WorkflowFlowNode
): { sourcePort: WorkflowPort; targetPort: WorkflowPort } | null {
  const sourceDefinition = getWorkflowNodeDefinition(sourceNode.data.type);
  const targetDefinition = getWorkflowNodeDefinition(targetNode.data.type);
  const pairs = sourceDefinition.outputPorts.flatMap((sourcePort) => {
    const targetPort = automaticTargetPortForSource(targetDefinition, sourcePort);
    if (!targetPort) return [];

    return [{
      sourcePort,
      targetPort,
      score:
        scoreSourceForTarget(sourcePort, targetPort) +
        sourcePortPreferenceScore(sourceNode, sourcePort, targetPort),
    }];
  });

  return pairs.sort((a, b) => b.score - a.score)[0] ?? null;
}

function canUseRunnerControlEdge(
  sourceNode: WorkflowFlowNode,
  sourcePort: WorkflowPort,
  targetNode: WorkflowFlowNode
): boolean {
  return sourceNode.data.type === "runner" &&
    sourcePort.id === "run" &&
    targetNode.data.type !== "runner" &&
    targetNode.data.type !== "comment";
}

export function inferCanvasConnectionPorts(
  connection: WorkflowConnection,
  nodes: WorkflowFlowNode[]
): { sourcePort: WorkflowPort; targetPort: WorkflowPort } | null {
  if (!connection.source || !connection.target) return null;

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return null;

  const dataSourcePort =
    "data" in connection && connection.data
      ? edgeDataPort(connection as Edge, "sourcePort")
      : undefined;
  const dataTargetPort =
    "data" in connection && connection.data
      ? edgeDataPort(connection as Edge, "targetPort")
      : undefined;

  const rawSourceHandle = dataSourcePort ?? connection.sourceHandle ?? "";
  const rawTargetHandle = dataTargetPort ?? connection.targetHandle ?? "";
  const sourceHandle =
    rawSourceHandle === WORKFLOW_CANVAS_OUTPUT_HANDLE_ID ? "" : rawSourceHandle;
  const targetHandle =
    rawTargetHandle === WORKFLOW_CANVAS_INPUT_HANDLE_ID ? "" : rawTargetHandle;

  const sourcePort =
    sourceNode.data.type === "runner"
      ? findPort(sourceNode, "run", "output")
      : sourceHandle
        ? findPort(sourceNode, sourceHandle, "output")
        : null;
  const targetPort = targetHandle ? findPort(targetNode, targetHandle, "input") : null;

  if (sourcePort && targetPort) return { sourcePort, targetPort };
  if (sourcePort && canUseRunnerControlEdge(sourceNode, sourcePort, targetNode)) {
    return { sourcePort, targetPort: WORKFLOW_CANVAS_RUN_TARGET_PORT };
  }
  if (sourcePort) {
    const inferredTargetPort = automaticTargetPortForSource(
      getWorkflowNodeDefinition(targetNode.data.type),
      sourcePort
    );
    return inferredTargetPort ? { sourcePort, targetPort: inferredTargetPort } : null;
  }
  if (targetPort) {
    const inferredSourcePort = automaticSourcePortForTarget(sourceNode, targetPort);
    return inferredSourcePort ? { sourcePort: inferredSourcePort, targetPort } : null;
  }

  return bestInferredPortPair(sourceNode, targetNode);
}

function wouldCreateCycle(
  connection: WorkflowConnection,
  edges: Edge[]
): boolean {
  if (!connection.source || !connection.target) return false;
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }

  const sourceTargets = adjacency.get(connection.source) ?? [];
  sourceTargets.push(connection.target);
  adjacency.set(connection.source, sourceTargets);

  const stack = [connection.target];
  const visited = new Set<string>();

  while (stack.length) {
    const nodeId = stack.pop();
    if (!nodeId || visited.has(nodeId)) continue;
    if (nodeId === connection.source) return true;

    visited.add(nodeId);
    stack.push(...(adjacency.get(nodeId) ?? []));
  }

  return false;
}

export function validateCanvasConnection(
  connection: WorkflowConnection,
  nodes: WorkflowFlowNode[],
  edges: Edge[]
): string | null {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return "Connection must start and end on a named port.";
  }
  if (connection.source === connection.target) {
    return "A node cannot connect to itself.";
  }
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return "Connection references a missing node.";

  const inferredPorts = inferCanvasConnectionPorts(connection, nodes);
  const sourcePort = inferredPorts?.sourcePort ?? null;
  if (!sourcePort) return "Connection references an unknown port.";
  const targetPort = inferredPorts?.targetPort ?? null;
  if (!targetPort) return `${sourcePort.label} output cannot map to ${targetNode.data.label}.`;

  const isRunnerControlEdge = sourceNode.data.type === "runner" && sourcePort.id === "run";
  if (!isRunnerControlEdge && !portTypesAreCompatible(sourcePort.dataType, targetPort.dataType)) {
    return `${sourcePort.label} output cannot connect to ${targetPort.label} input.`;
  }
  if (wouldCreateCycle(connection, edges)) {
    return "Connection would create a cycle.";
  }
  if (edges.some((edge) => {
    const edgePorts = inferCanvasConnectionPorts(edge, nodes);
    return edge.source === connection.source &&
      edge.target === connection.target &&
      edgePorts?.sourcePort.id === sourcePort.id &&
      edgePorts?.targetPort.id === targetPort.id;
  })) {
    return "That port connection already exists.";
  }

  return null;
}

export function toWorkflowGraph(
  sourceGraph: WorkflowGraph,
  nodes: WorkflowFlowNode[],
  edges: Edge[]
): WorkflowGraph {
  const sourceNodes = new Map(sourceGraph.nodes.map((node) => [node.id, node]));

  return {
    ...sourceGraph,
    nodes: nodes.map((node) => {
      const definition = getWorkflowNodeDefinition(node.data.type);
      const graphNode: WorkflowNode = {
        id: node.id,
        type: node.data.type,
        label: node.data.label,
        position: node.position,
        config: cloneConfig(node.data.config ?? definition.defaultConfig),
        retention: node.data.retention ?? definition.defaultRetention,
      };

      if (modelCategoryForNodeType(node.data.type)) {
        graphNode.provider = "bulkapis";
      } else if (node.data.provider) {
        graphNode.provider = node.data.provider;
      }
      if (node.data.model) graphNode.model = node.data.model;
      const existingNode = sourceNodes.get(node.id);
      if (existingNode?.inputBindings) graphNode.inputBindings = existingNode.inputBindings;

      return graphNode;
    }),
    edges: edges.map((edge) => {
      const inferredPorts = inferCanvasConnectionPorts(edge, nodes);
      const graphEdge: WorkflowEdge = {
        id: edge.id,
        sourceNodeId: edge.source,
        sourcePort:
          edgeDataPort(edge, "sourcePort") ??
          inferredPorts?.sourcePort.id ??
          String(edge.sourceHandle ?? WORKFLOW_CANVAS_OUTPUT_HANDLE_ID),
        targetNodeId: edge.target,
        targetPort:
          edgeDataPort(edge, "targetPort") ??
          inferredPorts?.targetPort.id ??
          WORKFLOW_CANVAS_INPUT_HANDLE_ID,
      };

      return graphEdge;
    }),
  };
}
