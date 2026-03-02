import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CirclePlay,
  GripVertical,
  ListChecks,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Unlink2,
  Workflow,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Collection } from "@/hooks/useCollections";

const FLOW_STORAGE_KEY_PREFIX = "api-captain-builder-flows-v1";
const ACTIVE_FLOW_KEY_PREFIX = "api-captain-builder-active-flow-v1";
const NODE_WIDTH = 260;
const NODE_HEIGHT = 112;

type NodeType =
  | "manual_trigger"
  | "schedule_trigger"
  | "send_request"
  | "collection_request"
  | "send_graphql"
  | "if_condition"
  | "switch_branch"
  | "for_each"
  | "delay"
  | "parallel"
  | "set_variable"
  | "get_variable"
  | "parse_json"
  | "transform"
  | "extract_jsonpath"
  | "assert_status"
  | "assert_body"
  | "log"
  | "stop";

type FieldType = "text" | "number" | "textarea" | "select";

interface FlowField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

interface FunctionDefinition {
  type: NodeType;
  title: string;
  description: string;
  category: "Trigger" | "API" | "Control" | "Data" | "Assertions" | "Utility";
  input: boolean;
  output: boolean;
  defaults: Record<string, string>;
  fields: FlowField[];
}

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, string>;
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

interface FlowDocument {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: string;
}

interface FlowWorkspaceProps {
  workspaceId: string;
  collections: Collection[];
}

type RunState = "idle" | "running" | "success" | "failed";
type LogLevel = "info" | "success" | "warning" | "error";

interface RunLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

