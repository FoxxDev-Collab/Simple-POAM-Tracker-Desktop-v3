import React, { useState } from 'react'
import { 
  LayoutDashboard, 
  Plus, 
  Target, 
  Milestone, 
  BarChart3,
  StickyNote,
  Import,
  Settings,
  ChevronRight,
  Moon,
  Sun,
  Bell,
  Calendar,
  Shield,
  FileDown,
  ClipboardCheck,
  Building,
  ChevronDown,
  Shuffle,
  RefreshCw,
  ClipboardList
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'
import { useNotifications } from '../../context/NotificationContext'
import { useSystem } from '../../context/SystemContext'
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator'
import { NotificationCenter } from './NotificationCenter'

interface SidebarProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onSwitchSystem?: () => void
}

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'create-poam',
    label: 'Create POAM',
    icon: Plus,
  },
  {
    id: 'poam-tracker',
    label: 'POAM Tracker',
    icon: Target,
  },
  {
    id: 'milestone-tracker',
    label: 'Milestones',
    icon: Milestone,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: StickyNote,
  },
  {
    id: 'stig-mapper',
    label: 'STIG Mapper',
    icon: Shield,
  },
  {
    id: 'nist-controls',
    label: 'NIST Controls',
    icon: ClipboardList,
  },
  {
    id: 'security-test-plan',
    label: 'Test Plans',
    icon: ClipboardCheck,
  },
  {
    id: 'nessus-center',
    label: 'Nessus Center',
    icon: FileDown,
  },
  {
    id: 'import-export',
    label: 'Import/Export',
    icon: Import,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
]

export function Sidebar({ activeTab, onTabChange, isCollapsed, onToggleCollapse, onSwitchSystem }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { unreadCount } = useNotifications()
  const { currentSystem } = useSystem()
  const { performComprehensiveCheck } = useNotificationGenerator()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSystemMenu, setShowSystemMenu] = useState(false)
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(false)

  const handleSwitchSystem = () => {
    if (onSwitchSystem) {
      onSwitchSystem()
    }
    setShowSystemMenu(false)
  }

  // Manual notification check
  const handleNotificationCheck = async () => {
    setIsCheckingNotifications(true)
    try {
      await performComprehensiveCheck()
    } catch (error) {
      console.error('Error checking notifications:', error)
    } finally {
      setIsCheckingNotifications(false)
    }
  }

  return (
    <div 
      className={cn(
        "flex flex-col border-r transition-all duration-300 ease-in-out",
        "bg-card text-card-foreground",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{
        minHeight: '100vh'
      }}
    >
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
              <p className="text-xs text-muted-foreground">Security Compliance</p>
            </div>
          </div>
        )}
        
        {/* Collapsed logo */}
        {isCollapsed && (
          <div className="flex items-center justify-center mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <img src="/favicon.svg" alt="POAM Tracker" className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Current System Display */}
        {currentSystem && (
          <>
            {!isCollapsed ? (
              <div className="relative mb-4">
                <button
                  onClick={() => setShowSystemMenu(!showSystemMenu)}
                  className="w-full flex items-center gap-3 p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {currentSystem.name}
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    showSystemMenu && "rotate-180"
                  )} />
                </button>
                
                {/* System Menu Dropdown */}
                {showSystemMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50">
                    <div className="p-1">
                      <button
                        onClick={handleSwitchSystem}
                        className="w-full flex items-center gap-3 p-2 text-left hover:bg-accent rounded-md transition-colors"
                      >
                        <Shuffle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Switch System</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <button
                  onClick={handleSwitchSystem}
                  className="w-full flex items-center justify-center p-2 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
                  title="Switch System"
                >
                  <Building className="w-4 h-4 text-primary" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            isCollapsed={isCollapsed}
            onClick={() => onTabChange(item.id)}
          />
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
  )
}

interface NavItemProps {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  level?: number
}

function NavItem({ item, isActive, isCollapsed, onClick, level = 0 }: NavItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded)
          } else {
            onClick()
          }
        }}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive 
            ? "bg-primary text-primary-foreground" 
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        style={{
          marginLeft: level > 0 ? '16px' : '0'
        }}
        title={isCollapsed ? item.label : undefined}
      >
        <div className="flex items-center space-x-3">
          <item.icon className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && (
            <span className="truncate">{item.label}</span>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="flex items-center space-x-1">
            {item.badge && (
              <span className="px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                {item.badge}
              </span>
            )}
            {hasChildren && (
              <ChevronRight 
                className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            )}
          </div>
        )}
      </button>

      {/* Submenu */}
      {hasChildren && isExpanded && !isCollapsed && (
        <div className="ml-3 mt-1 space-y-1">
          {item.children?.map((child) => (
            <NavItem
              key={child.id}
              item={child}
              isActive={isActive}
              isCollapsed={isCollapsed}
              onClick={onClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
} 