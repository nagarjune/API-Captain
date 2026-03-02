export interface PreScriptContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  envGet: (key: string) => string;
  envSet: (key: string, value: string) => void;
}

export interface PreScriptResult {
  success: boolean;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  logs: string[];
  error?: string;
}

export function runPreScript(
  script: string,
  context: PreScriptContext
): PreScriptResult {
  const logs: string[] = [];
  
  // Create mutable copies
  let url = context.url;
  let method = context.method;
  const headers = { ...context.headers };
  let body = context.body;

  // Create the pm object that scripts can use
  const pm = {
    get url() {
      return url;
    },
    set url(value: string) {
      url = value;
    },
    get method() {
      return method;
    },
    set method(value: string) {
      method = value.toUpperCase();
    },
    headers,
    get body() {
      return body;
    },
    set body(value: string) {
      body = value;
    },
    env: {
      get: context.envGet,
      set: context.envSet,
    },
  };

  // Create a custom console that captures logs
  const customConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
    },
    warn: (...args: unknown[]) => {
      logs.push(`[WARN] ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
    },
    error: (...args: unknown[]) => {
      logs.push(`[ERROR] ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
    },
    info: (...args: unknown[]) => {
      logs.push(`[INFO] ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
    },
  };

  try {
    // Create a function with pm and console in scope
    const scriptFunction = new Function(
      'pm',
      'console',
      'crypto',
      `"use strict";\n${script}`
    );

    // Execute the script
    scriptFunction(pm, customConsole, crypto);

    return {
      success: true,
      url,
      method,
      headers,
      body,
      logs,
    };
  } catch (error) {
    return {
      success: false,
      url: context.url,
      method: context.method,
      headers: context.headers,
      body: context.body,
      logs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
