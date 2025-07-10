import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface System {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  owner?: string;
  classification?: string;
  tags?: string[];
  is_active: boolean;
  poam_count?: number;
  last_accessed?: string;
}

interface SystemSummary {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  classification?: string;
  tags?: string[];
  poam_count: number;
  notes_count: number;
  stig_mappings_count: number;
  test_plans_count: number;
  last_accessed?: string;
  created_date: string;
}

interface SystemContextType {
  systems: SystemSummary[];
  currentSystem: SystemSummary | null;
  isLoading: boolean;
  isSystemsLoaded: boolean;
  setCurrentSystem: (system: SystemSummary) => Promise<void>;
  loadSystems: () => Promise<void>;
  createSystem: (system: Omit<System, 'id' | 'created_date' | 'updated_date'>) => Promise<void>;
  updateSystem: (system: System) => Promise<void>;
  deleteSystem: (systemId: string) => Promise<void>;
  refreshCurrentSystem: () => Promise<void>;
}

const CURRENT_SYSTEM_KEY = 'poam-tracker-current-system';

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [currentSystem, setCurrentSystemState] = useState<SystemSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSystemsLoaded, setIsSystemsLoaded] = useState(false);

  // Load systems from backend
  const loadSystems = useCallback(async () => {
    try {
      setIsLoading(true);
      const systemsList = await invoke<SystemSummary[]>('get_all_systems');
      setSystems(systemsList);
      setIsSystemsLoaded(true);

      // If no current system is set, try to restore from localStorage or use default
      if (!currentSystem && systemsList.length > 0) {
        const savedSystemId = localStorage.getItem(CURRENT_SYSTEM_KEY);
        let systemToSet = systemsList.find(s => s.id === savedSystemId);
        
        if (!systemToSet) {
          // If saved system not found, use the most recently accessed or first system
          systemToSet = systemsList.find(s => s.last_accessed) || systemsList[0];
        }
        
        if (systemToSet) {
          await setCurrentSystem(systemToSet);
        }
      }
    } catch (error) {
      console.error('Failed to load systems:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSystem]);

  // Set current system
  const setCurrentSystem = useCallback(async (system: SystemSummary) => {
    try {
      await invoke('set_active_system', { systemId: system.id });
      setCurrentSystemState(system);
      localStorage.setItem(CURRENT_SYSTEM_KEY, system.id);
    } catch (error) {
      console.error('Failed to set current system:', error);
      throw error;
    }
  }, []);

  // Create new system
  const createSystem = useCallback(async (systemData: Omit<System, 'id' | 'created_date' | 'updated_date'>) => {
    try {
      const now = new Date().toISOString();
      const newSystem: System = {
        ...systemData,
        id: crypto.randomUUID(),
        created_date: now,
        updated_date: now,
        is_active: true,
      };

      await invoke('create_system', { system: newSystem });
      await loadSystems(); // Refresh the systems list
    } catch (error) {
      console.error('Failed to create system:', error);
      throw error;
    }
  }, [loadSystems]);

  // Update system
  const updateSystem = useCallback(async (system: System) => {
    try {
      console.log('SystemContext - updateSystem called with:', system);
      
      // Ensure all required System fields are present
      const updatedSystem: System = {
        ...system,
        updated_date: new Date().toISOString(),
        is_active: system.is_active ?? true, // Ensure is_active is always set
      };

      console.log('SystemContext - Final system data being sent to backend:', updatedSystem);

      await invoke('update_system', { system: updatedSystem });
      
      console.log('SystemContext - Backend update completed, refreshing systems list');
      
      // Refresh the systems list
      const updatedSystems = await invoke<SystemSummary[]>('get_all_systems');
      setSystems(updatedSystems);
      
      console.log('SystemContext - Updated systems list:', updatedSystems);
      
      // Update current system if it's the one being updated
      if (currentSystem?.id === system.id) {
        const updatedCurrentSystem = updatedSystems.find(s => s.id === system.id);
        if (updatedCurrentSystem) {
          console.log('SystemContext - Updating current system to:', updatedCurrentSystem);
          setCurrentSystemState(updatedCurrentSystem);
        }
      }
    } catch (error) {
      console.error('Failed to update system:', error);
      throw error;
    }
  }, [currentSystem]);

  // Delete system
  const deleteSystem = useCallback(async (systemId: string) => {
    try {
      await invoke('delete_system', { id: systemId });
      
      // If we're deleting the current system, switch to another one
      if (currentSystem?.id === systemId) {
        const remainingSystems = systems.filter(s => s.id !== systemId);
        if (remainingSystems.length > 0) {
          await setCurrentSystem(remainingSystems[0]);
        } else {
          setCurrentSystemState(null);
          localStorage.removeItem(CURRENT_SYSTEM_KEY);
        }
      }
      
      await loadSystems(); // Refresh the systems list
    } catch (error) {
      console.error('Failed to delete system:', error);
      throw error;
    }
  }, [loadSystems, currentSystem, systems, setCurrentSystem]);

  // Refresh current system data
  const refreshCurrentSystem = useCallback(async () => {
    if (currentSystem) {
      await loadSystems();
      const refreshedSystem = systems.find(s => s.id === currentSystem.id);
      if (refreshedSystem) {
        setCurrentSystemState(refreshedSystem);
      }
    }
  }, [currentSystem, loadSystems, systems]);

  // Load systems on mount
  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  return (
    <SystemContext.Provider
      value={{
        systems,
        currentSystem,
        isLoading,
        isSystemsLoaded,
        setCurrentSystem,
        loadSystems,
        createSystem,
        updateSystem,
        deleteSystem,
        refreshCurrentSystem,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
} 