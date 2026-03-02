import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Clock, FileJson, FileText, List, HardDrive, Braces, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface ResponseViewerProps {
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  } | null;
  isLoading?: boolean;
}

export function ResponseViewer({ response, isLoading }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const isDarkTheme = useIsDarkTheme();

  const copyResponse = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-success text-success-foreground';
    if (status >= 300 && status < 400) return 'bg-info text-info-foreground';
    if (status >= 400 && status < 500) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getDurationColor = (duration: number) => {
    if (duration < 300) return 'text-success';
    if (duration < 1000) return 'text-warning';
    return 'text-destructive';
  };

  const formatBody = (body: string, mode: "formatted" | "raw"): { content: string; language: "json" | "markup" | "text" } => {
    if (mode === "raw") {
      return { content: body, language: "text" };
    }
    
    try {
      const parsed = JSON.parse(body);
      return { content: JSON.stringify(parsed, null, 2), language: "json" };
    } catch {
      // Check if it looks like XML/HTML
      if (body.trim().startsWith("<") && body.trim().endsWith(">")) {
        return { content: body, language: "markup" };
      }
      return { content: body, language: "text" };
    }
  };

  const formattedResponse = formatBody(response?.body || "", viewMode);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground text-sm">Sending request...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <FileJson className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Enter a URL and click Send to see the response
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className={cn("font-mono", getStatusColor(response.status))}>
            {response.status} {response.statusText}
          </Badge>
          <div className={cn("flex items-center gap-1.5 text-sm", getDurationColor(response.duration))}>
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{response.duration}ms</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{formatSize(new Blob([response.body]).size)}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyResponse}
          className="gap-1.5"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      <Tabs defaultValue="body" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="body" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            Headers
            <Badge variant="secondary" className="ml-1 text-xs">
              {Object.keys(response.headers).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="mt-3 space-y-2">
          <div className="flex justify-end">
            <TooltipProvider>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as "formatted" | "raw")}
                className="bg-secondary/50 p-0.5 rounded-md"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="formatted" size="sm" className="gap-1.5 px-2.5 h-7 data-[state=on]:bg-background">
                      <Braces className="h-3.5 w-3.5" />
                      <span className="text-xs">Formatted</span>
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Prettified with syntax highlighting</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="raw" size="sm" className="gap-1.5 px-2.5 h-7 data-[state=on]:bg-background">
                      <AlignLeft className="h-3.5 w-3.5" />
                      <span className="text-xs">Raw</span>
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Original response without formatting</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>
          </div>
          <ScrollArea className="h-[300px] rounded-lg border border-[hsl(var(--editor-border))] bg-[hsl(var(--editor-background))] text-[hsl(var(--editor-foreground))]">
            <Highlight
              theme={isDarkTheme ? themes.nightOwl : themes.nightOwlLight}
              code={formattedResponse.content}
              language={formattedResponse.language}
            >
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  className={cn(className, "p-4 text-sm font-mono whitespace-pre-wrap m-0")}
                  style={{ ...style, background: "transparent" }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="headers" className="mt-3">
          <ScrollArea className="h-[300px] rounded-lg border border-border bg-secondary/30">
            <div className="p-4 space-y-2">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                  <span className="font-mono text-primary font-medium">{key}</span>
                  <span className="font-mono text-muted-foreground break-all">{value}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
