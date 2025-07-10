import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Notification as NotificationType, 
  NotificationPreferences, 
  NotificationFilter, 
  NotificationStats 
} from '../types/notification';

interface NotificationContextType {
  notifications: NotificationType[];
  unreadCount: number;
  preferences: NotificationPreferences;
  filter: NotificationFilter;
  stats: NotificationStats;
  addNotification: (notification: Omit<NotificationType, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  setFilter: (filter: NotificationFilter) => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
  filteredNotifications: NotificationType[];
}

const defaultPreferences: NotificationPreferences = {
  deadlineAlerts: true,
  milestoneNotifications: true,
  overdueWarnings: true,
  systemUpdates: true,
  importExportStatus: true,
  desktopNotifications: true,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  // Load notifications and preferences from localStorage on mount
  useEffect(() => {
    const storedNotifications = localStorage.getItem('poam-notifications');
    const storedPreferences = localStorage.getItem('poam-notification-preferences');
    
    if (storedNotifications) {
      try {
        const parsed = JSON.parse(storedNotifications);
        setNotifications(parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    }
    
    if (storedPreferences) {
      try {
        const parsedPreferences = JSON.parse(storedPreferences);
        // Merge stored preferences with defaults to ensure all properties exist
        const mergedPreferences = { ...defaultPreferences, ...parsedPreferences };
        setPreferences(mergedPreferences);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        // Fallback to defaults if parsing fails
        setPreferences(defaultPreferences);
      }
    }
  }, []);

  // Save to localStorage whenever notifications or preferences change
  useEffect(() => {
    localStorage.setItem('poam-notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem('poam-notification-preferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }, [preferences]);

  // Generate unique ID for notifications
  const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addNotification = useCallback((notification: Omit<NotificationType, 'id' | 'timestamp' | 'isRead'>) => {
    // Check if this type of notification is enabled
    const typeEnabledMap: Record<NotificationType['type'], keyof NotificationPreferences> = {
      deadline_alert: 'deadlineAlerts',
      milestone_completed: 'milestoneNotifications',
      overdue_warning: 'overdueWarnings',
      system_status: 'systemUpdates',
      import_export: 'importExportStatus',
    };

    if (!preferences[typeEnabledMap[notification.type]]) {
      return;
    }

    const newNotification: NotificationType = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      isRead: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Show browser notification if enabled
    if (preferences.desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/poam-logo.png',
        tag: newNotification.id,
      });
    }


  }, [preferences]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
  }, []);

  // Request notification permission on first load
  useEffect(() => {
    if (preferences.desktopNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [preferences.desktopNotifications]);

  // Computed values
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.isRead;
    return notification.type === filter;
  });

  const stats: NotificationStats = {
    total: notifications.length,
    unread: unreadCount,
    byType: notifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType['type'], number>),
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      preferences,
      filter,
      stats,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAllNotifications,
      setFilter,
      updatePreferences,
      filteredNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
} 