const functionLibrary: FunctionDefinition[] = [
  {
    type: "manual_trigger",
    title: "Manual Trigger",
    description: "Start flow manually from Run.",
    category: "Trigger",
    input: false,
    output: true,
    defaults: {},
    fields: [],
  },
  {
    type: "schedule_trigger",
    title: "Schedule Trigger",
    description: "Run flow on a fixed interval.",
    category: "Trigger",
    input: false,
    output: true,
    defaults: { cron: "0 * * * *" },
    fields: [{ key: "cron", label: "Cron", type: "text", placeholder: "0 * * * *" }],
  },
  {
    type: "send_request",
    title: "Send Request",
    description: "Execute HTTP request from flow.",
    category: "API",
    input: true,
    output: true,
    defaults: { method: "GET", url: "https://api.example.com/users", body: "" },
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
          { label: "PATCH", value: "PATCH" },
          { label: "DELETE", value: "DELETE" },
        ],
      },
      { key: "url", label: "URL", type: "text", placeholder: "https://..." },
      { key: "body", label: "Body", type: "textarea", placeholder: "{ }" },
    ],
  },
  {
    type: "collection_request",
    title: "Collection Request",
    description: "Execute a saved request from Collections.",
    category: "API",
    input: true,
    output: true,
    defaults: { collectionId: "", requestId: "" },
    fields: [],
  },
  {
    type: "send_graphql",
    title: "Send GraphQL",
    description: "Execute GraphQL query/mutation.",
    category: "API",
    input: true,
    output: true,
    defaults: {
      endpoint: "https://api.example.com/graphql",
      query: "query Example { health }",
      variables: "{}",
    },
    fields: [
      { key: "endpoint", label: "Endpoint", type: "text", placeholder: "https://..." },
      { key: "query", label: "Query", type: "textarea", placeholder: "query { ... }" },
      { key: "variables", label: "Variables", type: "textarea", placeholder: "{}" },
    ],
  },
  {
    type: "if_condition",
    title: "If / Else",
    description: "Branch flow on expression result.",
    category: "Control",
    input: true,
    output: true,
    defaults: { expression: "response.status === 200" },
    fields: [
      { key: "expression", label: "Expression", type: "textarea", placeholder: "response.status === 200" },
    ],
  },
  {
    type: "switch_branch",
    title: "Switch",
    description: "Route to branch based on key.",
    category: "Control",
    input: true,
    output: true,
    defaults: { key: "response.status", cases: "200,400,500" },
    fields: [
      { key: "key", label: "Switch Key", type: "text", placeholder: "response.status" },
      { key: "cases", label: "Cases", type: "text", placeholder: "200,400,500" },
    ],
  },
  {
    type: "for_each",
    title: "For Each",
    description: "Iterate through array items.",
    category: "Control",
    input: true,
    output: true,
    defaults: { source: "response.body.items" },
    fields: [{ key: "source", label: "Array Path", type: "text", placeholder: "response.body.items" }],
  },
  {
    type: "parallel",
    title: "Parallel",
    description: "Run connected branches in parallel.",
    category: "Control",
    input: true,
    output: true,
    defaults: { waitForAll: "true" },
    fields: [
      {
        key: "waitForAll",
        label: "Join Strategy",
        type: "select",
        options: [
          { label: "Wait For All", value: "true" },
          { label: "First Completes", value: "false" },
        ],
      },
    ],
  },
  {
    type: "delay",
    title: "Delay",
    description: "Pause flow execution for duration.",
    category: "Control",
    input: true,
    output: true,
    defaults: { ms: "1000" },
    fields: [{ key: "ms", label: "Milliseconds", type: "number", placeholder: "1000" }],
  },
  {
    type: "set_variable",
    title: "Set Variable",
    description: "Set flow-scoped variable.",
    category: "Data",
    input: true,
    output: true,
    defaults: { key: "token", value: "{{response.body.token}}" },
    fields: [
      { key: "key", label: "Key", type: "text", placeholder: "token" },
      { key: "value", label: "Value", type: "text", placeholder: "{{response.body.token}}" },
    ],
  },
  {
    type: "get_variable",
    title: "Get Variable",
    description: "Read variable and map to output.",
    category: "Data",
    input: true,
    output: true,
    defaults: { key: "token", alias: "authToken" },
    fields: [
      { key: "key", label: "Key", type: "text", placeholder: "token" },
      { key: "alias", label: "Alias", type: "text", placeholder: "authToken" },
    ],
  },
  {
    type: "parse_json",
    title: "Parse JSON",
    description: "Parse raw text to JSON object.",
    category: "Data",
    input: true,
    output: true,
    defaults: { source: "response.body" },
    fields: [{ key: "source", label: "Source", type: "text", placeholder: "response.body" }],
  },
  {
    type: "transform",
    title: "Transform Data",
    description: "Map input fields to target shape.",
    category: "Data",
    input: true,
    output: true,
    defaults: { mapping: "{\n  \"id\": \"{{item.id}}\"\n}" },
    fields: [{ key: "mapping", label: "Mapping", type: "textarea", placeholder: "{ }" }],
  },
  {
    type: "extract_jsonpath",
    title: "Extract JSON Path",
    description: "Extract value using JSON path.",
    category: "Data",
    input: true,
    output: true,
    defaults: { path: "$.data.id", target: "userId" },
    fields: [
      { key: "path", label: "Path", type: "text", placeholder: "$.data.id" },
      { key: "target", label: "Target", type: "text", placeholder: "userId" },
    ],
  },
  {
    type: "assert_status",
    title: "Assert Status",
    description: "Check expected status code.",
    category: "Assertions",
    input: true,
    output: true,
    defaults: { expected: "200" },
    fields: [{ key: "expected", label: "Expected Status", type: "number", placeholder: "200" }],
  },
  {
    type: "assert_body",
    title: "Assert Body",
    description: "Validate body expression.",
    category: "Assertions",
    input: true,
    output: true,
    defaults: { expression: "response.body.success === true" },
    fields: [
      { key: "expression", label: "Assertion", type: "textarea", placeholder: "response.body.success === true" },
    ],
  },
  {
    type: "log",
    title: "Log",
    description: "Write value to run output.",
    category: "Utility",
    input: true,
    output: true,
    defaults: { message: "Current response: {{response.status}}" },
    fields: [{ key: "message", label: "Message", type: "textarea", placeholder: "Log message" }],
  },
  {
    type: "stop",
    title: "Stop",
    description: "Terminate flow execution.",
    category: "Utility",
    input: true,
    output: false,
    defaults: {},
    fields: [],
  },
];

