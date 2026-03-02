import { useEffect, useState } from "react";
import { Save, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collection } from "@/hooks/useCollections";

interface SaveRequestDialogProps {
  collections: Collection[];
  onSave: (collectionId: string, name: string) => void;
  onCreateCollection: (name: string) => string;
  disabled?: boolean;
  hideTrigger?: boolean;
  defaultRequestName?: string;
  defaultCollectionId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SaveRequestDialog({
  collections,
  onSave,
  onCreateCollection,
  disabled,
  hideTrigger = false,
  defaultRequestName = "",
  defaultCollectionId = "",
  open: controlledOpen,
  onOpenChange,
}: SaveRequestDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    setInternalOpen(v);
  };
  const [requestName, setRequestName] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!requestName.trim() && defaultRequestName) {
      setRequestName(defaultRequestName);
    }
    if (!selectedCollectionId && defaultCollectionId) {
      setSelectedCollectionId(defaultCollectionId);
    }
  }, [defaultCollectionId, defaultRequestName, open, requestName, selectedCollectionId]);

  const handleSave = () => {
    if (!requestName.trim()) return;

    let collectionId = selectedCollectionId;

    if (isCreatingCollection && newCollectionName.trim()) {
      const newCollection = onCreateCollection(newCollectionName.trim());
      collectionId = newCollection;
    }

    if (!collectionId) return;

    onSave(collectionId, requestName.trim());
    setOpen(false);
    setRequestName("");
    setSelectedCollectionId("");
    setNewCollectionName("");
    setIsCreatingCollection(false);
  };

  const canSave = requestName.trim() && (selectedCollectionId || (isCreatingCollection && newCollectionName.trim()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Save Request</DialogTitle>
          <DialogDescription>
            Save this request to a collection for easy access later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Request Name</label>
            <Input
              placeholder="Get Users"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
            />
          </div>

          {!isCreatingCollection ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Collection</label>
              {collections.length > 0 ? (
                <Select value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No collections available. Create one below.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-primary"
                onClick={() => setIsCreatingCollection(true)}
              >
                <FolderPlus className="h-4 w-4" />
                Create new collection
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">New Collection Name</label>
              <Input
                placeholder="My API Collection"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setIsCreatingCollection(false);
                  setNewCollectionName("");
                }}
              >
                Cancel new collection
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
