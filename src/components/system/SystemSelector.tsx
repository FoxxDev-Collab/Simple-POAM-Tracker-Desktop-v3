import { useState, useEffect } from 'react';
import { useSystem } from '../../context/SystemContext';
import { useToast } from '../../context/ToastContext';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Plus,
  Edit3,
  Trash2,
  Building,
  Upload,
  MoreVertical,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Move,
  X,
  Clock,
  User,
  Shield,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { BrandedLoader } from '../ui/BrandedLoader';
import { Icon } from '../ui/icon';
import CreateSystemModal from './CreateSystemModal';
import EditSystemModal from './EditSystemModal';
import CreateGroupModal from './CreateGroupModal';
import EditGroupModal from './EditGroupModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import * as api from '../../utils/tauriApi';

interface SystemSelectorProps {
  onSystemSelected: () => void;
  onGroupSelected?: (groupId: string) => void;
}

export default function SystemSelector({ onSystemSelected, onGroupSelected }: SystemSelectorProps) {
  const { 
    systems, 
    currentSystem, 
    isLoading, 
    isSystemsLoaded,
    setCurrentSystem, 
    loadSystems,
    createSystem, 
    updateSystem,
    deleteSystem 
  } = useSystem();
  
  const { showToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [deletingSystemId, setDeletingSystemId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(currentSystem?.id || null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingGroup, setIsImportingGroup] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [groupImportProgress, setGroupImportProgress] = useState<string | null>(null);

  
  // Group management state
  const [groups, setGroups] = useState<any[]>([]);
  const [ungroupedSystems, setUngroupedSystems] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  
  // Load groups and organize systems
  const loadGroupsAndSystems = async () => {
    try {
      setIsLoadingGroups(true);
      const [allGroups, ungroupedSystemsData] = await Promise.all([
        api.getAllGroups(),
        api.getUngroupedSystems()
      ]);
      
      // Load systems for each group
      const groupsWithSystems = await Promise.all(
        allGroups.map(async (group: any) => {
          const groupSystems = await api.getSystemsInGroup(group.id);
          return { ...group, systems: groupSystems };
        })
      );
      
      setGroups(groupsWithSystems);
      setUngroupedSystems(ungroupedSystemsData);
      
      // Set default expanded state for first load
      if (expandedGroups.size === 0) {
        const defaultExpanded = new Set(['ungrouped']);
        groupsWithSystems.forEach((group: any) => defaultExpanded.add(group.id));
        setExpandedGroups(defaultExpanded);
      }
    } catch (error) {
      console.error('Failed to load groups and systems:', error);
      showToast('error', 'Failed to load groups');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (isSystemsLoaded) {
      loadGroupsAndSystems();
    }
  }, [isSystemsLoaded]);

  const handleSystemSelect = async (system: any) => {
    try {
      setSelectedSystemId(system.id);
      await setCurrentSystem(system);
      showToast('success', `Connected to ${system.name}`);
      onSystemSelected();
    } catch (error) {
      showToast('error', `Failed to connect to ${system.name}`);
    }
  };

  const handleCreateSystem = async (systemData: any) => {
    try {
      await createSystem(systemData);
      showToast('success', `Created system: ${systemData.name}`);
      setShowCreateModal(false);
    } catch (error) {
      showToast('error', 'Failed to create system');
    }
  };

  const handleUpdateSystem = async (systemData: any) => {
    try {
      console.log('SystemSelector - handleUpdateSystem called with:', systemData);
      
      const completeSystem = await invoke('get_system_by_id', { id: systemData.id }) as any;
      console.log('SystemSelector - Retrieved complete system:', completeSystem);
      
      if (!completeSystem) {
        showToast('error', 'System not found');
        return;
      }

      // Check if the new name conflicts with existing systems (excluding the current one)
      if (systemData.name !== completeSystem.name) {
        console.log('SystemSelector - Name changed from', completeSystem.name, 'to', systemData.name);
        console.log('SystemSelector - All systems in context:', systems.map(s => ({ id: s.id, name: s.name })));
        console.log('SystemSelector - Current system ID being edited:', systemData.id);
        
        const existingSystem = systems.find(s => s.id !== systemData.id && s.name === systemData.name);
        console.log('SystemSelector - Found conflicting system:', existingSystem);
        
        if (existingSystem) {
          const suggestion = generateUniqueSystemName(systemData.name, systemData.id);
          showToast('error', 
            `A system with the name "${systemData.name}" already exists (ID: ${existingSystem.id}). ` +
            `Try using "${suggestion}" instead.`
          );
          console.log('SystemSelector - Conflict detected, aborting update');
          console.log('SystemSelector - Conflicting system details:', existingSystem);
          console.log('SystemSelector - Suggested alternative name:', suggestion);
          return;
        }
        console.log('SystemSelector - No name conflicts found, proceeding with update');
      }

      const updatedSystemData = {
        ...completeSystem,
        name: systemData.name,
        description: systemData.description,
        owner: systemData.owner || null,
        classification: systemData.classification || null,
        tags: systemData.tags && systemData.tags.length > 0 ? systemData.tags : null,
        updated_date: new Date().toISOString(),
        // Ensure all required fields are present
        group_id: completeSystem.group_id,
        is_active: completeSystem.is_active ?? true,
        poam_count: completeSystem.poam_count,
        last_accessed: completeSystem.last_accessed,
        created_date: completeSystem.created_date,
      };

      console.log('SystemSelector - About to call updateSystem with:', updatedSystemData);
      await updateSystem(updatedSystemData);
      console.log('SystemSelector - updateSystem completed, reloading systems...');
      
      await loadSystems(); 
      console.log('SystemSelector - loadSystems completed');
      
      await loadGroupsAndSystems();
      console.log('SystemSelector - loadGroupsAndSystems completed');
      
      if (selectedSystemId === systemData.id) {
        const updatedSystem = systems.find(s => s.id === systemData.id);
        if (updatedSystem) {
          setSelectedSystemId(updatedSystem.id);
          await setCurrentSystem(updatedSystem);
        }
      }
      
      showToast('success', `Updated system: ${systemData.name}`);
      setEditingSystem(null);
    } catch (error) {
      console.error('Failed to update system:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('UNIQUE constraint failed: systems.name')) {
        showToast('error', 'A system with this name already exists. Please choose a different name.');
      } else {
        showToast('error', `Failed to update system: ${errorMessage}`);
      }
    }
  };

  const handleDeleteSystem = async (systemId: string) => {
    if (systemId === 'default') {
      showToast('error', 'Cannot delete the default system');
      return;
    }

    try {
      setDeletingSystemId(systemId);
      await deleteSystem(systemId);
      showToast('success', 'System deleted successfully');
    } catch (error) {
      showToast('error', 'Failed to delete system');
    } finally {
      setDeletingSystemId(null);
    }
  };

  const handleImportSystem = async () => {
    try {
      setIsImporting(true);
      
      setImportProgress('Selecting file...');
      
      const selected = await open({
        filters: [{ name: 'System Backup', extensions: ['zip', 'json'] }]
      });
      
      if (!selected) {
        showToast('info', 'System import cancelled');
        setIsImporting(false);
        setImportProgress(null);
        return;
      }
      
      setImportProgress('Processing backup file...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      
      setImportProgress('Importing system data...');
      const result = await invoke('import_system_backup', { filePath: selected }) as any;
      
      setImportProgress('Updating system list...');
      
      // First refresh the context systems
      await loadSystems();
      
      // Then force refresh the local groups and systems state
      await loadGroupsAndSystems();
      
      setImportProgress('Connecting to imported system...');
      
      const importSummary = result.counts 
        ? Object.entries(result.counts).map(([key, value]) => `${value} ${key}`).join(', ')
        : 'system data';
      
      // Find and auto-select the imported system
      if (result.systemId) {
        try {
          // Get the imported system directly from database to ensure we have the latest data
          const importedSystem = await invoke<any>('get_system_by_id', { id: result.systemId });
          
          if (importedSystem) {
            setSelectedSystemId(importedSystem.id);
            await setCurrentSystem(importedSystem);
            setImportProgress('Import completed successfully!');
            showToast('success', `System "${result.systemName || 'Unknown'}" imported and connected! ${importSummary}`);
          } else {
            setImportProgress('Import completed successfully!');
            showToast('success', `System "${result.systemName || 'Unknown'}" imported successfully with ${importSummary}`);
          }
        } catch (error) {
          console.error('Failed to get imported system:', error);
          setImportProgress('Import completed successfully!');
          showToast('success', `System "${result.systemName || 'Unknown'}" imported successfully with ${importSummary}`);
        }
      } else {
        setImportProgress('Import completed successfully!');
        showToast('success', `System imported successfully with ${importSummary}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Show success state
      
    } catch (error) {
      console.error('System import error:', error);
      showToast('error', `System import failed: ${error}`);
    } finally {
      // Clean up loading state after successful import or error
      setTimeout(async () => {
        setIsImporting(false);
        setImportProgress(null);
        
        // Final refresh to make sure the UI shows the imported system
        try {
          await loadSystems();
          await loadGroupsAndSystems();
        } catch (error) {
          console.error('Failed to refresh after import:', error);
        }
      }, 1500); // Brief delay to show final state
    }
  };

  const handleImportGroup = async () => {
    try {
      setIsImportingGroup(true);
      setGroupImportProgress('Selecting file...');
      
      const selected = await open({
        filters: [{ name: 'Group Backup', extensions: ['zip'] }]
      });
      
      if (!selected) {
        showToast('info', 'Group import cancelled');
        setIsImportingGroup(false);
        setGroupImportProgress(null);
        return;
      }
      
      setGroupImportProgress('Extracting group backup...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      
      const result = await invoke('import_complete_group_backup', { 
        importPath: selected 
      }) as string;
      
      setGroupImportProgress('Updating groups and systems...');
      await loadGroupsAndSystems();
      await loadSystems();
      
      setGroupImportProgress('Group import completed successfully!');
      await new Promise(resolve => setTimeout(resolve, 800)); // Show success state
      
      showToast('success', `Group backup imported successfully. ${result}`);
      
    } catch (error) {
      console.error('Group import error:', error);
      showToast('error', `Group import failed: ${error}`);
    } finally {
      // Clean up loading state after successful import or error
      setTimeout(() => {
        setIsImportingGroup(false);
        setGroupImportProgress(null);
      }, 1000); // Brief delay to show final state
    }
  };

  // Group management handlers
  const handleCreateGroup = async (groupData: any) => {
    try {
      await api.createGroup(groupData);
      showToast('success', `Created group: ${groupData.name}`);
      setShowCreateGroupModal(false);
      await loadGroupsAndSystems();
    } catch (error) {
      showToast('error', 'Failed to create group');
    }
  };

  const handleUpdateGroup = async (groupData: any) => {
    try {
      // Fetch the complete group to ensure required fields (created_by, is_active, created_date) are present
      const completeGroup = await api.getGroupById(groupData.id);
      const updatedGroup = {
        ...completeGroup,
        name: groupData.name,
        description: groupData.description ?? null,
        color: groupData.color,
        updated_date: new Date().toISOString(),
      };
      await api.updateGroup(updatedGroup);
      showToast('success', `Updated group: ${groupData.name}`);
      setEditingGroup(null);
      await loadGroupsAndSystems();
    } catch (error) {
      console.error('Failed to update group:', error);
      showToast('error', 'Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await api.deleteGroup(groupId);
      showToast('success', 'Group deleted successfully');
      await loadGroupsAndSystems();
      await loadSystems(); // Refresh systems as they may have been ungrouped
    } catch (error) {
      showToast('error', 'Failed to delete group');
    }
  };

  const handleAddSystemToGroup = async (groupId: string, systemId: string) => {
    try {
      await api.addSystemToGroup(groupId, systemId);
      showToast('success', 'System added to group');
      await loadGroupsAndSystems();
    } catch (error) {
      showToast('error', 'Failed to add system to group');
    }
  };

  const handleRemoveSystemFromGroup = async (systemId: string) => {
    try {
      await api.removeSystemFromGroup(systemId);
      showToast('success', 'System removed from group');
      await loadGroupsAndSystems();
    } catch (error) {
      showToast('error', 'Failed to remove system from group');
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };



  // Helper function to generate unique system name suggestions
  const generateUniqueSystemName = (baseName: string, excludeId?: string): string => {
    // Remove any existing (Imported X) suffix
    const cleanName = baseName.replace(/\s*\(Imported\s+\d+\)\s*$/, '').trim();
    
    // Check if the clean name is available
    if (!systems.find(s => s.id !== excludeId && s.name === cleanName)) {
      return cleanName;
    }
    
    // Generate suggestions with incrementing numbers
    for (let i = 1; i <= 10; i++) {
      const suggestion = `${cleanName} (${i})`;
      if (!systems.find(s => s.id !== excludeId && s.name === suggestion)) {
        return suggestion;
      }
    }
    
    // Fallback with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
    return `${cleanName} (${timestamp})`;
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

  const getClassificationClasses = (classification: string) => {
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

  if (isLoading || !isSystemsLoaded || isLoadingGroups) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center">
        <BrandedLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5"></div>
        <div className="relative container-responsive py-16 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-4">
              POAM Tracker Desktop
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Select or create a system to begin managing your Plan of Action & Milestones with enterprise-grade security and compliance tracking.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button onClick={() => setShowCreateModal(true)} size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200">
                <Icon icon={Plus} size="md" className="mr-2" />
                Create New System
              </Button>
              <Button onClick={() => setShowCreateGroupModal(true)} variant="outline" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200">
                <Icon icon={FolderPlus} size="md" className="mr-2" />
                Create New Group
              </Button>
              <Button onClick={handleImportSystem} variant="outline" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200" disabled={isImporting}>
                {isImporting ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="animate-pulse">{importProgress || 'Importing System...'}</span>
                  </div>
                ) : (
                  <>
                    <Icon icon={Upload} size="md" className="mr-2" />
                    Import System
                  </>
                )}
              </Button>
              <Button onClick={handleImportGroup} variant="outline" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-200" disabled={isImportingGroup}>
                {isImportingGroup ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="animate-pulse">{groupImportProgress || 'Importing Group...'}</span>
                  </div>
                ) : (
                  <>
                    <Icon icon={Upload} size="md" className="mr-2" />
                    Import Group
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Systems Content */}
      <div className="container-responsive pb-16">
        <div className="space-y-12">
          
          {/* Groups */}
          {groups.map((group) => (
            <div key={group.id} className="space-y-6">
              {/* Group Header */}
              <div 
                className="flex items-center justify-between pl-4 py-3 rounded-lg border-l-4 bg-muted/20"
                style={{ borderLeftColor: group.color }}
              >
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="h-10 w-10 rounded-full hover:bg-muted/50"
                  >
                    {expandedGroups.has(group.id) ? (
                      <Icon icon={ChevronDown} size="md" />
                    ) : (
                      <Icon icon={ChevronRight} size="md" />
                    )}
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-2xl font-semibold text-foreground">{group.name}</h2>
                      {group.description && (
                        <p className="text-muted-foreground text-sm">{group.description}</p>
                      )}
                    </div>
                    <div 
                      className="px-3 py-1 rounded-full text-sm font-medium text-white shadow-sm"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.systems?.length || 0} systems
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {onGroupSelected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGroupSelected(group.id)}
                      className="shadow-sm"
                    >
                      Manage Group
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                        <Icon icon={MoreVertical} size="md" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingGroup(group)}>
                        <Icon icon={Edit3} size="sm" className="mr-2" />
                        <span>Edit Group</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-destructive"
                      >
                        <Icon icon={Trash2} size="sm" className="mr-2" tone="destructive" />
                        <span>Delete Group</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Group Systems Grid */}
              {expandedGroups.has(group.id) && (
                <div className="ml-14">
                  <SystemsGrid
                    systems={group.systems || []}
                    selectedSystemId={selectedSystemId}
                    onSystemSelect={handleSystemSelect}
                    onEditSystem={setEditingSystem}
                    onDeleteSystem={handleDeleteSystem}
                    onRemoveFromGroup={handleRemoveSystemFromGroup}
                    deletingSystemId={deletingSystemId}
                    getClassificationClasses={getClassificationClasses}
                    formatLastAccessed={formatLastAccessed}
                    showGroupActions={true}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped Systems */}
          {ungroupedSystems.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleGroupExpansion('ungrouped')}
                  className="h-10 w-10 rounded-full hover:bg-muted/50"
                >
                  {expandedGroups.has('ungrouped') ? (
                    <Icon icon={ChevronDown} size="md" />
                  ) : (
                    <Icon icon={ChevronRight} size="md" />
                  )}
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon icon={Folder} size="md" className="text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">Ungrouped Systems</h2>
                    <p className="text-muted-foreground mt-1">Systems not assigned to any group</p>
                  </div>
                  <div className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
                    {ungroupedSystems.length} systems
                  </div>
                </div>
              </div>

              {expandedGroups.has('ungrouped') && (
                <div className="ml-14">
                  <SystemsGrid
                    systems={ungroupedSystems}
                    selectedSystemId={selectedSystemId}
                    onSystemSelect={handleSystemSelect}
                    onEditSystem={setEditingSystem}
                    onDeleteSystem={handleDeleteSystem}
                    onAddToGroup={handleAddSystemToGroup}
                    deletingSystemId={deletingSystemId}
                    getClassificationClasses={getClassificationClasses}
                    formatLastAccessed={formatLastAccessed}
                    groups={groups}
                    showGroupActions={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {groups.length === 0 && ungroupedSystems.length === 0 && (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="p-8 bg-card border border-border rounded-2xl shadow-lg">
                  <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                    <Icon icon={Building} size="xl" className="text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">No Systems Found</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Create your first system or import an existing one to get started with POAM tracking and compliance management.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setShowCreateModal(true)} size="lg">
                      <Icon icon={Plus} size="md" className="mr-2" />
                      Create System
                    </Button>
                    <Button onClick={handleImportSystem} variant="outline" size="lg" disabled={isImporting}>
                      {isImporting ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="animate-pulse">{importProgress || 'Importing...'}</span>
                        </div>
                      ) : (
                        <>
                          <Icon icon={Upload} size="md" className="mr-2" />
                          Import System
                        </>
                      )}
                    </Button>
                    <Button onClick={handleImportGroup} variant="outline" size="lg" disabled={isImportingGroup}>
                      {isImportingGroup ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span className="animate-pulse">{groupImportProgress || 'Importing...'}</span>
                        </div>
                      ) : (
                        <>
                          <Icon icon={Upload} size="md" className="mr-2" />
                          Import Group
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Import Loading Overlay */}
      {(isImporting || isImportingGroup) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-lg border shadow-xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {((isImporting && importProgress?.includes('completed')) || 
                  (isImportingGroup && groupImportProgress?.includes('completed'))) ? (
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse"></div>
                  </>
                )}
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">
                  {isImporting ? 'Importing System' : 'Importing Group'}
                </h3>
                <p className="text-sm text-muted-foreground animate-pulse">
                  {isImporting ? importProgress : groupImportProgress}
                </p>
                <div className="text-xs text-muted-foreground">
                  {((isImporting && importProgress?.includes('completed')) || 
                    (isImportingGroup && groupImportProgress?.includes('completed'))) 
                    ? 'Import completed! The page will update automatically.' 
                    : 'Please wait while we process your import...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border bg-card/50">
        <div className="container-responsive py-8 text-center">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Systems provide complete data isolation for different organizations, projects, or environments. 
            Each system maintains its own POAMs, notes, STIG mappings, and security test plans.
          </p>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateSystemModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSystem}
        />
      )}
      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}
      {editingSystem && (
        <EditSystemModal
          system={editingSystem}
          onClose={() => setEditingSystem(null)}
          onSubmit={handleUpdateSystem}
        />
      )}
      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSubmit={handleUpdateGroup}
        />
      )}
    </div>
  );
}

// SystemsGrid component for clean table layout
interface SystemsGridProps {
  systems: any[];
  selectedSystemId: string | null;
  onSystemSelect: (system: any) => void;
  onEditSystem: (system: any) => void;
  onDeleteSystem: (systemId: string) => void;
  onRemoveFromGroup?: (systemId: string) => void;
  onAddToGroup?: (groupId: string, systemId: string) => void;
  deletingSystemId: string | null;
  getClassificationClasses: (classification: string) => string;
  formatLastAccessed: (dateString?: string) => string;
  groups?: any[];
  showGroupActions: boolean;
}

function SystemsGrid({
  systems,
  selectedSystemId,
  onSystemSelect,
  onEditSystem,
  onDeleteSystem,
  onRemoveFromGroup,
  onAddToGroup,
  deletingSystemId,
  getClassificationClasses,
  formatLastAccessed,
  groups,
  showGroupActions
}: SystemsGridProps) {
  if (systems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Icon icon={Building} size="lg" />
          <p>No systems found in this group.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left p-4 font-medium text-sm text-muted-foreground">System</th>
              <th className="text-left p-4 font-medium text-sm text-muted-foreground">Classification</th>
              <th className="text-left p-4 font-medium text-sm text-muted-foreground">Owner</th>
              <th className="text-left p-4 font-medium text-sm text-muted-foreground">Last Access</th>
              <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
              <th className="text-right p-4 font-medium text-sm text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => (
              <SystemTableRow
                key={system.id}
                system={system}
                selectedSystemId={selectedSystemId}
                onSystemSelect={onSystemSelect}
                onEditSystem={onEditSystem}
                onDeleteSystem={onDeleteSystem}
                onRemoveFromGroup={onRemoveFromGroup}
                onAddToGroup={onAddToGroup}
                deletingSystemId={deletingSystemId}
                getClassificationClasses={getClassificationClasses}
                formatLastAccessed={formatLastAccessed}
                groups={groups}
                showGroupActions={showGroupActions}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Individual System Table Row Component
interface SystemTableRowProps {
  system: any;
  selectedSystemId: string | null;
  onSystemSelect: (system: any) => void;
  onEditSystem: (system: any) => void;
  onDeleteSystem: (systemId: string) => void;
  onRemoveFromGroup?: (systemId: string) => void;
  onAddToGroup?: (groupId: string, systemId: string) => void;
  deletingSystemId: string | null;
  getClassificationClasses: (classification: string) => string;
  formatLastAccessed: (dateString?: string) => string;
  groups?: any[];
  showGroupActions: boolean;
}

function SystemTableRow({
  system,
  selectedSystemId,
  onSystemSelect,
  onEditSystem,
  onDeleteSystem,
  onRemoveFromGroup,
  onAddToGroup,
  deletingSystemId,
  getClassificationClasses,
  formatLastAccessed,
  groups,
  showGroupActions
}: SystemTableRowProps) {
  const isSelected = selectedSystemId === system.id;
  const isDeleting = deletingSystemId === system.id;

  return (
    <tr className={`
      border-b border-border hover:bg-muted/30 transition-colors
      ${isSelected ? 'bg-primary/5 border-primary/20' : ''}
      ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
    `}>
      {/* System Name & Description */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Icon icon={Building} size="sm" className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{system.name || 'Unnamed System'}</div>
            {system.description && (
              <div className="text-sm text-muted-foreground truncate max-w-xs">{system.description}</div>
            )}
            <div className="text-xs text-muted-foreground font-mono">ID: {system.id}</div>
          </div>
        </div>
      </td>

      {/* Classification */}
      <td className="p-4">
        {system.classification ? (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getClassificationClasses(system.classification)}`}>
            <Icon icon={Shield} size="xs" />
            {system.classification}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </td>

      {/* Owner */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {system.owner ? (
            <>
              <Icon icon={User} size="sm" className="text-muted-foreground" />
              <span className="text-sm font-medium">{system.owner}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      </td>

      {/* Last Access */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Icon icon={Clock} size="sm" className="text-muted-foreground" />
          <span className="text-sm">{formatLastAccessed(system.last_accessed)}</span>
        </div>
      </td>

      {/* Status */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {isSelected ? (
            <>
              <Icon icon={CheckCircle2} size="sm" className="text-success" />
              <span className="text-sm font-medium text-success">Connected</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Ready</span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="p-4">
        <div className="flex items-center justify-end gap-2">
          <Button 
            size="sm" 
            onClick={() => onSystemSelect(system)} 
            variant={isSelected ? 'default' : 'outline'}
            disabled={isDeleting}
          >
            {isSelected ? 'Connected' : 'Connect'}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Icon icon={MoreVertical} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditSystem(system)}>
                <Icon icon={Edit3} size="sm" className="mr-2" />
                <span>Edit</span>
              </DropdownMenuItem>
              {showGroupActions && onRemoveFromGroup && (
                <DropdownMenuItem onClick={() => onRemoveFromGroup(system.id)}>
                  <Icon icon={X} size="sm" className="mr-2" />
                  <span>Remove from Group</span>
                </DropdownMenuItem>
              )}
              {!showGroupActions && onAddToGroup && groups && groups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {groups.map((group) => (
                    <DropdownMenuItem 
                      key={group.id}
                      onClick={() => onAddToGroup(group.id, system.id)}
                    >
                      <Icon icon={Move} size="sm" className="mr-2" />
                      <span>Add to {group.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDeleteSystem(system.id)} 
                disabled={system.id === 'default'}
                className="text-destructive"
              >
                <Icon icon={Trash2} size="sm" className="mr-2" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}