import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BodyType } from "./BodyEditor";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { label: string; category: string; bodyType: BodyType; body: string }) => void;
  bodyType: BodyType;
  body: string;
}

export function SaveTemplateDialog({ open, onOpenChange, onSave, bodyType, body }: SaveTemplateDialogProps) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Custom");

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), category: category.trim() || "Custom", bodyType, body });
    setLabel("");
    setCategory("Custom");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>Save the current body as a reusable template.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Template"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Input
              id="template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Custom"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!label.trim()}>Save Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
