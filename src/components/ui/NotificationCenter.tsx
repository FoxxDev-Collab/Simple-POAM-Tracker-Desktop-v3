import { useState } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Upload,
  Monitor,
  Clock,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../context/NotificationContext';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { NotificationFilter } from '../../types/notification';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons = {
  deadline_alert: Calendar,
  milestone_completed: CheckCircle,
  overdue_warning: AlertTriangle,
  system_status: Monitor,
  import_export: Upload,
} as const;

const typeLabels = {
  deadline_alert: 'Deadline Alert',
  milestone_completed: 'Milestone Completed',
  overdue_warning: 'Overdue Warning',
  system_status: 'System Status',
  import_export: 'Import/Export',
} as const;

const severityColors = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
} as const;

const filterOptions: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'deadline_alert', label: 'Deadlines' },
  { value: 'milestone_completed', label: 'Milestones' },
  { value: 'overdue_warning', label: 'Overdue' },
  { value: 'system_status', label: 'System' },
  { value: 'import_export', label: 'Import/Export' },
];

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const {
    filteredNotifications,
    unreadCount,
    filter,
    setFilter,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    stats
  } = useNotifications();

  const { getLastCheckTime } = useNotificationGenerator();
  const [showPreferences, setShowPreferences] = useState(false);

  if (!isOpen) return null;

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const lastCheck = getLastCheckTime();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/50">
      <div className="w-96 max-w-full max-h-[80vh] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification Status */}
          <div className="mb-3 p-2 bg-accent/20 rounded-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>System Status</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last check: {formatTime(lastCheck)}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span>Total: {stats.total}</span>
              <span>Unread: {stats.unread}</span>
              <span>Auto-checks: On startup only</span>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center justify-between gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as NotificationFilter)}
              className="px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors text-foreground"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {stats.total > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors text-foreground"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preferences Panel */}
        {showPreferences && <NotificationPreferences onClose={() => setShowPreferences(false)} />}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">
                {stats.total === 0 
                  ? "System is monitoring POAMs and milestones for deadline alerts, overdue items, and status changes." 
                  : "All caught up! Use the refresh button in the sidebar to check for new notifications."
                }
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredNotifications.map(notification => {
                const TypeIcon = typeIcons[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      notification.isRead 
                        ? "bg-muted/30 border-border" 
                        : "bg-background border-primary/20 shadow-sm",
                      severityColors[notification.severity]
                    )}
                    onClick={() => !notification.isRead && markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm leading-snug">
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {notification.message}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="p-1 rounded hover:bg-accent transition-colors"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="p-1 rounded hover:bg-accent transition-colors"
                              title="Remove notification"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                            {typeLabels[notification.type]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationPreferences({ onClose }: { onClose: () => void }) {
  const { preferences, updatePreferences } = useNotifications();

  return (
    <div className="p-4 border-b border-border bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground">Notification Settings</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.deadlineAlerts}
              onChange={(e) => updatePreferences({ deadlineAlerts: e.target.checked })}
              className="rounded border-input"
            />
            <span>Deadline Alerts</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.milestoneNotifications}
              onChange={(e) => updatePreferences({ milestoneNotifications: e.target.checked })}
              className="rounded border-input"
            />
            <span>Milestones</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.overdueWarnings}
              onChange={(e) => updatePreferences({ overdueWarnings: e.target.checked })}
              className="rounded border-input"
            />
            <span>Overdue Warnings</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.systemUpdates}
              onChange={(e) => updatePreferences({ systemUpdates: e.target.checked })}
              className="rounded border-input"
            />
            <span>System Updates</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.importExportStatus}
              onChange={(e) => updatePreferences({ importExportStatus: e.target.checked })}
              className="rounded border-input"
            />
            <span>Import/Export</span>
          </label>
          

        </div>
        
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preferences.desktopNotifications}
            onChange={(e) => updatePreferences({ desktopNotifications: e.target.checked })}
            className="rounded border-input"
          />
          <span>Desktop Notifications</span>
        </label>
      </div>
    </div>
  );
} 