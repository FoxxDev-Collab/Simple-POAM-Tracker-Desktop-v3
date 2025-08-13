import React, { useEffect, useMemo, useState } from 'react';
import GroupSidebar from './GroupSidebar';
import * as api from '../../utils/tauriApi';
import { Button } from '../ui/button';
import { BrandedLoader } from '../ui/BrandedLoader';

interface GroupPackageProps {
  groupId: string;
  onExit: () => void;
}

type GroupTab =
  | 'overview'
  | 'group-poams'
  | 'group-milestones'
  | 'group-stps'
  | 'group-metrics';

export default function GroupPackage({ groupId, onExit }: GroupPackageProps) {
  const [activeTab, setActiveTab] = useState<GroupTab>('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [group, setGroup] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const g = await api.getGroupById(groupId);
        setGroup(g);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId]);

  const navigation = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: require('lucide-react').LayoutDashboard },
    { id: 'group-poams', label: 'Group POAMs', icon: require('lucide-react').Target },
    { id: 'group-milestones', label: 'Milestones', icon: require('lucide-react').Milestone },
    { id: 'group-stps', label: 'Test Plans', icon: require('lucide-react').ClipboardCheck },
    { id: 'group-metrics', label: 'Metrics', icon: require('lucide-react').BarChart3 },
  ], []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{group?.name || 'Group'}</h1>
                {group?.description && (
                  <p className="text-muted-foreground">{group.description}</p>
                )}
              </div>
              <Button variant="outline" onClick={onExit}>Exit Group</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-sm text-muted-foreground">Systems</div>
                <div className="text-2xl font-semibold">{group?.system_count ?? '—'}</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-sm text-muted-foreground">Total POAMs</div>
                <div className="text-2xl font-semibold">{group?.total_poam_count ?? '—'}</div>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="text-sm text-muted-foreground">Test Plans</div>
                <div className="text-2xl font-semibold">{group?.total_test_plans_count ?? '—'}</div>
              </div>
            </div>
          </div>
        );
      case 'group-poams':
        return <div className="text-muted-foreground">Group POAM Tracker (coming soon)</div>;
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


