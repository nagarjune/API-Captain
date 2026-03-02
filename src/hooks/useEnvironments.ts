import { useState, useCallback, useEffect } from 'react';

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

const createDefaultEnvironments = (): Environment[] => [
  {
    id: 'dev',
    name: 'Development',
    variables: [
      { id: crypto.randomUUID(), key: 'BASE_URL', value: 'http://localhost:3000' },
      { id: crypto.randomUUID(), key: 'API_KEY', value: 'dev-api-key' },
    ],
  },
  {
    id: 'staging',
    name: 'Staging',
    variables: [
      { id: crypto.randomUUID(), key: 'BASE_URL', value: 'https://staging.api.example.com' },
      { id: crypto.randomUUID(), key: 'API_KEY', value: 'staging-api-key' },
    ],
  },
  {
    id: 'prod',
    name: 'Production',
    variables: [
      { id: crypto.randomUUID(), key: 'BASE_URL', value: 'https://api.example.com' },
      { id: crypto.randomUUID(), key: 'API_KEY', value: 'prod-api-key' },
    ],
  },
];

const getEnvironmentsKey = (workspaceId?: string) =>
  `api-captain-environments:${workspaceId || 'default'}`;
const getActiveEnvironmentKey = (workspaceId?: string) =>
  `api-captain-active-environment:${workspaceId || 'default'}`;

const parseEnvironments = (raw: string | null): Environment[] => {
  if (!raw) return createDefaultEnvironments();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createDefaultEnvironments();
    }
    return parsed;
  } catch {
    return createDefaultEnvironments();
  }
};

export function useEnvironments(workspaceId?: string) {
  const storageKey = getEnvironmentsKey(workspaceId);
  const activeEnvKey = getActiveEnvironmentKey(workspaceId);

  const [environments, setEnvironments] = useState<Environment[]>(() => {
    return parseEnvironments(localStorage.getItem(storageKey));
  });

  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(() => {
    return localStorage.getItem(activeEnvKey) || 'dev';
  });

  // Reload environments whenever workspace changes.
  useEffect(() => {
    const loadedEnvironments = parseEnvironments(localStorage.getItem(storageKey));
    setEnvironments(loadedEnvironments);

    const storedActiveId = localStorage.getItem(activeEnvKey) || loadedEnvironments[0]?.id || null;
    const resolvedActiveId = loadedEnvironments.some((env) => env.id === storedActiveId)
      ? storedActiveId
      : loadedEnvironments[0]?.id || null;
    setActiveEnvironmentId(resolvedActiveId);
  }, [storageKey, activeEnvKey]);

  // Persist environments
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(environments));
  }, [environments, storageKey]);

  // Persist active environment
  useEffect(() => {
    if (activeEnvironmentId) {
      localStorage.setItem(activeEnvKey, activeEnvironmentId);
    }
  }, [activeEnvironmentId, activeEnvKey]);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) || null;

  const addEnvironment = useCallback((name: string) => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: [],
    };
    setEnvironments((prev) => [...prev, newEnv]);
    return newEnv;
  }, []);

  const updateEnvironment = useCallback((id: string, updates: Partial<Omit<Environment, 'id'>>) => {
    setEnvironments((prev) =>
      prev.map((env) => (env.id === id ? { ...env, ...updates } : env))
    );
  }, []);

  const deleteEnvironment = useCallback((id: string) => {
    setEnvironments((prev) => prev.filter((env) => env.id !== id));
    if (activeEnvironmentId === id) {
      setActiveEnvironmentId(environments[0]?.id || null);
    }
  }, [activeEnvironmentId, environments]);

  const addVariable = useCallback((envId: string, key: string = '', value: string = '') => {
    const newVar: EnvironmentVariable = {
      id: crypto.randomUUID(),
      key,
      value,
    };
    setEnvironments((prev) =>
      prev.map((env) =>
        env.id === envId
          ? { ...env, variables: [...env.variables, newVar] }
          : env
      )
    );
    return newVar;
  }, []);

  const updateVariable = useCallback(
    (envId: string, varId: string, updates: Partial<Omit<EnvironmentVariable, 'id'>>) => {
      setEnvironments((prev) =>
        prev.map((env) =>
          env.id === envId
            ? {
                ...env,
                variables: env.variables.map((v) =>
                  v.id === varId ? { ...v, ...updates } : v
                ),
              }
            : env
        )
      );
    },
    []
  );

  const deleteVariable = useCallback((envId: string, varId: string) => {
    setEnvironments((prev) =>
      prev.map((env) =>
        env.id === envId
          ? { ...env, variables: env.variables.filter((v) => v.id !== varId) }
          : env
      )
    );
  }, []);

  // Replace {{variable}} syntax with actual values
  const replaceVariables = useCallback(
    (text: string): string => {
      if (!activeEnvironment) return text;

      let result = text;
      const variablePattern = /\{\{(\w+)\}\}/g;

      result = result.replace(variablePattern, (match, varName) => {
        const variable = activeEnvironment.variables.find(
          (v) => v.key.toLowerCase() === varName.toLowerCase()
        );
        return variable ? variable.value : match;
      });

      return result;
    },
    [activeEnvironment]
  );

  // Get all variable keys for autocomplete
  const getVariableKeys = useCallback((): string[] => {
    if (!activeEnvironment) return [];
    return activeEnvironment.variables.map((v) => v.key);
  }, [activeEnvironment]);

  return {
    environments,
    activeEnvironment,
    activeEnvironmentId,
    setActiveEnvironmentId,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addVariable,
    updateVariable,
    deleteVariable,
    replaceVariables,
    getVariableKeys,
  };
}
