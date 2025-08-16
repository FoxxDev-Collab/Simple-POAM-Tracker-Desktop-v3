import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDateSelect: (date: string) => void;
  selectedDate?: string;
  minDate?: string;
  maxDate?: string;
}

export default function CalendarModal({
  isOpen,
  onClose,
  onDateSelect,
  selectedDate,
  minDate,
  maxDate
}: CalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Initialize current month based on selected date or today
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    } else {
      // Initialize to current month, ensuring we create a fresh Date object
      const now = new Date();
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, [isOpen]); // Only re-run when modal opens/closes, not on selectedDate changes

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const today = new Date();
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();

  // Get first day of the month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonthIndex + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  // Generate calendar days
  const calendarDays: (number | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const formatDateString = (year: number, month: number, day: number): string => {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const isDateDisabled = (year: number, month: number, day: number): boolean => {
    const dateStr = formatDateString(year, month, day);
    
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    
    return false;
  };

  const isDateSelected = (year: number, month: number, day: number): boolean => {
    if (!selectedDate) return false;
    return formatDateString(year, month, day) === selectedDate;
  };

  const isToday = (year: number, month: number, day: number): boolean => {
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    );
  };

  const handleDateClick = (day: number) => {
    const dateStr = formatDateString(currentYear, currentMonthIndex, day);
    if (!isDateDisabled(currentYear, currentMonthIndex, day)) {
      onDateSelect(dateStr);
      onClose();
    }
  };

  const handlePrevMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentMonth(new Date(currentYear, currentMonthIndex - 1, 1));
  };

  const handleNextMonth = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentMonth(new Date(currentYear, currentMonthIndex + 1, 1));
  };

  const handleTodayClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());
    if (!isDateDisabled(today.getFullYear(), today.getMonth(), today.getDate())) {
      onDateSelect(todayStr);
      onClose();
    } else {
      // Just navigate to today's month
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-card rounded-lg shadow-xl border border-border p-4 w-80"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-color)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="icon-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg font-semibold text-foreground">
            {monthNames[currentMonthIndex]} {currentYear}
          </h3>
          
          <button
            type="button"
            onClick={handleNextMonth}
            className="icon-btn"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-8" />;
            }

            const disabled = isDateDisabled(currentYear, currentMonthIndex, day);
            const selected = isDateSelected(currentYear, currentMonthIndex, day);
            const todayDate = isToday(currentYear, currentMonthIndex, day);
            const dateStr = formatDateString(currentYear, currentMonthIndex, day);
            const hovered = hoveredDate === dateStr;

            return (
              <button
                key={`${currentYear}-${currentMonthIndex}-${day}`}
                onClick={() => handleDateClick(day)}
                onMouseEnter={() => setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                disabled={disabled}
                className={`
                  h-8 w-8 text-sm rounded transition-colors flex items-center justify-center
                  ${disabled 
                    ? 'text-muted-foreground/40 cursor-not-allowed' 
                    : 'text-foreground hover:bg-muted cursor-pointer'
                  }
                  ${selected 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : ''
                  }
                  ${todayDate && !selected 
                    ? 'bg-muted font-semibold' 
                    : ''
                  }
                  ${hovered && !selected && !disabled 
                    ? 'bg-muted/60' 
                    : ''
                  }
                `}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleTodayClick}
            className="btn btn-primary"
          >
            Today
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 