const definitionByType = new Map(functionLibrary.map((item) => [item.type, item]));

function makeId(prefix: string) {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${raw}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createStarterFlow(name = "Main Flow"): FlowDocument {
  const startId = makeId("node");
  const stopId = makeId("node");
  return {
    id: makeId("flow"),
    name,
    nodes: [
      {
        id: startId,
        type: "manual_trigger",
        label: "Manual Trigger",
        x: 80,
        y: 120,
        config: {},
      },
      {
        id: stopId,
        type: "stop",
        label: "Stop",
        x: 520,
        y: 120,
        config: {},
      },
    ],
    edges: [{ id: makeId("edge"), from: startId, to: stopId }],
    updatedAt: new Date().toISOString(),
  };
}

const flowsStorageKey = (workspaceId: string) => `${FLOW_STORAGE_KEY_PREFIX}:${workspaceId}`;
const activeFlowStorageKey = (workspaceId: string) => `${ACTIVE_FLOW_KEY_PREFIX}:${workspaceId}`;

function loadFlows(workspaceId: string): FlowDocument[] {
  if (typeof window === "undefined") {
    return [createStarterFlow()];
  }

  try {
    const raw = window.localStorage.getItem(flowsStorageKey(workspaceId));
    if (!raw) return [createStarterFlow()];
    const parsed = JSON.parse(raw) as FlowDocument[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore malformed storage and recover with starter flow.
  }

  return [createStarterFlow()];
}

function loadActiveFlowId(workspaceId: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(activeFlowStorageKey(workspaceId)) || "";
}

function createNode(type: NodeType, x: number, y: number): FlowNode {
  const def = definitionByType.get(type);
  if (!def) {
    throw new Error(`Unknown node type: ${type}`);
  }

  return {
    id: makeId("node"),
    type,
    label: def.title,
    x,
    y,
    config: { ...def.defaults },
  };
}

export function FlowWorkspace({ workspaceId, collections }: FlowWorkspaceProps) {
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowDocument[]>(() => loadFlows(workspaceId));
  const [activeFlowId, setActiveFlowId] = useState<string>(() => loadActiveFlowId(workspaceId));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runFinishedAt, setRunFinishedAt] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const dragStateRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeFlow = useMemo(
    () => flows.find((flow) => flow.id === activeFlowId) ?? flows[0] ?? null,
    [flows, activeFlowId]
  );

  useEffect(() => {
    const nextFlows = loadFlows(workspaceId);
    const storedActiveFlowId = loadActiveFlowId(workspaceId);
    const resolvedActiveFlowId =
      nextFlows.find((flow) => flow.id === storedActiveFlowId)?.id || nextFlows[0]?.id || "";

    setFlows(nextFlows);
    setActiveFlowId(resolvedActiveFlowId);
    setSelectedNodeId(null);
    setConnectingFrom(null);
    setDraggingNodeId(null);
    setRunState("idle");
    setRunStartedAt(null);
    setRunFinishedAt(null);
    setRunLogs([]);
  }, [workspaceId]);

  useEffect(() => {
    if (!activeFlow) return;
    if (activeFlowId !== activeFlow.id) {
      setActiveFlowId(activeFlow.id);
    }
  }, [activeFlow, activeFlowId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(flowsStorageKey(workspaceId), JSON.stringify(flows));
  }, [flows, workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeFlowId) return;
    window.localStorage.setItem(activeFlowStorageKey(workspaceId), activeFlowId);
  }, [activeFlowId, workspaceId]);

  const groupedLibrary = useMemo(() => {
    const groups: Record<string, FunctionDefinition[]> = {};
    functionLibrary.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, FlowNode>();
    activeFlow?.nodes.forEach((node) => {
      map.set(node.id, node);
    });
    return map;
  }, [activeFlow]);

  const selectedNode = useMemo(
    () => activeFlow?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [activeFlow, selectedNodeId]
  );

  const selectedDef = selectedNode ? definitionByType.get(selectedNode.type) ?? null : null;

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedNode?.config.collectionId),
    [collections, selectedNode]
  );

  const selectedCollectionRequest = useMemo(
    () => selectedCollection?.requests.find((request) => request.id === selectedNode?.config.requestId),
    [selectedCollection, selectedNode]
  );

  const pushLog = useCallback(
    (level: LogLevel, message: string, node?: FlowNode) => {
      const entry: RunLogEntry = {
        id: makeId("log"),
        timestamp: new Date().toISOString(),
        level,
        message,
        nodeId: node?.id,
        nodeLabel: node?.label,
      };
      setRunLogs((previous) => [...previous, entry]);
    },
    []
  );

  const updateActiveFlow = useCallback(
    (updater: (flow: FlowDocument) => FlowDocument) => {
      if (!activeFlow) return;
      setFlows((previous) =>
        previous.map((flow) => {
          if (flow.id !== activeFlow.id) return flow;
          const next = updater(flow);
          return {
            ...next,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [activeFlow]
  );

  const addNodeToCanvas = useCallback(
    (type: NodeType, x: number, y: number) => {
      updateActiveFlow((flow) => ({
        ...flow,
        nodes: [
          ...flow.nodes,
          createNode(type, Math.max(24, x), Math.max(24, y)),
        ],
      }));
    },
    [updateActiveFlow]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      updateActiveFlow((flow) => ({
        ...flow,
        nodes: flow.nodes.filter((node) => node.id !== nodeId),
        edges: flow.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      }));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      if (connectingFrom === nodeId) setConnectingFrom(null);
    },
    [updateActiveFlow, selectedNodeId, connectingFrom]
  );

  const updateSelectedNode = useCallback(
    (changes: Partial<FlowNode>) => {
      if (!selectedNode) return;
      updateActiveFlow((flow) => ({
        ...flow,
        nodes: flow.nodes.map((node) =>
          node.id === selectedNode.id ? { ...node, ...changes } : node
        ),
      }));
    },
    [selectedNode, updateActiveFlow]
  );

  const updateSelectedConfig = useCallback(
    (key: string, value: string) => {
      if (!selectedNode) return;
      updateSelectedNode({
        config: {
          ...selectedNode.config,
          [key]: value,
        },
      });
    },
    [selectedNode, updateSelectedNode]
  );

  const onCanvasDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-api-flow-node");
    if (!raw) return;
    const type = raw as NodeType;
    if (!definitionByType.has(type)) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    addNodeToCanvas(type, event.clientX - rect.left - NODE_WIDTH / 2, event.clientY - rect.top - 34);
  };

  const onNodeMouseDown = (event: React.MouseEvent<HTMLDivElement>, node: FlowNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStateRef.current = {
      nodeId: node.id,
      offsetX: event.clientX - rect.left - node.x,
      offsetY: event.clientY - rect.top - node.y,
    };
    setDraggingNodeId(node.id);
    setSelectedNodeId(node.id);
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!dragState || !rect) return;

      const nextX = Math.max(24, event.clientX - rect.left - dragState.offsetX);
      const nextY = Math.max(24, event.clientY - rect.top - dragState.offsetY);

      updateActiveFlow((flow) => ({
        ...flow,
        nodes: flow.nodes.map((node) =>
          node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node
        ),
      }));
    };

    const onMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setDraggingNodeId(null);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [updateActiveFlow]);

  const createFlow = () => {
    const newFlow = createStarterFlow(`Flow ${flows.length + 1}`);
    setFlows((previous) => [...previous, newFlow]);
    setActiveFlowId(newFlow.id);
    setSelectedNodeId(null);
    setConnectingFrom(null);
  };

  const deleteFlow = () => {
    if (!activeFlow || flows.length <= 1) return;
    const next = flows.filter((flow) => flow.id !== activeFlow.id);
    setFlows(next);
    setActiveFlowId(next[0].id);
    setSelectedNodeId(null);
    setConnectingFrom(null);
  };

  const addConnection = (fromNodeId: string, toNodeId: string) => {
    if (!activeFlow || fromNodeId === toNodeId) {
      setConnectingFrom(null);
      return;
    }

    const duplicate = activeFlow.edges.some(
      (edge) => edge.from === fromNodeId && edge.to === toNodeId
    );
    if (!duplicate) {
      updateActiveFlow((flow) => ({
        ...flow,
        edges: [
          ...flow.edges,
          {
            id: makeId("edge"),
            from: fromNodeId,
            to: toNodeId,
          },
        ],
      }));
    }
    setConnectingFrom(null);
  };

  const removeConnection = (edgeId: string) => {
    updateActiveFlow((flow) => ({
      ...flow,
      edges: flow.edges.filter((edge) => edge.id !== edgeId),
    }));
  };

  const saveFlow = () => {
    toast({
      title: "Flow Saved",
      description: "Your flow configuration is saved locally.",
    });
  };

  const clearRunLogs = () => {
    setRunLogs([]);
    setRunState("idle");
    setRunStartedAt(null);
    setRunFinishedAt(null);
  };

  const validateNode = useCallback(
    (node: FlowNode): string | null => {
      switch (node.type) {
        case "send_request":
          if (!node.config.url?.trim()) return "URL is required.";
          if (!node.config.method?.trim()) return "HTTP method is required.";
          return null;
        case "collection_request": {
          const collection = collections.find((item) => item.id === node.config.collectionId);
          if (!collection) return "Collection is not selected.";
          const request = collection.requests.find((item) => item.id === node.config.requestId);
          if (!request) return "Request is not selected.";
          return null;
        }
        case "send_graphql":
          if (!node.config.endpoint?.trim()) return "GraphQL endpoint is required.";
          if (!node.config.query?.trim()) return "GraphQL query is required.";
          return null;
        case "if_condition":
        case "assert_body":
          if (!node.config.expression?.trim()) return "Expression is required.";
          return null;
        case "switch_branch":
          if (!node.config.key?.trim()) return "Switch key is required.";
          return null;
        case "for_each":
          if (!node.config.source?.trim()) return "Array source path is required.";
          return null;
        case "set_variable":
          if (!node.config.key?.trim()) return "Variable key is required.";
          return null;
        case "get_variable":
          if (!node.config.key?.trim()) return "Variable key is required.";
          return null;
        case "extract_jsonpath":
          if (!node.config.path?.trim()) return "JSON path is required.";
          return null;
        case "assert_status": {
          const parsed = Number(node.config.expected);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return "Expected status must be a valid positive number.";
          }
          return null;
        }
        case "delay": {
          const delayMs = Number(node.config.ms);
          if (!Number.isFinite(delayMs) || delayMs < 0) {
            return "Delay must be a valid number >= 0.";
          }
          return null;
        }
        default:
          return null;
      }
    },
    [collections]
  );

  const runFlow = async () => {
    if (!activeFlow || runState === "running") return;

    const flowToRun = activeFlow;
    const startedAt = new Date().toISOString();
    setRunState("running");
    setRunLogs([]);
    setRunStartedAt(startedAt);
    setRunFinishedAt(null);

    pushLog(
      "info",
      `Run started for "${flowToRun.name}" with ${flowToRun.nodes.length} node(s).`
    );

    const triggerNodes = flowToRun.nodes.filter(
      (node) => node.type === "manual_trigger" || node.type === "schedule_trigger"
    );
    if (triggerNodes.length === 0) {
      const finishedAt = new Date().toISOString();
      pushLog("error", "No trigger node found. Add Manual Trigger or Schedule Trigger.");
      setRunState("failed");
      setRunFinishedAt(finishedAt);
      toast({
        title: "Flow Failed",
        description: "No trigger node found in this flow.",
        variant: "destructive",
      });
      return;
    }

    const nodeById = new Map(flowToRun.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    flowToRun.edges.forEach((edge) => {
      const list = outgoing.get(edge.from) || [];
      list.push(edge.to);
      outgoing.set(edge.from, list);
    });

    const queue = triggerNodes.map((node) => node.id);
    const visited = new Set<string>();
    const executionOrder: FlowNode[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodeById.get(nodeId);
      if (!node) continue;
      executionOrder.push(node);

      (outgoing.get(nodeId) || []).forEach((nextNodeId) => {
        if (!visited.has(nextNodeId)) queue.push(nextNodeId);
      });
    }

    const unreachable = flowToRun.nodes.filter((node) => !visited.has(node.id));
    if (unreachable.length > 0) {
      pushLog(
        "warning",
        `${unreachable.length} node(s) are not connected to a trigger and were skipped.`
      );
    }

    let failed = false;

    for (const node of executionOrder) {
      pushLog("info", `Running node "${node.label}"`, node);

      const validationError = validateNode(node);
      if (validationError) {
        pushLog("error", `${node.label}: ${validationError}`, node);
        failed = true;
        break;
      }

      if (node.type === "delay") {
        const configured = Number(node.config.ms || "0");
        const waitMs = Math.min(Math.max(configured, 0), 3000);
        if (configured > waitMs) {
          pushLog(
            "warning",
            `${node.label}: delay capped at ${waitMs}ms for run preview (configured ${configured}ms).`,
            node
          );
        }
        await sleep(waitMs);
      } else {
        await sleep(120);
      }

      pushLog("success", `${node.label} completed.`, node);
    }

    const finishedAt = new Date().toISOString();
    setRunFinishedAt(finishedAt);

    if (failed) {
      setRunState("failed");
      pushLog("error", "Flow execution failed.");
      toast({
        title: "Flow Failed",
        description: "Check run logs for node-level error details.",
        variant: "destructive",
      });
      return;
    }

    setRunState("success");
    pushLog("success", `Flow execution completed successfully (${executionOrder.length} node(s)).`);
    toast({
      title: "Flow Succeeded",
      description: `${executionOrder.length} node(s) executed successfully.`,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Flow Builder</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              runState === "success"
                ? "default"
                : runState === "failed"
                ? "destructive"
                : "secondary"
            }
          >
            {runState === "running"
              ? "Running"
              : runState === "success"
              ? "Success"
              : runState === "failed"
              ? "Failed"
              : "Idle"}
          </Badge>
          <Button variant="outline" size="sm" onClick={createFlow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Flow
          </Button>
          <Button variant="outline" size="sm" onClick={saveFlow} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="hero"
            onClick={runFlow}
            className="gap-1.5"
            disabled={runState === "running"}
          >
            {runState === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CirclePlay className="h-3.5 w-3.5" />
            )}
            {runState === "running" ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-4 h-full">
          <div className="space-y-4 min-h-0">
            <Card className="bg-card-gradient border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Flow Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {flows.map((flow) => (
                  <button
                    key={flow.id}
                    className={cn(
                      "w-full text-left rounded-md px-3 py-2 text-sm border transition-colors",
                      activeFlow?.id === flow.id
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => {
                      setActiveFlowId(flow.id);
                      setSelectedNodeId(null);
                      setConnectingFrom(null);
                    }}
                  >
                    {flow.name}
                  </button>
                ))}
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteFlow}
                    disabled={flows.length <= 1}
                    className="w-full gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Flow
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card-gradient border-border min-h-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Function Palette</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[52vh] pr-3">
                  <div className="space-y-4">
                    {Object.entries(groupedLibrary).map(([category, functions]) => (
                      <div key={category}>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                          {category}
                        </div>
                        <div className="space-y-2">
                          {functions.map((item) => (
                            <div
                              key={item.type}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData("application/x-api-flow-node", item.type);
                                event.dataTransfer.effectAllowed = "copy";
                              }}
                              className="rounded-md border border-border bg-secondary/40 p-2.5 cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium">{item.title}</div>
                                  <div className="text-xs text-muted-foreground">{item.description}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => addNodeToCanvas(item.type, 120, 120)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card-gradient border-border min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  Drag-and-Drop Canvas
                </CardTitle>
                {connectingFrom ? (
                  <Badge variant="secondary" className="gap-1">
                    <Link2 className="h-3 w-3" />
                    Select input node
                  </Badge>
                ) : (
                  <Badge variant="outline">Ready</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={canvasRef}
                className="relative overflow-auto rounded-lg border border-border bg-secondary/20 h-[62vh]"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={onCanvasDrop}
                onClick={() => {
                  setSelectedNodeId(null);
                  setConnectingFrom(null);
                }}
              >
                <div className="absolute inset-0 pointer-events-none opacity-30 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:28px_28px]" />
                <div className="relative min-w-[1400px] min-h-[920px]">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <marker
                        id="edge-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
                      </marker>
                    </defs>
                    {activeFlow?.edges.map((edge) => {
                      const from = nodeMap.get(edge.from);
                      const to = nodeMap.get(edge.to);
                      if (!from || !to) return null;
                      const startX = from.x + NODE_WIDTH;
                      const startY = from.y + NODE_HEIGHT / 2;
                      const endX = to.x;
                      const endY = to.y + NODE_HEIGHT / 2;
                      const bend = Math.max(90, Math.abs(endX - startX) / 2);
                      const path = `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
                      return (
                        <g key={edge.id} className="pointer-events-auto">
                          <path
                            d={path}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeOpacity={0.9}
                            strokeWidth={2}
                            markerEnd="url(#edge-arrow)"
                            className="cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeConnection(edge.id);
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {activeFlow?.nodes.map((node) => {
                    const def = definitionByType.get(node.type);
                    if (!def) return null;
                    const isSelected = node.id === selectedNodeId;
                    const isDragging = node.id === draggingNodeId;
                    const isSource = connectingFrom === node.id;

                    return (
                      <div
                        key={node.id}
                        className={cn(
                          "absolute rounded-lg border bg-card shadow-sm",
                          "transition-shadow",
                          isSelected ? "border-primary ring-1 ring-primary/40" : "border-border",
                          isDragging ? "shadow-lg" : "shadow-none"
                        )}
                        style={{ width: NODE_WIDTH, left: node.x, top: node.y }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNodeId(node.id);
                        }}
                      >
                        {def.input && (
                          <button
                            className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted border border-border hover:border-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (connectingFrom) {
                                addConnection(connectingFrom, node.id);
                              }
                            }}
                            title="Connect to this input"
                          />
                        )}
                        {def.output && (
                          <button
                            className={cn(
                              "absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border hover:border-primary",
                              isSource
                                ? "bg-primary border-primary"
                                : "bg-muted border-border"
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConnectingFrom((prev) => (prev === node.id ? null : node.id));
                            }}
                            title="Start connection from this node"
                          />
                        )}

                        <div
                          className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border cursor-move"
                          onMouseDown={(event) => onNodeMouseDown(event, node)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{node.label}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteNode(node.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                        <div className="px-3 py-2">
                          <div className="text-xs text-muted-foreground">{def.title}</div>
                          <div className="text-xs mt-1 line-clamp-2">{def.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                <Unlink2 className="h-3.5 w-3.5" />
                Click a connector to start linking, then click another node input. Click a line to remove it.
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 min-h-0">
            <Card className="bg-card-gradient border-border min-h-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Node Inspector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 overflow-auto max-h-[52vh]">
                {activeFlow && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Flow Name</label>
                    <Input
                      value={activeFlow.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        updateActiveFlow((flow) => ({ ...flow, name }));
                      }}
                      placeholder="Flow name"
                    />
                  </div>
                )}

                {!selectedNode || !selectedDef ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Select a node to edit its function and configuration.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Node Label</label>
                      <Input
                        value={selectedNode.label}
                        onChange={(event) => updateSelectedNode({ label: event.target.value })}
                        placeholder="Node label"
                      />
                    </div>

                    <div>
                      <Badge variant="secondary">{selectedDef.category}</Badge>
                      <p className="text-xs text-muted-foreground mt-2">{selectedDef.description}</p>
                    </div>

                    {selectedNode.type === "collection_request" ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Collection</label>
                          <Select
                            value={selectedNode.config.collectionId || ""}
                            onValueChange={(nextCollectionId) => {
                              const collection = collections.find((c) => c.id === nextCollectionId);
                              const firstRequestId = collection?.requests[0]?.id || "";
                              updateSelectedNode({
                                config: {
                                  ...selectedNode.config,
                                  collectionId: nextCollectionId,
                                  requestId: firstRequestId,
                                },
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select collection" />
                            </SelectTrigger>
                            <SelectContent>
                              {collections.map((collection) => (
                                <SelectItem key={collection.id} value={collection.id}>
                                  {collection.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Request</label>
                          <Select
                            value={selectedNode.config.requestId || ""}
                            onValueChange={(nextRequestId) => updateSelectedConfig("requestId", nextRequestId)}
                            disabled={!selectedCollection || selectedCollection.requests.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select request" />
                            </SelectTrigger>
                            <SelectContent>
                              {(selectedCollection?.requests || []).map((request) => (
                                <SelectItem key={request.id} value={request.id}>
                                  {request.method} {request.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedCollectionRequest && (
                          <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium text-foreground">Method:</span> {selectedCollectionRequest.method}
                            </div>
                            <div className="break-all">
                              <span className="font-medium text-foreground">URL:</span> {selectedCollectionRequest.url}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : selectedDef.fields.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDef.fields.map((field) => {
                          const value = selectedNode.config[field.key] ?? "";

                          if (field.type === "textarea") {
                            return (
                              <div key={field.key} className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">{field.label}</label>
                                <Textarea
                                  value={value}
                                  placeholder={field.placeholder}
                                  onChange={(event) => updateSelectedConfig(field.key, event.target.value)}
                                  className="min-h-[88px]"
                                />
                              </div>
                            );
                          }

                          if (field.type === "select") {
                            return (
                              <div key={field.key} className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">{field.label}</label>
                                <Select value={value} onValueChange={(next) => updateSelectedConfig(field.key, next)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder={`Select ${field.label}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(field.options || []).map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }

                          return (
                            <div key={field.key} className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">{field.label}</label>
                              <Input
                                type={field.type === "number" ? "number" : "text"}
                                value={value}
                                placeholder={field.placeholder}
                                onChange={(event) => updateSelectedConfig(field.key, event.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                        This function has no configurable fields.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card-gradient border-border min-h-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    Run Logs
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRunLogs}
                    disabled={runLogs.length === 0 && runState === "idle"}
                  >
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        runState === "success"
                          ? "default"
                          : runState === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {runState === "running"
                        ? "Running"
                        : runState === "success"
                        ? "Success"
                        : runState === "failed"
                        ? "Failed"
                        : "Idle"}
                    </Badge>
                  </div>
                  {runStartedAt && (
                    <div className="text-muted-foreground">
                      Started: {new Date(runStartedAt).toLocaleTimeString()}
                    </div>
                  )}
                  {runFinishedAt && (
                    <div className="text-muted-foreground">
                      Finished: {new Date(runFinishedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[220px] pr-2">
                  {runLogs.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No run logs yet. Click Run to execute this flow and see node-level logs.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runLogs.map((log) => (
                        <div key={log.id} className="rounded-md border border-border p-2.5 bg-card">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {log.level === "success" && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              )}
                              {log.level === "error" && (
                                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              {log.level === "warning" && (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              )}
                              {log.level === "info" && (
                                <Workflow className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                              <span className="text-xs font-medium uppercase text-muted-foreground">
                                {log.level}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-xs mt-1">{log.message}</div>
                          {log.nodeLabel && (
                            <div className="text-[11px] mt-1 text-muted-foreground">
                              Node: {log.nodeLabel}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlowWorkspace;
