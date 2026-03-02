import { useState } from "react";
import { Plus, Trash2, Settings2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Environment, EnvironmentVariable } from "@/hooks/useEnvironments";

interface EnvironmentSelectorProps {
  environments: Environment[];
  activeEnvironment: Environment | null;
  onSelect: (id: string) => void;
  onAddEnvironment: (name: string) => void;
  onUpdateEnvironment: (id: string, updates: Partial<Omit<Environment, 'id'>>) => void;
  onDeleteEnvironment: (id: string) => void;
  onAddVariable: (envId: string) => void;
  onUpdateVariable: (envId: string, varId: string, updates: Partial<Omit<EnvironmentVariable, 'id'>>) => void;
  onDeleteVariable: (envId: string, varId: string) => void;
}

export function EnvironmentSelector({
  environments,
  activeEnvironment,
  onSelect,
  onAddEnvironment,
  onUpdateEnvironment,
  onDeleteEnvironment,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
}: EnvironmentSelectorProps) {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  const handleAddEnvironment = () => {
    if (newEnvName.trim()) {
      onAddEnvironment(newEnvName.trim());
      setNewEnvName("");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[140px] justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="truncate">{activeEnvironment?.name || "No Environment"}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {environments.map((env) => (
              <DropdownMenuItem
                key={env.id}
                onClick={() => onSelect(env.id)}
                className="justify-between"
              >
                <span>{env.name}</span>
                {activeEnvironment?.id === env.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsManageOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Manage Environments
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeEnvironment && activeEnvironment.variables.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {activeEnvironment.variables.length} vars
          </Badge>
        )}
      </div>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Environments</DialogTitle>
            <DialogDescription>
              Create and manage environment variables. Use <code className="text-primary">{"{{variable}}"}</code> syntax in URLs and values.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={cn(
                      "border rounded-lg p-4 space-y-4",
                      activeEnvironment?.id === env.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {editingEnvId === env.id ? (
                          <Input
                            value={env.name}
                            onChange={(e) => onUpdateEnvironment(env.id, { name: e.target.value })}
                            onBlur={() => setEditingEnvId(null)}
                            onKeyDown={(e) => e.key === "Enter" && setEditingEnvId(null)}
                            className="h-8 w-[200px]"
                            autoFocus
                          />
                        ) : (
                          <h4
                            className="font-medium cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setEditingEnvId(env.id)}
                          >
                            {env.name}
                          </h4>
                        )}
                        {activeEnvironment?.id === env.id && (
                          <Badge className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelect(env.id)}
                          disabled={activeEnvironment?.id === env.id}
                        >
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteEnvironment(env.id)}
                          disabled={environments.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {env.variables.length > 0 && (
                        <div className="grid grid-cols-[1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                          <span>Variable</span>
                          <span>Value</span>
                          <span></span>
                        </div>
                      )}
                      {env.variables.map((variable) => (
                        <div
                          key={variable.id}
                          className="grid grid-cols-[1fr_1fr_40px] gap-2 items-center"
                        >
                          <Input
                            placeholder="VARIABLE_NAME"
                            value={variable.key}
                            onChange={(e) =>
                              onUpdateVariable(env.id, variable.id, { key: e.target.value })
                            }
                            className="font-mono text-sm h-9"
                          />
                          <Input
                            placeholder="value"
                            value={variable.value}
                            onChange={(e) =>
                              onUpdateVariable(env.id, variable.id, { value: e.target.value })
                            }
                            className="font-mono text-sm h-9"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteVariable(env.id, variable.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddVariable(env.id)}
                        className="gap-1 text-muted-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        Add Variable
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add New Environment */}
                <div className="border border-dashed border-border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New environment name..."
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddEnvironment()}
                      className="flex-1"
                    />
                    <Button onClick={handleAddEnvironment} disabled={!newEnvName.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
