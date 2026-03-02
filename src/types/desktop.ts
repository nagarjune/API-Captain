export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface DesktopUpdateState {
  supported: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  autoUpdateEnabled: boolean;
  errorMessage: string | null;
}

export interface DesktopUpdatesApi {
  getState: () => Promise<DesktopUpdateState>;
  checkNow: () => Promise<DesktopUpdateState>;
  setAutoUpdateEnabled: (enabled: boolean) => Promise<DesktopUpdateState>;
  onStatus: (callback: (state: DesktopUpdateState) => void) => () => void;
}

export interface DesktopBridge {
  version: string;
  updates?: DesktopUpdatesApi;
}
