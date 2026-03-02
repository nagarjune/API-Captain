import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Import,
  Plus,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { WorkspaceMeta } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface WorkspaceSelectorProps {
  workspace: WorkspaceMeta | null;
  workspaces: WorkspaceMeta[];
  hasDirectorySupport: boolean;
  setupOpen: boolean;
  setSetupOpen: (open: boolean) => void;
  manageOpen: boolean;
  setManageOpen: (open: boolean) => void;
  isSyncing: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createBrowserWorkspace: (name: string) => Promise<void>;
  createFolderWorkspace: (name: string) => Promise<void>;
  openWorkspace: () => Promise<void>;
  importWorkspaceFile: (file: File) => Promise<void>;
  exportWorkspace: () => { filename: string; content: string };
  setGitEnabled: (enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  switchToBrowserWorkspace: () => Promise<void>;
  featureGitEnabled: boolean;
  featureFileExplorerEnabled: boolean;
  featureShowApiCaptainJsonEnabled: boolean;
  compact?: boolean;
  triggerClassName?: string;
}

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function WorkspaceSelector({
  workspace,
  workspaces,
  hasDirectorySupport,
  setupOpen,
  setSetupOpen,
  manageOpen,
  setManageOpen,
  isSyncing,
  switchWorkspace,
  createBrowserWorkspace,
  createFolderWorkspace,
  openWorkspace,
  importWorkspaceFile,
  exportWorkspace,
  setGitEnabled,
  syncNow,
  switchToBrowserWorkspace,
  featureGitEnabled,
  featureFileExplorerEnabled,
  featureShowApiCaptainJsonEnabled,
  compact = false,
  triggerClassName,
}: WorkspaceSelectorProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [isBusy, setIsBusy] = useState(false);

  const runAction = async (action: () => Promise<void>, successTitle: string, successDescription: string) => {
    setIsBusy(true);
    try {
      await action();
      toast({
        title: successTitle,
        description: successDescription,
      });
    } catch (error) {
      toast({
        title: "Workspace Action Failed",
        description: error instanceof Error ? error.message : "Unknown workspace error.",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportWorkspace = () => {
    const payload = exportWorkspace();
    downloadTextFile(payload.filename, payload.content);
    toast({
      title: "Workspace Exported",
      description: `${payload.filename} downloaded.`,
    });
  };

  const gitScript = `git init
git add ${workspace?.collectionsFileName || "collections.json"} .api-captain-workspace.json${featureShowApiCaptainJsonEnabled ? " apicaptain.json" : ""} README.md .gitignore
git commit -m "Track API Captain workspace"`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={compact ? "ghost" : "outline"}
            size="sm"
            className={cn(
              "gap-2 justify-between",
              compact
                ? "h-8 px-2 min-w-0 max-w-[240px] rounded-md border border-transparent hover:border-border/70 hover:bg-background/30 text-zinc-100"
                : "min-w-[170px]",
              triggerClassName
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {!compact && <FolderOpen className="h-4 w-4 text-primary shrink-0" />}
              <span className="truncate">{workspace?.name || "Workspace"}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px]">
          <DropdownMenuLabel>{workspace?.name || "Workspace"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() =>
                runAction(
                  () => switchWorkspace(item.id),
                  "Workspace Switched",
                  `${item.name} is now active.`
                )
              }
              className="justify-between"
              disabled={isBusy}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{item.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {item.storageMode === "folder" ? "Folder" : "Browser"}
                </Badge>
              </div>
              {workspace?.id === item.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-muted-foreground">Workspaces</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              setWorkspaceName("My Workspace");
              setSetupOpen(true);
            }}
            disabled={isBusy}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create workspace
          </DropdownMenuItem>
          {featureFileExplorerEnabled && (
            <DropdownMenuItem
              disabled={!hasDirectorySupport || isBusy}
              onClick={() =>
                runAction(openWorkspace, "Workspace Opened", "Workspace folder was linked and loaded.")
              }
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Open workspace
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => importInputRef.current?.click()}
            disabled={isBusy}
          >
            <Import className="h-4 w-4 mr-2" />
            Import workspace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Manage workspaces
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {featureGitEnabled && (
            <DropdownMenuCheckboxItem
              checked={Boolean(workspace?.gitEnabled)}
              disabled={workspace?.storageMode !== "folder" || isBusy}
              onCheckedChange={(checked) => {
                runAction(
                  () => setGitEnabled(Boolean(checked)),
                  checked ? "Git Storage Enabled" : "Git Storage Disabled",
                  checked
                    ? "Workspace files will be kept Git-friendly."
                    : "Workspace file sync will continue without Git files."
                );
              }}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Store files in Git
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;

          await runAction(
            () => importWorkspaceFile(file),
            "Workspace Imported",
            `${file.name} was imported successfully.`
          );
        }}
      />

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace. Collections will be isolated inside this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace Name</label>
              <Input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="My Workspace"
              />
            </div>
            {!hasDirectorySupport && (
              <p className="text-xs text-amber-400">
                This browser does not support folder picker. Use browser storage or switch to Chromium/Electron.
              </p>
            )}
            {!featureFileExplorerEnabled && (
              <p className="text-xs text-muted-foreground">
                File Explorer feature is disabled in Preferences → Features.
              </p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                runAction(
                  () => createBrowserWorkspace(workspaceName),
                  "Workspace Created",
                  "Using browser storage for this workspace."
                )
              }
              disabled={isBusy}
            >
              Use Browser Storage
            </Button>
            <Button
              className="gap-2"
              variant="hero"
              disabled={!hasDirectorySupport || isBusy || !featureFileExplorerEnabled}
              onClick={() =>
                runAction(
                  () => createFolderWorkspace(workspaceName),
                  "Workspace Created",
                  "Folder workspace linked and ready."
                )
              }
            >
              <FolderPlus className="h-4 w-4" />
              Choose Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="bg-card border-border max-w-xl">
            <DialogHeader>
            <DialogTitle>Manage Workspaces</DialogTitle>
            <DialogDescription>
              Manage the active workspace, storage location, manual sync, and Git-friendly files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-secondary/20 p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Workspace:</span> {workspace?.name || "Workspace"}
              </p>
              <p>
                <span className="text-muted-foreground">Storage:</span>{" "}
                {workspace?.storageMode === "folder" ? "Folder" : "Browser"}
              </p>
              <p>
                <span className="text-muted-foreground">Location:</span>{" "}
                {workspace?.linkedDirectoryName || "Browser local storage"}
              </p>
              <p>
                <span className="text-muted-foreground">Collections file:</span>{" "}
                {workspace?.collectionsFileName || "collections.json"}
              </p>
              {featureShowApiCaptainJsonEnabled && (
                <p>
                  <span className="text-muted-foreground">Config file:</span> apicaptain.json
                </p>
              )}
            </div>

            {featureGitEnabled && (
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Store files in Git</p>
                  <p className="text-xs text-muted-foreground">
                    Generates Git-friendly workspace files in the selected folder.
                  </p>
                </div>
                <Switch
                  checked={Boolean(workspace?.gitEnabled)}
                  disabled={workspace?.storageMode !== "folder" || isBusy}
                  onCheckedChange={(checked) =>
                    runAction(
                      () => setGitEnabled(checked),
                      checked ? "Git Storage Enabled" : "Git Storage Disabled",
                      checked ? "README and .gitignore are updated." : "Git files remain unchanged."
                    )
                  }
                />
              </div>
            )}

            {featureGitEnabled && workspace?.storageMode === "folder" && workspace.gitEnabled && (
              <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Git bootstrap commands</p>
                <pre className="text-xs font-mono whitespace-pre-wrap">{gitScript}</pre>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportWorkspace}
              disabled={isBusy}
            >
              <Download className="h-4 w-4" />
              Export Workspace
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runAction(syncNow, "Workspace Synced", "Collections were saved to workspace files.")
              }
              disabled={workspace?.storageMode !== "folder" || isBusy || isSyncing}
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                runAction(
                  switchToBrowserWorkspace,
                  "Switched to Browser Storage",
                  "Collections now sync to browser storage."
                )
              }
              disabled={isBusy || workspace?.storageMode === "browser"}
            >
              Switch to Browser Storage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
