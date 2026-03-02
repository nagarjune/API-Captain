import { useState } from "react";
import { Play, AlertCircle, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SyntaxHighlightedEditor } from "./SyntaxHighlightedEditor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PreScriptEditorProps {
  script: string;
  onChange: (script: string) => void;
  onTest: () => { success: boolean; output: string; error?: string };
}

const EXAMPLE_SCRIPTS = [
  {
    name: "Set timestamp header",
    code: `// Add a timestamp header
pm.headers["X-Timestamp"] = Date.now().toString();`,
  },
  {
    name: "Generate UUID",
    code: `// Generate a unique request ID
pm.headers["X-Request-ID"] = crypto.randomUUID();`,
  },
  {
    name: "Dynamic auth token",
    code: `// Set bearer token from environment
const token = pm.env.get("API_TOKEN") || "default-token";
pm.headers["Authorization"] = "Bearer " + token;`,
  },
  {
    name: "Modify request body",
    code: `// Add timestamp to JSON body
if (pm.body) {
  const data = JSON.parse(pm.body);
  data.timestamp = new Date().toISOString();
  pm.body = JSON.stringify(data, null, 2);
}`,
  },
];

export function PreScriptEditor({ script, onChange, onTest }: PreScriptEditorProps) {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    output: string;
    error?: string;
  } | null>(null);

  const handleTest = () => {
    const result = onTest();
    setTestResult(result);
  };

  const insertExample = (code: string) => {
    onChange(script ? `${script}\n\n${code}` : code);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Run JavaScript before sending the request. Use <code className="text-xs bg-secondary px-1 py-0.5 rounded">pm</code> object to modify the request.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Test Script
        </Button>
      </div>

      <SyntaxHighlightedEditor
        value={script}
        onChange={onChange}
        language="javascript"
        placeholder={`// Pre-request script
// Available APIs:
// - pm.url: Get/set request URL
// - pm.method: Get/set HTTP method
// - pm.headers: Object to get/set headers
// - pm.body: Get/set request body
// - pm.env.get(key): Get environment variable
// - pm.env.set(key, value): Set environment variable
// - console.log(): Log messages

pm.headers["X-Custom-Header"] = "value";`}
        minHeight="200px"
      />

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"} className="py-2">
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <Check className="h-4 w-4 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5" />
            )}
            <AlertDescription className="text-sm font-mono whitespace-pre-wrap">
              {testResult.success ? (
                testResult.output || "Script executed successfully"
              ) : (
                testResult.error
              )}
            </AlertDescription>
          </div>
        </Alert>
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
          <li><code className="text-xs bg-secondary px-1 rounded">pm.url</code> - Get/set request URL</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.method</code> - Get/set HTTP method</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.headers</code> - Object to get/set headers</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.body</code> - Get/set request body string</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.env.get(key)</code> - Get environment variable</li>
          <li><code className="text-xs bg-secondary px-1 rounded">pm.env.set(key, value)</code> - Set environment variable (session only)</li>
          <li><code className="text-xs bg-secondary px-1 rounded">console.log(...)</code> - Log to test output</li>
        </ul>
      </div>
    </div>
  );
}
