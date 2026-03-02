import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Download,
  FileCode2,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ListFilter,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  TerminalSquare,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Collection, SavedRequest } from "@/hooks/useCollections";
import { ImportExportDialog } from "./ImportExportDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400",
  POST: "text-blue-400",
  PUT: "text-amber-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
  HEAD: "text-purple-400",
  OPTIONS: "text-pink-400",
};

interface RequestTreeRequestNode {
  type: "request";
  request: SavedRequest;
  sortIndex: number;
}

interface RequestTreeFolderNode {
  type: "folder";
  name: string;
  key: string;
  requestCount: number;
  children: RequestTreeNode[];
  sortIndex: number;
}

type RequestTreeNode = RequestTreeRequestNode | RequestTreeFolderNode;

interface MutableFolderNode {
  name: string;
  key: string;
  sortIndex: number;
  folders: Map<string, MutableFolderNode>;
  folderOrder: string[];
  requests: Array<{ request: SavedRequest; sortIndex: number }>;
}

const normalizeFolderPath = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((segment) => (typeof segment === "string" ? segment.trim() : ""))
    .filter(Boolean);
};

const encodeFolderPath = (segments: string[]) =>
  segments.map((segment) => encodeURIComponent(segment)).join("/");

const decodeFolderPath = (value: string): string[] =>
  value
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .map((segment) => segment.trim())
    .filter(Boolean);

const createMutableFolderNode = (
  name: string,
  key: string,
  sortIndex: number
): MutableFolderNode => ({
  name,
  key,
  sortIndex,
  folders: new Map(),
  folderOrder: [],
  requests: [],
});

const toImmutableFolderNode = (node: MutableFolderNode): RequestTreeFolderNode => {
  const folderChildren = node.folderOrder
    .map((folderKey) => node.folders.get(folderKey))
    .filter((folder): folder is MutableFolderNode => Boolean(folder))
    .map((folder) => toImmutableFolderNode(folder));

  const requestChildren: RequestTreeRequestNode[] = node.requests.map(({ request, sortIndex }) => ({
    type: "request",
    request,
    sortIndex,
  }));

  const children = [...folderChildren, ...requestChildren].sort((a, b) => a.sortIndex - b.sortIndex);
  const requestCount = requestChildren.length + folderChildren.reduce((total, folder) => total + folder.requestCount, 0);

  return {
    type: "folder",
    name: node.name,
    key: node.key,
    requestCount,
    children,
    sortIndex: node.sortIndex,
  };
};

const buildCollectionRequestTree = (requests: SavedRequest[]): RequestTreeNode[] => {
  const root = createMutableFolderNode("", "", 0);

  requests.forEach((request, index) => {
    const folderPath = normalizeFolderPath(request.folderPath);
    let currentNode = root;
    const traversedPath: string[] = [];

    for (const segment of folderPath) {
      traversedPath.push(segment);
      const key = encodeFolderPath(traversedPath);
      const existingNode = currentNode.folders.get(key);

      if (existingNode) {
        existingNode.sortIndex = Math.min(existingNode.sortIndex, index);
        currentNode = existingNode;
      } else {
        const newNode = createMutableFolderNode(segment, key, index);
        currentNode.folders.set(key, newNode);
        currentNode.folderOrder.push(key);
        currentNode = newNode;
      }
    }

    currentNode.requests.push({ request, sortIndex: index });
  });

  const rootFolders = root.folderOrder
    .map((folderKey) => root.folders.get(folderKey))
    .filter((folder): folder is MutableFolderNode => Boolean(folder))
    .map((folder) => toImmutableFolderNode(folder));

  const rootRequests: RequestTreeRequestNode[] = root.requests.map(({ request, sortIndex }) => ({
    type: "request",
    request,
    sortIndex,
  }));

  return [...rootFolders, ...rootRequests].sort((a, b) => a.sortIndex - b.sortIndex);
};

interface SortableRequestItemProps {
  request: SavedRequest;
  collectionId: string;
  onLoadRequest: (request: SavedRequest) => void;
  onDuplicateRequest: (collectionId: string, requestId: string) => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onEditRequest: (collectionId: string, request: SavedRequest) => void;
}

function SortableRequestItem({
  request,
  collectionId,
  onLoadRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onEditRequest,
}: SortableRequestItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id, data: { collectionId, request } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-lg hover:bg-secondary/50 transition-colors min-w-0",
        isDragging && "opacity-50 bg-secondary/30"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="flex-1 min-w-0 justify-start gap-2 h-8 px-2 overflow-hidden"
        onClick={() => onLoadRequest(request)}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={cn("text-xs font-mono font-medium shrink-0", METHOD_COLORS[request.method])}>
          {request.method}
        </span>
        <span className="truncate text-xs text-left flex-1 min-w-0">{request.name}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => onEditRequest(collectionId, request)}
        title="Edit request"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => onDuplicateRequest(collectionId, request.id)}
        title="Duplicate request"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDeleteRequest(collectionId, request.id)}
        title="Delete request"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface DroppableCollectionProps {
  collection: Collection;
  isExpanded: boolean;
  children: React.ReactNode;
}

function DroppableCollection({ collection, isExpanded, children }: DroppableCollectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `collection-${collection.id}`,
    data: { collectionId: collection.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors rounded-lg",
        isOver && isExpanded && "bg-primary/10 ring-1 ring-primary/30"
      )}
    >
      {children}
    </div>
  );
}

interface RequestDragOverlayProps {
  request: SavedRequest;
}

function RequestDragOverlay({ request }: RequestDragOverlayProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-card border border-border shadow-lg px-3 py-2 max-w-[340px]">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className={cn("text-xs font-mono font-medium shrink-0", METHOD_COLORS[request.method])}>
        {request.method}
      </span>
      <span className="text-xs truncate">{request.name}</span>
    </div>
  );
}

export interface CurrentRequestConfig {
  method: string;
  url: string;
  headers: SavedRequest['headers'];
  queryParams: SavedRequest['queryParams'];
  auth: SavedRequest['auth'];
  body: string;
  bodyType: SavedRequest['bodyType'];
  graphqlQuery?: string;
  graphqlVariables?: string;
}

