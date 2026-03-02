import { useCallback, useEffect, useState } from "react";
import type { DesktopUpdateState } from "@/types/desktop";

const DEFAULT_UPDATE_STATE: DesktopUpdateState = {
  supported: false,
  status: "idle",
  currentVersion: "",
  latestVersion: null,
  updateAvailable: false,
  autoUpdateEnabled: true,
  errorMessage: null,
};

export function useDesktopUpdates() {
  const [state, setState] = useState<DesktopUpdateState>(DEFAULT_UPDATE_STATE);
  const isDesktopSupported = typeof window !== "undefined" && Boolean(window.desktop?.updates);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updatesApi = window.desktop?.updates;
    if (!updatesApi) return;

    let active = true;
    updatesApi
      .getState()
      .then((next) => {
        if (active) {
          setState(next);
        }
      })
      .catch(() => {
        if (active) {
          setState((previous) => ({ ...previous, status: "error", errorMessage: "Unable to read update state." }));
        }
      });

    const unsubscribe = updatesApi.onStatus((next) => {
      if (active) {
        setState(next);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setAutoUpdateEnabled = useCallback(async (enabled: boolean) => {
    if (typeof window === "undefined") return;
    const updatesApi = window.desktop?.updates;
    if (!updatesApi) {
      setState((previous) => ({ ...previous, autoUpdateEnabled: enabled }));
      return;
    }

    try {
      const next = await updatesApi.setAutoUpdateEnabled(enabled);
      setState(next);
    } catch {
      setState((previous) => ({
        ...previous,
        autoUpdateEnabled: enabled,
        status: "error",
        errorMessage: "Failed to update software update setting.",
      }));
    }
  }, []);

  const checkNow = useCallback(async () => {
    if (typeof window === "undefined") return;
    const updatesApi = window.desktop?.updates;
    if (!updatesApi) return;

    try {
      const next = await updatesApi.checkNow();
      setState(next);
    } catch {
      setState((previous) => ({
        ...previous,
        status: "error",
        errorMessage: "Failed to check for updates.",
      }));
    }
  }, []);

  return {
    state,
    isDesktopSupported,
    setAutoUpdateEnabled,
    checkNow,
  };
}
