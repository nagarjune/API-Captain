import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Collection } from "@/hooks/useCollections";
import { reviveCollections } from "@/hooks/useCollections";
import { getStoredBuilderSettings } from "@/lib/builderTheme";

type WorkspaceStorageMode = "browser" | "folder";

export interface WorkspaceMeta {
  id: string;
  name: string;
  storageMode: WorkspaceStorageMode;
  linkedDirectoryName?: string;
  collectionsFileName: string;
  gitEnabled: boolean;
  updatedAt: string;
}

interface WorkspaceManifest {
  id?: string;
  name?: string;
  collectionsFileName?: string;
  gitEnabled?: boolean;
}

interface UseWorkspaceOptions {
  collections: Collection[];
  replaceCollections: (collections: Collection[]) => void;
}

const LEGACY_COLLECTIONS_KEY = "api-collections";
const LEGACY_WORKSPACE_META_KEY = "api-workspace-meta-v1";
const WORKSPACES_KEY = "api-workspaces-v2";
const ACTIVE_WORKSPACE_KEY = "api-active-workspace-v2";
const WORKSPACE_COLLECTIONS_PREFIX = "api-workspace-collections-";

const WORKSPACE_DB_NAME = "api-workspace-db";
const WORKSPACE_DB_STORE = "handles";
const WORKSPACE_MANIFEST_FILE = ".api-captain-workspace.json";
const DEFAULT_COLLECTIONS_FILE = "collections.json";
const APICAPTAIN_CONFIG_FILE = "apicaptain.json";

const DEFAULT_WORKSPACE_NAME = "My Workspace";

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<any>;
};

const canUseDirectoryPicker = () =>
  typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";

const workspaceCollectionsKey = (workspaceId: string) => `${WORKSPACE_COLLECTIONS_PREFIX}${workspaceId}`;

const createDefaultWorkspace = (): WorkspaceMeta => ({
  id: crypto.randomUUID(),
  name: DEFAULT_WORKSPACE_NAME,
  storageMode: "browser",
  linkedDirectoryName: undefined,
  collectionsFileName: DEFAULT_COLLECTIONS_FILE,
  gitEnabled: false,
  updatedAt: new Date().toISOString(),
});

const normalizeWorkspace = (raw: Partial<WorkspaceMeta>): WorkspaceMeta => ({
  id: raw.id || crypto.randomUUID(),
  name: raw.name?.trim() || DEFAULT_WORKSPACE_NAME,
  storageMode: raw.storageMode === "folder" ? "folder" : "browser",
  linkedDirectoryName: raw.linkedDirectoryName,
  collectionsFileName: raw.collectionsFileName || DEFAULT_COLLECTIONS_FILE,
  gitEnabled: Boolean(raw.gitEnabled),
  updatedAt: raw.updatedAt || new Date().toISOString(),
});

const parseWorkspaceList = (value: string | null): WorkspaceMeta[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((workspace) => normalizeWorkspace(workspace as Partial<WorkspaceMeta>));
  } catch {
    return [];
  }
};

const parseStoredCollections = (value: string | null): Collection[] => {
  if (!value) return [];
  try {
    return reviveCollections(JSON.parse(value));
  } catch {
    return [];
  }
};

const persistWorkspaceList = (workspaces: WorkspaceMeta[]) => {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
};

const persistActiveWorkspaceId = (workspaceId: string) => {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
};

const persistWorkspaceCollections = (workspaceId: string, collections: Collection[]) => {
  localStorage.setItem(workspaceCollectionsKey(workspaceId), JSON.stringify(collections));
};

const readWorkspaceCollectionsSnapshot = (workspaceId: string): Collection[] => {
  return parseStoredCollections(localStorage.getItem(workspaceCollectionsKey(workspaceId)));
};

