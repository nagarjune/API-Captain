import { useState, useMemo } from "react";
import { GitCompare, ArrowLeftRight, Clock, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RequestHistoryItem } from "@/hooks/useRequestHistory";

interface ResponseDiffDialogProps {
  currentResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  } | null;
  history: RequestHistoryItem[];
}

interface DiffLine {
  type: "same" | "added" | "removed";
  content: string;
  lineNumLeft?: number;
  lineNumRight?: number;
}

function computeDiff(leftLines: string[], rightLines: string[]): DiffLine[] {
  // Simple LCS-based diff
  const m = leftLines.length;
  const n = rightLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m, j = n;
  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      stack.push({ type: "same", content: leftLines[i - 1], lineNumLeft: i, lineNumRight: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "added", content: rightLines[j - 1], lineNumRight: j });
      j--;
    } else {
      stack.push({ type: "removed", content: leftLines[i - 1], lineNumLeft: i });
      i--;
    }
  }
  stack.reverse();
  return stack;
}

function formatJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function StatusBadge({ status, statusText }: { status: number; statusText: string }) {
  const color = status >= 200 && status < 300
    ? "bg-success text-success-foreground"
    : status >= 400
      ? "bg-destructive text-destructive-foreground"
      : "bg-warning text-warning-foreground";
  return <Badge className={cn("font-mono text-xs", color)}>{status} {statusText}</Badge>;
}

export function ResponseDiffDialog({ currentResponse, history }: ResponseDiffDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");

  const historyWithResponses = history.filter((h) => h.response && h.response.body);

  const selectedItem = historyWithResponses.find((h) => h.id === selectedHistoryId);
  const compareResponse = selectedItem?.response ?? null;

  const diffLines = useMemo(() => {
    if (!compareResponse || !currentResponse) return [];
    const leftLines = formatJson(compareResponse.body).split("\n");
    const rightLines = formatJson(currentResponse.body).split("\n");
    return computeDiff(leftLines, rightLines);
  }, [compareResponse, currentResponse]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === "added").length;
    const removed = diffLines.filter((l) => l.type === "removed").length;
    return { added, removed };
  }, [diffLines]);

  if (!currentResponse) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={historyWithResponses.length === 0}>
          <GitCompare className="h-3.5 w-3.5" />
          Diff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Response Diff Comparison
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Compare with (from history)</label>
            <Select value={selectedHistoryId} onValueChange={setSelectedHistoryId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a previous response…" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                {historyWithResponses.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="font-mono text-xs">
                      {item.method} {item.url.length > 50 ? item.url.slice(0, 50) + "…" : item.url}
                      <span className="text-muted-foreground ml-2">
                        ({item.response?.status})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Current response</label>
            <div className="h-9 flex items-center gap-2 px-3 bg-secondary/50 rounded-md border border-border">
              <StatusBadge status={currentResponse.status} statusText={currentResponse.statusText} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {currentResponse.duration}ms
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> {formatSize(new Blob([currentResponse.body]).size)}
              </span>
            </div>
          </div>
        </div>

        {compareResponse ? (
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {/* Stats bar */}
            <div className="flex items-center gap-3 text-xs">
              {compareResponse && (
                <div className="flex items-center gap-2">
                  <StatusBadge status={compareResponse.status} statusText={compareResponse.statusText} />
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {compareResponse.duration}ms
                  </span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-success font-medium">+{stats.added} added</span>
                <span className="text-destructive font-medium">−{stats.removed} removed</span>
              </div>
            </div>

            {/* Diff view */}
            <ScrollArea className="flex-1 rounded-lg border border-[hsl(var(--editor-border))] bg-[hsl(var(--editor-background))]">
              <div className="p-0 font-mono text-xs leading-relaxed">
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      line.type === "added" && "bg-success/10",
                      line.type === "removed" && "bg-destructive/10"
                    )}
                  >
                    <span className={cn(
                      "w-10 text-right pr-2 select-none shrink-0 border-r border-border/30 py-px",
                      line.type === "same" && "text-muted-foreground/40",
                      line.type === "removed" && "text-destructive/60",
                      line.type === "added" && "text-transparent"
                    )}>
                      {line.lineNumLeft ?? ""}
                    </span>
                    <span className={cn(
                      "w-10 text-right pr-2 select-none shrink-0 border-r border-border/30 py-px",
                      line.type === "same" && "text-muted-foreground/40",
                      line.type === "added" && "text-success/60",
                      line.type === "removed" && "text-transparent"
                    )}>
                      {line.lineNumRight ?? ""}
                    </span>
                    <span className={cn(
                      "w-5 text-center select-none shrink-0 py-px",
                      line.type === "added" && "text-success",
                      line.type === "removed" && "text-destructive",
                      line.type === "same" && "text-muted-foreground/30"
                    )}>
                      {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                    </span>
                    <span className={cn(
                      "flex-1 whitespace-pre-wrap px-2 py-px",
                      line.type === "same" && "text-muted-foreground",
                      line.type === "added" && "text-success",
                      line.type === "removed" && "text-destructive"
                    )}>
                      {line.content}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <GitCompare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a previous response from history to compare
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
