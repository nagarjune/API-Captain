export interface PostScriptContext {
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  };
  envGet: (key: string) => string;
  envSet: (key: string, value: string) => void;
}

export interface PostScriptResult {
  success: boolean;
  logs: string[];
  testResults: TestResult[];
  error?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export function runPostScript(
  script: string,
  context: PostScriptContext
): PostScriptResult {
  const logs: string[] = [];
  const testResults: TestResult[] = [];

  // Parse response body as JSON if possible
  let jsonBody: unknown = null;
  try {
    jsonBody = JSON.parse(context.response.body);
  } catch {
    // Not JSON, that's fine
  }

  // Create the pm object that scripts can use
  const pm = {
    response: {
      status: context.response.status,
      statusText: context.response.statusText,
      headers: context.response.headers,
      body: context.response.body,
      json: () => {
        if (jsonBody === null) {
          throw new Error("Response body is not valid JSON");
        }
        return jsonBody;
      },
      duration: context.response.duration,
    },
    request: {
      url: context.request.url,
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    },
    env: {
      get: context.envGet,
      set: context.envSet,
    },
    test: (name: string, fn: () => void) => {
      try {
        fn();
        testResults.push({ name, passed: true });
      } catch (error) {
        testResults.push({
          name,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    expect: (value: unknown) => ({
      toBe: (expected: unknown) => {
        if (value !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      },
      toEqual: (expected: unknown) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
        }
      },
      toBeTruthy: () => {
        if (!value) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(value)}`);
        }
      },
      toBeFalsy: () => {
        if (value) {
          throw new Error(`Expected falsy value but got ${JSON.stringify(value)}`);
        }
      },
      toContain: (expected: unknown) => {
        if (typeof value === "string" && typeof expected === "string") {
          if (!value.includes(expected)) {
            throw new Error(`Expected "${value}" to contain "${expected}"`);
          }
        } else if (Array.isArray(value)) {
          if (!value.includes(expected)) {
            throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
          }
        } else {
          throw new Error("toContain only works on strings and arrays");
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (typeof value !== "number" || value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (typeof value !== "number" || value >= expected) {
          throw new Error(`Expected ${value} to be less than ${expected}`);
        }
      },
      toHaveProperty: (prop: string) => {
        if (typeof value !== "object" || value === null || !(prop in value)) {
          throw new Error(`Expected object to have property "${prop}"`);
        }
      },
      toHaveLength: (expected: number) => {
        if (!Array.isArray(value) && typeof value !== "string") {
          throw new Error("toHaveLength only works on arrays and strings");
        }
        if ((value as unknown[] | string).length !== expected) {
          throw new Error(`Expected length ${expected} but got ${(value as unknown[] | string).length}`);
        }
      },
    }),
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
      `"use strict";\n${script}`
    );

    // Execute the script
    scriptFunction(pm, customConsole);

    return {
      success: true,
      logs,
      testResults,
    };
  } catch (error) {
    return {
      success: false,
      logs,
      testResults,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
