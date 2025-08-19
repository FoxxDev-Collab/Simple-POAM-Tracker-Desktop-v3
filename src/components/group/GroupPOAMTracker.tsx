import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../context/ToastContext';
import GroupVulnerabilityAnalysis from './GroupVulnerabilityAnalysis';
import CreateGroupPOAM from './CreateGroupPOAM';
import GroupPOAMsView from './GroupPOAMsView';
import type { GroupPOAM } from '../../types/group';

interface GroupPOAMTrackerProps {
  groupId: string;
  systems: any[];
}

type ViewMode = 'poams' | 'vulnerabilities' | 'create';

export default function GroupPOAMTracker({ groupId, systems }: GroupPOAMTrackerProps) {
  const [groupPOAMs, setGroupPOAMs] = useState<GroupPOAM[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('poams');
  const [selectedPOAM, setSelectedPOAM] = useState<GroupPOAM | null>(null);
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<any[]>([]);
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

  const renderVulnerabilityView = () => (
    <GroupVulnerabilityAnalysis 
      groupId={groupId} 
      systems={systems}
      onCreatePOAMsFromVulnerabilities={(vulnerabilities) => {
        setSelectedVulnerabilities(vulnerabilities);
        setViewMode('create');
      }}
    />
  );

  const renderCreateView = () => (
    <CreateGroupPOAM
      groupId={groupId}
      systems={systems}
      preSelectedVulnerabilities={selectedVulnerabilities}
      existingPOAM={selectedPOAM}
      onCancel={() => {
        setSelectedVulnerabilities([]);
        setSelectedPOAM(null);
        setViewMode('poams');
      }}
      onSuccess={() => {
        setSelectedVulnerabilities([]);
        setSelectedPOAM(null);
        setViewMode('poams');
        loadGroupPOAMs();
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Group POAM Tracker</h1>
          <p className="text-muted-foreground">
            Manage cross-system security action items and vulnerabilities
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'poams' ? 'default' : 'outline'}
            onClick={() => setViewMode('poams')}
          >
            <Target className="w-4 h-4 mr-2" />
            POAMs
          </Button>
          <Button 
            variant={viewMode === 'vulnerabilities' ? 'default' : 'outline'}
            onClick={() => setViewMode('vulnerabilities')}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Vulnerabilities
          </Button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'poams' && renderPOAMView()}
      {viewMode === 'vulnerabilities' && renderVulnerabilityView()}
      {viewMode === 'create' && renderCreateView()}
    </div>
  );
}
