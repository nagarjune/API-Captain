import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface QueryParamItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface QueryParamsEditorProps {
  params: QueryParamItem[];
  onChange: (params: QueryParamItem[]) => void;
}

export function QueryParamsEditor({ params, onChange }: QueryParamsEditorProps) {
  const addParam = () => {
    onChange([
      ...params,
      { id: crypto.randomUUID(), key: '', value: '', enabled: true },
    ]);
  };

  const updateParam = (id: string, field: keyof QueryParamItem, value: string | boolean) => {
    onChange(
      params.map((param) =>
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeParam = (id: string) => {
    onChange(params.filter((param) => param.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Query Parameters</h3>
        <Button variant="ghost" size="sm" onClick={addParam} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Parameter
        </Button>
      </div>

      {params.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No query parameters added. Click "Add Parameter" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span></span>
            <span>Key</span>
            <span>Value</span>
            <span></span>
          </div>
          {params.map((param) => (
            <div
              key={param.id}
              className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center"
            >
              <Switch
                checked={param.enabled}
                onCheckedChange={(checked) => updateParam(param.id, 'enabled', checked)}
              />
              <Input
                placeholder="page"
                value={param.key}
                onChange={(e) => updateParam(param.id, 'key', e.target.value)}
                className={!param.enabled ? 'opacity-50' : ''}
              />
              <Input
                placeholder="1"
                value={param.value}
                onChange={(e) => updateParam(param.id, 'value', e.target.value)}
                className={!param.enabled ? 'opacity-50' : ''}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeParam(param.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
