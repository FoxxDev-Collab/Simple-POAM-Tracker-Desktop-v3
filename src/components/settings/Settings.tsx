import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { invoke } from '@tauri-apps/api/core';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Bell, 
  Globe, 
  Trash2, 
  AlertTriangle, 
  X, 
  Check, 
  Sun, 
  Moon, 
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAppLock } from '../../context/AppLockContext';

interface SettingsState {
  notificationsEnabled: boolean;
  notificationDuration: number;
  colorScheme: 'light' | 'dark';
  timezone: string;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const { isAppLockEnabled, setupAppLock, disableAppLock, lockApp } = useAppLock();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearingLog, setClearingLog] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // App Lock states
  const [showAppLockSetup, setShowAppLockSetup] = useState(false);
  const [showAppLockDisable, setShowAppLockDisable] = useState(false);
  const [appLockPassword, setAppLockPassword] = useState('');
  const [confirmAppLockPassword, setConfirmAppLockPassword] = useState('');
  const [currentAppLockPassword, setCurrentAppLockPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isProcessingAppLock, setIsProcessingAppLock] = useState(false);
  
  const [settings, setSettings] = useState<SettingsState>({
    notificationsEnabled: true,
    notificationDuration: 5,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    timezone: 'America/Boise'
  });

  const [originalSettings, setOriginalSettings] = useState<SettingsState>({
    notificationsEnabled: true,
    notificationDuration: 5,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    timezone: 'America/Boise'
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Update settings.colorScheme when theme changes
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      colorScheme: theme === 'dark' ? 'dark' : 'light'
    }));
  }, [theme]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasUnsavedChanges(hasChanges);
  }, [settings, originalSettings]);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        const typedSettings: SettingsState = {
          notificationsEnabled: parsedSettings.notificationsEnabled ?? true,
          notificationDuration: parsedSettings.notificationDuration ?? 5,
          colorScheme: (parsedSettings.colorScheme === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
          timezone: parsedSettings.timezone ?? 'America/Boise'
        };
        setSettings(typedSettings);
        setOriginalSettings(typedSettings);
      } else {
        // Set default settings if none exist
        const defaultSettings: SettingsState = {
          notificationsEnabled: true,
          notificationDuration: 5,
          colorScheme: theme === 'dark' ? 'dark' : 'light',
          timezone: 'America/Boise'
        };
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('error', 'Failed to load settings');
    }
  };

  const handleChange = (key: keyof SettingsState, value: any) => {
    setSettings({
      ...settings,
      [key]: value
    });
    
    // If color scheme is changed, update the theme immediately
    if (key === 'colorScheme') {
      setTheme(value === 'dark' ? 'dark' : 'light');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      localStorage.setItem('appSettings', JSON.stringify(settings));
      setOriginalSettings({ ...settings });
      setHasUnsavedChanges(false);
      showToast('success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setSettings({ ...originalSettings });
  };

  // App Lock handlers
  const handleSetupAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (appLockPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters long');
      return;
    }
    
    if (appLockPassword !== confirmAppLockPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }

    setIsProcessingAppLock(true);
    try {
      const success = await setupAppLock(appLockPassword);
      if (success) {
        setShowAppLockSetup(false);
        setAppLockPassword('');
        setConfirmAppLockPassword('');
      }
    } finally {
      setIsProcessingAppLock(false);
    }
  };

  const handleDisableAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAppLockPassword.trim()) {
      showToast('error', 'Please enter your current password');
      return;
    }

    setIsProcessingAppLock(true);
    try {
      const success = await disableAppLock(currentAppLockPassword);
      if (success) {
        setShowAppLockDisable(false);
        setCurrentAppLockPassword('');
      }
    } finally {
      setIsProcessingAppLock(false);
    }
  };

  const handleManualLock = () => {
    lockApp();
    showToast('info', 'Application locked manually');
  };

  const addToLog = (message: string) => {
    console.log(`[DataClear] ${message}`);
    setClearingLog(prev => [...prev, message]);
  };

  const deleteDatabaseFile = async () => {
    try {
      addToLog("Deleting database file...");
      const result = await invoke<string>('delete_database_file');
      addToLog(`Database result: ${result}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addToLog(`Error deleting database file: ${errorMessage}`);
      console.error('[Database] Delete error:', error);
      return false;
    }
  };

  const clearDatabase = async () => {
    setClearingLog([]);
    
    try {
      setIsClearing(true);
      addToLog("Starting data clearing process...");
      
      addToLog("Clearing browser storage...");
      
      let itemsCleared = 0;
      try {
        Object.keys(localStorage).forEach(key => {
          if (key !== 'appSettings') {
            localStorage.removeItem(key);
            itemsCleared++;
          } else {
            addToLog(`Keeping settings: ${key}`);
          }
        });
        addToLog(`Cleared ${itemsCleared} localStorage items`);
      } catch (localStorageError) {
        const errorMessage = localStorageError instanceof Error 
          ? localStorageError.message 
          : 'Unknown localStorage error';
        addToLog(`Error clearing localStorage: ${errorMessage}`);
      }
      
      try {
        sessionStorage.clear();
        addToLog('Session storage cleared');
      } catch (sessionStorageError) {
        const errorMessage = sessionStorageError instanceof Error 
          ? sessionStorageError.message 
          : 'Unknown sessionStorage error';
        addToLog(`Error clearing sessionStorage: ${errorMessage}`);
      }
      
      const databaseSuccess = await deleteDatabaseFile();
      
      if (databaseSuccess) {
        addToLog('Database file deleted successfully');
        showToast('success', 'All data cleared successfully');
      } else {
        addToLog('Failed to delete database file');
        showToast('warning', 'Browser storage cleared, but database deletion failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DataClear] Error clearing data:', error);
      addToLog(`Fatal error during data clearing: ${errorMessage}`);
      showToast('error', `Failed to clear data: ${errorMessage}`);
    } finally {
      addToLog('Clearing process finalized');
      setIsClearing(false);
      setShowConfirmDialog(false);
    }
  };

  const timezoneOptions = [
    { value: 'America/Boise', label: 'America/Boise (Mountain Time)' },
    { value: 'America/New_York', label: 'America/New_York (Eastern Time)' },
    { value: 'America/Chicago', label: 'America/Chicago (Central Time)' },
    { value: 'America/Denver', label: 'America/Denver (Mountain Time)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific Time)' },
    { value: 'America/Anchorage', label: 'America/Anchorage (Alaska Time)' },
    { value: 'America/Honolulu', label: 'America/Honolulu (Hawaii Time)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
  ];

  return (
    <>
      <div className="container-responsive space-y-6">
        {/* Header */}
        <div className="responsive-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">
                Customize your POAM Tracker experience
              </p>
            </div>
          </div>
          
          {hasUnsavedChanges && (
            <div className="button-group">
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn-responsive"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleResetSettings}
                className="btn-responsive"
              >
                Reset
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Appearance Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>Customize the look and feel of your application</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium text-foreground mb-3 block">Theme</label>
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <button
                    className={`group relative flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                      settings.colorScheme === 'light'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleChange('colorScheme', 'light')}
                  >
                    <div className="flex h-8 w-12 items-center justify-center rounded border bg-white shadow-sm">
                      <Sun className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="text-xs font-medium">Light</span>
                    {settings.colorScheme === 'light' && (
                      <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                  <button
                    className={`group relative flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                      settings.colorScheme === 'dark'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={() => handleChange('colorScheme', 'dark')}
                  >
                    <div className="flex h-8 w-12 items-center justify-center rounded border bg-gray-900 shadow-sm">
                      <Moon className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-xs font-medium">Dark</span>
                    {settings.colorScheme === 'dark' && (
                      <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Security</CardTitle>
                  <CardDescription>Protect your application with security features</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* App Lock Status */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isAppLockEnabled ? (
                      <Lock className="h-4 w-4 text-success" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <label className="text-sm font-medium text-foreground">
                      {isAppLockEnabled ? 'App Lock Enabled' : 'App Lock Disabled'}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isAppLockEnabled 
                      ? 'Your application is protected with a password'
                      : 'Enable app lock to secure your application'
                    }
                  </p>
                </div>
                
                {isAppLockEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualLock}
                  >
                    <Lock className="mr-2 h-3 w-3" />
                    Lock Now
                  </Button>
                )}
              </div>

              {/* Security Features */}
              {isAppLockEnabled && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Active Security Features</h4>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      Automatic lock after 10 minutes of inactivity
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      Secure password storage using Argon2 hashing
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      Protection against brute force attacks
                    </li>
                  </ul>
                </div>
              )}

              {/* App Lock Controls */}
              {!isAppLockEnabled ? (
                <div className="space-y-4">
                  {!showAppLockSetup ? (
                    <Button
                      onClick={() => setShowAppLockSetup(true)}
                      className="w-full"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Enable App Lock
                    </Button>
                  ) : (
                    <form onSubmit={handleSetupAppLock} className="space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-foreground">New Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={appLockPassword}
                              onChange={(e) => setAppLockPassword(e.target.value)}
                              placeholder="Enter a secure password (min 6 characters)"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                              required
                              minLength={6}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-sm font-medium text-foreground">Confirm Password</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmAppLockPassword}
                              onChange={(e) => setConfirmAppLockPassword(e.target.value)}
                              placeholder="Confirm your password"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAppLockSetup(false);
                            setAppLockPassword('');
                            setConfirmAppLockPassword('');
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isProcessingAppLock || !appLockPassword || !confirmAppLockPassword}
                          className="flex-1"
                        >
                          {isProcessingAppLock ? 'Setting up...' : 'Enable Lock'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {!showAppLockDisable ? (
                    <Button
                      variant="destructive"
                      onClick={() => setShowAppLockDisable(true)}
                      className="w-full"
                    >
                      <Unlock className="mr-2 h-4 w-4" />
                      Disable App Lock
                    </Button>
                  ) : (
                    <form onSubmit={handleDisableAppLock} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentAppLockPassword}
                            onChange={(e) => setCurrentAppLockPassword(e.target.value)}
                            placeholder="Enter your current password"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAppLockDisable(false);
                            setCurrentAppLockPassword('');
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={isProcessingAppLock || !currentAppLockPassword}
                          className="flex-1"
                        >
                          {isProcessingAppLock ? 'Disabling...' : 'Disable Lock'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Notifications</CardTitle>
                  <CardDescription>Control how you receive notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Enable notifications</label>
                  <p className="text-xs text-muted-foreground">Receive alerts and updates from the application</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled}
                    onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>

              {settings.notificationsEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Display duration: {settings.notificationDuration} seconds
                    </label>
                    <p className="text-xs text-muted-foreground">
                      How long notifications stay visible
                    </p>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={settings.notificationDuration}
                    onChange={(e) => handleChange('notificationDuration', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1s</span>
                    <span>10s</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regional Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Regional Settings</CardTitle>
                  <CardDescription>Configure your timezone and regional preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="timezone" className="text-sm font-medium text-foreground">Timezone</label>
                  <p className="text-xs text-muted-foreground">Used for displaying dates and times</p>
                </div>
                <select
                  id="timezone"
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Data & Privacy Section */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-lg text-destructive">Data & Privacy</CardTitle>
                  <CardDescription>Manage your data and privacy settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Clear all application data</p>
                    <p className="text-xs text-destructive/80">
                      This will permanently delete all POAMs, milestones, notes, and other data. 
                      Your settings will be preserved. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="destructive"
                onClick={() => setShowConfirmDialog(true)}
                disabled={isClearing}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearing ? 'Clearing Data...' : 'Clear All Data'}
              </Button>
              
              {clearingLog.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted px-3 py-2 border-b border-border">
                    <h4 className="text-sm font-medium">Operation Log</h4>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {clearingLog.map((log, index) => (
                      <div key={index} className="px-3 py-1 text-xs font-mono text-muted-foreground border-b border-border/50 last:border-b-0">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Confirm Data Deletion
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isClearing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-3">
                <div className="text-4xl">⚠️</div>
                <div className="space-y-2">
                  <p className="font-medium">Are you sure you want to delete all data?</p>
                  <p className="text-sm text-muted-foreground">
                    This will permanently remove all POAMs, milestones, notes, and other application data. 
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={isClearing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={clearDatabase}
                  disabled={isClearing}
                  className="flex-1"
                >
                  {isClearing ? 'Deleting...' : 'Delete All Data'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
} 