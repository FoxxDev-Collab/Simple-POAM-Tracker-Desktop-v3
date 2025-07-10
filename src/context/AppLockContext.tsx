import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppLockContextType, AppLockSettings } from '../types/appLock';
import { useToast } from './ToastContext';

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};

interface AppLockProviderProps {
  children: ReactNode;
}

export const AppLockProvider = ({ children }: AppLockProviderProps) => {
  const { showToast } = useToast();
  const [isLocked, setIsLocked] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState<number | null>(null);
  
  const [settings, setSettings] = useState<AppLockSettings>({
    isEnabled: false,
    hasPassword: false,
    inactivityTimeout: 10, // 10 minutes default
    lastActivity: Date.now(),
    isLocked: false,
  });

  // Load app lock status on mount
  useEffect(() => {
    checkAppLockStatus();
  }, []);

  // Set up activity monitoring
  useEffect(() => {
    if (isAppLockEnabled && !isLocked) {
      setupActivityMonitoring();
    } else {
      clearActivityTimer();
    }

    return () => {
      clearActivityTimer();
    };
  }, [isAppLockEnabled, isLocked]);

  const checkAppLockStatus = async () => {
    try {
      const isConfigured = await invoke<boolean>('is_app_lock_configured');
      setIsAppLockEnabled(isConfigured);
      setSettings(prev => ({ 
        ...prev, 
        isEnabled: isConfigured,
        hasPassword: isConfigured 
      }));
    } catch (error) {
      console.error('Failed to check app lock status:', error);
    }
  };

  const clearActivityTimer = useCallback(() => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      setInactivityTimer(null);
    }
  }, [inactivityTimer]);

  const resetInactivityTimer = useCallback(() => {
    clearActivityTimer();
    
    if (isAppLockEnabled && !isLocked) {
      const timer = setTimeout(() => {
        lockApp();
      }, settings.inactivityTimeout * 60 * 1000); // Convert minutes to milliseconds
      
      setInactivityTimer(timer);
    }
  }, [isAppLockEnabled, isLocked, settings.inactivityTimeout, clearActivityTimer]);

  const updateActivity = useCallback(() => {
    if (isAppLockEnabled && !isLocked) {
      setSettings(prev => ({ ...prev, lastActivity: Date.now() }));
      resetInactivityTimer();
    }
  }, [isAppLockEnabled, isLocked, resetInactivityTimer]);

  const setupActivityMonitoring = useCallback(() => {
    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity, resetInactivityTimer]);

  const lockApp = useCallback(() => {
    if (isAppLockEnabled) {
      setIsLocked(true);
      setSettings(prev => ({ ...prev, isLocked: true }));
      clearActivityTimer();
      showToast('info', 'Application locked due to inactivity');
    }
  }, [isAppLockEnabled, clearActivityTimer, showToast]);

  const unlockApp = useCallback(async (password: string): Promise<boolean> => {
    try {
      const isValid = await invoke<boolean>('verify_app_lock', { password });
      
      if (isValid) {
        setIsLocked(false);
        setSettings(prev => ({ ...prev, isLocked: false, lastActivity: Date.now() }));
        showToast('success', 'Application unlocked successfully');
        return true;
      } else {
        showToast('error', 'Invalid password');
        return false;
      }
    } catch (error) {
      console.error('Failed to unlock app:', error);
      showToast('error', 'Failed to unlock application');
      return false;
    }
  }, [showToast]);

  const setupAppLock = useCallback(async (password: string): Promise<boolean> => {
    try {
      await invoke('setup_app_lock', { password });
      setIsAppLockEnabled(true);
      setSettings(prev => ({ 
        ...prev, 
        isEnabled: true, 
        hasPassword: true,
        lastActivity: Date.now()
      }));
      showToast('success', 'App lock configured successfully');
      return true;
    } catch (error) {
      console.error('Failed to setup app lock:', error);
      showToast('error', 'Failed to configure app lock');
      return false;
    }
  }, [showToast]);

  const disableAppLock = useCallback(async (password: string): Promise<boolean> => {
    try {
      await invoke('remove_app_lock', { password });
      setIsAppLockEnabled(false);
      setIsLocked(false);
      setSettings(prev => ({ 
        ...prev, 
        isEnabled: false, 
        hasPassword: false,
        isLocked: false
      }));
      clearActivityTimer();
      showToast('success', 'App lock disabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to disable app lock:', error);
      showToast('error', 'Failed to disable app lock');
      return false;
    }
  }, [clearActivityTimer, showToast]);

  const checkInactivity = useCallback(() => {
    if (isAppLockEnabled && !isLocked) {
      const timeSinceLastActivity = Date.now() - settings.lastActivity;
      const inactivityLimit = settings.inactivityTimeout * 60 * 1000;
      
      if (timeSinceLastActivity >= inactivityLimit) {
        lockApp();
      }
    }
  }, [isAppLockEnabled, isLocked, settings.lastActivity, settings.inactivityTimeout, lockApp]);

  const value: AppLockContextType = {
    isLocked,
    isAppLockEnabled,
    lockApp,
    unlockApp,
    setupAppLock,
    disableAppLock,
    updateActivity,
    checkInactivity,
    settings,
  };

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}; 