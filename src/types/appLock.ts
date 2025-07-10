export interface AppLockSettings {
  isEnabled: boolean;
  hasPassword: boolean;
  inactivityTimeout: number; // in minutes
  lastActivity: number; // timestamp
  isLocked: boolean;
}

export interface AppLockContextType {
  isLocked: boolean;
  isAppLockEnabled: boolean;
  lockApp: () => void;
  unlockApp: (password: string) => Promise<boolean>;
  setupAppLock: (password: string) => Promise<boolean>;
  disableAppLock: (password: string) => Promise<boolean>;
  updateActivity: () => void;
  checkInactivity: () => void;
  settings: AppLockSettings;
}

export interface LockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
  isUnlocking: boolean;
} 