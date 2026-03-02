import { Link2, Trash2, Variable } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChainedVariablesPanelProps {
  variables: Record<string, string>;
  onClear: () => void;
  onRemove: (key: string) => void;
}

export function ChainedVariablesPanel({ variables, onClear, onRemove }: ChainedVariablesPanelProps) {
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="bg-secondary/30 border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chained Variables</span>
          <Badge variant="secondary" className="text-xs">
            {entries.length}
          </Badge>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all chained variables</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs text-muted-foreground">
        Set by post-scripts via <code className="bg-secondary px-1 rounded">pm.env.set()</code>. Use <code className="bg-secondary px-1 rounded">{"{{key}}"}</code> in URLs, headers, or body.
      </p>
      <ScrollArea className="max-h-[150px]">
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-2 text-xs font-mono bg-background/50 rounded px-2 py-1.5 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Variable className="h-3 w-3 text-primary shrink-0" />
                <span className="text-foreground font-semibold truncate">{key}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-muted-foreground truncate">{value.length > 40 ? value.slice(0, 40) + "…" : value}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => onRemove(key)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
