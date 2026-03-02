import { useState, useRef } from "react";
import { Download, Upload, FileJson, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collection, SavedRequest } from "@/hooks/useCollections";
import { useToast } from "@/hooks/use-toast";

interface ImportExportDialogProps {
  collections: Collection[];
  onImport: (collections: Collection[]) => void;
}

interface PostmanAuthEntry {
  key?: string;
  value?: string;
}

interface PostmanItem {
  name?: string;
  request?: {
    method?: string;
    url?:
      | string
      | { raw?: string; query?: { key?: string; value?: string; disabled?: boolean }[] };
    header?: { key?: string; value?: string; disabled?: boolean }[];
    body?: { mode?: string; raw?: string };
    auth?: {
      type?: string;
      bearer?: PostmanAuthEntry[];
      basic?: PostmanAuthEntry[];
      apikey?: PostmanAuthEntry[];
    };
  };
  item?: PostmanItem[];
}

interface PostmanRequestNode {
  item: PostmanItem;
  folderPath: string[];
}

const normalizeFolderPath = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((segment) => (typeof segment === "string" ? segment.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

function collectPostmanRequests(items: PostmanItem[], currentPath: string[] = []): PostmanRequestNode[] {
  const result: PostmanRequestNode[] = [];
  for (const item of items) {
    if (item.request) {
      result.push({
        item,
        folderPath: [...currentPath],
      });
    }

    if (Array.isArray(item.item) && item.item.length > 0) {
      const folderName = item.name?.trim();
      const nextPath = folderName ? [...currentPath, folderName] : [...currentPath];
      result.push(...collectPostmanRequests(item.item, nextPath));
    }
  }
  return result;
}

function convertPostmanCollection(postman: { info?: { name?: string; description?: string }; item?: PostmanItem[] }): Collection {
  const now = new Date();
  const requestNodes = collectPostmanRequests(postman.item || []);

  const requests = requestNodes.map(({ item, folderPath }): SavedRequest => {
    const req = item.request!;
    const rawUrl = typeof req.url === "string" ? req.url : req.url?.raw || "";
    const queryParams = (typeof req.url === "object" && req.url?.query) || [];
    const headers = (req.header || []).map((h) => ({
      id: crypto.randomUUID(),
      key: h.key || "",
      value: h.value || "",
      enabled: !h.disabled,
    }));

    let authConfig: SavedRequest["auth"] = { type: "none" };
    if (req.auth?.type === "bearer" && req.auth.bearer?.[0]) {
      authConfig = { type: "bearer", bearer: { token: req.auth.bearer[0].value || "" } };
    } else if (req.auth?.type === "basic" && req.auth.basic) {
      const username = req.auth.basic.find((entry) => entry.key === "username")?.value || "";
      const password = req.auth.basic.find((entry) => entry.key === "password")?.value || "";
      authConfig = { type: "basic", basic: { username, password } };
    } else if (req.auth?.type === "apikey" && req.auth.apikey) {
      const key = req.auth.apikey.find((entry) => entry.key === "key")?.value || "";
      const value = req.auth.apikey.find((entry) => entry.key === "value")?.value || "";
      const addTo = req.auth.apikey.find((entry) => entry.key === "in")?.value === "query" ? "query" : "header";
      authConfig = {
        type: "api-key",
        apiKey: {
          key,
          value,
          addTo,
        },
      };
    }

    return {
      id: crypto.randomUUID(),
      name: item.name || "Untitled",
      method: (req.method || "GET").toUpperCase(),
      url: rawUrl,
      folderPath: folderPath.length > 0 ? folderPath : undefined,
      headers,
      queryParams: queryParams.map((q) => ({
        id: crypto.randomUUID(),
        key: q.key || "",
        value: q.value || "",
        enabled: !q.disabled,
      })),
      auth: authConfig,
      body: req.body?.raw || "",
      bodyType: req.body?.mode === "raw" ? "json" : "none",
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    id: crypto.randomUUID(),
    name: postman.info?.name || "Imported Postman Collection",
    description: postman.info?.description || "",
    requests,
    createdAt: now,
    updatedAt: now,
  };
}

export function ImportExportDialog({ collections, onImport }: ImportExportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Collection[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    if (collections.length === 0) {
      toast({
        title: "No collections to export",
        description: "Create some collections first before exporting.",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      collections: collections,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-collections-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Collections exported",
      description: `Successfully exported ${collections.length} collection(s).`,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        let validatedCollections: Collection[];

        // Detect Postman collection format (v2.0 and v2.1)
        if ((parsed.info || parsed._postman_id) && parsed.item && Array.isArray(parsed.item)) {
          validatedCollections = [convertPostmanCollection(parsed)];
        } else if (parsed.collections && Array.isArray(parsed.collections)) {
          // Native format
          validatedCollections = parsed.collections.map(
            (col: Collection) => {
              if (!col.id || !col.name || !Array.isArray(col.requests)) {
                throw new Error(
                  `Invalid collection format: ${col.name || "unknown"}`
                );
              }
              return {
                ...col,
                createdAt: new Date(col.createdAt),
                updatedAt: new Date(col.updatedAt),
                requests: col.requests.map((req) => ({
                  ...req,
                  folderPath: normalizeFolderPath(req.folderPath),
                  createdAt: new Date(req.createdAt),
                  updatedAt: new Date(req.updatedAt),
                })),
              };
            }
          );
        } else {
          throw new Error("Unrecognized file format. Supported: native JSON or Postman Collection v2.1");
        }

        setImportData(validatedCollections);
        setImportError(null);
        setImportDialogOpen(true);
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : "Failed to parse file"
        );
        setImportDialogOpen(true);
      }
    };

    reader.readAsText(file);
    // Reset input so the same file can be selected again
    event.target.value = "";
  };

  const handleImportConfirm = () => {
    if (importData) {
      onImport(importData);
      toast({
        title: "Collections imported",
        description: `Successfully imported ${importData.length} collection(s).`,
      });
    }
    setImportDialogOpen(false);
    setImportData(null);
    setImportError(null);
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setImportData(null);
    setImportError(null);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <FileJson className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Collections
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import Collections
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Import Collections</DialogTitle>
            <DialogDescription>
              {importError
                ? "There was an error parsing the file."
                : "Review the collections to import."}
            </DialogDescription>
          </DialogHeader>

          {importError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          ) : importData ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Found {importData.length} collection(s) to import:
              </p>
              <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                {importData.map((col) => (
                  <li
                    key={col.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                  >
                    <span className="text-sm font-medium">{col.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {col.requests.length} request(s)
                    </span>
                  </li>
                ))}
              </ul>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Imported collections will be added alongside existing ones.
                  Duplicates may occur.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={handleImportCancel}>
              Cancel
            </Button>
            {!importError && importData && (
              <Button onClick={handleImportConfirm}>
                Import {importData.length} Collection(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
