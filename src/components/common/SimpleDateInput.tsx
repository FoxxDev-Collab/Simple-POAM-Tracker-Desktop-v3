import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import CalendarModal from './CalendarModal';

interface SimpleDateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function SimpleDateInput({
  value,
  onChange,
  min,
  max,
  placeholder = "YYYY-MM-DD",
  className = "",
  required = false,
  disabled = false
}: SimpleDateInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
    validateDate(value);
  }, [value, min, max]);

  const validateDate = (dateString: string) => {
    if (!dateString) {
      setIsValid(true);
      setErrorMessage('');
      return true;
    }

    // Check format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      setIsValid(false);
      setErrorMessage('Please use YYYY-MM-DD format');
      return false;
    }

    // Check if it's a valid date
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) {
      setIsValid(false);
      setErrorMessage('Invalid date');
      return false;
    }

    // Check min/max constraints
    if (min) {
      const minDate = new Date(min + 'T00:00:00');
      if (date < minDate) {
        setIsValid(false);
        setErrorMessage(`Date must be on or after ${min}`);
        return false;
      }
    }

    if (max) {
      const maxDate = new Date(max + 'T00:00:00');
      if (date > maxDate) {
        setIsValid(false);
        setErrorMessage(`Date must be on or before ${max}`);
        return false;
      }
    }

    setIsValid(true);
    setErrorMessage('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Auto-format as user types
    newValue = newValue.replace(/[^\d-]/g, ''); // Only allow digits and hyphens
    
    // Auto-add hyphens
    if (newValue.length === 4 && !newValue.includes('-')) {
      newValue = newValue + '-';
    } else if (newValue.length === 7 && newValue.split('-').length === 2) {
      newValue = newValue + '-';
    }
    
    // Limit length
    if (newValue.length > 10) {
      newValue = newValue.substring(0, 10);
    }

    setInputValue(newValue);
    
    // Only validate and call onChange if it's a complete date or empty
    if (newValue.length === 10 || newValue === '') {
      const valid = validateDate(newValue);
      if (valid || newValue === '') {
        onChange(newValue);
      }
    }
  };

  const handleBlur = () => {
    // Final validation on blur
    validateDate(inputValue);
    if (inputValue !== value) {
      // If the input doesn't match the prop value, reset it
      if (!isValid && value) {
        setInputValue(value);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow backspace, delete, tab, escape, enter, and arrow keys
    if ([8, 9, 27, 13, 37, 38, 39, 40, 46].includes(e.keyCode)) {
      return;
    }
    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (e.ctrlKey && [65, 67, 86, 88].includes(e.keyCode)) {
      return;
    }
    // Only allow digits and hyphens
    if (!/[\d-]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleCalendarSelect = (date: string) => {
    setInputValue(date);
    onChange(date);
    setShowCalendar(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} ${!isValid ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''} pr-10`}
          required={required}
          disabled={disabled}
          maxLength={10}
        />
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          disabled={disabled}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>
      
      {!isValid && errorMessage && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <CalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        onDateSelect={handleCalendarSelect}
        selectedDate={inputValue}
        minDate={min}
        maxDate={max}
      />
    </div>
  );
} 