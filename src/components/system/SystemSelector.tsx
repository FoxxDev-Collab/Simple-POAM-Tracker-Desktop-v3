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
  Tag,
  Shield,
  Activity,
  ArrowRight,
  CheckCircle2
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
      const completeSystem = await invoke('get_system_by_id', { id: systemData.id }) as any;
      
      if (!completeSystem) {
        showToast('error', 'System not found');
        return;
      }

      const updatedSystemData = {
        ...completeSystem,
        name: systemData.name,
        description: systemData.description,
        owner: systemData.owner || null,
        classification: systemData.classification || null,
        tags: systemData.tags && systemData.tags.length > 0 ? systemData.tags : null,
      };

      await updateSystem(updatedSystemData);
      await loadSystems(); 
      
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
      showToast('error', 'Failed to update system');
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
      const selected = await open({
        filters: [{ name: 'System Backup', extensions: ['zip', 'json'] }]
      });
      
      if (!selected) {
        showToast('info', 'System import cancelled');
        setIsImporting(false);
        return;
      }
      
      const result = await invoke('import_system_backup', { filePath: selected }) as any;
      
      await loadSystems();
      
      const importSummary = result.itemsImported 
        ? Object.entries(result.itemsImported).map(([key, value]) => `${value} ${key}`).join(', ')
        : 'system data';
      
      showToast('success', `System "${result.systemName || 'Unknown'}" imported with ${importSummary}`);
      
      if (result.systemId) {
        const importedSystem = systems.find(s => s.id === result.systemId);
        if (importedSystem) {
          await handleSystemSelect(importedSystem);
        }
      }
      
    } catch (error) {
      console.error('System import error:', error);
      showToast('error', `System import failed: ${error}`);
    } finally {
      setIsImporting(false);
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

  const getSystemStats = (system: any) => {
    const stats = [];
    if (system.poam_count > 0) stats.push(`${system.poam_count} POAMs`);
    if (system.notes_count > 0) stats.push(`${system.notes_count} Notes`);
    if (system.stig_mappings_count > 0) stats.push(`${system.stig_mappings_count} STIG Mappings`);
    if (system.test_plans_count > 0) stats.push(`${system.test_plans_count} Test Plans`);
    return stats.length > 0 ? stats.join(' • ') : 'No data yet';
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
                    <div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin mr-2"></div>
                    Importing...
                  </div>
                ) : (
                  <>
                    <Icon icon={Upload} size="md" className="mr-2" />
                    Import System
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
              <div className="flex items-center justify-between">
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
                    <div 
                      className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground">{group.name}</h2>
                      {group.description && (
                        <p className="text-muted-foreground mt-1">{group.description}</p>
                      )}
                    </div>
                    <div className="px-3 py-1 bg-muted rounded-full text-sm font-medium text-muted-foreground">
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
                    getSystemStats={getSystemStats}
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
                    getSystemStats={getSystemStats}
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
                    <Button onClick={handleImportSystem} variant="outline" size="lg">
                      <Icon icon={Upload} size="md" className="mr-2" />
                      Import System
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
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

// SystemsGrid component for modern card layout
interface SystemsGridProps {
  systems: any[];
  selectedSystemId: string | null;
  onSystemSelect: (system: any) => void;
  onEditSystem: (system: any) => void;
  onDeleteSystem: (systemId: string) => void;
  onRemoveFromGroup?: (systemId: string) => void;
  onAddToGroup?: (groupId: string, systemId: string) => void;
  deletingSystemId: string | null;
  getSystemStats: (system: any) => string;
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
  getSystemStats,
  getClassificationClasses,
  formatLastAccessed,
  groups,
  showGroupActions
}: SystemsGridProps) {
  if (systems.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="p-8 bg-card border border-border rounded-2xl shadow-sm">
          <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Icon icon={Building} size="xl" className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No systems found in this group.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {systems.map((system) => (
        <SystemCard
          key={system.id}
          system={system}
          selectedSystemId={selectedSystemId}
          onSystemSelect={onSystemSelect}
          onEditSystem={onEditSystem}
          onDeleteSystem={onDeleteSystem}
          onRemoveFromGroup={onRemoveFromGroup}
          onAddToGroup={onAddToGroup}
          deletingSystemId={deletingSystemId}
          getSystemStats={getSystemStats}
          getClassificationClasses={getClassificationClasses}
          formatLastAccessed={formatLastAccessed}
          groups={groups}
          showGroupActions={showGroupActions}
        />
      ))}
    </div>
  );
}

// Individual System Card Component
interface SystemCardProps {
  system: any;
  selectedSystemId: string | null;
  onSystemSelect: (system: any) => void;
  onEditSystem: (system: any) => void;
  onDeleteSystem: (systemId: string) => void;
  onRemoveFromGroup?: (systemId: string) => void;
  onAddToGroup?: (groupId: string, systemId: string) => void;
  deletingSystemId: string | null;
  getSystemStats: (system: any) => string;
  getClassificationClasses: (classification: string) => string;
  formatLastAccessed: (dateString?: string) => string;
  groups?: any[];
  showGroupActions: boolean;
}

function SystemCard({
  system,
  selectedSystemId,
  onSystemSelect,
  onEditSystem,
  onDeleteSystem,
  onRemoveFromGroup,
  onAddToGroup,
  deletingSystemId,
  getSystemStats,
  getClassificationClasses,
  formatLastAccessed,
  groups,
  showGroupActions
}: SystemCardProps) {
  const isSelected = selectedSystemId === system.id;
  const isDeleting = deletingSystemId === system.id;

  return (
    <div className={`
      group relative bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden
      ${isSelected ? 'ring-2 ring-primary/20 border-primary/30 bg-primary/5' : 'hover:border-border/60'}
      ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
    `}>
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2.5 bg-primary/10 rounded-xl flex-shrink-0">
              <Icon icon={Building} size="md" className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{system.name || 'Unnamed System'}</h3>
              <p className="text-xs text-muted-foreground font-mono">ID: {system.id}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* Description */}
        {system.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {system.description}
          </p>
        )}

        {/* Classification Badge */}
        {system.classification && (
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${getClassificationClasses(system.classification)}`}>
              <Icon icon={Shield} size="xs" />
              {system.classification}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Owner */}
        {system.owner && (
          <div className="flex items-center gap-2 text-sm">
            <Icon icon={User} size="sm" className="text-muted-foreground" />
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-medium text-foreground">{system.owner}</span>
          </div>
        )}

        {/* Tags */}
        {system.tags && system.tags.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Icon icon={Tag} size="sm" className="text-muted-foreground mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {system.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-md">
                  {tag}
                </span>
              ))}
              {system.tags.length > 3 && (
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  +{system.tags.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="flex items-center gap-2 text-sm">
          <Icon icon={Activity} size="sm" className="text-muted-foreground" />
          <span className="text-muted-foreground">Stats:</span>
          <span className="font-medium text-foreground">{getSystemStats(system)}</span>
        </div>

        {/* Last Access */}
        <div className="flex items-center gap-2 text-sm">
          <Icon icon={Clock} size="sm" className="text-muted-foreground" />
          <span className="text-muted-foreground">Last access:</span>
          <span className="font-medium text-foreground">{formatLastAccessed(system.last_accessed)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSelected && (
              <Icon icon={CheckCircle2} size="sm" className="text-success" />
            )}
            <span className="text-xs text-muted-foreground">
              {isSelected ? 'Currently connected' : 'Ready to connect'}
            </span>
          </div>
          <Button 
            size="sm" 
            onClick={() => onSystemSelect(system)} 
            variant={isSelected ? 'default' : 'outline'}
            className="shadow-sm"
            disabled={isDeleting}
          >
            {isSelected ? (
              <>
                <Icon icon={CheckCircle2} size="sm" className="mr-1.5" />
                Connected
              </>
            ) : (
              <>
                Connect
                <Icon icon={ArrowRight} size="sm" className="ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}