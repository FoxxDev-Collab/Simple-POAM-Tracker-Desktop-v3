import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Target, Clock, AlertCircle, X } from 'lucide-react';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';
import { Milestone } from '../../types/Milestone';
import { formatDateDisplay } from '../../utils/dateUtils';
// Unified styles via global patterns and Tailwind

interface POAM {
  id: number;
  title: string;
  milestones: Milestone[];
}

interface CalendarEvent {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  poamTitle?: string;
  poamId?: number;
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

interface CalendarProps {
  onNavigateToMilestone?: (milestoneId: string, poamId?: number) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ onNavigateToMilestone }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  
  const { showToast } = useToast();
  const { currentSystem } = useSystem();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to view calendar.</p>
      </div>
    );
  }

  useEffect(() => {
    loadMilestones();
  }, [currentSystem?.id]);

  // Load milestones from backend
  const loadMilestones = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping calendar load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Calendar: Loading milestones from backend for system:', currentSystem.id);
      const poams = await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id });
      
      // Extract all milestones from all POAMs
      const allMilestones: Milestone[] = [];
      
      if (poams && poams.length > 0) {
        poams.forEach(poam => {
          const poamMilestones = poam.milestones.map(milestone => ({
            ...milestone,
            poamTitle: poam.title,
            poamId: poam.id
          }));
          allMilestones.push(...poamMilestones);
        });
      }
      
      console.log('Calendar: Extracted milestones:', allMilestones);
      setMilestones(allMilestones);
    } catch (error) {
      console.error('Calendar: Error loading milestones:', error);
      showToast('error', `Failed to load milestones: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate calendar days for the current month
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Previous month's last days
    const prevMonth = new Date(year, month - 1, 0);
    const daysFromPrevMonth = startingDayOfWeek;
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // Add previous month's days
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date,
        day: date.getDate(),
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        events: getEventsForDate(date)
      });
    }
    
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        day: date.getDate(),
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        events: getEventsForDate(date)
      });
    }
    
    // Add next month's days to fill the grid
    const totalCells = 42; // 6 weeks * 7 days
    const remainingCells = totalCells - days.length;
    
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        day: date.getDate(),
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        events: getEventsForDate(date)
      });
    }
    
    return days;
  };

  // Check if two dates are the same day
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    // Format the date as YYYY-MM-DD for comparison
    const targetDateString = date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
    
    return milestones
      .filter(milestone => {
        // Extract just the date part from milestone.dueDate (YYYY-MM-DD)
        const milestoneDateString = milestone.dueDate.split('T')[0]; // Remove time if present
        return milestoneDateString === targetDateString;
      })
      .map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        status: milestone.status,
        poamTitle: milestone.poamTitle,
        poamId: milestone.poamId
      }));
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle date click
  const handleDateClick = (day: CalendarDay) => {
    if (day.events.length > 0) {
      setSelectedDate(day.date);
      setSelectedDateEvents(day.events);
      setShowEventModal(true);
    }
  };

  // Handle milestone navigation
  const handleMilestoneClick = (event: CalendarEvent) => {
    console.log('Calendar: Navigating to milestone:', {
      milestoneId: event.id,
      poamId: event.poamId,
      title: event.title
    });
    
    setShowEventModal(false);
    
    if (onNavigateToMilestone && event.poamId) {
      // Add a small delay to ensure the modal closes before navigation
      setTimeout(() => {
        console.log('Calendar: Calling navigation callback');
        onNavigateToMilestone(event.id, event.poamId);
      }, 100);
    } else {
      console.warn('Calendar: Navigation callback not available or missing POAM ID', {
        hasCallback: !!onNavigateToMilestone,
        poamId: event.poamId
      });
    }
  };

  // Get status color class
  const getStatusColorClass = (status: string): string => {
    switch (status) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
        return 'status-in-progress';
      case 'Delayed':
        return 'status-delayed';
      case 'Not Started':
      default:
        return 'status-not-started';
    }
  };

  // Get upcoming tasks (next 30 days, excluding completed)
  const getUpcomingTasks = (): CalendarEvent[] => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return milestones
      .filter(milestone => {
        // Exclude completed milestones
        if (milestone.status === 'Completed') return false;
        
        const dueDate = new Date(milestone.dueDate);
        return dueDate >= today && dueDate <= thirtyDaysFromNow;
      })
      .map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        status: milestone.status,
        poamTitle: milestone.poamTitle,
        poamId: milestone.poamId
      }))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  // Get days until due date
  const getDaysUntilDue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Format days until due for display
  const formatDaysUntil = (daysUntil: number): string => {
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `${daysUntil} days left`;
  };

  // Get status color class for badges (matching POAM tracker style)
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600 bg-green-50';
      case 'In Progress': return 'text-blue-600 bg-blue-50';
      case 'On Hold': return 'text-yellow-600 bg-yellow-50';
      case 'Not Started': return 'text-gray-600 bg-gray-50';
      case 'Delayed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get priority badge color (for upcoming tasks priority column)
  const getPriorityBadgeColor = (daysUntil: number): string => {
    if (daysUntil < 0) return 'text-red-600 bg-red-50';
    if (daysUntil <= 3) return 'text-red-600 bg-red-50';
    if (daysUntil <= 7) return 'text-orange-600 bg-orange-50';
    if (daysUntil <= 14) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const calendarDays = generateCalendarDays();

  if (loading) {
    return (
      <div className="calendar-container">
        <div className="loading-indicator">
          <Icon icon={CalendarIcon} size="xl" spin />
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      {loading ? (
        <div className="loading-indicator">
          <CalendarIcon className="h-8 w-8 animate-spin" />
          <p>Loading calendar...</p>
        </div>
      ) : (
        <>
          {/* Calendar Header */}
          <div className="calendar-header">
            <div className="calendar-title title-row">
              <Icon icon={CalendarIcon} size="lg" tone="primary" />
              <h1 className="text-2xl font-bold tracking-tight">Calendar View</h1>
            </div>
            
            <div className="calendar-nav">
              <Button
                onClick={goToPreviousMonth}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Previous Month"
              >
                <Icon icon={ChevronLeft} size="sm" />
              </Button>
              
              <div className="current-month">
                <span className="month-year">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
              </div>
              
              <Button
                onClick={goToNextMonth}
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Next Month"
              >
                <Icon icon={ChevronRight} size="sm" />
              </Button>
              
              <Button
                onClick={goToToday}
                size="sm"
                title="Go to Today"
              >
                <span className="hide-mobile">Today</span>
                <span className="show-mobile">T</span>
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="calendar-grid">
            {/* Day Headers */}
            <div className="calendar-header-row">
              {DAYS.map(day => (
                <div key={day} className="calendar-day-header">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="calendar-body">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${
                    day.isCurrentMonth ? 'current-month' : 'other-month'
                  } ${day.isToday ? 'today' : ''} ${
                    day.events.length > 0 ? 'has-events' : ''
                  }`}
                  onClick={() => handleDateClick(day)}
                >
                  <span className="day-number">{day.day}</span>
                  
                  {/* Event indicators */}
                  {day.events.length > 0 && (
                    <div className="event-indicators">
                      {day.events.slice(0, 3).map((event, eventIndex) => (
                        <div
                          key={eventIndex}
                          className={`event-dot ${getStatusColorClass(event.status)}`}
                          title={`${event.title} - ${event.status}`}
                        />
                      ))}
                      {day.events.length > 3 && (
                        <div className="event-count">+{day.events.length - 3}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Tasks Section */}
          <div className="upcoming-tasks-section">
            <div className="section-header">
              <div className="section-title title-row">
                <Icon icon={Clock} size="md" tone="primary" />
                <h2>Upcoming Tasks</h2>
              </div>
            </div>

            {/* Results Summary */}
            <div className="px-5 py-3 border-b border-border bg-muted/10 text-sm text-muted-foreground">
              Showing {getUpcomingTasks().length} upcoming tasks in the next 30 days
            </div>

            {getUpcomingTasks().length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <Icon icon={CalendarIcon} size="xl" className="opacity-60 mb-3" />
                <h4 className="text-lg font-semibold mb-1">You’re all caught up</h4>
                <p className="text-muted-foreground">No upcoming tasks in the next 30 days</p>
              </div>
            ) : (
              <div className="bg-card rounded-lg overflow-hidden">
                <div className="table-responsive">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-4">Task</th>
                        <th className="text-left p-4">POAM</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-left p-4">Due Date</th>
                        <th className="text-left p-4">Priority</th>
                        <th className="text-left p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getUpcomingTasks().map((task) => {
                        const daysUntil = getDaysUntilDue(task.dueDate);
                        
                        return (
                          <tr key={task.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                            <td className="p-4">
                              <div className="font-medium text-foreground">{task.title}</div>
                            </td>
                            <td className="p-4 text-sm">
                              <span className="text-foreground">{task.poamTitle}</span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                {task.status}
                              </span>
                            </td>
                            <td className="p-4 text-sm">
                              <div>
                                <div className="text-foreground">{formatDateDisplay(task.dueDate)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className={`flex items-center gap-1 text-xs font-medium ${getPriorityBadgeColor(daysUntil)}`}>
                                {daysUntil < 0 && <Icon icon={AlertCircle} size="xs" tone="destructive" />}
                                {daysUntil >= 0 && daysUntil <= 3 && <Icon icon={AlertCircle} size="xs" tone="warning" />}
                                {daysUntil > 3 && <Icon icon={Clock} size="xs" tone="muted" />}
                                <span>{formatDaysUntil(daysUntil)}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                                onClick={() => task.poamId && onNavigateToMilestone?.(task.id, task.poamId)}
                                disabled={!onNavigateToMilestone || !task.poamId}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Event Modal */}
          {showEventModal && selectedDate && (
            <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
              <div className="event-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Events for {formatDateDisplay(selectedDate.toISOString())}</h3>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowEventModal(false)}>
                    <Icon icon={X} size="sm" />
                  </Button>
                </div>
                
                <div className="modal-content">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="event-item"
                      onClick={() => handleMilestoneClick(event)}
                    >
                      <div className="event-details">
                        <div className="event-title">{event.title}</div>
                        <div className="event-poam">{event.poamTitle}</div>
                        <div className={`event-status ${getStatusColorClass(event.status)}`}>
                          {event.status}
                        </div>
                      </div>
                      <Icon icon={Target} size="sm" tone="muted" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 