const openWorkspaceDatabase = async (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === "undefined") return null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_DB_STORE)) {
        db.createObjectStore(WORKSPACE_DB_STORE);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const storeDirectoryHandle = async (workspaceId: string, handle: any) => {
  const db = await openWorkspaceDatabase();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_DB_STORE, "readwrite");
    tx.objectStore(WORKSPACE_DB_STORE).put(handle, workspaceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
};

const readStoredDirectoryHandle = async (workspaceId: string): Promise<any | null> => {
  const db = await openWorkspaceDatabase();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_DB_STORE, "readonly");
    const request = tx.objectStore(WORKSPACE_DB_STORE).get(workspaceId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
};

const removeStoredDirectoryHandle = async (workspaceId: string) => {
  const db = await openWorkspaceDatabase();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_DB_STORE, "readwrite");
    tx.objectStore(WORKSPACE_DB_STORE).delete(workspaceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
};

const ensureDirectoryPermission = async (handle: any): Promise<boolean> => {
  if (!handle?.queryPermission || !handle?.requestPermission) return true;
  const granted = await handle.queryPermission({ mode: "readwrite" });
  if (granted === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
};

const readJsonFile = async <T,>(handle: any, fileName: string): Promise<T | null> => {
  try {
    const fileHandle = await handle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
};

const writeTextFile = async (handle: any, fileName: string, content: string) => {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
};

const removeFileIfExists = async (handle: any, fileName: string) => {
  try {
    await handle.removeEntry(fileName);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return;
    }
    throw error;
  }
};

const makeWorkspaceManifest = (workspace: WorkspaceMeta): WorkspaceManifest => ({
  id: workspace.id,
  name: workspace.name,
  collectionsFileName: workspace.collectionsFileName,
  gitEnabled: workspace.gitEnabled,
});

const createApiCaptainConfig = (workspace: WorkspaceMeta) =>
  JSON.stringify(
    {
      app: "API Captain",
      workspace: {
        id: workspace.id,
        name: workspace.name,
        storageMode: workspace.storageMode,
        collectionsFileName: workspace.collectionsFileName,
        gitEnabled: workspace.gitEnabled,
      },
    },
    null,
    2
  );

const createGitReadme = (workspace: WorkspaceMeta, includeApiCaptainConfig: boolean) => `# ${workspace.name}

This folder stores API Captain workspace data.

Tracked files:
- ${workspace.collectionsFileName}
- ${WORKSPACE_MANIFEST_FILE}
${includeApiCaptainConfig ? `- ${APICAPTAIN_CONFIG_FILE}\n` : ""}

Suggested commands:
\`\`\`bash
git init
git add ${workspace.collectionsFileName} ${WORKSPACE_MANIFEST_FILE}${includeApiCaptainConfig ? ` ${APICAPTAIN_CONFIG_FILE}` : ""} README.md .gitignore
git commit -m "Track API Captain workspace"
\`\`\`
`;

const DEFAULT_GITIGNORE = `node_modules/
dist/
.DS_Store
`;

const setWorkspaceTimestamp = (workspace: WorkspaceMeta): WorkspaceMeta => ({
  ...workspace,
  updatedAt: new Date().toISOString(),
});

export function useWorkspace({ collections, replaceCollections }: UseWorkspaceOptions) {
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const skipNextSyncRef = useRef(false);
  const directoryHandlesRef = useRef<Record<string, any>>({});

  const hasDirectorySupport = canUseDirectoryPicker();

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null,
    [activeWorkspaceId, workspaces]
  );

  const updateWorkspaceList = useCallback((updater: (current: WorkspaceMeta[]) => WorkspaceMeta[]) => {
    setWorkspaces((current) => {
      const next = updater(current).map(setWorkspaceTimestamp);
      persistWorkspaceList(next);
      return next;
    });
  }, []);

  const syncWorkspaceFiles = useCallback(
    async (workspace: WorkspaceMeta, nextCollections: Collection[]) => {
      if (workspace.storageMode !== "folder") return;
      const directoryHandle = directoryHandlesRef.current[workspace.id];
      if (!directoryHandle) return;

      setIsSyncing(true);
      try {
        const hasPermission = await ensureDirectoryPermission(directoryHandle);
        if (!hasPermission) throw new Error("Workspace folder permission was not granted.");
        const features = getStoredBuilderSettings();
        const showApiCaptainJson = features.featureShowApiCaptainJson;

        await writeTextFile(
          directoryHandle,
          workspace.collectionsFileName,
          JSON.stringify(nextCollections, null, 2)
        );
        await writeTextFile(
          directoryHandle,
          WORKSPACE_MANIFEST_FILE,
          JSON.stringify(makeWorkspaceManifest(workspace), null, 2)
        );

        if (showApiCaptainJson) {
          await writeTextFile(directoryHandle, APICAPTAIN_CONFIG_FILE, createApiCaptainConfig(workspace));
        } else {
          await removeFileIfExists(directoryHandle, APICAPTAIN_CONFIG_FILE);
        }

        if (workspace.gitEnabled) {
          await writeTextFile(directoryHandle, "README.md", createGitReadme(workspace, showApiCaptainJson));
          await writeTextFile(directoryHandle, ".gitignore", DEFAULT_GITIGNORE);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  const loadCollectionsForWorkspace = useCallback(
    async (workspace: WorkspaceMeta): Promise<Collection[]> => {
      if (workspace.storageMode === "browser") {
        return readWorkspaceCollectionsSnapshot(workspace.id);
      }

      const directoryHandle = directoryHandlesRef.current[workspace.id];
      if (!directoryHandle) {
        return readWorkspaceCollectionsSnapshot(workspace.id);
      }

      const hasPermission = await ensureDirectoryPermission(directoryHandle);
      if (!hasPermission) {
        throw new Error(`Permission denied for workspace "${workspace.name}".`);
      }

      const fileData = await readJsonFile<unknown>(directoryHandle, workspace.collectionsFileName);
      if (Array.isArray(fileData)) {
        const revived = reviveCollections(fileData);
        persistWorkspaceCollections(workspace.id, revived);
        return revived;
      }

      return readWorkspaceCollectionsSnapshot(workspace.id);
    },
    []
  );

  const persistCurrentWorkspaceCollections = useCallback(
    async (workspace: WorkspaceMeta | null, nextCollections: Collection[]) => {
      if (!workspace) return;
      persistWorkspaceCollections(workspace.id, nextCollections);
      if (workspace.storageMode === "folder") {
        await syncWorkspaceFiles(workspace, nextCollections);
      }
    },
    [syncWorkspaceFiles]
  );

  const restoreDirectoryHandles = useCallback(async (workspaceList: WorkspaceMeta[]) => {
    const folderWorkspaces = workspaceList.filter((workspace) => workspace.storageMode === "folder");
    for (const workspace of folderWorkspaces) {
      try {
        const handle = await readStoredDirectoryHandle(workspace.id);
        if (handle) {
          directoryHandlesRef.current[workspace.id] = handle;
        }
      } catch {
        // Ignore handle restore failures; workspace can still use browser snapshot fallback.
      }
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        let nextWorkspaces = parseWorkspaceList(localStorage.getItem(WORKSPACES_KEY));

        if (nextWorkspaces.length === 0) {
          nextWorkspaces = [createDefaultWorkspace()];
        }

        localStorage.removeItem(LEGACY_WORKSPACE_META_KEY);

        persistWorkspaceList(nextWorkspaces);
        await restoreDirectoryHandles(nextWorkspaces);

        let nextActiveId = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || nextWorkspaces[0].id;
        if (!nextWorkspaces.some((workspace) => workspace.id === nextActiveId)) {
          nextActiveId = nextWorkspaces[0].id;
        }
        persistActiveWorkspaceId(nextActiveId);

        const active = nextWorkspaces.find((workspace) => workspace.id === nextActiveId) || nextWorkspaces[0];
        const existingWorkspaceSnapshot = readWorkspaceCollectionsSnapshot(active.id);
        const legacyCollections = parseStoredCollections(localStorage.getItem(LEGACY_COLLECTIONS_KEY));
        const initialCollections =
          existingWorkspaceSnapshot.length > 0
            ? existingWorkspaceSnapshot
            : active.storageMode === "browser"
            ? legacyCollections
            : await loadCollectionsForWorkspace(active);

        persistWorkspaceCollections(active.id, initialCollections);
        skipNextSyncRef.current = true;
        setWorkspaces(nextWorkspaces);
        setActiveWorkspaceId(active.id);
        replaceCollections(initialCollections);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Workspace initialization failed.");
      } finally {
        initializedRef.current = true;
      }
    };

    if (!initializedRef.current) {
      void initialize();
    }
  }, [loadCollectionsForWorkspace, replaceCollections, restoreDirectoryHandles]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!activeWorkspace) return;

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    void persistCurrentWorkspaceCollections(activeWorkspace, collections).catch((error) => {
      setLastError(error instanceof Error ? error.message : "Unable to sync workspace data.");
    });
  }, [activeWorkspace, collections, persistCurrentWorkspaceCollections]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!initializedRef.current) return;
      if (!activeWorkspace) return;
      if (workspaceId === activeWorkspace.id) return;

      await persistCurrentWorkspaceCollections(activeWorkspace, collections);

      const target = workspaces.find((workspace) => workspace.id === workspaceId);
      if (!target) return;

      const nextCollections = await loadCollectionsForWorkspace(target);
      persistActiveWorkspaceId(target.id);
      skipNextSyncRef.current = true;
      setActiveWorkspaceId(target.id);
      replaceCollections(nextCollections);
    },
    [
      activeWorkspace,
      collections,
      loadCollectionsForWorkspace,
      persistCurrentWorkspaceCollections,
      replaceCollections,
      workspaces,
    ]
  );

  const createBrowserWorkspace = useCallback(
    async (name: string) => {
      const workspace = setWorkspaceTimestamp({
        id: crypto.randomUUID(),
        name: name.trim() || "Workspace",
        storageMode: "browser",
        linkedDirectoryName: undefined,
        collectionsFileName: DEFAULT_COLLECTIONS_FILE,
        gitEnabled: false,
        updatedAt: new Date().toISOString(),
      });

      updateWorkspaceList((current) => [...current, workspace]);
      persistWorkspaceCollections(workspace.id, []);
      persistActiveWorkspaceId(workspace.id);
      skipNextSyncRef.current = true;
      setActiveWorkspaceId(workspace.id);
      replaceCollections([]);
      setSetupOpen(false);
    },
    [replaceCollections, updateWorkspaceList]
  );

  const attachDirectoryWorkspace = useCallback(
    async (directoryHandle: any, requestedName?: string) => {
      const hasPermission = await ensureDirectoryPermission(directoryHandle);
      if (!hasPermission) {
        throw new Error("Read/write permission is required for folder-based workspaces.");
      }

      const manifest = await readJsonFile<WorkspaceManifest>(directoryHandle, WORKSPACE_MANIFEST_FILE);
      const workspaceId = manifest?.id || crypto.randomUUID();

      const workspaceMeta: WorkspaceMeta = setWorkspaceTimestamp({
        id: workspaceId,
        name: requestedName?.trim() || manifest?.name || directoryHandle.name || "Workspace",
        storageMode: "folder",
        linkedDirectoryName: directoryHandle.name,
        collectionsFileName: manifest?.collectionsFileName || DEFAULT_COLLECTIONS_FILE,
        gitEnabled: Boolean(manifest?.gitEnabled),
        updatedAt: new Date().toISOString(),
      });

      directoryHandlesRef.current[workspaceMeta.id] = directoryHandle;
      await storeDirectoryHandle(workspaceMeta.id, directoryHandle);

      const fileCollectionsRaw = await readJsonFile<unknown>(
        directoryHandle,
        workspaceMeta.collectionsFileName
      );
      const fileCollections = Array.isArray(fileCollectionsRaw) ? reviveCollections(fileCollectionsRaw) : [];
      const existingSnapshot = readWorkspaceCollectionsSnapshot(workspaceMeta.id);
      const targetCollections = fileCollections.length > 0 ? fileCollections : existingSnapshot;

      persistWorkspaceCollections(workspaceMeta.id, targetCollections);

      updateWorkspaceList((current) => {
        const index = current.findIndex((workspace) => workspace.id === workspaceMeta.id);
        if (index === -1) return [...current, workspaceMeta];
        const next = [...current];
        next[index] = workspaceMeta;
        return next;
      });

      await syncWorkspaceFiles(workspaceMeta, targetCollections);
      persistActiveWorkspaceId(workspaceMeta.id);
      skipNextSyncRef.current = true;
      setActiveWorkspaceId(workspaceMeta.id);
      replaceCollections(targetCollections);
      setSetupOpen(false);
    },
    [replaceCollections, syncWorkspaceFiles, updateWorkspaceList]
  );

  const createFolderWorkspace = useCallback(
    async (name: string) => {
      if (!hasDirectorySupport) {
        throw new Error("Folder workspaces are not supported in this browser.");
      }
      const pickerWindow = window as DirectoryPickerWindow;
      const handle = await pickerWindow.showDirectoryPicker?.({ mode: "readwrite" });
      if (!handle) return;
      await attachDirectoryWorkspace(handle, name);
    },
    [attachDirectoryWorkspace, hasDirectorySupport]
  );

  const openWorkspace = useCallback(async () => {
    if (!hasDirectorySupport) {
      throw new Error("Folder workspaces are not supported in this browser.");
    }
    const pickerWindow = window as DirectoryPickerWindow;
    const handle = await pickerWindow.showDirectoryPicker?.({ mode: "readwrite" });
    if (!handle) return;
    await attachDirectoryWorkspace(handle);
  }, [attachDirectoryWorkspace, hasDirectorySupport]);

  const importWorkspaceFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as
        | Collection[]
        | {
            workspace?: Partial<WorkspaceMeta>;
            collections?: Collection[];
          };

      let importedCollections: Collection[] = [];
      let importedName: string | null = null;

      if (Array.isArray(parsed)) {
        importedCollections = reviveCollections(parsed);
      } else if (Array.isArray(parsed.collections)) {
        importedCollections = reviveCollections(parsed.collections);
        importedName = parsed.workspace?.name || null;
      } else {
        throw new Error("Invalid workspace file.");
      }

      const workspace = setWorkspaceTimestamp({
        id: crypto.randomUUID(),
        name: importedName || file.name.replace(/\.json$/i, "") || "Imported Workspace",
        storageMode: "browser",
        linkedDirectoryName: undefined,
        collectionsFileName: DEFAULT_COLLECTIONS_FILE,
        gitEnabled: false,
        updatedAt: new Date().toISOString(),
      });

      updateWorkspaceList((current) => [...current, workspace]);
      persistWorkspaceCollections(workspace.id, importedCollections);
      persistActiveWorkspaceId(workspace.id);
      skipNextSyncRef.current = true;
      setActiveWorkspaceId(workspace.id);
      replaceCollections(importedCollections);
    },
    [replaceCollections, updateWorkspaceList]
  );

  const exportWorkspace = useCallback(() => {
    const workspace = activeWorkspace;
    if (!workspace) {
      return {
        filename: "workspace.workspace.json",
        content: JSON.stringify({ workspace: null, collections: [] }, null, 2),
      };
    }

    return {
      filename: `${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workspace"}.workspace.json`,
      content: JSON.stringify(
        {
          workspace: makeWorkspaceManifest(workspace),
          collections,
        },
        null,
        2
      ),
    };
  }, [activeWorkspace, collections]);

  const setGitEnabled = useCallback(
    async (enabled: boolean) => {
      if (!activeWorkspace) return;
      const nextWorkspace = setWorkspaceTimestamp({
        ...activeWorkspace,
        gitEnabled: enabled,
      });

      updateWorkspaceList((current) =>
        current.map((workspace) => (workspace.id === nextWorkspace.id ? nextWorkspace : workspace))
      );

      if (nextWorkspace.storageMode === "folder") {
        await syncWorkspaceFiles(nextWorkspace, collections);
      }
    },
    [activeWorkspace, collections, syncWorkspaceFiles, updateWorkspaceList]
  );

  const syncNow = useCallback(async () => {
    if (!activeWorkspace) return;
    await persistCurrentWorkspaceCollections(activeWorkspace, collections);
  }, [activeWorkspace, collections, persistCurrentWorkspaceCollections]);

  const switchToBrowserWorkspace = useCallback(async () => {
    if (!activeWorkspace) return;

    if (activeWorkspace.storageMode === "folder") {
      await removeStoredDirectoryHandle(activeWorkspace.id);
      delete directoryHandlesRef.current[activeWorkspace.id];
    }

    const nextWorkspace = setWorkspaceTimestamp({
      ...activeWorkspace,
      storageMode: "browser",
      linkedDirectoryName: undefined,
      gitEnabled: false,
    });

    updateWorkspaceList((current) =>
      current.map((workspace) => (workspace.id === nextWorkspace.id ? nextWorkspace : workspace))
    );
    persistWorkspaceCollections(nextWorkspace.id, collections);
  }, [activeWorkspace, collections, updateWorkspaceList]);

  return {
    workspace: activeWorkspace,
    workspaces,
    hasDirectorySupport,
    setupOpen,
    setSetupOpen,
    manageOpen,
    setManageOpen,
    isSyncing,
    lastError,
    clearError: () => setLastError(null),
    createBrowserWorkspace,
    createFolderWorkspace,
    openWorkspace,
    switchWorkspace,
    importWorkspaceFile,
    exportWorkspace,
    setGitEnabled,
    syncNow,
    switchToBrowserWorkspace,
  };
}
