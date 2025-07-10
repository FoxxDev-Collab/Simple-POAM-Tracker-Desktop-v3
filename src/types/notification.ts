export interface Notification {
  id: string;
  type: 'deadline_alert' | 'milestone_completed' | 'overdue_warning' | 'system_status' | 'import_export';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
  actionUrl?: string;
  metadata?: {
    poamId?: number;
    milestoneId?: string;
    relatedEntity?: string;
  };
}

export interface NotificationPreferences {
  deadlineAlerts: boolean;
  milestoneNotifications: boolean;
  overdueWarnings: boolean;
  systemUpdates: boolean;
  importExportStatus: boolean;
  desktopNotifications: boolean;
}

export type NotificationFilter = 'all' | 'unread' | 'deadline_alert' | 'milestone_completed' | 'overdue_warning' | 'system_status' | 'import_export';

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<Notification['type'], number>;
} 