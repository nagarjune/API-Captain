import { useState } from "react";
import { Play, AlertCircle, Check, Info, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SyntaxHighlightedEditor } from "./SyntaxHighlightedEditor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TestResult } from "@/lib/postScriptRunner";
import { cn } from "@/lib/utils";

interface PostScriptEditorProps {
  script: string;
  onChange: (script: string) => void;
  onTest: () => { success: boolean; logs: string[]; testResults: TestResult[]; error?: string };
  hasResponse: boolean;
}

const EXAMPLE_SCRIPTS = [
  {
    name: "Check status code",
    code: `// Verify successful response
pm.test("Status is 200", () => {
  pm.expect(pm.response.status).toBe(200);
});`,
  },
  {
    name: "Validate JSON structure",
    code: `// Check response has expected properties
pm.test("Response has data property", () => {
  const json = pm.response.json();
  pm.expect(json).toHaveProperty("data");
});`,
  },
  {
    name: "Extract and save token",
    code: `// Save token from response to environment
const json = pm.response.json();
if (json.token) {
  pm.env.set("AUTH_TOKEN", json.token);
  console.log("Token saved to AUTH_TOKEN");
}`,
  },
  {
    name: "Check response time",
    code: `// Verify response is fast enough
pm.test("Response time < 500ms", () => {
  pm.expect(pm.response.duration).toBeLessThan(500);
});`,
  },
];

export function PostScriptEditor({ script, onChange, onTest, hasResponse }: PostScriptEditorProps) {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    logs: string[];
    testResults: TestResult[];
    error?: string;
  } | null>(null);

  const handleTest = () => {
    const result = onTest();
    setTestResult(result);
  };

  const insertExample = (code: string) => {
    onChange(script ? `${script}\n\n${code}` : code);
  };

  const passedTests = testResult?.testResults.filter(t => t.passed).length ?? 0;
  const totalTests = testResult?.testResults.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Run JavaScript after receiving the response. Use <code className="text-xs bg-secondary px-1 py-0.5 rounded">pm</code> object to access and validate.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!hasResponse}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Test Script
        </Button>
      </div>

      {!hasResponse && (
        <Alert className="py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Send a request first to test post-response scripts.
          </AlertDescription>
        </Alert>
      )}

      <SyntaxHighlightedEditor
        value={script}
        onChange={onChange}
        language="javascript"
        placeholder={`// Post-response script
// Available APIs:
// - pm.response.status: HTTP status code
// - pm.response.statusText: Status text
// - pm.response.headers: Response headers object
// - pm.response.body: Raw response body string
// - pm.response.json(): Parse body as JSON
// - pm.response.duration: Response time in ms
// - pm.request: Original request data
// - pm.env.get(key): Get environment variable
// - pm.env.set(key, value): Set environment variable
// - pm.test(name, fn): Run a test assertion
// - pm.expect(value): Create assertions

pm.test("Status is 200", () => {
  pm.expect(pm.response.status).toBe(200);
});`}
        minHeight="200px"
      />

      {testResult && (
        <div className="space-y-2">
          {/* Test Results Summary */}
          {testResult.testResults.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className={cn(
                "px-3 py-2 text-sm font-medium flex items-center justify-between",
                passedTests === totalTests ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                <span>Test Results</span>
                <span>{passedTests}/{totalTests} passed</span>
              </div>
              <div className="divide-y divide-border">
                {testResult.testResults.map((test, i) => (
                  <div key={i} className="px-3 py-2 flex items-start gap-2 text-sm">
                    {test.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={test.passed ? "text-foreground" : "text-destructive"}>
                        {test.name}
                      </span>
                      {test.error && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {test.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Console Output */}
          {testResult.logs.length > 0 && (
            <Alert className="py-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <AlertDescription className="text-sm font-mono whitespace-pre-wrap">
                  {testResult.logs.join('\n')}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Error Display */}
          {!testResult.success && testResult.error && (
            <Alert variant="destructive" className="py-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <AlertDescription className="text-sm font-mono whitespace-pre-wrap">
                  {testResult.error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Success with no tests */}
          {testResult.success && testResult.testResults.length === 0 && testResult.logs.length === 0 && (
            <Alert className="py-2">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success mt-0.5" />
                <AlertDescription className="text-sm">
                  Script executed successfully
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="examples" className="border-border">
          <AccordionTrigger className="text-sm py-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Example Scripts
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {EXAMPLE_SCRIPTS.map((example) => (
                <Button
                  key={example.name}
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-auto py-2 px-3"
                  onClick={() => insertExample(example.code)}
                >
                  {example.name}
                </Button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-3 rounded-md">
        <p className="font-medium">Available APIs:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li><code className="text-xs bg-secondary px-1 rounded">pm.response.status</code> - HTTP status code</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.response.json()</code> - Parse body as JSON</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.response.duration</code> - Response time in ms</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.test(name, fn)</code> - Run a named test</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.expect(val).toBe()</code> - Assert equality</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.expect(val).toHaveProperty()</code> - Check object property</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.env.set(key, val)</code> - Save to environment</li>
        </ul>
      </div>
    </div>
  );
}
