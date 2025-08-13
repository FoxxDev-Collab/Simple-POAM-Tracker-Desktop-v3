import React from 'react';
import {
  LayoutDashboard,
  Target,
  Milestone,
  BarChart3,
  ClipboardCheck,
  ChevronRight,
  Building,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GroupSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onExit?: () => void;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: any;
}

const groupNavigation: NavItemDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'group-poams', label: 'Group POAMs', icon: Target },
  { id: 'group-milestones', label: 'Milestones', icon: Milestone },
  { id: 'group-stps', label: 'Test Plans', icon: ClipboardCheck },
  { id: 'group-metrics', label: 'Metrics', icon: BarChart3 },
];

export default function GroupSidebar({ activeTab, onTabChange, isCollapsed, onToggleCollapse, onExit }: GroupSidebarProps) {
  return (
    <div className={cn(
      'w-64 bg-card border-r border-border flex flex-col transition-all duration-300',
      isCollapsed && 'w-16'
    )}>
      <div className="p-3 border-b border-border">
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg hover:bg-accent"
              title="Expand"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-primary" />
              <span className="font-semibold">Group</span>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg hover:bg-accent"
              title="Collapse"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {groupNavigation.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </div>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={onExit}
          className="w-full px-3 py-2 text-sm rounded-lg bg-accent hover:bg-accent/80"
        >
          {isCollapsed ? 'Exit' : 'Exit Group'}
        </button>
      </div>
    </div>
  );
}


