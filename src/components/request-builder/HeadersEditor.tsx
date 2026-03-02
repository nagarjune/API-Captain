import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface HeaderItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface HeadersEditorProps {
  headers: HeaderItem[];
  onChange: (headers: HeaderItem[]) => void;
}

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const addHeader = () => {
    onChange([
      ...headers,
      { id: crypto.randomUUID(), key: '', value: '', enabled: true },
    ]);
  };

  const updateHeader = (id: string, field: keyof HeaderItem, value: string | boolean) => {
    onChange(
      headers.map((header) =>
        header.id === id ? { ...header, [field]: value } : header
      )
    );
  };

  const removeHeader = (id: string) => {
    onChange(headers.filter((header) => header.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Headers</h3>
        <Button variant="ghost" size="sm" onClick={addHeader} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Header
        </Button>
      </div>

      {headers.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No headers added. Click "Add Header" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span></span>
            <span>Key</span>
            <span>Value</span>
            <span></span>
          </div>
          {headers.map((header) => (
            <div
              key={header.id}
              className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center"
            >
              <Switch
                checked={header.enabled}
                onCheckedChange={(checked) => updateHeader(header.id, 'enabled', checked)}
              />
              <Input
                placeholder="Content-Type"
                value={header.key}
                onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
                className={!header.enabled ? 'opacity-50' : ''}
              />
              <Input
                placeholder="application/json"
                value={header.value}
                onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                className={!header.enabled ? 'opacity-50' : ''}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeHeader(header.id)}
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
