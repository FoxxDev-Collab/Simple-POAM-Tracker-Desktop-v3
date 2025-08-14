import { useEffect, useState } from 'react';
import GroupSidebar from './GroupSidebar';
import GroupOverview from './GroupOverview';
import GroupPOAMTracker from './GroupPOAMTracker';
import GroupNistControls from './GroupNistControls';
import * as api from '../../utils/tauriApi';
import { BrandedLoader } from '../ui/BrandedLoader';

interface GroupPackageProps {
  groupId: string;
  onExit: () => void;
}

type GroupTab =
  | 'overview'
  | 'group-poams'
  | 'group-nist-controls'
  | 'group-milestones'
  | 'group-stps'
  | 'group-metrics';

export default function GroupPackage({ groupId, onExit }: GroupPackageProps) {
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
          <GroupOverview 
            group={group} 
            systems={systems} 
            onExit={onExit} 
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
        return <div className="text-muted-foreground">Group Milestones (coming soon)</div>;
      case 'group-stps':
        return <div className="text-muted-foreground">Group Security Test Plans (coming soon)</div>;
      case 'group-metrics':
        return <div className="text-muted-foreground">Group Metrics (coming soon)</div>;
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


