import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Braces, FileText, Code, AlertCircle, Check, Workflow, FileUp, FileCode, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SyntaxHighlightedEditor } from "./SyntaxHighlightedEditor";
import { GraphQLEditor } from "./GraphQLEditor";
import { FormDataEditor, FormDataField } from "./FormDataEditor";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useCustomBodyTemplates } from "@/hooks/useCustomBodyTemplates";
import { toast } from "sonner";

interface BodyTemplate {
  label: string;
  bodyType: BodyType;
  body: string;
  category: string;
}

const bodyTemplates: BodyTemplate[] = [
  {
    label: "Empty Object",
    category: "JSON",
    bodyType: "json",
    body: '{\n  \n}',
  },
  {
    label: "REST Resource",
    category: "JSON",
    bodyType: "json",
    body: '{\n  "name": "",\n  "email": "",\n  "role": "user",\n  "active": true\n}',
  },
  {
    label: "Auth Login",
    category: "JSON",
    bodyType: "json",
    body: '{\n  "username": "",\n  "password": ""\n}',
  },
  {
    label: "Pagination",
    category: "JSON",
    bodyType: "json",
    body: '{\n  "page": 1,\n  "limit": 20,\n  "sort": "created_at",\n  "order": "desc"\n}',
  },
  {
    label: "SOAP Envelope",
    category: "XML",
    bodyType: "xml",
    body: '<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope\n  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Header/>\n  <soap:Body>\n    <Request>\n      <Param>value</Param>\n    </Request>\n  </soap:Body>\n</soap:Envelope>',
  },
  {
    label: "RSS Feed Item",
    category: "XML",
    bodyType: "xml",
    body: '<?xml version="1.0" encoding="UTF-8"?>\n<item>\n  <title>Title</title>\n  <link>https://example.com</link>\n  <description>Description</description>\n</item>',
  },
  {
    label: "Query + Variables",
    category: "GraphQL",
    bodyType: "graphql",
    body: 'query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n  }\n}',
  },
  {
    label: "Mutation",
    category: "GraphQL",
    bodyType: "graphql",
    body: 'mutation CreateUser($input: CreateUserInput!) {\n  createUser(input: $input) {\n    id\n    name\n  }\n}',
  },
  {
    label: "URL Encoded",
    category: "Text",
    bodyType: "text",
    body: 'grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET',
  },
];

export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'graphql' | 'form-data';

interface JsonError {
  message: string;
  line: number | null;
  column: number | null;
}

interface BodyEditorProps {
  body: string;
  bodyType: BodyType;
  onBodyChange: (body: string) => void;
  onBodyTypeChange: (type: BodyType) => void;
  graphqlQuery?: string;
  graphqlVariables?: string;
  onGraphqlQueryChange?: (query: string) => void;
  onGraphqlVariablesChange?: (variables: string) => void;
  endpoint?: string;
  formDataFields?: FormDataField[];
  onFormDataFieldsChange?: (fields: FormDataField[]) => void;
}