interface CollectionsPanelProps {
  collections: Collection[];
  onAddCollection: (name: string, description: string) => Collection;
  onUpdateCollection: (id: string, name: string, description: string) => void;
  onDeleteCollection: (id: string) => void;
  onAddRequestToCollection: (
    collectionId: string,
    request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onLoadRequest: (request: SavedRequest) => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onImportCollections: (collections: Collection[]) => void;
  onDuplicateRequest: (collectionId: string, requestId: string) => void;
  onDuplicateCollection: (collectionId: string) => Collection | null;
  onReorderRequests: (collectionId: string, oldIndex: number, newIndex: number) => void;
  onMoveRequest: (sourceCollectionId: string, targetCollectionId: string, requestId: string, targetIndex?: number) => void;
  onUpdateRequest: (collectionId: string, requestId: string, updates: Partial<Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  currentConfig: CurrentRequestConfig;
}

type RunnerStage = "setup" | "running" | "completed";
type RunnerFilter = "all" | "passed" | "failed" | "skipped";
type RunnerStatus = "queued" | "running" | "passed" | "failed" | "skipped" | "cancelled";

interface CollectionRunResult {
  id: string;
  requestId: string;
  requestName: string;
  method: string;
  url: string;
  iteration: number;
  runnerStatus: RunnerStatus;
  status: number;
  statusText: string;
  duration: number;
  success: boolean;
  error?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  startedAt?: string;
  finishedAt?: string;
}

export function CollectionsPanel({
  collections,
  onAddCollection,
  onUpdateCollection,
  onDeleteCollection,
  onAddRequestToCollection,
  onLoadRequest,
  onDeleteRequest,
  onImportCollections,
  onDuplicateRequest,
  onDuplicateCollection,
  onReorderRequests,
  onMoveRequest,
  onUpdateRequest,
  currentConfig,
}: CollectionsPanelProps) {
  const { toast } = useToast();
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [collapsedFolderKeys, setCollapsedFolderKeys] = useState<Set<string>>(new Set());
  const [activeRequest, setActiveRequest] = useState<{ request: SavedRequest; collectionId: string } | null>(null);
  const [editingRequest, setEditingRequest] = useState<{ request: SavedRequest; collectionId: string } | null>(null);
  const [editRequestName, setEditRequestName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [targetCollection, setTargetCollection] = useState<Collection | null>(null);
  const [targetFolderPath, setTargetFolderPath] = useState<string[] | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequestName, setNewRequestName] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newJsFileOpen, setNewJsFileOpen] = useState(false);
  const [newJsFileName, setNewJsFileName] = useState("");
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [folderRenameCollection, setFolderRenameCollection] = useState<Collection | null>(null);
  const [folderRenamePath, setFolderRenamePath] = useState<string[]>([]);
  const [folderRenameName, setFolderRenameName] = useState("");
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runningCollectionId, setRunningCollectionId] = useState<string | null>(null);
  const [runnerCollection, setRunnerCollection] = useState<Collection | null>(null);
  const [runnerStage, setRunnerStage] = useState<RunnerStage>("setup");
  const [runnerDelayMs, setRunnerDelayMs] = useState(0);
  const [runnerIterations, setRunnerIterations] = useState(1);
  const [runnerTagFilterEnabled, setRunnerTagFilterEnabled] = useState(false);
  const [runnerConfigureRequests, setRunnerConfigureRequests] = useState(false);
  const [runnerSelectedRequestIds, setRunnerSelectedRequestIds] = useState<Set<string>>(new Set());
  const [runnerDataFileName, setRunnerDataFileName] = useState("");
  const [runnerDataRows, setRunnerDataRows] = useState<Record<string, string>[]>([]);
  const [runnerFilter, setRunnerFilter] = useState<RunnerFilter>("all");
  const [runnerSelectedResultId, setRunnerSelectedResultId] = useState<string | null>(null);
  const runnerAbortRef = useRef<AbortController | null>(null);
  const runnerFileInputRef = useRef<HTMLInputElement>(null);
  const [runCollectionName, setRunCollectionName] = useState("");
  const [runResults, setRunResults] = useState<CollectionRunResult[]>([]);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactContent, setArtifactContent] = useState("");
  const [artifactFileName, setArtifactFileName] = useState("collection-output.txt");
  const [artifactMimeType, setArtifactMimeType] = useState("text/plain");
  const [settingsCollection, setSettingsCollection] = useState<Collection | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");

  // Search results across all collections
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    const results: { collection: Collection; request: SavedRequest }[] = [];
    
    collections.forEach((collection) => {
      collection.requests.forEach((request) => {
        const matchesName = request.name.toLowerCase().includes(query);
        const matchesUrl = request.url.toLowerCase().includes(query);
        const matchesMethod = request.method.toLowerCase().includes(query);
        
        if (matchesName || matchesUrl || matchesMethod) {
          results.push({ collection, request });
        }
      });
    });
    
    return results;
  }, [collections, searchQuery]);

  const runnerSummary = useMemo(() => {
    const passed = runResults.filter((item) => item.runnerStatus === "passed").length;
    const failed = runResults.filter(
      (item) => item.runnerStatus === "failed" || item.runnerStatus === "cancelled"
    ).length;
    const skipped = runResults.filter((item) => item.runnerStatus === "skipped").length;
    return {
      all: runResults.length,
      passed,
      failed,
      skipped,
    };
  }, [runResults]);

  const filteredRunResults = useMemo(() => {
    if (runnerFilter === "all") return runResults;
    if (runnerFilter === "passed") {
      return runResults.filter((item) => item.runnerStatus === "passed");
    }
    if (runnerFilter === "failed") {
      return runResults.filter(
        (item) => item.runnerStatus === "failed" || item.runnerStatus === "cancelled"
      );
    }
    return runResults.filter((item) => item.runnerStatus === "skipped");
  }, [runResults, runnerFilter]);

  const runnerSelectedResult = useMemo(
    () => runResults.find((item) => item.id === runnerSelectedResultId) ?? null,
    [runResults, runnerSelectedResultId]
  );

  const selectedRunnerRequests = useMemo(() => {
    if (!runnerCollection) return [];
    return runnerCollection.requests.filter((request) => runnerSelectedRequestIds.has(request.id));
  }, [runnerCollection, runnerSelectedRequestIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    onAddCollection(newCollectionName.trim(), newCollectionDescription.trim());
    setNewCollectionName("");
    setNewCollectionDescription("");
    setNewCollectionOpen(false);
  };

  const handleUpdateCollection = () => {
    if (!editingCollection || !newCollectionName.trim()) return;
    onUpdateCollection(
      editingCollection.id,
      newCollectionName.trim(),
      newCollectionDescription.trim()
    );
    setEditingCollection(null);
    setNewCollectionName("");
    setNewCollectionDescription("");
  };

  const openEditDialog = (collection: Collection) => {
    setEditingCollection(collection);
    setNewCollectionName(collection.name);
    setNewCollectionDescription(collection.description);
  };

  const openEditRequestDialog = (collectionId: string, request: SavedRequest) => {
    setEditingRequest({ request, collectionId });
    setEditRequestName(request.name);
  };

  const handleRenameRequest = () => {
    if (!editingRequest || !editRequestName.trim()) return;
    onUpdateRequest(editingRequest.collectionId, editingRequest.request.id, {
      name: editRequestName.trim(),
    });
    setEditingRequest(null);
    setEditRequestName("");
  };

  const handleUpdateRequestConfig = () => {
    if (!editingRequest) return;
    onUpdateRequest(editingRequest.collectionId, editingRequest.request.id, {
      name: editRequestName.trim() || editingRequest.request.name,
      method: currentConfig.method,
      url: currentConfig.url,
      headers: currentConfig.headers,
      queryParams: currentConfig.queryParams,
      auth: currentConfig.auth,
      body: currentConfig.body,
      bodyType: currentConfig.bodyType,
      graphqlQuery: currentConfig.graphqlQuery,
      graphqlVariables: currentConfig.graphqlVariables,
    });
    setEditingRequest(null);
    setEditRequestName("");
  };

  const openNewRequestDialog = (collection: Collection, folderPath?: string[]) => {
    setTargetCollection(collection);
    setTargetFolderPath(folderPath ?? null);
    setNewRequestName(`New Request ${collection.requests.length + 1}`);
    setNewRequestOpen(true);
  };

  const openNewFolderDialog = (collection: Collection, folderPath?: string[]) => {
    setTargetCollection(collection);
    setTargetFolderPath(folderPath ?? null);
    setNewFolderName("");
    setNewFolderOpen(true);
  };

  const openNewJsFileDialog = (collection: Collection, folderPath?: string[]) => {
    setTargetCollection(collection);
    setTargetFolderPath(folderPath ?? null);
    setNewJsFileName("script");
    setNewJsFileOpen(true);
  };

  const openRenameFolderDialog = (collection: Collection, folderPath: string[]) => {
    if (folderPath.length === 0) return;
    setFolderRenameCollection(collection);
    setFolderRenamePath(folderPath);
    setFolderRenameName(folderPath[folderPath.length - 1] || "Folder");
    setRenameFolderOpen(true);
  };

  const openCollectionSettings = (collection: Collection) => {
    setSettingsCollection(collection);
    setSettingsName(collection.name);
    setSettingsDescription(collection.description);
  };

  const closeTargetDialogs = () => {
    setTargetCollection(null);
    setTargetFolderPath(null);
    setNewRequestOpen(false);
    setNewFolderOpen(false);
    setNewJsFileOpen(false);
  };

  const ensureFileExtension = (name: string, extension: string) => {
    const trimmed = name.trim();
    if (!trimmed) return extension.startsWith(".") ? `file${extension}` : `file.${extension}`;
    if (trimmed.toLowerCase().endsWith(extension.toLowerCase())) return trimmed;
    return `${trimmed}${extension}`;
  };

  const createEmptyRequest = (name: string): Omit<SavedRequest, "id" | "createdAt" | "updatedAt"> => ({
    name,
    method: "GET",
    url: "",
    headers: [],
    queryParams: [],
    auth: { type: "none" },
    body: "",
    bodyType: "none",
    graphqlQuery: "",
    graphqlVariables: "",
  });

  const isRequestInFolder = (request: SavedRequest, folderPath: string[]) => {
    const requestPath = normalizeFolderPath(request.folderPath);
    if (!requestPath || requestPath.length < folderPath.length) return false;
    return folderPath.every((segment, index) => requestPath[index] === segment);
  };

  const getFolderRequests = (collection: Collection, folderPath: string[]) =>
    collection.requests.filter((request) => isRequestInFolder(request, folderPath));

  const handleCreateRequest = () => {
    if (!targetCollection || !newRequestName.trim()) return;
    onAddRequestToCollection(targetCollection.id, {
      ...createEmptyRequest(newRequestName.trim()),
      folderPath: targetFolderPath || undefined,
    });
    setExpandedCollections((prev) => new Set([...prev, targetCollection.id]));
    toast({
      title: "Request Created",
      description: `"${newRequestName.trim()}" was added to ${targetCollection.name}.`,
    });
    closeTargetDialogs();
    setNewRequestName("");
  };

  const handleCreateJsFile = () => {
    if (!targetCollection || !newJsFileName.trim()) return;
    const fileName = ensureFileExtension(newJsFileName, ".js");
    onAddRequestToCollection(targetCollection.id, {
      ...createEmptyRequest(fileName),
      folderPath: targetFolderPath || undefined,
      bodyType: "text",
      body: [
        "// Collection script file",
        "// Update and attach this script to requests as needed.",
        "",
        "console.log('API Captain script');",
      ].join("\n"),
    });
    setExpandedCollections((prev) => new Set([...prev, targetCollection.id]));
    toast({
      title: "JS File Added",
      description: `${fileName} was added to ${targetCollection.name}.`,
    });
    closeTargetDialogs();
    setNewJsFileName("");
  };

  const handleCreateFolder = () => {
    if (!targetCollection || !newFolderName.trim()) return;
    if (targetFolderPath && targetFolderPath.length > 0) {
      const nestedPath = [...targetFolderPath, newFolderName.trim()];
      onAddRequestToCollection(targetCollection.id, {
        ...createEmptyRequest("New Request 1"),
        folderPath: nestedPath,
      });
      setExpandedCollections((prev) => new Set([...prev, targetCollection.id]));
      nestedPath.forEach((_, index) => {
        const key = encodeFolderPath(nestedPath.slice(0, index + 1));
        setFolderExpanded(targetCollection.id, key, true);
      });
      toast({
        title: "Folder Created",
        description: `Created folder "${newFolderName.trim()}" with a starter request.`,
      });
      closeTargetDialogs();
      setNewFolderName("");
      return;
    }

    const folderCollection = onAddCollection(
      `${targetCollection.name} / ${newFolderName.trim()}`,
      `Folder created from ${targetCollection.name}`
    );
    setExpandedCollections((prev) => new Set([...prev, folderCollection.id]));
    toast({
      title: "Folder Created",
      description: `Created folder "${newFolderName.trim()}" as a sub-collection.`,
    });
    closeTargetDialogs();
    setNewFolderName("");
  };

  const handleRenameFolder = () => {
    if (!folderRenameCollection || folderRenamePath.length === 0 || !folderRenameName.trim()) return;
    const currentSegment = folderRenamePath[folderRenamePath.length - 1];
    const nextSegment = folderRenameName.trim();
    if (currentSegment === nextSegment) {
      setFolderRenameCollection(null);
      setFolderRenamePath([]);
      setFolderRenameName("");
      setRenameFolderOpen(false);
      return;
    }

    const sourcePrefix = folderRenamePath;
    const targetPrefix = [...folderRenamePath.slice(0, -1), nextSegment];
    const folderRequests = getFolderRequests(folderRenameCollection, sourcePrefix);

    folderRequests.forEach((request) => {
      const requestPath = normalizeFolderPath(request.folderPath) || [];
      const suffix = requestPath.slice(sourcePrefix.length);
      onUpdateRequest(folderRenameCollection.id, request.id, {
        folderPath: [...targetPrefix, ...suffix],
      });
    });

    toast({
      title: "Folder Renamed",
      description: `Renamed "${currentSegment}" to "${nextSegment}".`,
    });
    setFolderRenameCollection(null);
    setFolderRenamePath([]);
    setFolderRenameName("");
    setRenameFolderOpen(false);
  };

  const sanitizeFileName = (value: string) =>
    value
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "collection";

  const downloadTextFile = (fileName: string, content: string, mimeType = "text/plain") => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const openArtifactDialog = (title: string, content: string, fileName: string, mimeType = "text/plain") => {
    setArtifactTitle(title);
    setArtifactContent(content);
    setArtifactFileName(fileName);
    setArtifactMimeType(mimeType);
    setArtifactDialogOpen(true);
  };

  const applyRunnerVariables = (value: string, row?: Record<string, string>) => {
    if (!value) return value;
    if (!row || Object.keys(row).length === 0) return value;

    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (full, key: string) => {
      const matchKey = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());
      return matchKey ? row[matchKey] : full;
    });
  };

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }
    values.push(current.trim());
    return values;
  };

  const parseCsvRows = (raw: string) => {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = cells[index] ?? "";
        return row;
      }, {});
    });
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const resetRunnerConfiguration = (collection: Collection) => {
    setRunnerDelayMs(0);
    setRunnerIterations(1);
    setRunnerTagFilterEnabled(false);
    setRunnerConfigureRequests(false);
    setRunnerDataFileName("");
    setRunnerDataRows([]);
    setRunnerSelectedRequestIds(new Set(collection.requests.map((request) => request.id)));
  };

  const handleRunnerDataFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      let rows: Record<string, string>[] = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("JSON file must be an array of objects.");
        }
        rows = parsed.map((item) => {
          if (!item || typeof item !== "object") {
            throw new Error("Each JSON item must be an object.");
          }
          return Object.entries(item as Record<string, unknown>).reduce<Record<string, string>>(
            (result, [key, value]) => {
              result[key] = value == null ? "" : String(value);
              return result;
            },
            {}
          );
        });
      } else {
        rows = parseCsvRows(raw);
      }

      if (rows.length === 0) {
        throw new Error("No data rows found in uploaded file.");
      }

      setRunnerDataRows(rows);
      setRunnerDataFileName(file.name);
      toast({
        title: "Runner Data Loaded",
        description: `${rows.length} row(s) loaded from ${file.name}.`,
      });
    } catch (error) {
      toast({
        title: "Data File Error",
        description: error instanceof Error ? error.message : "Invalid CSV/JSON file.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const openRunner = (
    collection: Collection,
    options?: { requestIds?: string[]; label?: string }
  ) => {
    const requestIds = options?.requestIds;
    const scopedRequests =
      requestIds && requestIds.length > 0
        ? collection.requests.filter((request) => requestIds.includes(request.id))
        : collection.requests;

    if (scopedRequests.length === 0) {
      toast({
        title: "Nothing to Run",
        description:
          requestIds && requestIds.length > 0
            ? "No runnable requests found in this folder."
            : "This collection has no saved requests.",
        variant: "destructive",
      });
      return;
    }

    setRunnerCollection(collection);
    setRunCollectionName(options?.label || collection.name);
    setRunResults([]);
    setRunnerFilter("all");
    setRunnerSelectedResultId(null);
    setRunnerStage("setup");
    setRunDialogOpen(true);
    resetRunnerConfiguration(collection);
    if (requestIds && requestIds.length > 0) {
      setRunnerConfigureRequests(true);
      setRunnerSelectedRequestIds(new Set(requestIds));
    }
  };

  const cancelRunnerExecution = () => {
    runnerAbortRef.current?.abort();
  };

  const buildRequestUrl = (request: SavedRequest, row?: Record<string, string>) => {
    let finalUrl = applyRunnerVariables(request.url.trim(), row);
    if (!finalUrl) return "";

    const enabledParams = request.queryParams.filter((param) => param.enabled && param.key.trim());
    if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map(
          (param) =>
            `${encodeURIComponent(applyRunnerVariables(param.key, row))}=${encodeURIComponent(
              applyRunnerVariables(param.value, row)
            )}`
        )
        .join("&");
      finalUrl += finalUrl.includes("?") ? `&${queryString}` : `?${queryString}`;
    }

    if (request.auth.type === "api-key" && request.auth.apiKey?.addTo === "query" && request.auth.apiKey.key) {
      const suffix = `${encodeURIComponent(applyRunnerVariables(request.auth.apiKey.key, row))}=${encodeURIComponent(
        applyRunnerVariables(request.auth.apiKey.value || "", row)
      )}`;
      finalUrl += finalUrl.includes("?") ? `&${suffix}` : `?${suffix}`;
    }

    return finalUrl;
  };

  const buildRequestHeaders = (request: SavedRequest, row?: Record<string, string>) => {
    const headers: Record<string, string> = {};
    request.headers
      .filter((header) => header.enabled && header.key.trim())
      .forEach((header) => {
        headers[applyRunnerVariables(header.key, row)] = applyRunnerVariables(header.value, row);
      });

    if (request.auth.type === "bearer" && request.auth.bearer?.token) {
      headers.Authorization = `Bearer ${applyRunnerVariables(request.auth.bearer.token, row)}`;
    } else if (request.auth.type === "basic" && request.auth.basic?.username) {
      headers.Authorization = `Basic ${btoa(
        `${applyRunnerVariables(request.auth.basic.username, row)}:${applyRunnerVariables(
          request.auth.basic.password || "",
          row
        )}`
      )}`;
    } else if (
      request.auth.type === "api-key" &&
      request.auth.apiKey?.addTo === "header" &&
      request.auth.apiKey.key
    ) {
      headers[applyRunnerVariables(request.auth.apiKey.key, row)] = applyRunnerVariables(
        request.auth.apiKey.value || "",
        row
      );
    }

    return headers;
  };

  const buildRequestBody = (request: SavedRequest, row?: Record<string, string>) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return undefined;
    if (request.bodyType === "none") return undefined;

    if (request.bodyType === "graphql") {
      const payload: { query: string; variables?: unknown } = {
        query: applyRunnerVariables(request.graphqlQuery || request.body || "", row),
      };
      if (request.graphqlVariables?.trim()) {
        const rawVariables = applyRunnerVariables(request.graphqlVariables, row);
        try {
          payload.variables = JSON.parse(rawVariables);
        } catch {
          payload.variables = rawVariables;
        }
      }
      return JSON.stringify(payload);
    }

    return applyRunnerVariables(request.body || "", row) || undefined;
  };

  const requestToCurl = (request: SavedRequest) => {
    const url = buildRequestUrl(request) || request.url || "https://api.example.com";
    const headers = buildRequestHeaders(request);
    const body = buildRequestBody(request);
    const headerArgs = Object.entries(headers)
      .map(([key, value]) => `  -H '${key.replace(/'/g, "'\\''")}: ${value.replace(/'/g, "'\\''")}'`)
      .join(" \\\n");

    const dataArg = typeof body === "string" && body
      ? ` \\\n  --data '${body.replace(/'/g, "'\\''")}'`
      : "";

    return [
      `# ${request.name}`,
      `curl -X ${request.method} '${url.replace(/'/g, "'\\''")}'${headerArgs ? ` \\\n${headerArgs}` : ""}${dataArg}`,
    ].join("\n");
  };

  const buildScopeLabel = (collection: Collection, folderPath?: string[]) =>
    folderPath && folderPath.length > 0
      ? `${collection.name} / ${folderPath.join(" / ")}`
      : collection.name;

  const shareRequestScope = async (
    scopeName: string,
    description: string,
    requests: SavedRequest[],
    fallbackFileName: string
  ) => {
    const payload = JSON.stringify(
      {
        name: scopeName,
        description,
        requests,
      },
      null,
      2
    );

    const copied = await copyToClipboard(payload);
    if (copied) {
      toast({
        title: "Scope Shared",
        description: "Scope JSON copied to clipboard.",
      });
      return;
    }

    downloadTextFile(fallbackFileName, payload, "application/json");
    toast({
      title: "Share Export Downloaded",
      description: "Clipboard unavailable, downloaded share JSON instead.",
    });
  };

  const generateDocsForScope = (scopeName: string, description: string, requests: SavedRequest[]) => {
    const markdown = [
      `# ${scopeName}`,
      "",
      description || "_No description provided._",
      "",
      `Total requests: ${requests.length}`,
      "",
      "## Requests",
      "",
      ...requests.flatMap((request, index) => {
        const sections = [
          `### ${index + 1}. ${request.name}`,
          `- Method: \`${request.method}\``,
          `- URL: \`${request.url || "(empty)"}\``,
        ];
        if (request.body && request.bodyType !== "none") {
          sections.push("- Body:");
          sections.push("```");
          sections.push(request.body);
          sections.push("```");
        }
        sections.push("");
        return sections;
      }),
    ].join("\n");

    openArtifactDialog(
      `Generated Docs: ${scopeName}`,
      markdown,
      `${sanitizeFileName(scopeName)}-docs.md`,
      "text/markdown"
    );
  };

  const revealScopeInFinder = (scopeName: string, description: string, requests: SavedRequest[]) => {
    const payload = JSON.stringify(
      {
        name: scopeName,
        description,
        requests,
      },
      null,
      2
    );
    downloadTextFile(`${sanitizeFileName(scopeName)}.json`, payload, "application/json");
    toast({
      title: "Scope Exported",
      description: "Downloaded scope JSON (Finder reveal equivalent in web mode).",
    });
  };

  const openScopeInTerminal = async (scopeName: string, requests: SavedRequest[]) => {
    const script = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "",
      `# ${scopeName}`,
      "",
      ...requests.flatMap((request) => [requestToCurl(request), ""]),
    ].join("\n");

    const copied = await copyToClipboard(script);
    openArtifactDialog(
      `Terminal Script: ${scopeName}`,
      script,
      `${sanitizeFileName(scopeName)}.sh`,
      "text/x-shellscript"
    );
    toast({
      title: "Terminal Script Ready",
      description: copied ? "Shell script copied to clipboard." : "Copy the script from the preview dialog.",
    });
  };

  const handleShareCollection = async (collection: Collection) => {
    await shareRequestScope(
      collection.name,
      collection.description,
      collection.requests,
      `${sanitizeFileName(collection.name)}-share.json`
    );
  };

  const handleShareFolder = async (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) {
      toast({
        title: "Nothing to Share",
        description: "This folder has no requests.",
        variant: "destructive",
      });
      return;
    }
    const scopeName = buildScopeLabel(collection, folderPath);
    await shareRequestScope(
      scopeName,
      `Folder from ${collection.name}`,
      requests,
      `${sanitizeFileName(scopeName)}-share.json`
    );
  };

  const handleGenerateDocs = (collection: Collection) => {
    generateDocsForScope(collection.name, collection.description, collection.requests);
  };

  const handleGenerateFolderDocs = (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) {
      toast({
        title: "Nothing to Document",
        description: "This folder has no requests.",
        variant: "destructive",
      });
      return;
    }
    generateDocsForScope(buildScopeLabel(collection, folderPath), `Folder from ${collection.name}`, requests);
  };

  const handleCollapseCollection = (collectionId: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      next.delete(collectionId);
      return next;
    });
  };

  const handleCollapseFolder = (collectionId: string, folderPath: string[]) => {
    setFolderExpanded(collectionId, encodeFolderPath(folderPath), false);
  };

  const handleRevealInFinder = (collection: Collection) => {
    revealScopeInFinder(collection.name, collection.description, collection.requests);
  };

  const handleRevealFolderInFinder = (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) {
      toast({
        title: "Nothing to Reveal",
        description: "This folder has no requests.",
        variant: "destructive",
      });
      return;
    }
    revealScopeInFinder(buildScopeLabel(collection, folderPath), `Folder from ${collection.name}`, requests);
  };

  const handleOpenInTerminal = async (collection: Collection) => {
    await openScopeInTerminal(collection.name, collection.requests);
  };

  const handleOpenFolderInTerminal = async (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) {
      toast({
        title: "Nothing to Open",
        description: "This folder has no requests.",
        variant: "destructive",
      });
      return;
    }
    await openScopeInTerminal(buildScopeLabel(collection, folderPath), requests);
  };

  const handleRunFolder = (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    openRunner(collection, {
      requestIds: requests.map((request) => request.id),
      label: `${buildScopeLabel(collection, folderPath)} Runner`,
    });
  };

  const handleCloneFolder = (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) {
      toast({
        title: "Nothing to Clone",
        description: "This folder has no requests.",
        variant: "destructive",
      });
      return;
    }

    const sourcePrefix = folderPath;
    const sourceLeaf = sourcePrefix[sourcePrefix.length - 1] || "Folder";
    const targetPrefix = [...sourcePrefix.slice(0, -1), `${sourceLeaf} (Copy)`];

    requests.forEach((request) => {
      const requestPath = normalizeFolderPath(request.folderPath) || [];
      const suffix = requestPath.slice(sourcePrefix.length);
      onAddRequestToCollection(collection.id, {
        name: request.name,
        method: request.method,
        url: request.url,
        folderPath: [...targetPrefix, ...suffix],
        headers: request.headers,
        queryParams: request.queryParams,
        auth: request.auth,
        body: request.body,
        bodyType: request.bodyType,
        graphqlQuery: request.graphqlQuery,
        graphqlVariables: request.graphqlVariables,
      });
    });

    setExpandedCollections((prev) => new Set([...prev, collection.id]));
    targetPrefix.forEach((_, index) => {
      const key = encodeFolderPath(targetPrefix.slice(0, index + 1));
      setFolderExpanded(collection.id, key, true);
    });

    toast({
      title: "Folder Cloned",
      description: `Created "${targetPrefix[targetPrefix.length - 1]}".`,
    });
  };

  const handleRemoveFolder = (collection: Collection, folderPath: string[]) => {
    const requests = getFolderRequests(collection, folderPath);
    if (requests.length === 0) return;
    requests.forEach((request) => onDeleteRequest(collection.id, request.id));
    toast({
      title: "Folder Removed",
      description: `${requests.length} request(s) removed from "${folderPath[folderPath.length - 1]}".`,
    });
  };

  const handleFolderSettings = (collection: Collection, folderPath: string[]) => {
    openRenameFolderDialog(collection, folderPath);
  };

  const executeRunner = async () => {
    if (!runnerCollection || runningCollectionId) return;

    const runnableRequests = runnerConfigureRequests
      ? runnerCollection.requests.filter((request) => runnerSelectedRequestIds.has(request.id))
      : runnerCollection.requests;
    const skippedRequests = runnerConfigureRequests
      ? runnerCollection.requests.filter((request) => !runnerSelectedRequestIds.has(request.id))
      : [];

    if (runnableRequests.length === 0) {
      toast({
        title: "No Requests Selected",
        description: "Choose at least one request to run.",
        variant: "destructive",
      });
      return;
    }

    const iterations = Math.max(1, runnerIterations || 1);
    const dataRows = runnerDataRows.length > 0 ? runnerDataRows : [{}];

    const plan: CollectionRunResult[] = [];
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      runnableRequests.forEach((request) => {
        const id = `${request.id}-iter-${iteration}`;
        plan.push({
          id,
          requestId: request.id,
          requestName: request.name,
          method: request.method,
          url: request.url || "(empty URL)",
          iteration,
          runnerStatus: "queued",
          status: 0,
          statusText: "Queued",
          duration: 0,
          success: false,
        });
      });
      skippedRequests.forEach((request) => {
        const id = `${request.id}-iter-${iteration}-skipped`;
        plan.push({
          id,
          requestId: request.id,
          requestName: request.name,
          method: request.method,
          url: request.url || "(empty URL)",
          iteration,
          runnerStatus: "skipped",
          status: 0,
          statusText: "Skipped",
          duration: 0,
          success: false,
          error: "Excluded by request selection.",
        });
      });
    }

    setRunResults(plan);
    setRunnerSelectedResultId(plan[0]?.id || null);
    setRunnerFilter("all");
    setRunnerStage("running");
    setRunningCollectionId(runnerCollection.id);

    const abortController = new AbortController();
    runnerAbortRef.current = abortController;

    let finalResults = plan;
    const updateEntry = (id: string, updates: Partial<CollectionRunResult>) => {
      finalResults = finalResults.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry));
      setRunResults(finalResults);
    };

    const queuedEntries = plan.filter((item) => item.runnerStatus === "queued");
    for (const entry of queuedEntries) {
      if (abortController.signal.aborted) break;

      const request = runnableRequests.find((item) => item.id === entry.requestId);
      if (!request) continue;

      const rowIndex = (entry.iteration - 1) % dataRows.length;
      const row = dataRows[rowIndex];
      const requestUrl = buildRequestUrl(request, row);

      if (!requestUrl) {
        updateEntry(entry.id, {
          url: "(empty URL)",
          runnerStatus: "failed",
          statusText: "Failed",
          error: "URL is empty.",
          finishedAt: new Date().toISOString(),
        });
        continue;
      }

      const startedAt = new Date().toISOString();
      updateEntry(entry.id, {
        runnerStatus: "running",
        statusText: "Running",
        startedAt,
        url: requestUrl,
      });

      const start = performance.now();
      try {
        const response = await fetch(requestUrl, {
          method: request.method,
          headers: buildRequestHeaders(request, row),
          body: buildRequestBody(request, row),
          signal: abortController.signal,
        });
        const responseBody = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const duration = Math.round(performance.now() - start);
        const passed = response.status >= 200 && response.status < 400;
        updateEntry(entry.id, {
          runnerStatus: passed ? "passed" : "failed",
          status: response.status,
          statusText: response.statusText,
          duration,
          success: passed,
          responseBody,
          responseHeaders,
          finishedAt: new Date().toISOString(),
          error: undefined,
        });
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        const aborted = error instanceof Error && error.name === "AbortError";
        updateEntry(entry.id, {
          runnerStatus: aborted ? "cancelled" : "failed",
          status: 0,
          statusText: aborted ? "Cancelled" : "Network Error",
          duration,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          finishedAt: new Date().toISOString(),
        });
        if (aborted) break;
      }

      if (!abortController.signal.aborted && runnerDelayMs > 0) {
        await sleep(runnerDelayMs);
      }
    }

    const cancelled = abortController.signal.aborted;
    if (cancelled) {
      finalResults = finalResults.map((entry) => {
        if (entry.runnerStatus === "queued" || entry.runnerStatus === "running") {
          return {
            ...entry,
            runnerStatus: "cancelled",
            statusText: "Cancelled",
            success: false,
            finishedAt: new Date().toISOString(),
          };
        }
        return entry;
      });
      setRunResults(finalResults);
      toast({
        title: "Execution Cancelled",
        description: "Collection run was cancelled.",
        variant: "destructive",
      });
    } else {
      const successCount = finalResults.filter((item) => item.runnerStatus === "passed").length;
      const totalCount = plan.filter((item) => item.runnerStatus !== "skipped").length;
      toast({
        title: successCount === totalCount ? "Collection Run Succeeded" : "Collection Run Completed",
        description: `${successCount}/${totalCount} requests passed.`,
        variant: successCount === totalCount ? "default" : "destructive",
      });
    }

    runnerAbortRef.current = null;
    setRunnerStage("completed");
    setRunningCollectionId(null);
  };

  const handleRunCollection = (collection: Collection) => {
    openRunner(collection);
  };

  const handleCloneCollection = (collection: Collection) => {
    const cloned = onDuplicateCollection(collection.id);
    if (cloned) {
      toast({
        title: "Collection Cloned",
        description: `Created "${cloned.name}".`,
      });
    }
  };

  const handleSaveCollectionSettings = () => {
    if (!settingsCollection || !settingsName.trim()) return;
    onUpdateCollection(settingsCollection.id, settingsName.trim(), settingsDescription.trim());
    setSettingsCollection(null);
    toast({
      title: "Settings Saved",
      description: "Collection settings updated.",
    });
  };

  const toggleCollectionExpanded = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setFolderExpanded = (collectionId: string, folderKey: string, expanded: boolean) => {
    const scopedKey = `${collectionId}:${folderKey}`;
    setCollapsedFolderKeys((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.delete(scopedKey);
      } else {
        next.add(scopedKey);
      }
      return next;
    });
  };

  const isFolderExpanded = (collectionId: string, folderKey: string) =>
    !collapsedFolderKeys.has(`${collectionId}:${folderKey}`);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as { collectionId: string; request: SavedRequest } | undefined;
    if (data) {
      setActiveRequest({ request: data.request, collectionId: data.collectionId });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Auto-expand collection when dragging over it
      const overId = String(over.id);
      if (overId.startsWith('collection-')) {
        const collectionId = overId.replace('collection-', '');
        if (!expandedCollections.has(collectionId)) {
          setExpandedCollections((prev) => new Set([...prev, collectionId]));
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRequest(null);

    if (!over) return;

    const activeData = active.data.current as { collectionId: string; request: SavedRequest } | undefined;
    if (!activeData) return;

    const overId = String(over.id);
    
    // Check if dropping on a collection droppable area
    if (overId.startsWith('collection-')) {
      const targetCollectionId = overId.replace('collection-', '');
      if (targetCollectionId !== activeData.collectionId) {
        // Moving to a different collection
        onMoveRequest(activeData.collectionId, targetCollectionId, activeData.request.id);
      }
      return;
    }

    // Check if dropping on another request
    const overData = over.data.current as { collectionId: string; request: SavedRequest } | undefined;
    if (!overData) return;

    if (activeData.collectionId === overData.collectionId) {
      // Reordering within the same collection
      const collection = collections.find((c) => c.id === activeData.collectionId);
      if (!collection) return;

      const oldIndex = collection.requests.findIndex((r) => r.id === active.id);
      const newIndex = collection.requests.findIndex((r) => r.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        onReorderRequests(activeData.collectionId, oldIndex, newIndex);
      }
    } else {
      // Moving to a different collection at a specific position
      const targetCollection = collections.find((c) => c.id === overData.collectionId);
      if (!targetCollection) return;

      const targetIndex = targetCollection.requests.findIndex((r) => r.id === over.id);
      onMoveRequest(activeData.collectionId, overData.collectionId, activeData.request.id, targetIndex);
    }
  };

  const renderRequestTree = (
    collection: Collection,
    nodes: RequestTreeNode[],
    depth = 0
  ): React.ReactNode =>
    nodes.map((node) => {
      if (node.type === "request") {
        return (
          <SortableRequestItem
            key={node.request.id}
            request={node.request}
            collectionId={collection.id}
            onLoadRequest={onLoadRequest}
            onDuplicateRequest={onDuplicateRequest}
            onDeleteRequest={onDeleteRequest}
            onEditRequest={openEditRequestDialog}
          />
        );
      }

      const folderPath = decodeFolderPath(node.key);
      const expanded = isFolderExpanded(collection.id, node.key);

      return (
        <Collapsible
          key={`${collection.id}:${node.key}`}
          open={expanded}
          onOpenChange={(open) => setFolderExpanded(collection.id, node.key, open)}
        >
          <div className="group flex items-center gap-1 rounded-lg hover:bg-secondary/50 transition-colors min-w-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1 min-w-0 justify-start gap-2 h-8 px-2 text-xs overflow-hidden",
                  depth > 0 && "pl-3"
                )}
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <FolderOpen className="h-3.5 w-3.5 text-primary/90 shrink-0" />
                <span className="truncate flex-1 text-left">{node.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{node.requestCount}</span>
              </Button>
            </CollapsibleTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => openNewRequestDialog(collection, folderPath)}>
                  <FilePlus2 className="h-4 w-4 mr-2" />
                  New Request
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openNewFolderDialog(collection, folderPath)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openNewJsFileDialog(collection, folderPath)}>
                  <FileCode2 className="h-4 w-4 mr-2" />
                  New JS File
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRunFolder(collection, folderPath)}
                  disabled={runningCollectionId === collection.id}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {runningCollectionId === collection.id ? "Running..." : "Run"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCloneFolder(collection, folderPath)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openRenameFolderDialog(collection, folderPath)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShareFolder(collection, folderPath)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGenerateFolderDocs(collection, folderPath)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Generate Docs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCollapseFolder(collection.id, folderPath)}>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Collapse
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRevealFolderInFinder(collection, folderPath)}>
                  <Download className="h-4 w-4 mr-2" />
                  Reveal in Finder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleFolderSettings(collection, folderPath)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenFolderInTerminal(collection, folderPath)}>
                  <TerminalSquare className="h-4 w-4 mr-2" />
                  Open in Terminal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => handleRemoveFolder(collection, folderPath)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CollapsibleContent className="pl-4 space-y-0.5 overflow-hidden">
            {renderRequestTree(collection, node.children, depth + 1)}
          </CollapsibleContent>
        </Collapsible>
      );
    });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderOpen className="h-4 w-4 text-primary" />
            Collections
          </div>
          <div className="flex items-center gap-1">
            <ImportExportDialog
              collections={collections}
              onImport={onImportCollections}
            />
            <Dialog open={newCollectionOpen} onOpenChange={setNewCollectionOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
                <DialogDescription>
                  Create a new collection to organize your API requests.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="My Collection"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Optional description..."
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewCollectionOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No matching requests</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {searchResults.map(({ collection, request }) => (
                  <div
                    key={`${collection.id}-${request.id}`}
                    className="group flex items-center gap-2 rounded-lg hover:bg-secondary/50 transition-colors p-2 cursor-pointer"
                    onClick={() => {
                      onLoadRequest(request);
                      setSearchQuery("");
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-mono font-medium", METHOD_COLORS[request.method])}>
                          {request.method}
                        </span>
                        <span className="truncate text-xs font-medium">{request.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {collection.name}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {request.url}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Collection Dialog */}
        <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Edit Collection</DialogTitle>
              <DialogDescription>
                Update the collection name and description.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="My Collection"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Optional description..."
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingCollection(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCollection} disabled={!newCollectionName.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Request Dialog */}
        <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Edit Request</DialogTitle>
              <DialogDescription>
                Rename the request or update it with your current configuration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Request Name</label>
                <Input
                  placeholder="My Request"
                  value={editRequestName}
                  onChange={(e) => setEditRequestName(e.target.value)}
                />
              </div>
              
              {editingRequest && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className="text-sm font-medium">Saved Configuration</p>
                  <div className="text-xs space-y-1 text-muted-foreground bg-secondary/30 rounded-lg p-3">
                    <div className="flex gap-2">
                      <span className={cn("font-mono font-medium", METHOD_COLORS[editingRequest.request.method])}>
                        {editingRequest.request.method}
                      </span>
                      <span className="truncate font-mono">{editingRequest.request.url || "(no URL)"}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm font-medium">Current Configuration</p>
                  <div className="text-xs space-y-1 text-muted-foreground bg-secondary/30 rounded-lg p-3">
                    <div className="flex gap-2">
                      <span className={cn("font-mono font-medium", METHOD_COLORS[currentConfig.method])}>
                        {currentConfig.method}
                      </span>
                      <span className="truncate font-mono">{currentConfig.url || "(no URL)"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditingRequest(null)}>
                Cancel
              </Button>
              <Button 
                variant="secondary"
                onClick={handleRenameRequest} 
                disabled={!editRequestName.trim()}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename Only
              </Button>
              <Button 
                onClick={handleUpdateRequestConfig}
                disabled={!currentConfig.url.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                Update with Current
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Request Dialog */}
        <Dialog
          open={newRequestOpen}
          onOpenChange={(open) => {
            setNewRequestOpen(open);
            if (!open) {
              setNewRequestName("");
              setTargetCollection(null);
              setTargetFolderPath(null);
            }
          }}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Request</DialogTitle>
              <DialogDescription>
                Add a new request inside {targetCollection?.name || "this collection"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Request Name</label>
              <Input
                placeholder="New Request"
                value={newRequestName}
                onChange={(e) => setNewRequestName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeTargetDialogs}>Cancel</Button>
              <Button onClick={handleCreateRequest} disabled={!newRequestName.trim()}>
                Create Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Folder Dialog */}
        <Dialog
          open={newFolderOpen}
          onOpenChange={(open) => {
            setNewFolderOpen(open);
            if (!open) {
              setNewFolderName("");
              setTargetCollection(null);
              setTargetFolderPath(null);
            }
          }}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Folder</DialogTitle>
              <DialogDescription>
                {targetFolderPath && targetFolderPath.length > 0
                  ? `Create a nested folder in ${targetCollection?.name || "this collection"} / ${targetFolderPath.join(" / ")}.`
                  : `Create a folder collection from ${targetCollection?.name || "this collection"}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeTargetDialogs}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New JS File Dialog */}
        <Dialog
          open={newJsFileOpen}
          onOpenChange={(open) => {
            setNewJsFileOpen(open);
            if (!open) {
              setNewJsFileName("");
              setTargetCollection(null);
              setTargetFolderPath(null);
            }
          }}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>New JS File</DialogTitle>
              <DialogDescription>
                Add a script file entry inside {targetCollection?.name || "this collection"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">File Name</label>
              <Input
                placeholder="script.js"
                value={newJsFileName}
                onChange={(e) => setNewJsFileName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeTargetDialogs}>Cancel</Button>
              <Button onClick={handleCreateJsFile} disabled={!newJsFileName.trim()}>
                Add JS File
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Folder Dialog */}
        <Dialog
          open={renameFolderOpen}
          onOpenChange={(open) => {
            setRenameFolderOpen(open);
            if (!open) {
              setFolderRenameCollection(null);
              setFolderRenamePath([]);
              setFolderRenameName("");
            }
          }}
        >
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Rename Folder</DialogTitle>
              <DialogDescription>
                Rename folder in {folderRenameCollection?.name || "this collection"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium">Folder Name</label>
              <Input
                placeholder="Folder Name"
                value={folderRenameName}
                onChange={(e) => setFolderRenameName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameFolderOpen(false)}>Cancel</Button>
              <Button onClick={handleRenameFolder} disabled={!folderRenameName.trim()}>
                Rename Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collection Runner */}
        <Dialog
          open={runDialogOpen}
          onOpenChange={(open) => {
            if (!open && runningCollectionId) {
              cancelRunnerExecution();
            }
            setRunDialogOpen(open);
          }}
        >
          <DialogContent className="bg-card border-border max-w-[96vw] w-[96vw] h-[90vh]">
            <DialogHeader>
              <DialogTitle>{runCollectionName || "Collection"} Runner</DialogTitle>
              <DialogDescription>
                {runnerStage === "setup"
                  ? "Configure and run collection requests end-to-end."
                  : runnerStage === "running"
                  ? "Collection execution is in progress."
                  : "Execution completed. Review results and rerun if needed."}
              </DialogDescription>
            </DialogHeader>

            {runnerStage === "setup" ? (
              <div className="space-y-6 min-h-0 overflow-y-auto pr-1">
                <div className="space-y-2 max-w-[220px]">
                  <Label htmlFor="runner-delay-input">Delay (in ms)</Label>
                  <Input
                    id="runner-delay-input"
                    type="number"
                    min={0}
                    value={runnerDelayMs}
                    onChange={(e) => setRunnerDelayMs(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Filter requests with tags</p>
                      <p className="text-xs text-muted-foreground">Tag filters will be added in this runner mode.</p>
                    </div>
                    <Switch
                      checked={runnerTagFilterEnabled}
                      onCheckedChange={setRunnerTagFilterEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Configure requests to run</p>
                      <p className="text-xs text-muted-foreground">Select only the requests you want in this run.</p>
                    </div>
                    <Switch
                      checked={runnerConfigureRequests}
                      onCheckedChange={setRunnerConfigureRequests}
                    />
                  </div>
                </div>

                {runnerConfigureRequests && runnerCollection && (
                  <div className="rounded-md border border-border">
                    <ScrollArea className="h-[220px] p-3">
                      <div className="space-y-2">
                        {runnerCollection.requests.map((request) => (
                          <label
                            key={request.id}
                            className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2"
                          >
                            <Checkbox
                              checked={runnerSelectedRequestIds.has(request.id)}
                              onCheckedChange={(checked) => {
                                setRunnerSelectedRequestIds((previous) => {
                                  const next = new Set(previous);
                                  if (checked) {
                                    next.add(request.id);
                                  } else {
                                    next.delete(request.id);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <span className={cn("text-xs font-mono", METHOD_COLORS[request.method])}>
                              {request.method}
                            </span>
                            <span className="text-sm truncate">{request.name}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You have {runnerCollection?.requests.length || 0} requests in this collection.
                  </p>

                  <div className="flex items-center gap-2">
                    <Button onClick={executeRunner} className="gap-2" variant="hero">
                      <Play className="h-4 w-4" />
                      Run Collection
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!runnerCollection) return;
                        resetRunnerConfiguration(runnerCollection);
                      }}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Specify iterations
                    </div>
                    <Input
                      type="number"
                      min={1}
                      className="max-w-[180px]"
                      value={runnerIterations}
                      onChange={(e) => setRunnerIterations(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Upload className="h-3.5 w-3.5" />
                      Upload a CSV or JSON file
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => runnerFileInputRef.current?.click()}
                      >
                        Choose File
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {runnerDataFileName || "No file selected"}
                      </span>
                    </div>
                    <input
                      ref={runnerFileInputRef}
                      type="file"
                      accept=".csv,.json"
                      className="hidden"
                      onChange={handleRunnerDataFileUpload}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-0 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 border border-border rounded-md p-1">
                    <span className="text-xs text-muted-foreground px-2 flex items-center gap-1">
                      <ListFilter className="h-3.5 w-3.5" />
                      Filter by:
                    </span>
                    <Button
                      size="sm"
                      variant={runnerFilter === "all" ? "secondary" : "ghost"}
                      onClick={() => setRunnerFilter("all")}
                    >
                      All {runnerSummary.all}
                    </Button>
                    <Button
                      size="sm"
                      variant={runnerFilter === "passed" ? "secondary" : "ghost"}
                      onClick={() => setRunnerFilter("passed")}
                    >
                      Passed {runnerSummary.passed}
                    </Button>
                    <Button
                      size="sm"
                      variant={runnerFilter === "failed" ? "secondary" : "ghost"}
                      onClick={() => setRunnerFilter("failed")}
                    >
                      Failed {runnerSummary.failed}
                    </Button>
                    <Button
                      size="sm"
                      variant={runnerFilter === "skipped" ? "secondary" : "ghost"}
                      onClick={() => setRunnerFilter("skipped")}
                    >
                      Skipped {runnerSummary.skipped}
                    </Button>
                  </div>

                  {runnerStage === "running" ? (
                    <Button variant="destructive" onClick={cancelRunnerExecution}>
                      Cancel Execution
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setRunnerStage("setup")}
                      >
                        Back to Setup
                      </Button>
                      <Button
                        variant="hero"
                        onClick={executeRunner}
                        disabled={!!runningCollectionId}
                      >
                        Run Again
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4 flex-1 min-h-0">
                  <div className="rounded-md border border-border bg-secondary/20 p-2 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="space-y-1">
                        {filteredRunResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => setRunnerSelectedResultId(result.id)}
                            className={cn(
                              "w-full text-left rounded-md px-3 py-2.5 border transition-colors",
                              runnerSelectedResultId === result.id
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card hover:bg-secondary/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {result.runnerStatus === "passed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                              {result.runnerStatus === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                              {result.runnerStatus === "cancelled" && <X className="h-3.5 w-3.5 text-destructive" />}
                              {result.runnerStatus === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                              {result.runnerStatus === "queued" && <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                              {result.runnerStatus === "skipped" && <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />}

                              <span className="truncate text-sm">{result.requestName}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Iteration {result.iteration} • {result.method} • {result.status || "--"} {result.statusText}
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="rounded-md border border-border bg-card p-3 min-h-0 flex flex-col">
                    {runnerSelectedResult ? (
                      <>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{runnerSelectedResult.requestName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {runnerSelectedResult.method} {runnerSelectedResult.url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                runnerSelectedResult.runnerStatus === "passed"
                                  ? "default"
                                  : runnerSelectedResult.runnerStatus === "skipped"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {runnerSelectedResult.status || "--"} {runnerSelectedResult.statusText}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {runnerSelectedResult.duration}ms
                            </span>
                          </div>
                        </div>

                        <Tabs defaultValue="response" className="flex-1 min-h-0 flex flex-col">
                          <TabsList className="justify-start w-fit">
                            <TabsTrigger value="response">Response</TabsTrigger>
                            <TabsTrigger value="headers">Headers</TabsTrigger>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="tests">Tests</TabsTrigger>
                          </TabsList>

                          <TabsContent value="response" className="flex-1 min-h-0">
                            <ScrollArea className="h-[48vh] rounded-md border border-border bg-secondary/20 p-3">
                              <pre className="text-xs whitespace-pre-wrap font-mono">
                                {runnerSelectedResult.responseBody || runnerSelectedResult.error || "No response body"}
                              </pre>
                            </ScrollArea>
                          </TabsContent>

                          <TabsContent value="headers" className="flex-1 min-h-0">
                            <ScrollArea className="h-[48vh] rounded-md border border-border bg-secondary/20 p-3">
                              {runnerSelectedResult.responseHeaders &&
                              Object.keys(runnerSelectedResult.responseHeaders).length > 0 ? (
                                <div className="space-y-1">
                                  {Object.entries(runnerSelectedResult.responseHeaders).map(([key, value]) => (
                                    <div key={key} className="grid grid-cols-[180px_1fr] gap-3 text-xs">
                                      <span className="font-mono text-primary">{key}</span>
                                      <span className="font-mono break-all">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No headers captured.</p>
                              )}
                            </ScrollArea>
                          </TabsContent>

                          <TabsContent value="timeline" className="flex-1 min-h-0">
                            <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs space-y-2">
                              <p>Iteration: {runnerSelectedResult.iteration}</p>
                              <p>Started: {runnerSelectedResult.startedAt ? new Date(runnerSelectedResult.startedAt).toLocaleString() : "--"}</p>
                              <p>Finished: {runnerSelectedResult.finishedAt ? new Date(runnerSelectedResult.finishedAt).toLocaleString() : "--"}</p>
                              <p>Duration: {runnerSelectedResult.duration}ms</p>
                            </div>
                          </TabsContent>

                          <TabsContent value="tests" className="flex-1 min-h-0">
                            <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs space-y-2">
                              <div className="flex items-center gap-2">
                                {runnerSelectedResult.success ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                )}
                                <span>Status code is successful (&lt; 400)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {runnerSelectedResult.error ? (
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                                <span>No runtime error</span>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Select a request result to view details.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Generated Output Dialog */}
        <Dialog open={artifactDialogOpen} onOpenChange={setArtifactDialogOpen}>
          <DialogContent className="bg-card border-border max-w-3xl">
            <DialogHeader>
              <DialogTitle>{artifactTitle}</DialogTitle>
              <DialogDescription>
                Copy the generated content or download it as a file.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={artifactContent}
              onChange={(e) => setArtifactContent(e.target.value)}
              className="min-h-[360px] font-mono text-xs"
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  const copied = await copyToClipboard(artifactContent);
                  toast({
                    title: copied ? "Copied" : "Copy Failed",
                    description: copied ? "Content copied to clipboard." : "Clipboard permission is not available.",
                    variant: copied ? "default" : "destructive",
                  });
                }}
              >
                Copy
              </Button>
              <Button
                onClick={() => downloadTextFile(artifactFileName, artifactContent, artifactMimeType)}
              >
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collection Settings Dialog */}
        <Dialog open={!!settingsCollection} onOpenChange={(open) => !open && setSettingsCollection(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Collection Settings</DialogTitle>
              <DialogDescription>
                Update collection metadata and behavior.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  rows={3}
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md p-3">
                Requests: {settingsCollection?.requests.length ?? 0}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsCollection(null)}>Cancel</Button>
              <Button onClick={handleSaveCollectionSettings} disabled={!settingsName.trim()}>
                Save Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Collections List - hidden during search */}
        {searchResults === null && (
          <>
            {collections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No collections yet</p>
                <p className="text-xs mt-1">Create a collection to save requests</p>
              </div>
            ) : (
              <div className="space-y-1">
                {collections.map((collection) => (
              <DroppableCollection
                key={collection.id}
                collection={collection}
                isExpanded={expandedCollections.has(collection.id)}
              >
                <Collapsible
                  open={expandedCollections.has(collection.id)}
                  onOpenChange={() => toggleCollectionExpanded(collection.id)}
                >
                  <div className="group flex items-center gap-1 rounded-lg hover:bg-secondary/50 transition-colors min-w-0">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 min-w-0 justify-start gap-2 h-9 px-2 overflow-hidden"
                      >
                        {expandedCollections.has(collection.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate text-sm min-w-0 flex-1 text-left">{collection.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {collection.requests.length}
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem onClick={() => openNewRequestDialog(collection)}>
                          <FilePlus2 className="h-4 w-4 mr-2" />
                          New Request
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openNewFolderDialog(collection)}>
                          <FolderPlus className="h-4 w-4 mr-2" />
                          New Folder
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openNewJsFileDialog(collection)}>
                          <FileCode2 className="h-4 w-4 mr-2" />
                          New JS File
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRunCollection(collection)}
                          disabled={runningCollectionId === collection.id}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {runningCollectionId === collection.id ? "Running..." : "Run"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCloneCollection(collection)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(collection)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareCollection(collection)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGenerateDocs(collection)}>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Generate Docs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCollapseCollection(collection.id)}>
                          <Minimize2 className="h-4 w-4 mr-2" />
                          Collapse
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRevealInFinder(collection)}>
                          <Download className="h-4 w-4 mr-2" />
                          Reveal in Finder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openCollectionSettings(collection)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenInTerminal(collection)}>
                          <TerminalSquare className="h-4 w-4 mr-2" />
                          Open in Terminal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteCollection(collection.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CollapsibleContent className="pl-6 pr-1 space-y-0.5 overflow-hidden">
                    {collection.description && (
                      <p className="text-xs text-muted-foreground px-2 py-1 break-words leading-relaxed">
                        {collection.description}
                      </p>
                    )}
                    {collection.requests.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2 italic">
                        No saved requests - drag requests here
                      </p>
                    ) : (
                      <SortableContext
                        items={collection.requests.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {renderRequestTree(collection, buildCollectionRequestTree(collection.requests))}
                      </SortableContext>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </DroppableCollection>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      <DragOverlay>
        {activeRequest && <RequestDragOverlay request={activeRequest.request} />}
      </DragOverlay>
    </DndContext>
  );
}
