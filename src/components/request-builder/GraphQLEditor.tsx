import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  Check, 
  Database,
  Braces,
  FileCode,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyntaxHighlightedEditor } from "./SyntaxHighlightedEditor";

interface GraphQLEditorProps {
  query: string;
  variables: string;
  onQueryChange: (query: string) => void;
  onVariablesChange: (variables: string) => void;
  endpoint?: string;
}

interface SchemaType {
  name: string;
  kind: string;
  description?: string;
  fields?: Array<{
    name: string;
    type: string;
    description?: string;
    args?: Array<{ name: string; type: string }>;
  }>;
}

interface IntrospectionResult {
  types: SchemaType[];
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
}

// GraphQL introspection query
const INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        args {
          name
          type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }
        }
        type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }
      }
    }
  }
}`;

function formatType(type: any): string {
  if (!type) return "Unknown";
  if (type.kind === "NON_NULL") {
    return `${formatType(type.ofType)}!`;
  }
  if (type.kind === "LIST") {
    return `[${formatType(type.ofType)}]`;
  }
  return type.name || "Unknown";
}

function parseIntrospectionResult(data: any): IntrospectionResult {
  const schema = data.__schema;
  const types: SchemaType[] = schema.types
    .filter((t: any) => !t.name.startsWith("__"))
    .map((t: any) => ({
      name: t.name,
      kind: t.kind,
      description: t.description,
      fields: t.fields?.map((f: any) => ({
        name: f.name,
        type: formatType(f.type),
        description: f.description,
        args: f.args?.map((a: any) => ({
          name: a.name,
          type: formatType(a.type),
        })),
      })),
    }));

  return {
    types,
    queryType: schema.queryType?.name,
    mutationType: schema.mutationType?.name,
    subscriptionType: schema.subscriptionType?.name,
  };
}

export function GraphQLEditor({
  query,
  variables,
  onQueryChange,
  onVariablesChange,
  endpoint,
}: GraphQLEditorProps) {
  const [activeTab, setActiveTab] = useState<"query" | "variables" | "schema">("query");
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [schema, setSchema] = useState<IntrospectionResult | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const validateVariables = useCallback((value: string) => {
    if (!value.trim()) {
      setVariablesError(null);
      return;
    }
    try {
      JSON.parse(value);
      setVariablesError(null);
    } catch (e) {
      setVariablesError((e as Error).message);
    }
  }, []);

  const handleVariablesChange = (value: string) => {
    onVariablesChange(value);
    validateVariables(value);
  };

  const fetchSchema = async () => {
    if (!endpoint?.trim()) {
      setSchemaError("Please enter a GraphQL endpoint URL first");
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: INTROSPECTION_QUERY }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Introspection failed");
      }

      const parsed = parseIntrospectionResult(result.data);
      setSchema(parsed);
      setActiveTab("schema");
    } catch (error) {
      setSchemaError((error as Error).message);
    } finally {
      setSchemaLoading(false);
    }
  };

  const toggleType = (typeName: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  const insertTemplate = (template: string) => {
    onQueryChange(template);
  };

  const queryTemplates = [
    {
      name: "Basic Query",
      template: `query {
  items {
    id
    name
  }
}`,
    },
    {
      name: "Query with Variables",
      template: `query GetItem($id: ID!) {
  item(id: $id) {
    id
    name
    description
  }
}`,
      variables: `{
  "id": "1"
}`,
    },
    {
      name: "Mutation",
      template: `mutation CreateItem($input: CreateItemInput!) {
  createItem(input: $input) {
    id
    name
  }
}`,
      variables: `{
  "input": {
    "name": "New Item"
  }
}`,
    },
  ];

  const getKindBadgeColor = (kind: string): string => {
    switch (kind) {
      case "OBJECT":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "INPUT_OBJECT":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "ENUM":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "SCALAR":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "INTERFACE":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "UNION":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Braces className="h-4 w-4 text-primary" />
          GraphQL Request
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchema}
            disabled={schemaLoading || !endpoint?.trim()}
            className="gap-1.5"
          >
            {schemaLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Database className="h-3 w-3" />
            )}
            Fetch Schema
          </Button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Templates:</span>
        {queryTemplates.map((template) => (
          <Button
            key={template.name}
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              insertTemplate(template.template);
              if (template.variables) {
                onVariablesChange(template.variables);
              }
            }}
          >
            {template.name}
          </Button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="query" className="gap-1.5">
            <FileCode className="h-3 w-3" />
            Query
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-1.5">
            <Braces className="h-3 w-3" />
            Variables
            {variablesError && (
              <AlertCircle className="h-3 w-3 text-destructive ml-1" />
            )}
          </TabsTrigger>
          <TabsTrigger value="schema" className="gap-1.5">
            <Database className="h-3 w-3" />
            Schema
            {schema && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {schema.types.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="query" className="mt-3">
          <SyntaxHighlightedEditor
            value={query}
            onChange={onQueryChange}
            language="text"
            placeholder={`query {
  users {
    id
    name
    email
  }
}`}
            minHeight="250px"
          />
        </TabsContent>

        <TabsContent value="variables" className="mt-3 space-y-2">
          <SyntaxHighlightedEditor
            value={variables}
            onChange={handleVariablesChange}
            language="json"
            placeholder={`{
  "id": "123",
  "limit": 10
}`}
            hasError={!!variablesError}
            minHeight="150px"
          />
          <div
            className={cn(
              "flex items-center gap-2 text-xs",
              variablesError ? "text-destructive" : "text-success"
            )}
          >
            {variablesError ? (
              <>
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="break-all">{variablesError}</span>
              </>
            ) : variables.trim() ? (
              <>
                <Check className="h-3 w-3" />
                <span>Valid JSON</span>
              </>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="schema" className="mt-3">
          {schemaError && (
            <Card className="p-4 border-destructive/50 bg-destructive/10">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{schemaError}</span>
              </div>
            </Card>
          )}

          {!schema && !schemaError && (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No schema loaded</p>
              <p className="text-xs mt-1">
                Click "Fetch Schema" to introspect the GraphQL endpoint
              </p>
            </div>
          )}

          {schema && (
            <ScrollArea className="h-[300px] rounded-md border border-border">
              <div className="p-3 space-y-1">
                {/* Root Types */}
                {schema.queryType && (
                  <div className="text-xs text-muted-foreground mb-2">
                    <span className="font-medium">Query:</span> {schema.queryType}
                    {schema.mutationType && (
                      <span className="ml-3">
                        <span className="font-medium">Mutation:</span>{" "}
                        {schema.mutationType}
                      </span>
                    )}
                    {schema.subscriptionType && (
                      <span className="ml-3">
                        <span className="font-medium">Subscription:</span>{" "}
                        {schema.subscriptionType}
                      </span>
                    )}
                  </div>
                )}

                {/* Types List */}
                {schema.types.map((type) => (
                  <Collapsible
                    key={type.name}
                    open={expandedTypes.has(type.name)}
                    onOpenChange={() => toggleType(type.name)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-md text-sm">
                      {expandedTypes.has(type.name) ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="font-mono font-medium">{type.name}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", getKindBadgeColor(type.kind))}
                      >
                        {type.kind}
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-3 border-l border-border space-y-1 py-1">
                        {type.description && (
                          <p className="text-xs text-muted-foreground italic mb-2">
                            {type.description}
                          </p>
                        )}
                        {type.fields?.map((field) => (
                          <div
                            key={field.name}
                            className="text-xs font-mono py-1 flex items-start gap-2"
                          >
                            <span className="text-foreground">{field.name}</span>
                            {field.args && field.args.length > 0 && (
                              <span className="text-muted-foreground">
                                ({field.args.map((a) => `${a.name}: ${a.type}`).join(", ")})
                              </span>
                            )}
                            <span className="text-primary">: {field.type}</span>
                          </div>
                        ))}
                        {(!type.fields || type.fields.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">
                            No fields
                          </span>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
