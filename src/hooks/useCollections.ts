import { useState, useCallback } from 'react';
import { HeaderItem } from '@/components/request-builder/HeadersEditor';
import { QueryParamItem } from '@/components/request-builder/QueryParamsEditor';
import { AuthConfig } from '@/components/request-builder/AuthEditor';
import { BodyType } from '@/components/request-builder/BodyEditor';

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  folderPath?: string[];
  headers: HeaderItem[];
  queryParams: QueryParamItem[];
  auth: AuthConfig;
  body: string;
  bodyType: BodyType;
  graphqlQuery?: string;
  graphqlVariables?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  requests: SavedRequest[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'api-collections';

const toDate = (value: unknown): Date => {
  const parsed = value ? new Date(value as string | number | Date) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeFolderPath = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

export function reviveCollections(data: unknown): Collection[] {
  if (!Array.isArray(data)) return [];

  return data.map((rawCollection) => {
    const collection = rawCollection as Partial<Collection>;
    const requests = Array.isArray(collection.requests) ? collection.requests : [];

    return {
      id: collection.id || crypto.randomUUID(),
      name: collection.name || 'Untitled Collection',
      description: collection.description || '',
      requests: requests.map((rawRequest) => {
        const request = rawRequest as Partial<SavedRequest>;
        return {
          id: request.id || crypto.randomUUID(),
          name: request.name || 'Untitled Request',
          method: request.method || 'GET',
          url: request.url || '',
          folderPath: normalizeFolderPath(request.folderPath),
          headers: Array.isArray(request.headers) ? request.headers : [],
          queryParams: Array.isArray(request.queryParams) ? request.queryParams : [],
          auth: request.auth || { type: 'none' },
          body: request.body || '',
          bodyType: request.bodyType || 'none',
          graphqlQuery: request.graphqlQuery || '',
          graphqlVariables: request.graphqlVariables || '',
          createdAt: toDate(request.createdAt),
          updatedAt: toDate(request.updatedAt),
        } as SavedRequest;
      }),
      createdAt: toDate(collection.createdAt),
      updatedAt: toDate(collection.updatedAt),
    } as Collection;
  });
}

export function parseCollectionsJson(json: string): Collection[] {
  try {
    return reviveCollections(JSON.parse(json));
  } catch {
    return [];
  }
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseCollectionsJson(stored) : [];
  });

  const saveToStorage = useCallback((updated: Collection[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addCollection = useCallback((name: string, description: string = '') => {
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name,
      description,
      requests: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setCollections((prev) => {
      const updated = [...prev, newCollection];
      saveToStorage(updated);
      return updated;
    });

    return newCollection;
  }, [saveToStorage]);

  const updateCollection = useCallback((id: string, name: string, description: string) => {
    setCollections((prev) => {
      const updated = prev.map((col) =>
        col.id === id
          ? { ...col, name, description, updatedAt: new Date() }
          : col
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const deleteCollection = useCallback((id: string) => {
    setCollections((prev) => {
      const updated = prev.filter((col) => col.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const addRequestToCollection = useCallback((
    collectionId: string,
    request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const newRequest: SavedRequest = {
      ...request,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      folderPath: normalizeFolderPath(request.folderPath),
    };

    setCollections((prev) => {
      const updated = prev.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              requests: [...col.requests, newRequest],
              updatedAt: new Date(),
            }
          : col
      );
      saveToStorage(updated);
      return updated;
    });

    return newRequest;
  }, [saveToStorage]);

  const updateRequestInCollection = useCallback((
    collectionId: string,
    requestId: string,
    request: Partial<Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    setCollections((prev) => {
      const updated = prev.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              requests: col.requests.map((req) =>
                req.id === requestId
                  ? (() => {
                      const nextRequest: SavedRequest = {
                        ...req,
                        ...request,
                        updatedAt: new Date(),
                      };
                      if ('folderPath' in request) {
                        nextRequest.folderPath = normalizeFolderPath(request.folderPath);
                      }
                      return nextRequest;
                    })()
                  : req
              ),
              updatedAt: new Date(),
            }
          : col
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const deleteRequestFromCollection = useCallback((collectionId: string, requestId: string) => {
    setCollections((prev) => {
      const updated = prev.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              requests: col.requests.filter((req) => req.id !== requestId),
              updatedAt: new Date(),
            }
          : col
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const importCollections = useCallback((newCollections: Collection[]) => {
    setCollections((prev) => {
      // Generate new IDs to avoid conflicts
      const collectionsWithNewIds = reviveCollections(newCollections).map((col) => ({
        ...col,
        id: crypto.randomUUID(),
        requests: col.requests.map((req) => ({
          ...req,
          id: crypto.randomUUID(),
        })),
      }));
      const updated = [...prev, ...collectionsWithNewIds];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const replaceCollections = useCallback((nextCollections: Collection[]) => {
    setCollections(() => {
      const normalized = reviveCollections(nextCollections);
      saveToStorage(normalized);
      return normalized;
    });
  }, [saveToStorage]);

  const duplicateRequest = useCallback((collectionId: string, requestId: string) => {
    let duplicatedRequest: SavedRequest | null = null;
    
    setCollections((prev) => {
      const updated = prev.map((col) => {
        if (col.id !== collectionId) return col;
        
        const originalRequest = col.requests.find((req) => req.id === requestId);
        if (!originalRequest) return col;
        
        duplicatedRequest = {
          ...originalRequest,
          id: crypto.randomUUID(),
          name: `${originalRequest.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        return {
          ...col,
          requests: [...col.requests, duplicatedRequest],
          updatedAt: new Date(),
        };
      });
      saveToStorage(updated);
      return updated;
    });
    
    return duplicatedRequest;
  }, [saveToStorage]);

  const duplicateCollection = useCallback((collectionId: string) => {
    let clonedCollection: Collection | null = null;

    setCollections((prev) => {
      const source = prev.find((col) => col.id === collectionId);
      if (!source) return prev;

      clonedCollection = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (Copy)`,
        requests: source.requests.map((req) => ({
          ...req,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = [...prev, clonedCollection];
      saveToStorage(updated);
      return updated;
    });

    return clonedCollection;
  }, [saveToStorage]);

  const reorderRequests = useCallback((
    collectionId: string,
    oldIndex: number,
    newIndex: number
  ) => {
    setCollections((prev) => {
      const updated = prev.map((col) => {
        if (col.id !== collectionId) return col;
        
        const newRequests = [...col.requests];
        const [removed] = newRequests.splice(oldIndex, 1);
        newRequests.splice(newIndex, 0, removed);
        
        return {
          ...col,
          requests: newRequests,
          updatedAt: new Date(),
        };
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const moveRequestToCollection = useCallback((
    sourceCollectionId: string,
    targetCollectionId: string,
    requestId: string,
    targetIndex?: number
  ) => {
    setCollections((prev) => {
      // Find the request in the source collection
      const sourceCollection = prev.find((col) => col.id === sourceCollectionId);
      if (!sourceCollection) return prev;
      
      const request = sourceCollection.requests.find((req) => req.id === requestId);
      if (!request) return prev;
      
      const updated = prev.map((col) => {
        if (col.id === sourceCollectionId) {
          // Remove from source
          return {
            ...col,
            requests: col.requests.filter((req) => req.id !== requestId),
            updatedAt: new Date(),
          };
        }
        if (col.id === targetCollectionId) {
          // Add to target at specified index or end
          const newRequests = [...col.requests];
          const insertIndex = targetIndex !== undefined ? targetIndex : newRequests.length;
          newRequests.splice(insertIndex, 0, { ...request, updatedAt: new Date() });
          return {
            ...col,
            requests: newRequests,
            updatedAt: new Date(),
          };
        }
        return col;
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  return {
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
  };
}
