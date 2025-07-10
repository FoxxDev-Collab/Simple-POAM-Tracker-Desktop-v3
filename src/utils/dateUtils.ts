/**
 * Format a date according to the specified format and timezone
 * @param date Date to format
 * @param format Format string (MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD)
 * @param timezone Timezone string (e.g., 'America/Boise')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, format: string = 'MM/DD/YYYY', timezone: string = 'America/Boise'): string {
  // Convert string date to Date object if needed
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Format the date according to the timezone
  const options: Intl.DateTimeFormatOptions = { timeZone: timezone };
  
  // Get date parts in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...options,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(dateObj);
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  const year = parts.find(part => part.type === 'year')?.value || '2000';
  
  // Apply the format
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Parse a date string with timezone support
 * @param dateString Date string to parse
 * @returns Date object
 */
export function parseDate(dateString: string): Date {
  // For simple parsing, we'll use the built-in Date constructor
  // In a production app, consider using a library like date-fns-tz for more robust parsing
  return new Date(dateString);
}

/**
 * Get the current date in the specified timezone
 * @returns Date object representing current date in the specified timezone
 */
export function getCurrentDate(): Date {
  const now = new Date();
  return now;
}

/**
 * Format a date for display with locale support and timezone awareness
 * @param dateString Date string to format
 * @param timezone Timezone string (optional) - If provided, formats in this timezone. Otherwise, uses system default.
 * @returns Localized date string
 */
export function formatDateDisplay(dateString: string, timezone?: string): string {
  if (!dateString) return '';
  
  let date: Date;
  
  // Handle different date formats to avoid timezone conversion issues
  try {
    // If it's a YYYY-MM-DD format (date only), parse it without timezone conversion
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateString.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
      const day = parseInt(parts[2], 10);
      
      // Create a date in the local timezone at noon to avoid DST issues
      date = new Date(year, month, day, 12, 0, 0);
    } else {
      // For other formats, use regular parsing
      date = new Date(dateString);
    }
    
    // If date is invalid, return empty string
    if (isNaN(date.getTime())) return '';
  } catch (error) {
    console.error('Error parsing date:', error, 'Input:', dateString);
    return '';
  }
  
  // Base options for formatting
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  
  // Only specify timeZone in options if a valid one is provided
  if (timezone) {
    try {
      // Check if timezone is supported by the environment
      new Intl.DateTimeFormat(undefined, { timeZone: timezone }); 
      options.timeZone = timezone;
    } catch (e) {
      console.warn(`Invalid or unsupported timezone provided: "${timezone}". Falling back to system default.`);
      // If timezone is invalid, don't set options.timeZone, letting Intl use the default
    }
  }
  // If no timezone is provided, options.timeZone remains undefined, and Intl.DateTimeFormat uses the system default.
  
  // Format the date using the browser's locale (navigator.language)
  // It will use the specified timezone if valid, otherwise the system default.
  return new Intl.DateTimeFormat(navigator.language, options).format(date);
}

/**
 * Adjusts imported date strings for correct timezone handling
 * This function is used when importing data to ensure dates are properly interpreted
 * without timezone shifts affecting the date portion (YYYY-MM-DD).
 * @param dateString The date string from the imported file
 * @returns A properly formatted date string (YYYY-MM-DD) ready for storage, or empty string if invalid.
 */
export function normalizeImportedDate(dateString: string): string {
  if (!dateString) return '';

  let year: number | undefined;
  let month: number | undefined; // 1-based month
  let day: number | undefined;

  // Trim whitespace
  const trimmedDateString = dateString.trim();

  // Attempt 1: Parse YYYY-MM-DD (potentially with time/timezone info)
  const isoMatch = trimmedDateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    // Attempt 2: Parse MM/DD/YYYY
    const slashMatch = trimmedDateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      year = parseInt(slashMatch[3], 10);
      month = parseInt(slashMatch[1], 10);
      day = parseInt(slashMatch[2], 10);
    }
     // Add other formats here if needed, e.g., DD/MM/YYYY
     // else {
     //    const euSlashMatch = trimmedDateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
     //    if (euSlashMatch) {
     //      year = parseInt(euSlashMatch[3], 10);
     //      month = parseInt(euSlashMatch[2], 10);
     //      day = parseInt(euSlashMatch[1], 10);
     //    }
     // }
  }

  // Validate parsed components (basic validation)
  if (year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
     // Format to YYYY-MM-DD
     const formattedMonth = String(month).padStart(2, '0');
     const formattedDay = String(day).padStart(2, '0');
     // Further validation might be needed for days in month (e.g., Feb 30th)
     // For simplicity, we accept dates like this for now. Libraries like date-fns handle this better.
     return `${year}-${formattedMonth}-${formattedDay}`;
  }

  // Fallback: Try parsing with new Date() and extracting UTC components.
  // This is less reliable as new Date() parsing is implementation-dependent.
  try {
    const date = new Date(trimmedDateString);
    // Check if the resulting date is valid
    if (!isNaN(date.getTime())) {
       const utcYear = date.getUTCFullYear();
       const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
       const utcDay = String(date.getUTCDate()).padStart(2, '0');
       console.warn(`Used fallback Date parsing for input: '${trimmedDateString}'. Result: ${utcYear}-${utcMonth}-${utcDay}. This might be inaccurate if original string lacked timezone info.`);
       return `${utcYear}-${utcMonth}-${utcDay}`;
    }
  } catch (e) {
     // Ignore errors during fallback parsing
  }

  console.error(`Could not reliably parse date string: '${trimmedDateString}'. Returning empty string.`);
  return '';
}

/**
 * Check if a date is valid
 * @param date Date to validate
 * @returns Boolean indicating if the date is valid
 */
export function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

/**
 * Format a date string for HTML date input (YYYY-MM-DD) without timezone conversion
 * This prevents the common issue where dates shift by 1 day due to timezone conversion
 * @param dateString Date string to format
 * @returns Formatted date string (YYYY-MM-DD) or empty string if invalid
 */
export function formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  
  try {
    // If the date is already in YYYY-MM-DD format, return it as is
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // If the date is in ISO format with time, extract just the date part
    if (dateString.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return dateString.split('T')[0];
    }
    
    // For other formats, parse manually to avoid timezone issues
    let year: number | undefined;
    let month: number | undefined;
    let day: number | undefined;
    
    // Try MM/DD/YYYY format
    const slashMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      month = parseInt(slashMatch[1], 10);
      day = parseInt(slashMatch[2], 10);
      year = parseInt(slashMatch[3], 10);
    }
    
    // Try DD/MM/YYYY format (if first attempt doesn't make sense)
    if (!slashMatch) {
      const euSlashMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (euSlashMatch && parseInt(euSlashMatch[1]) > 12) {
        day = parseInt(euSlashMatch[1], 10);
        month = parseInt(euSlashMatch[2], 10);
        year = parseInt(euSlashMatch[3], 10);
      }
    }
    
    // Validate and format
    if (year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      return `${year}-${formattedMonth}-${formattedDay}`;
    }
    
    // Fallback: use Date parsing but adjust for timezone
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Use UTC methods to avoid timezone conversion
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return '';
  } catch (error) {
    console.error('Error formatting date for input:', error, 'Input:', dateString);
    return '';
  }
} 