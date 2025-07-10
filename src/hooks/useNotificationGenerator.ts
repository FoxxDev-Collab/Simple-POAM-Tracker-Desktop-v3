import { useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { invoke } from '@tauri-apps/api/core';
import { useSystem } from '../context/SystemContext';

interface POAM {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  riskLevel: string;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
  poamTitle?: string;
  poamId?: number;
}

export function useNotificationGenerator() {
  const { addNotification } = useNotifications();
  const { currentSystem } = useSystem();
  const lastCheckRef = useRef<Date>(new Date());
  const checkIntervalRef = useRef<number | null>(null);

  // Check for deadline alerts (POAMs due within 7 days)
  const checkDeadlineAlerts = useCallback(async (poams?: POAM[]) => {
    if (!currentSystem?.id) return;

    try {
      // Fetch latest data if not provided
      const latestPOAMs = poams || await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id });
      
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      latestPOAMs.forEach(poam => {
        const endDate = new Date(poam.endDate);
        const isUpcoming = endDate > now && endDate <= sevenDaysFromNow;
        const isOverdue = endDate < now && poam.status !== 'Completed';
        
        if (isUpcoming && poam.status !== 'Completed') {
          const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          addNotification({
            type: 'deadline_alert',
            title: 'POAM Deadline Approaching',
            message: `"${poam.title}" is due in ${daysLeft} day(s). Current status: ${poam.status}`,
            severity: poam.priority === 'High' ? 'error' : poam.priority === 'Medium' ? 'warning' : 'info',
            metadata: {
              poamId: poam.id,
              relatedEntity: poam.title
            }
          });
        }
        
        if (isOverdue) {
          const daysOverdue = Math.floor((now.getTime() - endDate.getTime()) / (24 * 60 * 60 * 1000));
          addNotification({
            type: 'overdue_warning',
            title: 'POAM Overdue',
            message: `"${poam.title}" is ${daysOverdue} day(s) overdue. Please update status or extend deadline.`,
            severity: 'error',
            metadata: {
              poamId: poam.id,
              relatedEntity: poam.title
            }
          });
        }
      });
    } catch (error) {
      console.error('Error checking deadline alerts:', error);
    }
  }, [addNotification, currentSystem?.id]);

  // Check for milestone completion notifications and deadline alerts
  const checkMilestoneUpdates = useCallback(async (milestones?: Milestone[]) => {
    if (!currentSystem?.id) return;

    try {
      // Fetch latest milestone data if not provided
      let latestMilestones = milestones;
      
      if (!latestMilestones) {
        const poams = await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id });
        latestMilestones = [];
        poams.forEach(poam => {
          const poamMilestones = poam.milestones.map(milestone => ({
            ...milestone,
            poamTitle: poam.title,
            poamId: poam.id
          }));
          latestMilestones!.push(...poamMilestones);
        });
      }

      const now = new Date();
      
      latestMilestones.forEach(milestone => {
        const dueDate = new Date(milestone.dueDate);
        const isDueSoon = dueDate > now && dueDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isOverdue = dueDate < now && milestone.status !== 'Completed';
        
        // Milestone due soon
        if (isDueSoon && milestone.status !== 'Completed') {
          const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          addNotification({
            type: 'deadline_alert',
            title: 'Milestone Due Soon',
            message: `Milestone "${milestone.title}" is due in ${daysLeft} day(s). Current status: ${milestone.status}`,
            severity: 'warning',
            metadata: {
              milestoneId: milestone.id,
              poamId: milestone.poamId,
              relatedEntity: milestone.title
            }
          });
        }
        
        // Milestone overdue
        if (isOverdue) {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
          addNotification({
            type: 'overdue_warning',
            title: 'Milestone Overdue',
            message: `Milestone "${milestone.title}" is ${daysOverdue} day(s) overdue${milestone.poamTitle ? ` (POAM: "${milestone.poamTitle}")` : ''}.`,
            severity: 'error',
            metadata: {
              milestoneId: milestone.id,
              poamId: milestone.poamId,
              relatedEntity: milestone.title
            }
          });
        }
      });
    } catch (error) {
      console.error('Error checking milestone updates:', error);
    }
  }, [addNotification, currentSystem?.id]);

  // System status notifications
  const notifySystemEvent = useCallback((event: {
    type: 'import' | 'export' | 'backup' | 'sync' | 'error';
    message: string;
    success?: boolean;
    details?: string;
  }) => {
    let title = '';
    let severity: 'info' | 'warning' | 'error' | 'success' = 'info';
    
    switch (event.type) {
      case 'import':
        title = event.success ? 'Import Completed' : 'Import Failed';
        severity = event.success ? 'success' : 'error';
        break;
      case 'export':
        title = event.success ? 'Export Completed' : 'Export Failed';
        severity = event.success ? 'success' : 'error';
        break;
      case 'backup':
        title = event.success ? 'Backup Completed' : 'Backup Failed';
        severity = event.success ? 'success' : 'error';
        break;
      case 'sync':
        title = event.success ? 'Data Synchronized' : 'Sync Failed';
        severity = event.success ? 'success' : 'error';
        break;
      case 'error':
        title = 'System Error';
        severity = 'error';
        break;
    }

    addNotification({
      type: event.type === 'import' || event.type === 'export' ? 'import_export' : 'system_status',
      title,
      message: event.message + (event.details ? ` ${event.details}` : ''),
      severity,
      metadata: {
        relatedEntity: event.type
      }
    });
  }, [addNotification]);

  // Notification for POAM creation
  const notifyPOAMCreated = useCallback((poam: POAM) => {
    addNotification({
      type: 'system_status',
      title: 'POAM Created',
      message: `New POAM "${poam.title}" has been created with ${poam.milestones.length} milestones.`,
      severity: 'success',
      metadata: {
        poamId: poam.id,
        relatedEntity: poam.title
      }
    });

    // Check if the new POAM has any immediate deadline concerns
    checkDeadlineAlerts([poam]);
    
    // Check milestone deadlines for the new POAM
    if (poam.milestones.length > 0) {
      const milestonesWithPOAM = poam.milestones.map(m => ({
        ...m,
        poamTitle: poam.title,
        poamId: poam.id
      }));
      checkMilestoneUpdates(milestonesWithPOAM);
    }
  }, [addNotification, checkDeadlineAlerts, checkMilestoneUpdates]);

  // Notification for POAM update
  const notifyPOAMUpdated = useCallback((poam: POAM, previousStatus?: string) => {
    let message = `POAM "${poam.title}" has been updated.`;
    let severity: 'info' | 'success' = 'info';

    // Special handling for status changes
    if (previousStatus && previousStatus !== poam.status) {
      if (poam.status === 'Completed') {
        message = `POAM "${poam.title}" has been marked as completed!`;
        severity = 'success';
      } else {
        message = `POAM "${poam.title}" status changed from ${previousStatus} to ${poam.status}.`;
      }
    }

    addNotification({
      type: 'system_status',
      title: 'POAM Updated',
      message,
      severity,
      metadata: {
        poamId: poam.id,
        relatedEntity: poam.title
      }
    });

    // Re-check deadlines after update
    checkDeadlineAlerts([poam]);
    
    if (poam.milestones.length > 0) {
      const milestonesWithPOAM = poam.milestones.map(m => ({
        ...m,
        poamTitle: poam.title,
        poamId: poam.id
      }));
      checkMilestoneUpdates(milestonesWithPOAM);
    }
  }, [addNotification, checkDeadlineAlerts, checkMilestoneUpdates]);

  // Notification for milestone completion
  const notifyMilestoneCompleted = useCallback((milestone: Milestone) => {
    addNotification({
      type: 'milestone_completed',
      title: 'Milestone Completed',
      message: `Milestone "${milestone.title}" has been marked as completed${milestone.poamTitle ? ` for POAM "${milestone.poamTitle}"` : ''}.`,
      severity: 'success',
      metadata: {
        milestoneId: milestone.id,
        poamId: milestone.poamId,
        relatedEntity: milestone.title
      }
    });
  }, [addNotification]);

  // Comprehensive data check - runs periodically and on-demand
  const performComprehensiveCheck = useCallback(async () => {
    if (!currentSystem?.id) return;

    try {
      console.log('Performing comprehensive notification check for system:', currentSystem.name);
      
      // Update last check time
      lastCheckRef.current = new Date();
      
      // Check all POAMs and milestones
      await Promise.all([
        checkDeadlineAlerts(),
        checkMilestoneUpdates()
      ]);

      console.log('Comprehensive notification check completed');
    } catch (error) {
      console.error('Error in comprehensive notification check:', error);
    }
  }, [checkDeadlineAlerts, checkMilestoneUpdates, currentSystem?.id, currentSystem?.name]);

  // Auto-check notifications on startup only
  const scheduleNotificationCheck = useCallback(() => {
    // Clear existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // Only schedule if we have a current system
    if (!currentSystem?.id) return () => {};

    // Perform initial check on startup/system change
    performComprehensiveCheck();

    // No periodic checks - only manual triggers and startup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [performComprehensiveCheck, currentSystem?.id]);

  // Initialize notification checking when system changes
  useEffect(() => {
    const cleanup = scheduleNotificationCheck();
    return cleanup;
  }, [scheduleNotificationCheck]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return {
    // Core notification functions
    checkDeadlineAlerts,
    checkMilestoneUpdates,
    notifySystemEvent,
    performComprehensiveCheck,
    
    // POAM-specific notifications
    notifyPOAMCreated,
    notifyPOAMUpdated,
    notifyMilestoneCompleted,
    
    // Scheduling
    scheduleNotificationCheck,
    
    // Utility
    getLastCheckTime: () => lastCheckRef.current
  };
}

// Helper function to create sample notifications for testing
export function createSampleNotifications(addNotification: any) {
  // Sample POAM deadline alert
  addNotification({
    type: 'deadline_alert',
    title: 'POAM Deadline Approaching',
    message: 'Security Assessment POAM is due in 3 days. Current status: In Progress',
    severity: 'warning',
    metadata: {
      poamId: 1,
      relatedEntity: 'Security Assessment'
    }
  });

  // Sample milestone completion
  addNotification({
    type: 'milestone_completed',
    title: 'Milestone Completed',
    message: 'Initial Risk Assessment milestone has been completed for Network Security POAM.',
    severity: 'success',
    metadata: {
      milestoneId: 'milestone-1',
      poamId: 2,
      relatedEntity: 'Initial Risk Assessment'
    }
  });

  // Sample overdue warning
  addNotification({
    type: 'overdue_warning',
    title: 'POAM Overdue',
    message: 'Compliance Review POAM is 5 days overdue. Please update status or extend deadline.',
    severity: 'error',
    metadata: {
      poamId: 3,
      relatedEntity: 'Compliance Review'
    }
  });

  // Sample system status
  addNotification({
    type: 'system_status',
    title: 'Backup Completed',
    message: 'Weekly data backup completed successfully. 127 POAMs and 45 milestones backed up.',
    severity: 'success',
    metadata: {
      relatedEntity: 'backup'
    }
  });

  // Sample import/export
  addNotification({
    type: 'import_export',
    title: 'Import Completed',
    message: 'Successfully imported 15 POAMs from Excel file "Q4_Security_Assessment.xlsx".',
    severity: 'success',
    metadata: {
      relatedEntity: 'Q4_Security_Assessment.xlsx'
    }
  });
} 