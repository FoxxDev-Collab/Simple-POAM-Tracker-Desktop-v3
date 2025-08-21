import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import CreateGroupPOAM from './CreateGroupPOAM';
import GroupPOAMsView from './GroupPOAMsView';
import type { GroupPOAM } from '../../types/group';

interface GroupPOAMTrackerProps {
  groupId: string;
  systems: any[];
}

type ViewMode = 'poams' | 'create';

export default function GroupPOAMTracker({ groupId, systems }: GroupPOAMTrackerProps) {
  const [groupPOAMs, setGroupPOAMs] = useState<GroupPOAM[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('poams');
  const [selectedPOAM, setSelectedPOAM] = useState<GroupPOAM | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (groupId) {
      loadGroupPOAMs();
    }
  }, [groupId]);

  const loadGroupPOAMs = async () => {
    setIsLoading(true);
    try {
      const poams = await invoke<GroupPOAM[]>('get_group_poams', { groupId });
      setGroupPOAMs(poams);
      console.log('Loaded group POAMs:', poams);
    } catch (error) {
      console.error('Failed to load group POAMs:', error);
      showToast('error', 'Failed to load group POAMs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePOAM = async (poamId: number) => {
    if (!confirm('Are you sure you want to delete this Group POAM?')) {
      return;
    }

    try {
      await invoke('delete_group_poam', { id: poamId });
      setGroupPOAMs(prev => prev.filter(p => p.id !== poamId));
      showToast('success', 'Group POAM deleted successfully');
    } catch (error) {
      console.error('Failed to delete group POAM:', error);
      showToast('error', 'Failed to delete Group POAM');
    }
  };

  const handleEditPOAM = (poam: GroupPOAM) => {
    setSelectedPOAM(poam);
    setViewMode('create');
  };

  const handleCreatePOAM = () => {
    setSelectedPOAM(null);
    setViewMode('create');
  };

  const renderPOAMView = () => (
    <GroupPOAMsView 
      groupPOAMs={groupPOAMs}
      isLoading={isLoading}
      systems={systems}
      onEditPOAM={handleEditPOAM}
      onDeletePOAM={handleDeletePOAM}
      onCreatePOAM={handleCreatePOAM}
    />
  );

  const renderCreateView = () => (
    <CreateGroupPOAM
      groupId={groupId}
      systems={systems}
      preSelectedVulnerabilities={[]}
      existingPOAM={selectedPOAM}
      onCancel={() => {
        setSelectedPOAM(null);
        setViewMode('poams');
      }}
      onSuccess={() => {
        setSelectedPOAM(null);
        setViewMode('poams');
        loadGroupPOAMs();
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Group POAM Tracker</h1>
          <p className="text-muted-foreground">
            Manage cross-system security action items
          </p>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'poams' && renderPOAMView()}
      {viewMode === 'create' && renderCreateView()}
    </div>
  );
}
