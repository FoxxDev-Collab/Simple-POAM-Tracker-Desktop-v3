import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { invoke } from '@tauri-apps/api/core';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Trash2, 
  AlertTriangle, 
  Sun, 
  Moon, 
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Info,
  Scale,
  User,
  Building,
  Database,
  Tag,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import TabNavigation from '../tabNavigation/TabNavigation';
import { clearNessusData, clearStigData } from '../../utils/tauriApi';
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
  const { currentSystem } = useSystem();
  const { isAppLockEnabled, setupAppLock, disableAppLock, lockApp } = useAppLock();
  const [activeTab, setActiveTab] = useState('general');
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

  // Keep for future settings expansion (theme uses direct setters)

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

  // System Info helper functions
  const getClassificationClasses = (classification?: string) => {
    switch (classification?.toUpperCase()) {
      case 'UNCLASSIFIED':
        return 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
      case 'CONFIDENTIAL':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
      case 'SECRET':
        return 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
      case 'TOP SECRET':
        return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    }
  };

  const getSystemStats = () => {
    if (!currentSystem) return 'No system selected';
    const stats: string[] = [];
    if (currentSystem.poam_count > 0) stats.push(`${currentSystem.poam_count} POAMs`);
    if (currentSystem.notes_count > 0) stats.push(`${currentSystem.notes_count} Notes`);
    if (currentSystem.stig_mappings_count > 0) stats.push(`${currentSystem.stig_mappings_count} STIG Mappings`);
    if (currentSystem.test_plans_count > 0) stats.push(`${currentSystem.test_plans_count} Test Plans`);
    return stats.length > 0 ? stats.join(' • ') : 'No data yet';
  };

  const formatLastAccessed = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
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

  const handleClearScans = async () => {
    try {
      if (!currentSystem?.id) {
        showToast('error', 'No active system selected');
        return;
      }
      setIsClearing(true);
      addToLog(`Clearing Nessus scans for system ${currentSystem.id}...`);
      const msg = await clearNessusData(currentSystem.id);
      addToLog(msg);
      showToast('success', 'Nessus scan data cleared');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addToLog(`Failed to clear scans: ${errorMessage}`);
      showToast('error', 'Failed to clear scan data');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearStig = async () => {
    try {
      if (!currentSystem?.id) {
        showToast('error', 'No active system selected');
        return;
      }
      setIsClearing(true);
      addToLog(`Clearing STIG mappings for system ${currentSystem.id}...`);
      const msg = await clearStigData(currentSystem.id);
      addToLog(msg);
      showToast('success', 'STIG mapping data cleared');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addToLog(`Failed to clear STIG data: ${errorMessage}`);
      showToast('error', 'Failed to clear STIG data');
    } finally {
      setIsClearing(false);
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

  // Timezone options will be added when the UI exposes timezone selection

  const handleClearAllData = async () => {
    await clearDatabase();
  };

  // Tab render functions
  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Theme Settings */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Appearance</CardTitle>
              <CardDescription>
                Customize the visual appearance of your application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Theme</label>
                <div className="text-sm text-muted-foreground">
                  Choose your preferred color scheme
                </div>
              </div>
              <div className="flex items-center rounded-lg border border-border p-1">
                <Button
                  variant={theme === 'light' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="gap-2"
                >
                  <Sun className="h-4 w-4" />
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="gap-2"
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Lock Settings */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Security</CardTitle>
              <CardDescription>
                Configure application security and lock settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">App Lock</div>
              <div className="text-sm text-muted-foreground">
                {isAppLockEnabled 
                  ? 'Application lock is currently enabled' 
                  : 'Protect your application with a password'
                }
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAppLockEnabled ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualLock}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Lock Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowAppLockDisable(true)}
                    className="gap-2"
                  >
                    <Unlock className="h-4 w-4" />
                    Disable
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAppLockSetup(true)}
                  className="gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Enable App Lock
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div>
              <div className="font-medium">Clear STIG Mappings</div>
              <div className="text-sm text-muted-foreground">
                Remove all imported STIG-to-NIST mappings for the active system
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearStig}
              disabled={isClearing}
              className="gap-2"
            >
              {isClearing ? 'Clearing...' : 'Clear STIG'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Data Management</CardTitle>
              <CardDescription>
                Manage your application data and storage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Clear All Data</div>
              <div className="text-sm text-muted-foreground">
                Permanently delete all POAMs, notes, and settings
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isClearing}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? 'Clearing...' : 'Clear All Data'}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div>
              <div className="font-medium">Clear Nessus Scan Data</div>
              <div className="text-sm text-muted-foreground">
                Remove imported Nessus scans and findings for the active system
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearScans}
              disabled={isClearing}
              className="gap-2"
            >
              {isClearing ? 'Clearing...' : 'Clear Scans'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSystemInfo = () => {
    if (!currentSystem) {
      return (
        <div className="text-center p-12 text-muted-foreground">
          No system selected.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{currentSystem.name || 'Unnamed System'}</CardTitle>
                <CardDescription>{currentSystem.description || 'No description'}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 text-sm">
                {currentSystem.owner && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>
                      Owner: <span className="font-medium text-foreground">{currentSystem.owner}</span>
                    </span>
                  </div>
                )}
                {currentSystem.classification && (
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      Classification:
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassificationClasses(currentSystem.classification)}`}>
                        {currentSystem.classification}
                      </span>
                    </div>
                  </div>
                )}
                {currentSystem.tags && currentSystem.tags.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {currentSystem.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span>{getSystemStats()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Last accessed: {formatLastAccessed(currentSystem.last_accessed)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAbout = () => {
    const appName = 'POAM Tracker Desktop';
    const version = '1.0.1';

    return (
      <div className="space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{appName}</CardTitle>
                <CardDescription>Security Compliance Management</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Author</div>
                    <div className="font-medium">Jeremiah Price</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Version</div>
                    <div className="font-medium">{version}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Scale className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Terms of Use</div>
                    <div className="font-medium">By using this application you agree to the license, terms, and acceptable use.</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. Use within authorized environments only.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border text-sm text-muted-foreground">
              <p>
                Copyright © {new Date().getFullYear()} Jeremiah Price. All rights reserved.
              </p>
              <p className="mt-1">Developed for professional POA&M tracking and security compliance workflows.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <>
      <div className="container-responsive space-y-6">
        {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
            <div className="p-2 bg-primary/10 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">
                Application settings, system information, and about
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

        {/* Tabs - Unified reusable component */}
        <TabNavigation
          tabs={[
            {
              id: 'general',
              label: 'General',
              content: (
                <div className="container-responsive p-6 space-y-8">
                  {renderGeneralSettings()}
                </div>
              )
            },
            {
              id: 'system',
              label: 'System Info',
              content: (
                <div className="container-responsive p-6 space-y-8">
                  {renderSystemInfo()}
                </div>
              )
            },
            {
              id: 'about',
              label: 'About',
              content: (
                <div className="container-responsive p-6 space-y-8">
                  {renderAbout()}
                </div>
              )
            }
          ]}
          activeTabId={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* App Lock Setup Dialog */}
      {showAppLockSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Setup App Lock</h3>
            <form onSubmit={handleSetupAppLock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={appLockPassword}
                    onChange={(e) => setAppLockPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md pr-10"
                    placeholder="Enter password (min 6 characters)"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmAppLockPassword}
                    onChange={(e) => setConfirmAppLockPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md pr-10"
                    placeholder="Confirm password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAppLockSetup(false);
                    setAppLockPassword('');
                    setConfirmAppLockPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessingAppLock || !appLockPassword || !confirmAppLockPassword}
                >
                  {isProcessingAppLock ? 'Setting up...' : 'Enable Lock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Lock Disable Dialog */}
      {showAppLockDisable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Disable App Lock</h3>
            <form onSubmit={handleDisableAppLock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentAppLockPassword}
                    onChange={(e) => setCurrentAppLockPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md pr-10"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAppLockDisable(false);
                    setCurrentAppLockPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isProcessingAppLock || !currentAppLockPassword}
                >
                  {isProcessingAppLock ? 'Disabling...' : 'Disable Lock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Confirm Data Deletion</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              This will permanently delete all POAMs, notes, settings, and other application data. This action cannot be undone.
            </p>
            {isClearing && (
              <div className="mb-4 max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/50 p-3 rounded border font-mono">
                {clearingLog.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setClearingLog([]);
                }}
                disabled={isClearing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAllData}
                disabled={isClearing}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isClearing ? 'Clearing...' : 'Delete All Data'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
                