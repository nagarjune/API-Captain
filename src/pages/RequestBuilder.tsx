import { useState, useRef, useEffect } from "react";
import {
  Send,
  ArrowLeft,
  Anchor,
  Database,
  Trash2,
  Wifi,
  Globe,
  Clock,
  X,
  RefreshCw,
  Plus,
  Save,
  Settings2,
  Search,
  Cookie,
  TerminalSquare,
  Command,
  Github,
  Home,
  PanelLeft,
  PanelRight,
  LayoutGrid,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MethodSelector } from "@/components/request-builder/MethodSelector";
import { HeadersEditor, HeaderItem } from "@/components/request-builder/HeadersEditor";
import { QueryParamsEditor, QueryParamItem } from "@/components/request-builder/QueryParamsEditor";
import { AuthEditor, AuthConfig } from "@/components/request-builder/AuthEditor";
import { BodyEditor, BodyType } from "@/components/request-builder/BodyEditor";
import { FormDataField } from "@/components/request-builder/FormDataEditor";
import { ResponseViewer } from "@/components/request-builder/ResponseViewer";
import { RequestHistory } from "@/components/request-builder/RequestHistory";
import { EnvironmentSelector } from "@/components/request-builder/EnvironmentSelector";
import { CollectionsPanel } from "@/components/request-builder/CollectionsPanel";
import { WorkspaceSelector } from "@/components/request-builder/WorkspaceSelector";
import { SaveRequestDialog } from "@/components/request-builder/SaveRequestDialog";
import { CodeGeneratorDialog } from "@/components/request-builder/CodeGeneratorDialog";
import { WebSocketPanel } from "@/components/request-builder/WebSocketPanel";
import { PreScriptEditor } from "@/components/request-builder/PreScriptEditor";
import { PostScriptEditor } from "@/components/request-builder/PostScriptEditor";
import { useRequestHistory, RequestHistoryItem } from "@/hooks/useRequestHistory";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useCollections, SavedRequest } from "@/hooks/useCollections";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRequestCache } from "@/hooks/useRequestCache";
import { useBuilderSettings } from "@/hooks/useBuilderSettings";
import { useDesktopUpdates } from "@/hooks/useDesktopUpdates";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { runPreScript } from "@/lib/preScriptRunner";
import { runPostScript } from "@/lib/postScriptRunner";
import { ChainedVariablesPanel } from "@/components/request-builder/ChainedVariablesPanel";
import { ResponseDiffDialog } from "@/components/request-builder/ResponseDiffDialog";
import { KeyboardShortcutsDialog } from "@/components/request-builder/KeyboardShortcutsDialog";
import { FlowWorkspace } from "@/components/request-builder/FlowWorkspace";
import { BuilderSettingsDialog } from "@/components/request-builder/BuilderSettingsDialog";

export type ProtocolMode = "http" | "websocket";

interface BuilderResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

interface TabRequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

interface RequestTab {
  id: string;
  title: string;
  protocolMode: ProtocolMode;
  method: string;
  url: string;
  headers: HeaderItem[];
  queryParams: QueryParamItem[];
  auth: AuthConfig;
  body: string;
  bodyType: BodyType;
  graphqlQuery: string;
  graphqlVariables: string;
  formDataFields: FormDataField[];
  preScript: string;
  postScript: string;
  isLoading: boolean;
  lastRequestInfo: TabRequestInfo | null;
  response: BuilderResponse | null;
  linkedCollectionId: string | null;
  linkedRequestId: string | null;
  linkedRequestName: string | null;
}

type PanelLayoutMode = "split" | "request" | "sidebar";

const PANEL_LAYOUT_STORAGE_KEY = "api-captain.panel-layout";

function createDefaultHeaders(): HeaderItem[] {
  return [{ id: crypto.randomUUID(), key: "Content-Type", value: "application/json", enabled: true }];
}

function createRequestTab(index = 1): RequestTab {
  return {
    id: crypto.randomUUID(),
    title: `Request ${index}`,
    protocolMode: "http",
    method: "GET",
    url: "",
    headers: createDefaultHeaders(),
    queryParams: [],
    auth: { type: "none" },
    body: "",
    bodyType: "none",
    graphqlQuery: "",
    graphqlVariables: "",
    formDataFields: [],
    preScript: "",
    postScript: "",
    isLoading: false,
    lastRequestInfo: null,
    response: null,
    linkedCollectionId: null,
    linkedRequestId: null,
    linkedRequestName: null,
  };
}

const APP_VERSION = "v0.0.3";

