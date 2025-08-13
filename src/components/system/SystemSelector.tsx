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
  X
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
      await api.updateGroup(groupData);
      showToast('success', `Updated group: ${groupData.name}`);
      setEditingGroup(null);
      await loadGroupsAndSystems();
    } catch (error) {
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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Header */}
      <div className="w-full text-center py-12 px-4">
        <h1 className="text-5xl font-bold tracking-tight">POAM Tracker Desktop</h1>
        <p className="text-muted-foreground mt-2 text-lg max-w-2xl mx-auto">
          Select or create a system to begin managing your Plan of Action & Milestones
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Button onClick={() => setShowCreateModal(true)} size="lg" className="shadow-lg">
            <Icon icon={Plus} size="md" className="mr-2" />
            Create New System
          </Button>
          <Button onClick={() => setShowCreateGroupModal(true)} variant="outline" size="lg" className="shadow-lg">
            <Icon icon={FolderPlus} size="md" className="mr-2" />
            Create New Group
          </Button>
          <Button onClick={handleImportSystem} variant="outline" size="lg" className="shadow-lg" disabled={isImporting}>
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
      
      {/* Grouped Systems */}
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-screen-2xl mx-auto space-y-8">
          
          {/* Groups */}
          {groups.map((group) => (
            <div key={group.id} className="space-y-4">
              {/* Group Header */}
              <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="p-2"
                  >
                    {expandedGroups.has(group.id) ? (
                      <Icon icon={ChevronDown} size="md" />
                    ) : (
                      <Icon icon={ChevronRight} size="md" />
                    )}
                  </Button>
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <h3 className="text-lg font-semibold">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {group.systems?.length || 0} systems
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onGroupSelected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGroupSelected(group.id)}
                    >
                      Manage Group
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Icon icon={MoreVertical} size="sm" />
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

              {/* Group Systems */}
              {expandedGroups.has(group.id) && (
                <div className="ml-8">
                  <SystemsTable
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroupExpansion('ungrouped')}
                    className="p-2"
                  >
                    {expandedGroups.has('ungrouped') ? (
                      <Icon icon={ChevronDown} size="md" />
                    ) : (
                      <Icon icon={ChevronRight} size="md" />
                    )}
                  </Button>
                  <Icon icon={Folder} size="md" className="text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">Ungrouped Systems</h3>
                    <p className="text-sm text-muted-foreground">Systems not assigned to any group</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {ungroupedSystems.length} systems
                  </div>
                </div>
              </div>

              {expandedGroups.has('ungrouped') && (
                <div className="ml-8">
                  <SystemsTable
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

          {/* Default expanded state for first time users */}
          {groups.length === 0 && ungroupedSystems.length === 0 && (
            <div className="text-center py-12">
              <div className="p-8 bg-card border border-border rounded-xl shadow-sm">
                <Icon icon={Building} size="xl" className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Systems Found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first system or import an existing one to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center py-8 text-sm text-muted-foreground">
        <p>Systems provide complete data isolation for different organizations, projects, or environments.</p>
      </div>

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

// SystemsTable component for list view
interface SystemsTableProps {
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

function SystemsTable({
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
}: SystemsTableProps) {
  if (systems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="p-6 bg-card border border-border rounded-lg">
          <Icon icon={Building} size="xl" className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No systems found in this group.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      <div className="table-responsive">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium text-muted-foreground">System</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Description</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Owner</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Classification</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Tags</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Statistics</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Last Access</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => (
              <tr 
                key={system.id} 
                className={`border-t border-border hover:bg-muted/30 transition-colors ${
                  selectedSystemId === system.id ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{system.name || 'Unnamed System'}</div>
                      <div className="text-sm text-muted-foreground">ID: {system.id}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-muted-foreground max-w-xs truncate">
                    {system.description || 'No description provided'}
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm">
                    {system.owner ? (
                      <span className="text-foreground">{system.owner}</span>
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  {system.classification ? (
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getClassificationClasses(system.classification)}`}>
                      {system.classification}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td className="p-4">
                  {system.tags && system.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-48">
                      {system.tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                          {tag}
                        </span>
                      ))}
                      {system.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs text-muted-foreground">
                          +{system.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No tags</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="text-sm text-muted-foreground">
                    {getSystemStats(system)}
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-muted-foreground">
                    {formatLastAccessed(system.last_accessed)}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => onSystemSelect(system)} 
                      variant={selectedSystemId === system.id ? 'default' : 'outline'}
                      className="text-xs"
                    >
                      {selectedSystemId === system.id ? 'Connect' : 'Select'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditSystem(system)}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        {showGroupActions && onRemoveFromGroup && (
                          <DropdownMenuItem onClick={() => onRemoveFromGroup(system.id)}>
                            <X className="mr-2 h-4 w-4" />
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
                                <Move className="mr-2 h-4 w-4" />
                                <span>Add to {group.name}</span>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDeleteSystem(system.id)} 
                          disabled={system.id === 'default' || deletingSystemId === system.id}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}