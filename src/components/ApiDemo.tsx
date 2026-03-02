import { useMemo, useState } from "react";
import {
  ArrowDown,
  Braces,
  Cable,
  Database,
  GitBranch,
  Radio,
  ShieldCheck,
  TimerReset,
  Workflow,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

type FlowMode = "http" | "websocket";

interface FlowNode {
  id: string;
  label: string;
  detail: string;
  icon: typeof Workflow;
  optional?: boolean;
}

const httpNodes: FlowNode[] = [
  { id: "validate", label: "Validate Request", detail: "Check URL + method and resolve variables.", icon: Braces },
  { id: "build", label: "Build Headers / Body", detail: "Apply params, auth, and request payload.", icon: ShieldCheck },
  { id: "pre", label: "Run Pre-Script", detail: "Mutate request before dispatch.", icon: Workflow, optional: true },
  { id: "cache-read", label: "Cache Lookup", detail: "Short-circuit with cached response when available.", icon: Database, optional: true },
  { id: "timeout", label: "Timeout Guard", detail: "Attach request timeout with abort controller.", icon: TimerReset, optional: true },
  { id: "send", label: "Execute Network Request", detail: "Send to API endpoint and wait for response.", icon: Cable },
  { id: "retry", label: "Retry Failures", detail: "Retry on transient network/server errors.", icon: GitBranch, optional: true },
  { id: "post", label: "Run Post-Script", detail: "Execute tests and capture chained variables.", icon: Workflow, optional: true },
  { id: "cache-write", label: "Cache Success", detail: "Persist successful responses for reuse.", icon: Database, optional: true },
  { id: "render", label: "Render + Persist History", detail: "Display response and save execution history.", icon: Workflow },
];

const websocketNodes: FlowNode[] = [
  { id: "resolve", label: "Resolve Endpoint", detail: "Build final ws/wss URL from variables.", icon: Braces },
  { id: "connect", label: "Open Connection", detail: "Create and negotiate socket handshake.", icon: Radio },
  { id: "state", label: "Track State", detail: "Observe open/close/error transitions.", icon: Workflow },
  { id: "send", label: "Send Messages", detail: "Publish payloads to active socket.", icon: Cable },
  { id: "receive", label: "Receive Stream", detail: "Process inbound messages/events.", icon: Database },
  { id: "close", label: "Close Session", detail: "Terminate connection cleanly.", icon: ShieldCheck },
];

const ApiDemo = () => {
  const [mode, setMode] = useState<FlowMode>("http");
  const nodes = useMemo(() => (mode === "http" ? httpNodes : websocketNodes), [mode]);

  return (
    <section id="demo" className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Request <span className="text-gradient">Execution Flows</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            End-to-end node maps for HTTP and WebSocket execution, including optional branches.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-card border border-border overflow-hidden glow-accent">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-primary" />
                <span className="font-medium">Flow View</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={mode === "http" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setMode("http")}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  HTTP
                </Button>
                <Button
                  size="sm"
                  variant={mode === "websocket" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setMode("websocket")}
                >
                  <Radio className="h-3.5 w-3.5" />
                  WebSocket
                </Button>
              </div>
            </div>

            <div className="p-4">
              <div className="space-y-1">
                {nodes.map((node, index) => {
                  const Icon = node.icon;
                  return (
                    <div key={node.id}>
                      <div
                        className={cn(
                          "rounded-lg border p-4",
                          node.optional
                            ? "border-dashed border-border bg-secondary/35"
                            : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{node.label}</div>
                              <div className="text-xs text-muted-foreground">{node.detail}</div>
                            </div>
                          </div>
                          <Badge variant={node.optional ? "secondary" : "outline"} className="text-[10px]">
                            {node.optional ? "Optional Node" : "Required Node"}
                          </Badge>
                        </div>
                      </div>
                      {index < nodes.length - 1 && (
                        <div className="h-6 flex items-center justify-center text-muted-foreground">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Showing {nodes.length} nodes in the {mode === "http" ? "HTTP" : "WebSocket"} flow.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ApiDemo;
