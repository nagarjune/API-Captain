import { formatDistanceToNow } from "date-fns";
import { Clock, Trash2, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RequestHistoryItem } from "@/hooks/useRequestHistory";

interface RequestHistoryProps {
  history: RequestHistoryItem[];
  onSelect: (item: RequestHistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const methodColors: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-info',
  PUT: 'text-warning',
  PATCH: 'text-warning',
  DELETE: 'text-destructive',
  HEAD: 'text-muted-foreground',
  OPTIONS: 'text-muted-foreground',
};

const statusColors = (status: number) => {
  if (status >= 200 && status < 300) return 'bg-success/20 text-success border-success/30';
  if (status >= 300 && status < 400) return 'bg-info/20 text-info border-info/30';
  if (status >= 400 && status < 500) return 'bg-warning/20 text-warning border-warning/30';
  return 'bg-destructive/20 text-destructive border-destructive/30';
};

export function RequestHistory({ history, onSelect, onRemove, onClear }: RequestHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">No request history yet</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Your requests will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          History
          <Badge variant="secondary" className="text-xs">
            {history.length}
          </Badge>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {history.map((item) => (
            <div
              key={item.id}
              className="group relative border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-secondary/30 transition-colors cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("font-mono font-semibold text-sm", methodColors[item.method])}>
                      {item.method}
                    </span>
                    {item.response && (
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-mono", statusColors(item.response.status))}
                      >
                        {item.response.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground truncate font-mono">
                    {item.url}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    {item.response && (
                      <span className="ml-2">• {item.response.duration}ms</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(item);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
