import { useState, useCallback } from "react";
import type { BodyType } from "@/components/request-builder/BodyEditor";

export interface CustomBodyTemplate {
  id: string;
  label: string;
  bodyType: BodyType;
  body: string;
  category: string;
  createdAt: number;
}

const STORAGE_KEY = "custom-body-templates";

function loadTemplates(): CustomBodyTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: CustomBodyTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function useCustomBodyTemplates() {
  const [templates, setTemplates] = useState<CustomBodyTemplate[]>(loadTemplates);

  const addTemplate = useCallback((template: Omit<CustomBodyTemplate, "id" | "createdAt">) => {
    const newTemplate: CustomBodyTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setTemplates((prev) => {
      const next = [...prev, newTemplate];
      saveTemplates(next);
      return next;
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTemplates(next);
      return next;
    });
  }, []);

  return { templates, addTemplate, deleteTemplate };
}
