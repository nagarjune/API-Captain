import { useState } from "react";
import { Plus, Trash2, FileUp, Type, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FormDataField {
  id: string;
  key: string;
  value: string;
  type: "text" | "file";
  enabled: boolean;
  file?: File | null;
}

interface FormDataEditorProps {
  fields: FormDataField[];
  onChange: (fields: FormDataField[]) => void;
}

export function FormDataEditor({ fields, onChange }: FormDataEditorProps) {
  const addField = (type: "text" | "file" = "text") => {
    onChange([
      ...fields,
      { id: crypto.randomUUID(), key: "", value: "", type, enabled: true, file: null },
    ]);
  };

  const updateField = (id: string, updates: Partial<FormDataField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const handleFileChange = (id: string, fileList: FileList | null) => {
    if (fileList && fileList[0]) {
      const file = fileList[0];
      updateField(id, { file, value: file.name });
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {fields.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No form fields. Add text or file fields below.
          </div>
        )}
        {fields.map((field) => (
          <div
            key={field.id}
            className={cn(
              "flex items-center gap-2 group",
              !field.enabled && "opacity-50"
            )}
          >
            <Switch
              checked={field.enabled}
              onCheckedChange={(checked) => updateField(field.id, { enabled: checked })}
              className="scale-75 shrink-0"
            />
            <Badge
              variant={field.type === "file" ? "default" : "secondary"}
              className="text-[10px] px-1.5 py-0 shrink-0 cursor-pointer select-none"
              onClick={() =>
                updateField(field.id, {
                  type: field.type === "text" ? "file" : "text",
                  file: null,
                  value: "",
                })
              }
            >
              {field.type === "file" ? (
                <FileUp className="h-3 w-3 mr-0.5" />
              ) : (
                <Type className="h-3 w-3 mr-0.5" />
              )}
              {field.type}
            </Badge>
            <Input
              placeholder="Key"
              value={field.key}
              onChange={(e) => updateField(field.id, { key: e.target.value })}
              className="flex-1 font-mono text-sm h-8"
            />
            {field.type === "text" ? (
              <Input
                placeholder="Value"
                value={field.value}
                onChange={(e) => updateField(field.id, { value: e.target.value })}
                className="flex-1 font-mono text-sm h-8"
              />
            ) : (
              <div className="flex-1 relative">
                <Input
                  type="file"
                  onChange={(e) => handleFileChange(field.id, e.target.files)}
                  className="font-mono text-sm h-8"
                />
                {field.file && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground truncate max-w-[120px]">
                    {formatFileSize(field.file.size)}
                  </span>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeField(field.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addField("text")}>
          <Type className="h-3.5 w-3.5" />
          Add Text Field
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addField("file")}>
          <FileUp className="h-3.5 w-3.5" />
          Add File Field
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
