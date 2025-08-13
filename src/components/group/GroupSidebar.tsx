import { useState } from 'react';
import {
  LayoutDashboard,
  Target,
  Milestone,
  BarChart3,
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Building,
  Sun,
  Moon,
  Bell,
  RefreshCw,
  Shuffle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { NotificationCenter } from '../ui/NotificationCenter';

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
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { performComprehensiveCheck } = useNotificationGenerator();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(false);

  const handleExitGroup = () => {
    if (onExit) {
      onExit();
    }
    setShowGroupMenu(false);
  };

  // Manual notification check
  const handleNotificationCheck = async () => {
    setIsCheckingNotifications(true);
    try {
      await performComprehensiveCheck();
    } catch (error) {
      console.error('Error checking notifications:', error);
    } finally {
      setIsCheckingNotifications(false);
    }
  };

  return (
    <div className={cn(
      'flex flex-col border-r transition-all duration-300 ease-in-out bg-card text-card-foreground',
      isCollapsed ? 'w-16' : 'w-64'
    )} style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        {/* Logo and Brand */}
        {!isCollapsed && (
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <img src="/favicon.svg" alt="POAM Tracker" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">POAM Tracker</h1>
              <p className="text-xs text-muted-foreground">Group Package</p>
            </div>
          </div>
        )}
        
        {/* Collapsed logo */}
        {isCollapsed ? (
          <div className="flex items-center justify-center mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <img src="/favicon.svg" alt="POAM Tracker" className="w-6 h-6" />
            </div>
          </div>
        ) : null}

        {/* Group Context Display */}
        {!isCollapsed ? (
          <div className="relative mb-4">
            <button
              onClick={() => setShowGroupMenu(!showGroupMenu)}
              className="w-full flex items-center gap-3 p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground">Group Package</p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                showGroupMenu && "rotate-180"
              )} />
            </button>
            
            {/* Group Menu Dropdown */}
            {showGroupMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50">
                <div className="p-1">
                  <button
                    onClick={handleExitGroup}
                    className="w-full flex items-center gap-3 p-2 text-left hover:bg-accent rounded-md transition-colors"
                  >
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Exit Group</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <button
              onClick={handleExitGroup}
              className="w-full flex items-center justify-center p-2 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
              title="Exit Group"
            >
              <Building className="w-4 h-4 text-primary" />
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

      {/* Bottom Actions */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Quick Actions */}
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick Actions
            </span>
          </div>
        )}
        
        <div className={isCollapsed ? "flex flex-col gap-1" : "flex flex-wrap gap-1"}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground"
            title={isCollapsed ? "Toggle theme" : undefined}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Manual Notification Check */}
          <button
            onClick={handleNotificationCheck}
            disabled={isCheckingNotifications}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-foreground disabled:opacity-50"
            title={isCollapsed ? "Check for new notifications" : undefined}
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingNotifications ? 'animate-spin' : ''}`} />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors relative text-foreground"
            title={isCollapsed ? "Notifications" : undefined}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="pt-2 text-xs text-muted-foreground text-center">
            <p>© 2025 POAM Tracker</p>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-3 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRight className={cn("w-5 h-5 transition-transform", !isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </div>
  );
}