export default function RequestBuilder() {
  const { toast } = useToast();
  const builderSettings = useBuilderSettings();
  const { state: updateState } = useDesktopUpdates();
  const {
    collections,
    addCollection,
    updateCollection,
    deleteCollection,
    addRequestToCollection,
    updateRequestInCollection,
    deleteRequestFromCollection,
    importCollections,
    replaceCollections,
    duplicateRequest,
    duplicateCollection,
    reorderRequests,
    moveRequestToCollection,
  } = useCollections();
  const {
    workspace,
    workspaces,
    hasDirectorySupport,
    setupOpen,
    setSetupOpen,
    manageOpen,
    setManageOpen,
    isSyncing,
    lastError,
    clearError,
    createBrowserWorkspace,
    createFolderWorkspace,
    openWorkspace,
    switchWorkspace,
    importWorkspaceFile,
    exportWorkspace,
    setGitEnabled,
    syncNow,
    switchToBrowserWorkspace,
  } = useWorkspace({
    collections,
    replaceCollections,
  });
  const activeWorkspaceId = workspace?.id;

  const { history, addToHistory, removeFromHistory, clearHistory } = useRequestHistory(activeWorkspaceId);
  const {
    environments,
    activeEnvironment,
    setActiveEnvironmentId,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addVariable,
    updateVariable,
    deleteVariable,
    replaceVariables,
  } = useEnvironments(activeWorkspaceId);

  const {
    getCached,
    setCached,
    clearCache,
    getCacheSize,
    cacheEnabled,
    setCacheEnabled,
  } = useRequestCache();

  const initialTabRef = useRef<RequestTab>(createRequestTab(1));
  const [tabs, setTabs] = useState<RequestTab[]>(() => [initialTabRef.current]);
  const [activeTabId, setActiveTabId] = useState<string>(() => initialTabRef.current.id);
  const [timeout, setTimeout] = useState<number>(30); // seconds
  const [timeoutEnabled, setTimeoutEnabled] = useState(true);
  const [sessionEnvVars, setSessionEnvVars] = useState<Record<string, string>>({});
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [retryDelay, setRetryDelay] = useState(1000); // ms
  const [retryCount, setRetryCount] = useState(0);
  const [runningTabId, setRunningTabId] = useState<string | null>(null);
  const previousWorkspaceIdRef = useRef<string | null>(null);
  const workspaceRequestStateRef = useRef<
    Record<string, { tabs: RequestTab[]; activeTabId: string; sessionEnvVars: Record<string, string> }>
  >({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [flowsOpen, setFlowsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelLayout, setPanelLayout] = useState<PanelLayoutMode>(() => {
    if (typeof window === "undefined") return "split";
    const saved = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);
    if (saved === "request" || saved === "sidebar" || saved === "split") {
      return saved;
    }
    return "split";
  });
  const tabsRef = useRef<RequestTab[]>(tabs);
  const activeTabIdRef = useRef<string>(activeTabId);
  const sessionEnvVarsRef = useRef<Record<string, string>>(sessionEnvVars);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    sessionEnvVarsRef.current = sessionEnvVars;
  }, [sessionEnvVars]);

  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, panelLayout);
  }, [panelLayout]);

  useEffect(() => {
    if (!lastError) return;
    toast({
      title: "Workspace Error",
      description: lastError,
      variant: "destructive",
    });
    clearError();
  }, [clearError, lastError, toast]);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    const previousWorkspaceId = previousWorkspaceIdRef.current;

    if (previousWorkspaceId && previousWorkspaceId !== activeWorkspaceId) {
      workspaceRequestStateRef.current[previousWorkspaceId] = {
        tabs: tabsRef.current,
        activeTabId: activeTabIdRef.current,
        sessionEnvVars: sessionEnvVarsRef.current,
      };
    }

    const nextWorkspaceState = workspaceRequestStateRef.current[activeWorkspaceId];
    if (nextWorkspaceState) {
      const restoredTabs =
        nextWorkspaceState.tabs.length > 0 ? nextWorkspaceState.tabs : [createRequestTab(1)];
      const restoredActiveTabId =
        restoredTabs.find((tab) => tab.id === nextWorkspaceState.activeTabId)?.id || restoredTabs[0].id;

      setTabs(restoredTabs);
      setActiveTabId(restoredActiveTabId);
      setSessionEnvVars(nextWorkspaceState.sessionEnvVars || {});
    } else {
      const freshTab = createRequestTab(1);
      setTabs([freshTab]);
      setActiveTabId(freshTab.id);
      setSessionEnvVars({});
    }

    previousWorkspaceIdRef.current = activeWorkspaceId;

    if (abortControllerRef.current && previousWorkspaceId && previousWorkspaceId !== activeWorkspaceId) {
      abortControllerRef.current.abort();
    }

    setRetryCount(0);
    setRunningTabId(null);
    clearCache();
  }, [activeWorkspaceId, clearCache]);

  const updateTab = (tabId: string, updater: (tab: RequestTab) => RequestTab) => {
    setTabs((previous) =>
      previous.map((tab) => (tab.id === tabId ? updater(tab) : tab))
    );
  };

  const updateActiveTab = (updater: (tab: RequestTab) => RequestTab) => {
    if (!activeTab) return;
    updateTab(activeTab.id, updater);
  };

  const protocolMode = activeTab?.protocolMode ?? "http";
  const method = activeTab?.method ?? "GET";
  const url = activeTab?.url ?? "";
  const headers = activeTab?.headers ?? [];
  const queryParams = activeTab?.queryParams ?? [];
  const auth = activeTab?.auth ?? { type: "none" };
  const body = activeTab?.body ?? "";
  const bodyType = activeTab?.bodyType ?? "none";
  const graphqlQuery = activeTab?.graphqlQuery ?? "";
  const graphqlVariables = activeTab?.graphqlVariables ?? "";
  const formDataFields = activeTab?.formDataFields ?? [];
  const preScript = activeTab?.preScript ?? "";
  const postScript = activeTab?.postScript ?? "";
  const isLoading = activeTab?.isLoading ?? false;
  const lastRequestInfo = activeTab?.lastRequestInfo ?? null;
  const response = activeTab?.response ?? null;

  const setProtocolMode = (next: ProtocolMode) => {
    updateActiveTab((tab) => ({ ...tab, protocolMode: next }));
  };
  const setMethod = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, method: next }));
  };
  const setUrl = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, url: next }));
  };
  const setHeaders = (next: HeaderItem[]) => {
    updateActiveTab((tab) => ({ ...tab, headers: next }));
  };
  const setQueryParams = (next: QueryParamItem[]) => {
    updateActiveTab((tab) => ({ ...tab, queryParams: next }));
  };
  const setAuth = (next: AuthConfig) => {
    updateActiveTab((tab) => ({ ...tab, auth: next }));
  };
  const setBody = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, body: next }));
  };
  const setBodyType = (next: BodyType) => {
    updateActiveTab((tab) => ({ ...tab, bodyType: next }));
  };
  const setGraphqlQuery = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, graphqlQuery: next }));
  };
  const setGraphqlVariables = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, graphqlVariables: next }));
  };
  const setFormDataFields = (next: FormDataField[]) => {
    updateActiveTab((tab) => ({ ...tab, formDataFields: next }));
  };
  const setPreScript = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, preScript: next }));
  };
  const setPostScript = (next: string) => {
    updateActiveTab((tab) => ({ ...tab, postScript: next }));
  };

  // Variable replacement that also checks session/chained variables
  const replaceAllVariables = (text: string): string => {
    let result = replaceVariables(text);
    // Session vars (from post-scripts) override environment vars
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, varName) => {
      const sessionVal = Object.entries(sessionEnvVars).find(
        ([k]) => k.toLowerCase() === varName.toLowerCase()
      );
      return sessionVal ? sessionVal[1] : match;
    });
    return result;
  };

  const removeSessionVar = (key: string) => {
    setSessionEnvVars(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const buildHeaders = (): Record<string, string> => {
    const result: Record<string, string> = {};
    
    // Add enabled custom headers with variable replacement
    headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => {
      result[replaceAllVariables(h.key)] = replaceAllVariables(h.value);
    });

    // Add auth headers with variable replacement
    if (auth.type === "bearer" && auth.bearer?.token) {
      result["Authorization"] = `Bearer ${replaceAllVariables(auth.bearer.token)}`;
    } else if (auth.type === "basic" && auth.basic?.username) {
      const encoded = btoa(`${replaceAllVariables(auth.basic.username)}:${replaceAllVariables(auth.basic.password || "")}`);
      result["Authorization"] = `Basic ${encoded}`;
    } else if (auth.type === "api-key" && auth.apiKey?.key && auth.apiKey.addTo === "header") {
      result[replaceAllVariables(auth.apiKey.key)] = replaceAllVariables(auth.apiKey.value || "");
    }

    return result;
  };

  const buildUrl = (): string => {
    // Replace variables in the base URL
    let finalUrl = replaceAllVariables(url);
    
    // Add enabled query params with variable replacement
    const enabledParams = queryParams.filter((p) => p.enabled && p.key.trim());
    if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map((p) => `${encodeURIComponent(replaceAllVariables(p.key))}=${encodeURIComponent(replaceAllVariables(p.value))}`)
        .join('&');
      const separator = finalUrl.includes("?") ? "&" : "?";
      finalUrl = `${finalUrl}${separator}${queryString}`;
    }
    
    // Add API key to query if configured
    if (auth.type === "api-key" && auth.apiKey?.key && auth.apiKey.addTo === "query") {
      const separator = finalUrl.includes("?") ? "&" : "?";
      finalUrl = `${finalUrl}${separator}${encodeURIComponent(replaceAllVariables(auth.apiKey.key))}=${encodeURIComponent(replaceAllVariables(auth.apiKey.value || ""))}`;
    }
    
    return finalUrl;
  };

  const sendRequest = async () => {
    if (!activeTab) return;
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL to send the request",
        variant: "destructive",
      });
      return;
    }

    const targetTabId = activeTab.id;
    const sourceMethod = method;
    const sourceUrl = url;
    const sourceBody = body;

    let requestHeaders = buildHeaders();
    let requestUrl = buildUrl();
    // Handle different body formats
    let requestBody: string | FormData = "";
    let isFormData = false;
    if (bodyType === "form-data") {
      const formData = new FormData();
      formDataFields.filter((f) => f.enabled && f.key.trim()).forEach((f) => {
        if (f.type === "file" && f.file) {
          formData.append(replaceAllVariables(f.key), f.file);
        } else {
          formData.append(replaceAllVariables(f.key), replaceAllVariables(f.value));
        }
      });
      requestBody = formData;
      isFormData = true;
      // Remove Content-Type so browser sets it with boundary
      delete requestHeaders["Content-Type"];
      delete requestHeaders["content-type"];
    } else if (bodyType === "graphql" && graphqlQuery.trim()) {
      const graphqlPayload: { query: string; variables?: unknown } = {
        query: graphqlQuery,
      };
      if (graphqlVariables.trim()) {
        try {
          graphqlPayload.variables = JSON.parse(graphqlVariables);
        } catch {
          // If variables are invalid JSON, ignore them
        }
      }
      requestBody = JSON.stringify(graphqlPayload);
    } else if (["POST", "PUT", "PATCH"].includes(method) && bodyType !== "none" && body.trim()) {
      requestBody = replaceAllVariables(body);
    }
    const bodyString = isFormData ? "[FormData]" : (requestBody as string);
    let requestMethod = method;

    // Run pre-script if present
    if (preScript.trim()) {
      const scriptResult = runPreScript(preScript, {
        url: requestUrl,
        method: requestMethod,
        headers: requestHeaders,
        body: bodyString,
        envGet: (key: string) =>
          sessionEnvVars[key] ||
          activeEnvironment?.variables.find((v) => v.key === key)?.value ||
          "",
        envSet: (key: string, value: string) => {
          setSessionEnvVars((prev) => ({ ...prev, [key]: value }));
        },
      });

      if (!scriptResult.success) {
        toast({
          title: "Pre-script Error",
          description: scriptResult.error,
          variant: "destructive",
        });
        return;
      }

      // Apply script modifications
      requestUrl = scriptResult.url;
      requestMethod = scriptResult.method;
      requestHeaders = scriptResult.headers;
      requestBody = scriptResult.body;

      // Log any console output from the script
      if (scriptResult.logs.length > 0) {
        console.log("[Pre-script output]", ...scriptResult.logs);
      }
    }

    // Check cache first
    const cached = !isFormData ? getCached(requestMethod, requestUrl, requestHeaders, bodyString) : null;
    if (cached) {
      updateTab(targetTabId, (tab) => ({
        ...tab,
        response: {
          ...cached,
          duration: cached.duration,
        },
      }));
      toast({
        title: "Cached Response",
        description: `Loaded from cache (cached ${Math.round((Date.now() - cached.cachedAt) / 1000)}s ago)`,
      });
      return;
    }

    // Create AbortController for timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setRunningTabId(targetTabId);

    let timeoutId: number | null = null;
    if (timeoutEnabled && timeout > 0) {
      timeoutId = window.setTimeout(() => {
        abortController.abort();
      }, timeout * 1000);
    }

    updateTab(targetTabId, (tab) => ({
      ...tab,
      isLoading: true,
      response: null,
    }));
    setRetryCount(0);

    const maxAttempts = retryEnabled ? retryAttempts : 1;

    const startTime = performance.now();
    let lastError: unknown = null;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
          setRetryCount(attempt - 1);
          toast({
            title: "Retrying Request",
            description: `Attempt ${attempt}/${maxAttempts} after ${retryDelay}ms delay...`,
          });
          await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
          // Check if cancelled during delay
          if (abortController.signal.aborted) break;
        }

        try {
          const fetchOptions: RequestInit = {
            method: requestMethod,
            headers: requestHeaders,
            signal: abortController.signal,
          };

          if (requestBody) {
            fetchOptions.body = requestBody;
          }

          const res = await fetch(requestUrl, fetchOptions);
          const endTime = performance.now();
          const duration = Math.round(endTime - startTime);

          const responseHeaders: Record<string, string> = {};
          res.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          const responseBody = await res.text();

          const responseData: BuilderResponse = {
            status: res.status,
            statusText: res.statusText,
            headers: responseHeaders,
            body: responseBody,
            duration,
          };

          // If response is a server error and retries remain, retry
          if (res.status >= 500 && attempt < maxAttempts) {
            lastError = new Error(`Server error ${res.status}`);
            continue;
          }

          updateTab(targetTabId, (tab) => ({
            ...tab,
            response: responseData,
          }));

          if (attempt > 1) {
            toast({
              title: "Request Succeeded",
              description: `Succeeded on attempt ${attempt}/${maxAttempts}`,
            });
          }

          // Store request info for post-script testing
          updateTab(targetTabId, (tab) => ({
            ...tab,
            lastRequestInfo: {
              url: requestUrl,
              method: requestMethod,
              headers: requestHeaders,
              body: bodyString,
            },
          }));

          // Run post-script if present
          if (postScript.trim()) {
            const postScriptResult = runPostScript(postScript, {
              response: responseData,
              request: {
                url: requestUrl,
                method: requestMethod,
                headers: requestHeaders,
                body: bodyString,
              },
              envGet: (key: string) =>
                sessionEnvVars[key] ||
                activeEnvironment?.variables.find((v) => v.key === key)?.value ||
                "",
              envSet: (key: string, value: string) => {
                setSessionEnvVars((prev) => ({ ...prev, [key]: value }));
              },
            });

            if (postScriptResult.logs.length > 0) {
              console.log("[Post-script output]", ...postScriptResult.logs);
            }

            if (postScriptResult.testResults.length > 0) {
              const passed = postScriptResult.testResults.filter((t) => t.passed).length;
              const total = postScriptResult.testResults.length;
              toast({
                title: passed === total ? "All Tests Passed" : "Some Tests Failed",
                description: `${passed}/${total} tests passed`,
                variant: passed === total ? "default" : "destructive",
              });
            }

            if (!postScriptResult.success) {
              toast({
                title: "Post-script Error",
                description: postScriptResult.error,
                variant: "destructive",
              });
            }
          }

          // Cache successful responses (2xx)
          if (res.status >= 200 && res.status < 300) {
            setCached(sourceMethod, requestUrl, requestHeaders, bodyString, responseData);
          }

          // Add to history
          addToHistory({
            method: sourceMethod,
            url: sourceUrl,
            headers: requestHeaders,
            body: sourceBody,
            response: responseData,
          });

          // Success - break out of retry loop
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const isAborted = error instanceof Error && error.name === "AbortError";

          // Don't retry on manual abort
          if (isAborted) break;

          // If retries remain, continue
          if (attempt < maxAttempts) continue;
        }
      }

      // If all attempts failed, handle the final error
      if (lastError) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        const isAborted =
          lastError instanceof Error && (lastError as Error).name === "AbortError";
        const errorMessage = isAborted
          ? `Request timed out after ${timeout} seconds`
          : lastError instanceof Error
          ? lastError.message
          : "Unknown error";

        const retriedSuffix = retryEnabled && !isAborted ? ` (after ${retryAttempts} attempts)` : "";

        toast({
          title: isAborted ? "Request Timeout" : "Request Failed",
          description: errorMessage + retriedSuffix,
          variant: "destructive",
        });

        const errorResponse: BuilderResponse = {
          status: 0,
          statusText: isAborted ? "Timeout" : "Network Error",
          headers: {},
          body: JSON.stringify({ error: errorMessage }),
          duration,
        };

        updateTab(targetTabId, (tab) => ({
          ...tab,
          response: errorResponse,
        }));

        addToHistory({
          method: sourceMethod,
          url: sourceUrl,
          headers: requestHeaders,
          body: sourceBody,
          response: errorResponse,
        });
      }
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      abortControllerRef.current = null;
      setRetryCount(0);
      setRunningTabId(null);
      updateTab(targetTabId, (tab) => ({
        ...tab,
        isLoading: false,
      }));
    }
  };

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({
        title: "Request Cancelled",
        description: "The request was manually cancelled",
      });
    }
  };

  const loadFromHistory = (item: RequestHistoryItem) => {
    // Convert headers back to HeaderItem format
    const headerItems: HeaderItem[] = Object.entries(item.headers)
      .filter(([key]) => !["Authorization"].includes(key))
      .map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
        enabled: true,
      }));
    
    updateActiveTab((tab) => ({
      ...tab,
      method: item.method,
      url: item.url,
      body: item.body,
      bodyType: item.body ? "json" : "none",
      headers: headerItems.length > 0 ? headerItems : createDefaultHeaders(),
      response: item.response ?? tab.response,
      linkedCollectionId: null,
      linkedRequestId: null,
      linkedRequestName: null,
    }));

    toast({
      title: "Request Loaded",
      description: `Loaded ${item.method} ${item.url}`,
    });
  };

  const loadFromCollection = (request: SavedRequest) => {
    updateActiveTab((tab) => ({
      ...tab,
      title: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      queryParams: request.queryParams,
      auth: request.auth,
      body: request.body,
      bodyType: request.bodyType,
      graphqlQuery: request.graphqlQuery || "",
      graphqlVariables: request.graphqlVariables || "",
      response: null,
      lastRequestInfo: null,
      linkedCollectionId: collections.find((collection) =>
        collection.requests.some((item) => item.id === request.id)
      )?.id || null,
      linkedRequestId: request.id,
      linkedRequestName: request.name,
    }));

    toast({
      title: "Request Loaded",
      description: `Loaded "${request.name}" from collection`,
    });
  };

  const handleSaveRequest = (collectionId: string, name: string) => {
    const savedRequest = addRequestToCollection(collectionId, {
      name,
      method,
      url,
      headers,
      queryParams,
      auth,
      body,
      bodyType,
      graphqlQuery,
      graphqlVariables,
    });

    updateActiveTab((tab) => ({
      ...tab,
      title: savedRequest.name,
      linkedCollectionId: collectionId,
      linkedRequestId: savedRequest.id,
      linkedRequestName: savedRequest.name,
    }));

    toast({
      title: "Request Saved",
      description: `"${name}" has been saved to collection`,
    });
  };

  const handleCreateCollectionFromSave = (name: string): string => {
    const collection = addCollection(name);
    return collection.id;
  };

  const handleSaveCurrentRequest = () => {
    if (!activeTab) return;
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL before saving.",
        variant: "destructive",
      });
      return;
    }

    if (activeTab.linkedCollectionId && activeTab.linkedRequestId) {
      const requestName = activeTab.linkedRequestName || activeTab.title || "Request";
      updateRequestInCollection(activeTab.linkedCollectionId, activeTab.linkedRequestId, {
        name: requestName,
        method,
        url,
        headers,
        queryParams,
        auth,
        body,
        bodyType,
        graphqlQuery,
        graphqlVariables,
      });

      toast({
        title: "Request Updated",
        description: `"${requestName}" updated in its collection.`,
      });
      return;
    }

    setSaveDialogOpen(true);
  };

  const addRequestTab = () => {
    const next = createRequestTab(tabs.length + 1);
    setTabs((previous) => [...previous, next]);
    setActiveTabId(next.id);
  };

  const closeRequestTab = (tabId: string) => {
    if (tabs.length <= 1 || runningTabId === tabId) return;
    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    setTabs(remaining);

    if (activeTabId === tabId) {
      const fallback = remaining[Math.max(0, closingIndex - 1)] ?? remaining[0];
      if (fallback) {
        setActiveTabId(fallback.id);
      }
    }
  };

  // Keyboard shortcuts
  const sendRequestRef = useRef(sendRequest);
  sendRequestRef.current = sendRequest;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (!isLoading && protocolMode === "http") sendRequestRef.current();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (url.trim()) handleSaveCurrentRequest();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }
    };
    const shortcutHandler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keydown", shortcutHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keydown", shortcutHandler);
    };
  }, [isLoading, protocolMode, url, activeTab, method, headers, queryParams, auth, body, bodyType, graphqlQuery, graphqlVariables]);

  const isDesktopShell =
    typeof window !== "undefined" &&
    Boolean((window as Window & { desktop?: { version?: string } }).desktop?.version);
  const showGithubUpdateLabel = !builderSettings.autoUpdates && updateState.updateAvailable;
  const githubUpdateLabel = updateState.latestVersion
    ? `New v${updateState.latestVersion} available`
    : "New version available";
  const showRequestPanel = panelLayout !== "sidebar";
  const showSidebarPanel = panelLayout !== "request";
  const mainGridClass =
    panelLayout === "split"
      ? "grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6"
      : "grid h-full min-h-0 grid-cols-1 gap-6";

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/70 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-10 border-b border-border/70 bg-[linear-gradient(90deg,#1a1b1f_0%,#23252b_50%,#1f2126_100%)] app-chrome-drag">
          <div className="w-full h-full px-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 app-chrome-no-drag">
              {isDesktopShell && (
                <div className="hidden md:flex items-center gap-1.5 mr-1">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
              )}
              <Link to="/">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-300 hover:text-zinc-100 hover:bg-white/10"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              <WorkspaceSelector
                workspace={workspace}
                workspaces={workspaces}
                hasDirectorySupport={hasDirectorySupport}
                setupOpen={setupOpen}
                setSetupOpen={setSetupOpen}
                manageOpen={manageOpen}
                setManageOpen={setManageOpen}
                isSyncing={isSyncing}
                switchWorkspace={switchWorkspace}
                createBrowserWorkspace={createBrowserWorkspace}
                createFolderWorkspace={createFolderWorkspace}
                openWorkspace={openWorkspace}
                importWorkspaceFile={importWorkspaceFile}
                exportWorkspace={exportWorkspace}
                setGitEnabled={setGitEnabled}
                syncNow={syncNow}
                switchToBrowserWorkspace={switchToBrowserWorkspace}
                featureGitEnabled={builderSettings.featureGit}
                featureFileExplorerEnabled={builderSettings.featureFileExplorer}
                featureShowApiCaptainJsonEnabled={builderSettings.featureShowApiCaptainJson}
                compact
                triggerClassName="text-zinc-100 hover:text-zinc-100"
              />
            </div>
            <div className="hidden md:flex items-center gap-2 text-zinc-100 pointer-events-none">
              <Anchor className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-wide">API Captain</span>
            </div>
            <div className="flex items-center gap-1 app-chrome-no-drag">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 hover:text-zinc-100 hover:bg-white/10 ${
                  panelLayout === "request" ? "bg-white/10 text-zinc-100" : "text-zinc-300"
                }`}
                onClick={() => setPanelLayout("request")}
                title="Focus request panel"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 hover:text-zinc-100 hover:bg-white/10 ${
                  panelLayout === "sidebar" ? "bg-white/10 text-zinc-100" : "text-zinc-300"
                }`}
                onClick={() => setPanelLayout("sidebar")}
                title="Focus sidebar panel"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 hover:text-zinc-100 hover:bg-white/10 ${
                  panelLayout === "split" ? "bg-white/10 text-zinc-100" : "text-zinc-300"
                }`}
                onClick={() => setPanelLayout("split")}
                title="Layout grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 shrink-0">
              <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <h1 className="text-lg font-medium whitespace-nowrap">Request Builder</h1>
            </div>
            <div className="flex items-center gap-3 min-w-0 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Protocol Toggle */}
              <ToggleGroup 
                type="single" 
                value={protocolMode} 
                onValueChange={(v) => v && setProtocolMode(v as ProtocolMode)}
                className="bg-secondary/50 p-1 rounded-lg"
              >
                <ToggleGroupItem value="http" className="gap-1.5 text-xs px-3">
                  <Globe className="h-3.5 w-3.5" />
                  HTTP
                </ToggleGroupItem>
                <ToggleGroupItem value="websocket" className="gap-1.5 text-xs px-3">
                  <Wifi className="h-3.5 w-3.5" />
                  WebSocket
                </ToggleGroupItem>
              </ToggleGroup>
              <TooltipProvider>
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Cache</span>
                        <Switch
                          checked={cacheEnabled}
                          onCheckedChange={setCacheEnabled}
                          className="scale-75"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {cacheEnabled ? "Response caching is enabled (5 min TTL)" : "Response caching is disabled"}
                    </TooltipContent>
                  </Tooltip>
                  {getCacheSize() > 0 && (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        {getCacheSize()}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={clearCache}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear all cached responses</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
                {/* Timeout Config */}
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Timeout</span>
                        <Switch
                          checked={timeoutEnabled}
                          onCheckedChange={setTimeoutEnabled}
                          className="scale-75"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {timeoutEnabled ? `Requests timeout after ${timeout}s` : "Request timeout is disabled"}
                    </TooltipContent>
                  </Tooltip>
                {timeoutEnabled && (
                    <select
                      value={timeout}
                      onChange={(e) => setTimeout(Number(e.target.value))}
                      className="bg-transparent text-sm text-foreground border-none outline-none cursor-pointer"
                    >
                      <option value={5}>5s</option>
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                      <option value={120}>120s</option>
                    </select>
                  )}
                </div>
                {/* Retry Config */}
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Retry</span>
                        <Switch
                          checked={retryEnabled}
                          onCheckedChange={setRetryEnabled}
                          className="scale-75"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {retryEnabled
                        ? `Retry failed requests up to ${retryAttempts}× with ${retryDelay}ms delay`
                        : "Auto-retry is disabled"}
                    </TooltipContent>
                  </Tooltip>
                  {retryEnabled && (
                    <>
                      <select
                        value={retryAttempts}
                        onChange={(e) => setRetryAttempts(Number(e.target.value))}
                        className="bg-transparent text-sm text-foreground border-none outline-none cursor-pointer"
                      >
                        <option value={2}>2×</option>
                        <option value={3}>3×</option>
                        <option value={5}>5×</option>
                        <option value={10}>10×</option>
                      </select>
                      <select
                        value={retryDelay}
                        onChange={(e) => setRetryDelay(Number(e.target.value))}
                        className="bg-transparent text-sm text-foreground border-none outline-none cursor-pointer"
                      >
                        <option value={500}>500ms</option>
                        <option value={1000}>1s</option>
                        <option value={2000}>2s</option>
                        <option value={5000}>5s</option>
                      </select>
                    </>
                  )}
                  {isLoading && retryCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      retry {retryCount}
                    </Badge>
                  )}
                </div>
              </TooltipProvider>
              <EnvironmentSelector
                environments={environments}
                activeEnvironment={activeEnvironment}
                onSelect={setActiveEnvironmentId}
                onAddEnvironment={addEnvironment}
                onUpdateEnvironment={updateEnvironment}
                onDeleteEnvironment={deleteEnvironment}
                onAddVariable={addVariable}
                onUpdateVariable={updateVariable}
                onDeleteVariable={deleteVariable}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-6 flex-1 min-h-0 overflow-hidden">
        <div className={mainGridClass}>
          {/* Main Request Panel */}
          {showRequestPanel && (
          <div className="space-y-6 min-h-0 overflow-y-auto pr-1">
            {/* Request Tabs */}
            <Card className="bg-card-gradient border-border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {tabs.map((tab) => {
                    const active = tab.id === activeTabId;
                    const disabled = !!runningTabId && runningTabId !== tab.id;
                    const tabLabel = tab.url.trim()
                      ? tab.url.replace(/^https?:\/\//, "")
                      : tab.title;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => !disabled && setActiveTabId(tab.id)}
                        className={`group shrink-0 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-primary/60 bg-primary/10 text-foreground"
                            : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tab.protocolMode === "http" ? tab.method : "WS"}
                        </Badge>
                        <span className="max-w-[220px] truncate">{tabLabel}</span>
                        {tab.isLoading && (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                        {tabs.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Close ${tab.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              closeRequestTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={addRequestTab}
                    disabled={!!runningTabId}
                    aria-label="Add request tab"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            {protocolMode === "http" ? (
              <>
                {/* URL Bar */}
                <Card className="bg-card-gradient border-border">
                  <CardContent className="p-4">
                    <div className="flex gap-2">
                      <MethodSelector value={method} onChange={setMethod} />
                      <Input
                        ref={urlInputRef}
                        placeholder="https://api.example.com/endpoint"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="flex-1 font-mono"
                        onKeyDown={(e) => e.key === "Enter" && sendRequest()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={handleSaveCurrentRequest}
                        disabled={!url.trim()}
                      >
                        <Save className="h-4 w-4" />
                        {activeTab?.linkedRequestId ? "Update" : "Save"}
                      </Button>
                      <SaveRequestDialog
                        collections={collections}
                        onSave={handleSaveRequest}
                        onCreateCollection={handleCreateCollectionFromSave}
                        disabled={!url.trim()}
                        hideTrigger
                        defaultRequestName={activeTab?.linkedRequestName || activeTab?.title || "Request"}
                        defaultCollectionId={activeTab?.linkedCollectionId || ""}
                        open={saveDialogOpen}
                        onOpenChange={setSaveDialogOpen}
                      />
                      <CodeGeneratorDialog
                        config={{
                          method,
                          url,
                          headers,
                          queryParams,
                          auth,
                          body,
                          bodyType,
                        }}
                        disabled={!url.trim()}
                      />
                      {isLoading ? (
                        <Button
                          onClick={cancelRequest}
                          variant="destructive"
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={sendRequest}
                              className="gap-2"
                              variant="hero"
                            >
                              <Send className="h-4 w-4" />
                              Send
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Request (Ctrl+Enter)</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Request Configuration */}
                <Card className="bg-card-gradient border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Request Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="params" className="w-full">
                      <TabsList className="w-full justify-start mb-4">
                        <TabsTrigger value="params">Params</TabsTrigger>
                        <TabsTrigger value="headers">Headers</TabsTrigger>
                        <TabsTrigger value="body">Body</TabsTrigger>
                        <TabsTrigger value="auth">Auth</TabsTrigger>
                        <TabsTrigger value="pre-script">Pre-Script</TabsTrigger>
                        <TabsTrigger value="post-script">Post-Script</TabsTrigger>
                      </TabsList>

                      <TabsContent value="params">
                        <QueryParamsEditor params={queryParams} onChange={setQueryParams} />
                      </TabsContent>

                      <TabsContent value="headers">
                        <HeadersEditor headers={headers} onChange={setHeaders} />
                      </TabsContent>

                      <TabsContent value="body">
                        <BodyEditor
                          body={body}
                          bodyType={bodyType}
                          onBodyChange={setBody}
                          onBodyTypeChange={setBodyType}
                          graphqlQuery={graphqlQuery}
                          graphqlVariables={graphqlVariables}
                          onGraphqlQueryChange={setGraphqlQuery}
                          onGraphqlVariablesChange={setGraphqlVariables}
                          endpoint={buildUrl()}
                          formDataFields={formDataFields}
                          onFormDataFieldsChange={setFormDataFields}
                        />
                      </TabsContent>

                      <TabsContent value="auth">
                        <AuthEditor auth={auth} onChange={setAuth} />
                      </TabsContent>

                      <TabsContent value="pre-script">
                        <PreScriptEditor
                          script={preScript}
                          onChange={setPreScript}
                          onTest={() => {
                            const requestHeaders = buildHeaders();
                            const requestUrl = buildUrl();
                            const requestBody = ["POST", "PUT", "PATCH"].includes(method) && bodyType !== "none" && body.trim() 
                              ? replaceAllVariables(body) 
                              : "";
                            
                            const result = runPreScript(preScript, {
                              url: requestUrl,
                              method,
                              headers: requestHeaders,
                              body: requestBody,
                              envGet: (key: string) => sessionEnvVars[key] || activeEnvironment?.variables.find(v => v.key === key)?.value || "",
                              envSet: (key: string, value: string) => {
                                setSessionEnvVars(prev => ({ ...prev, [key]: value }));
                              },
                            });

                            return {
                              success: result.success,
                              output: result.logs.join("\n"),
                              error: result.error,
                            };
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="post-script">
                        <PostScriptEditor
                          script={postScript}
                          onChange={setPostScript}
                          hasResponse={!!response}
                          onTest={() => {
                            if (!response) {
                              return {
                                success: false,
                                logs: [],
                                testResults: [],
                                error: "No response to test against. Send a request first.",
                              };
                            }
                            
                            return runPostScript(postScript, {
                              response,
                              request: lastRequestInfo || {
                                url: buildUrl(),
                                method,
                                headers: buildHeaders(),
                                body: ["POST", "PUT", "PATCH"].includes(method) && bodyType !== "none" && body.trim() 
                                  ? replaceAllVariables(body) 
                                  : "",
                              },
                              envGet: (key: string) => sessionEnvVars[key] || activeEnvironment?.variables.find(v => v.key === key)?.value || "",
                              envSet: (key: string, value: string) => {
                                setSessionEnvVars(prev => ({ ...prev, [key]: value }));
                              },
                            });
                          }}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Response */}
                <Card className="bg-card-gradient border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Response</CardTitle>
                      <ResponseDiffDialog currentResponse={response} history={history} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponseViewer response={response} isLoading={isLoading} />
                  </CardContent>
                </Card>
              </>
            ) : (
              /* WebSocket Mode */
              <Card className="bg-card-gradient border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-primary" />
                    WebSocket Testing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WebSocketPanel />
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {/* Sidebar */}
          {showSidebarPanel && (
          <div className="space-y-4 min-h-0 overflow-y-auto pr-1">
            {/* Chained Variables */}
            <ChainedVariablesPanel
              variables={sessionEnvVars}
              onClear={() => setSessionEnvVars({})}
              onRemove={removeSessionVar}
            />
            {/* Collections */}
            <Card className="bg-card-gradient border-border overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[calc(100vh-22rem)]">
              <CardContent className="p-4 min-h-0 overflow-y-auto">
                <CollectionsPanel
                  collections={collections}
                  onAddCollection={addCollection}
                  onUpdateCollection={updateCollection}
                  onDeleteCollection={deleteCollection}
                  onAddRequestToCollection={addRequestToCollection}
                  onLoadRequest={loadFromCollection}
                  onDeleteRequest={deleteRequestFromCollection}
                  onImportCollections={importCollections}
                  onDuplicateRequest={duplicateRequest}
                  onDuplicateCollection={duplicateCollection}
                  onReorderRequests={reorderRequests}
                  onMoveRequest={moveRequestToCollection}
                  onUpdateRequest={updateRequestInCollection}
                  currentConfig={{
                    method,
                    url,
                    headers,
                    queryParams,
                    auth,
                    body,
                    bodyType,
                    graphqlQuery,
                    graphqlVariables,
                  }}
                />
              </CardContent>
            </Card>

            {/* Flows */}
            <Card className="bg-card-gradient border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Flows</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Build and run drag-and-drop flows using saved collection requests and utility functions.
                </p>
                <Button onClick={() => setFlowsOpen(true)} className="w-full">
                  Open Flow Builder
                </Button>
              </CardContent>
            </Card>

            {/* History */}
            <Card className="bg-card-gradient border-border">
              <CardContent className="p-4">
                <RequestHistory
                  history={history}
                  onSelect={loadFromHistory}
                  onRemove={removeFromHistory}
                  onClear={clearHistory}
                />
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </main>
      <footer className="border-t border-border bg-card/70 backdrop-blur-sm px-4 py-1.5">
        <div className="w-full flex items-center justify-between gap-3 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShortcutsOpen(true)}
              title="Keyboard Shortcuts"
            >
              <Command className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFlowsOpen(true)}
              title="Flow Runner"
            >
              <TerminalSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
              title="GitHub Repository"
            >
              <a
                href="https://github.com/nagarjune/API-Captain"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
            {showGithubUpdateLabel && (
              <span className="text-[11px] text-amber-300 font-medium whitespace-nowrap">
                {githubUpdateLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                urlInputRef.current?.focus();
                urlInputRef.current?.select();
              }}
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                toast({
                  title: "Cache & Cookies",
                  description: cacheEnabled
                    ? "Cache is enabled. Browser cookies are managed by the browser profile."
                    : "Cache is disabled. Browser cookies are managed by the browser profile.",
                })
              }
            >
              <Cookie className="h-3.5 w-3.5" />
              Cookies
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                toast({
                  title: "Dev Tools",
                  description: "Open browser dev tools with Ctrl+Shift+I (or Cmd+Option+I on macOS).",
                })
              }
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Dev Tools
            </Button>
            <Badge variant="outline" className="h-8 px-2 rounded-md text-xs shrink-0">
              {APP_VERSION}
            </Badge>
          </div>
        </div>
      </footer>
      <Dialog open={flowsOpen} onOpenChange={setFlowsOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Flow Builder</DialogTitle>
          </DialogHeader>
          <div className="h-full min-h-0 pb-4">
            <FlowWorkspace
              key={activeWorkspaceId || "workspace-default"}
              workspaceId={activeWorkspaceId || "workspace-default"}
              collections={collections}
            />
          </div>
        </DialogContent>
      </Dialog>
      <BuilderSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
