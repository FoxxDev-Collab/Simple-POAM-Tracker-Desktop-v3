import { useState } from "react";
import { Sidebar } from "./components/ui/sidebar";
import Dashboard from "./components/dashboard";
import { CreatePOAM, POAMTracker } from "./components/poam";
import { MilestoneTracker } from "./components/milestones";
import { Calendar } from "./components/calendar";
import Metrics from "./components/metrics";
import { Notes } from "./components/notes";
import { STIGMapper } from "./components/stigMapper";
import { SecurityTestPlan } from "./components/securityTestPlan";
import ImportExport from "./components/importExport";
import { NessusCenter } from "./components/nessus";
import Settings from "./components/settings";
import EditPOAM from "./components/poam/EditPOAM";
import { ToastProvider } from "./context/ToastContext";
import { ToastContainer } from "./components/toast";
import { ThemeProvider } from "./context/ThemeContext";
import { TabProvider } from "./context/TabContext";
import { AppLockProvider, useAppLock } from "./context/AppLockContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SystemProvider, useSystem } from "./context/SystemContext";
import LockScreen from "./components/security/LockScreen";
import SystemSelector from "./components/system/SystemSelector";
import { BrandedLoader } from "./components/ui/BrandedLoader";
import GroupPackage from "./components/group/GroupPackage";

// Create a context to manage the EditPOAM tab
import { createContext, useContext } from 'react';

interface EditPOAMContextType {
  openEditPOAM: (poamId: number) => void;
  closeEditPOAM: () => void;
}

export const EditPOAMContext = createContext<EditPOAMContextType>({
  openEditPOAM: () => {},
  closeEditPOAM: () => {},
});

export const useEditPOAM = () => useContext(EditPOAMContext);

// App content component that uses the AppLock and System contexts
function AppContent() {
  const { isLocked, unlockApp } = useAppLock();
  const { currentSystem, isSystemsLoaded, isLoading } = useSystem();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>("dashboard");
  const [editingPOAM, setEditingPOAM] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSystemSelector, setShowSystemSelector] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const handleUnlock = async (password: string): Promise<boolean> => {
    setIsUnlocking(true);
    try {
      return await unlockApp(password);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Function to open the EditPOAM tab
  const openEditPOAM = (poamId: number) => {
    setEditingPOAM(poamId);
    setActiveTabId("edit-poam");
  };

  // Function to close the EditPOAM tab
  const closeEditPOAM = () => {
    setEditingPOAM(null);
    setActiveTabId("poam-tracker");
  };

  // Function to switch systems (clear current system and show selector)
  const handleSwitchSystem = () => {
    setShowSystemSelector(true);
    // Reset active tab to dashboard for clean slate
    setActiveTabId("dashboard");
  };

  // Function to navigate to milestone tracker from calendar
  const handleNavigateToMilestone = (milestoneId: string, poamId?: number) => {
    console.log('App: Navigating to milestone tracker', {
      milestoneId,
      poamId,
      currentTab: activeTabId
    });
    
    // Store the milestone ID for highlighting in milestone tracker
    sessionStorage.setItem('highlightMilestone', milestoneId);
    if (poamId) {
      sessionStorage.setItem('highlightPOAM', poamId.toString());
    }
    
    console.log('App: Session storage set, switching to milestone-tracker tab');
    setActiveTabId("milestone-tracker");
  };

  // Render the active tab content
  const renderActiveContent = () => {
    switch (activeTabId) {
      case "dashboard":
        return <Dashboard />;
      case "create-poam":
        return <CreatePOAM />;
      case "poam-tracker":
        return <POAMTracker />;
      case "milestone-tracker":
        return <MilestoneTracker />;
      case "calendar":
        return <Calendar onNavigateToMilestone={handleNavigateToMilestone} />;
      case "metrics":
        return <Metrics />;
      case "notes":
        return <Notes />;
      case "stig-mapper":
        return <STIGMapper />;
      case "security-test-plan":
        return <SecurityTestPlan />;
      case "nessus-center":
        return <NessusCenter />;
      case "import-export":
        return <ImportExport />;
      case "settings":
        return <Settings />;
      case "edit-poam":
        return editingPOAM ? (
          <EditPOAM 
            poamId={editingPOAM} 
            onSave={closeEditPOAM}
          />
        ) : (
          <div className="text-center p-8">
            <p className="text-muted-foreground">No POAM selected for editing.</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  // Show loading screen while systems are being loaded
  if (!isSystemsLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <BrandedLoader size="lg" />
          <p className="mt-4 text-muted-foreground text-lg">
            Initializing POAM Tracker...
          </p>
        </div>
      </div>
    );
  }

  // Show system selector if no current system is selected OR if explicitly requested
  if ((!currentSystem || showSystemSelector) && !activeGroupId) {
    return (
      <SystemSelector
        onSystemSelected={() => {
          setShowSystemSelector(false);
          console.log('System selected, proceeding to main application');
        }}
        onGroupSelected={(groupId: string) => {
          setActiveGroupId(groupId);
          setShowSystemSelector(false);
        }}
      />
    );
  }

  // Group Package interface
  if (activeGroupId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex h-screen">
          <div className="flex-1 overflow-hidden relative">
            <main className="h-full overflow-auto p-0 bg-background">
              <GroupPackage
                groupId={activeGroupId}
                onExit={() => {
                  setActiveGroupId(null);
                  setShowSystemSelector(true);
                }}
              />
            </main>
            <ToastContainer />
          </div>
        </div>
      </div>
    );
  }

  // Main application - user has selected a system
  return (
    <EditPOAMContext.Provider value={{ openEditPOAM, closeEditPOAM }}>
      <TabProvider setActiveTabId={setActiveTabId}>
        <div className="min-h-screen bg-background text-foreground">
          {/* Lock Screen Overlay */}
          {isLocked && (
            <LockScreen onUnlock={handleUnlock} isUnlocking={isUnlocking} />
          )}

          {/* Main Application Layout */}
          <div className="flex h-screen">
            {/* Sidebar */}
            <Sidebar 
              activeTab={activeTabId}
              onTabChange={setActiveTabId}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onSwitchSystem={handleSwitchSystem}
            />

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
              {/* Page Content - Full Height */}
              <main className="h-full overflow-auto p-6 bg-background">
                <div className="max-w-7xl mx-auto h-full">
                  {renderActiveContent()}
                </div>
              </main>
              
              {/* Toast Notifications - Positioned within main content area */}
              <ToastContainer />
            </div>
          </div>
        </div>
      </TabProvider>
    </EditPOAMContext.Provider>
  );
}

// Main App component with providers
function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppLockProvider>
            <SystemProvider>
              <AppContent />
            </SystemProvider>
          </AppLockProvider>
        </NotificationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
