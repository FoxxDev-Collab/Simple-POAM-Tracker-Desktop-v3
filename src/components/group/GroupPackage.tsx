import { useEffect, useState } from 'react';
import GroupSidebar from './GroupSidebar';
import EnhancedGroupOverview from './EnhancedGroupOverview';
import GroupPOAMTracker from './GroupPOAMTracker';
import GroupNistControls from './GroupNistControls';
import GroupMilestones from './GroupMilestones';
import GroupSTPs from './GroupSTPs';
import GroupNotes from './GroupNotes';
import GroupMetrics from './GroupMetrics';
import GroupExportImport from './GroupExportImport';
import * as api from '../../utils/tauriApi';
import { BrandedLoader } from '../ui/BrandedLoader';

interface GroupPackageProps {
  groupId: string;
  onExit: () => void;
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

type GroupTab =
  | 'overview'
  | 'group-poams'
  | 'group-nist-controls'
  | 'group-milestones'
  | 'group-stps'
  | 'group-notes'
  | 'group-metrics'
  | 'group-export-import';

export default function GroupPackage({ groupId, onExit, onSwitchToSystem }: GroupPackageProps) {
  const [activeTab, setActiveTab] = useState<GroupTab>('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [group, setGroup] = useState<any | null>(null);
  const [systems, setSystems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [groupData, systemsData] = await Promise.all([
          api.getGroupById(groupId),
          api.getSystemsInGroup(groupId)
        ]);
        setGroup(groupData);
        setSystems(systemsData);
      } catch (error) {
        console.error('Failed to load group data:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId]);

  // Navigation is handled inside GroupSidebar

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <EnhancedGroupOverview 
            group={group} 
            systems={systems} 
            onExit={onExit}
            onSwitchToSystem={onSwitchToSystem}
          />
        );
      case 'group-poams':
        return (
          <GroupPOAMTracker 
            groupId={groupId} 
            systems={systems}
          />
        );
      case 'group-nist-controls':
        return (
          <GroupNistControls 
            groupId={groupId} 
            systems={systems}
          />
        );
      case 'group-milestones':
        return (
          <GroupMilestones 
            groupId={groupId} 
            systems={systems}
          />
        );
      case 'group-stps':
        return (
          <GroupSTPs 
            groupId={groupId} 
            systems={systems}
            onSwitchToSystem={onSwitchToSystem}
          />
        );
      case 'group-notes':
        return (
          <GroupNotes 
            groupId={groupId} 
            systems={systems}
            onSwitchToSystem={onSwitchToSystem}
          />
        );
      case 'group-metrics':
        return (
          <GroupMetrics 
            groupId={groupId} 
            systems={systems}
            onSwitchToSystem={onSwitchToSystem}
          />
        );
      case 'group-export-import':
        return (
          <GroupExportImport
            groupId={groupId}
            groupName={group?.name || 'Unknown Group'}
            systems={systems}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <BrandedLoader />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <GroupSidebar
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as GroupTab)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onExit={onExit}
      />
      <div className="flex-1 overflow-hidden">
        <main className="h-full overflow-auto p-6 bg-background">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}