// Parse JSON error to extract line and column info
function parseJsonError(error: Error, jsonString: string): JsonError {
  const message = error.message;
  
  // Try to extract position from error message (format varies by browser)
  // Chrome: "...at position 123"
  // Firefox: "...at line X column Y"
  const positionMatch = message.match(/position\s+(\d+)/i);
  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  
  if (lineColMatch) {
    return {
      message: message,
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }
  
  if (positionMatch) {
    const position = parseInt(positionMatch[1], 10);
    // Convert position to line number
    const lines = jsonString.substring(0, position).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return {
      message: message,
      line,
      column,
    };
  }
  
  return {
    message: message,
    line: null,
    column: null,
  };
}

export function BodyEditor({ 
  body, 
  bodyType, 
  onBodyChange, 
  onBodyTypeChange,
  graphqlQuery = "",
  graphqlVariables = "",
  onGraphqlQueryChange,
  onGraphqlVariablesChange,
  endpoint,
  formDataFields = [],
  onFormDataFieldsChange,
}: BodyEditorProps) {
  const [jsonError, setJsonError] = useState<JsonError | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { templates: customTemplates, addTemplate, deleteTemplate } = useCustomBodyTemplates();

  const formatJson = () => {
    if (bodyType !== 'json' || !body.trim()) return;
    
    try {
      const parsed = JSON.parse(body);
      const formatted = JSON.stringify(parsed, null, 2);
      onBodyChange(formatted);
      setJsonError(null);
    } catch (e) {
      setJsonError(parseJsonError(e as Error, body));
    }
  };

  const validateJson = (value: string) => {
    if (bodyType !== 'json' || !value.trim()) {
      setJsonError(null);
      return;
    }
    
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(parseJsonError(e as Error, value));
    }
  };

  const handleBodyChange = (value: string) => {
    onBodyChange(value);
    validateJson(value);
  };

  const errorMessage = useMemo(() => {
    if (!jsonError) return null;
    const { message, line, column } = jsonError;
    if (line && column) {
      return `Line ${line}, Column ${column}: ${message}`;
    }
    if (line) {
      return `Line ${line}: ${message}`;
    }
    return message;
  }, [jsonError]);

  const applyTemplate = (template: BodyTemplate) => {
    onBodyTypeChange(template.bodyType);
    if (template.bodyType === "graphql" && onGraphqlQueryChange) {
      onGraphqlQueryChange(template.body);
    } else {
      onBodyChange(template.body);
    }
    setJsonError(null);
  };

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, { template: BodyTemplate; customId?: string }[]> = {};
    bodyTemplates.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push({ template: t });
    });
    customTemplates.forEach((t) => {
      const cat = t.category || "Custom";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ template: t, customId: t.id });
    });
    return groups;
  }, [customTemplates]);

  const handleSaveTemplate = (data: { label: string; category: string; bodyType: BodyType; body: string }) => {
    addTemplate(data);
    toast.success(`Template "${data.label}" saved`);
  };

  const handleDeleteTemplate = (id: string, label: string) => {
    deleteTemplate(id);
    toast.success(`Template "${label}" deleted`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Request Body</h3>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {Object.entries(groupedTemplates).map(([category, items], i) => (
                <div key={category}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs">{category}</DropdownMenuLabel>
                  {items.map(({ template: t, customId }) => (
                    <DropdownMenuItem
                      key={customId || t.label}
                      className="flex items-center justify-between"
                      onClick={() => applyTemplate(t)}
                    >
                      <span className="truncate">{t.label}</span>
                      {customId && (
                        <button
                          className="ml-2 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(customId, t.label);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={bodyType === "none" || bodyType === "form-data"}
                onClick={() => setSaveDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Save Current as Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={bodyType} onValueChange={(v) => onBodyTypeChange(v as BodyType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Body type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">None</span>
                </span>
              </SelectItem>
              <SelectItem value="json">
                <span className="flex items-center gap-2">
                  <Braces className="h-3 w-3" />
                  JSON
                </span>
              </SelectItem>
              <SelectItem value="xml">
                <span className="flex items-center gap-2">
                  <Code className="h-3 w-3" />
                  XML
                </span>
              </SelectItem>
              <SelectItem value="text">
                <span className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Text
                </span>
              </SelectItem>
              <SelectItem value="graphql">
                <span className="flex items-center gap-2">
                  <Workflow className="h-3 w-3" />
                  GraphQL
                </span>
              </SelectItem>
              <SelectItem value="form-data">
                <span className="flex items-center gap-2">
                  <FileUp className="h-3 w-3" />
                  Form Data
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {bodyType === 'json' && (
            <Button variant="ghost" size="sm" onClick={formatJson}>
              Format
            </Button>
          )}
        </div>
      </div>

      {bodyType === 'none' ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          This request does not have a body.
        </div>
      ) : bodyType === 'graphql' ? (
        <GraphQLEditor
          query={graphqlQuery}
          variables={graphqlVariables}
          onQueryChange={onGraphqlQueryChange || (() => {})}
          onVariablesChange={onGraphqlVariablesChange || (() => {})}
          endpoint={endpoint}
        />
      ) : bodyType === 'form-data' ? (
        <FormDataEditor
          fields={formDataFields}
          onChange={onFormDataFieldsChange || (() => {})}
        />
      ) : (
        <>
          <SyntaxHighlightedEditor
            value={body}
            onChange={handleBodyChange}
            language={bodyType === 'json' ? 'json' : bodyType === 'xml' ? 'markup' : 'text'}
            placeholder={
              bodyType === 'json'
                ? '{\n  "key": "value"\n}'
                : bodyType === 'xml'
                ? '<?xml version="1.0"?>\n<root>\n  <element>value</element>\n</root>'
                : 'Enter request body...'
            }
            hasError={!!jsonError}
            errorLine={jsonError?.line ?? null}
          />
          {bodyType === 'json' && (
            <div className={cn(
              "flex items-center gap-2 text-xs",
              jsonError ? "text-destructive" : "text-success"
            )}>
              {jsonError ? (
                <>
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="break-all">{errorMessage}</span>
                </>
              ) : body.trim() ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Valid JSON</span>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
      <SaveTemplateDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveTemplate}
        bodyType={bodyType}
        body={bodyType === "graphql" ? graphqlQuery : body}
      />
    </div>
  );
}
