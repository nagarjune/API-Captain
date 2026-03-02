import { useEffect, useState } from "react";
import {
  BUILDER_SETTINGS_UPDATED_EVENT,
  BUILDER_THEME_STORAGE_KEY,
  BuilderSettings,
  getStoredBuilderSettings,
} from "@/lib/builderTheme";

export const useBuilderSettings = (): BuilderSettings => {
  const [settings, setSettings] = useState<BuilderSettings>(() => getStoredBuilderSettings());

  useEffect(() => {
    const refresh = () => setSettings(getStoredBuilderSettings());
    const storageListener = (event: StorageEvent) => {
      if (!event.key || event.key === BUILDER_THEME_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener("storage", storageListener);
    window.addEventListener(BUILDER_SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", storageListener);
      window.removeEventListener(BUILDER_SETTINGS_UPDATED_EVENT, refresh);
    };
  }, []);

  return settings;
};
