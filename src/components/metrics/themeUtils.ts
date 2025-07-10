/**
 * Theme utilities for metrics components
 * Provides consistent colors that work well in both dark and light modes using CSS variables
 */

// Get computed CSS variables for theme-aware colors
export const getThemeColors = () => {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  return {
    foreground: `hsl(${computedStyle.getPropertyValue('--foreground').trim()})`,
    background: `hsl(${computedStyle.getPropertyValue('--background').trim()})`,
    muted: `hsl(${computedStyle.getPropertyValue('--muted-foreground').trim()})`,
    primary: `hsl(${computedStyle.getPropertyValue('--primary').trim()})`,
    success: `hsl(${computedStyle.getPropertyValue('--success').trim()})`,
    warning: `hsl(${computedStyle.getPropertyValue('--warning').trim()})`,
    destructive: `hsl(${computedStyle.getPropertyValue('--destructive').trim()})`,
    border: `hsl(${computedStyle.getPropertyValue('--border').trim()})`,
    card: `hsl(${computedStyle.getPropertyValue('--card').trim()})`
  };
};

// Status colors using theme variables
export const getStatusColors = () => {
  const themeColors = getThemeColors();
  return {
    'Not Started': themeColors.muted,
    'In Progress': themeColors.primary,
    'Completed': themeColors.success,
    'On Hold': themeColors.warning,
    'Delayed': themeColors.destructive,
    'Cancelled': themeColors.muted,
  };
};

// Priority colors using theme variables
export const getPriorityColors = () => {
  const themeColors = getThemeColors();
  return {
    'Low': themeColors.success,
    'Medium': themeColors.warning,
    'High': themeColors.destructive,
    'Critical': themeColors.destructive
  };
};

// Risk level colors using theme variables
export const getRiskColors = () => {
  const themeColors = getThemeColors();
  return {
    'Low': themeColors.success,
    'Medium': themeColors.warning,
    'High': themeColors.destructive,
    'Very High': themeColors.destructive
  };
};

// Legacy exports for backward compatibility - will return theme-aware colors
export const statusColors = getStatusColors();
export const priorityColors = getPriorityColors();
export const riskColors = getRiskColors();

// Chart options for consistent styling across charts
export const getBaseChartOptions = () => {
  const themeColors = getThemeColors();
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: themeColors.foreground,
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: themeColors.card,
        titleColor: themeColors.foreground,
        bodyColor: themeColors.foreground,
        borderColor: themeColors.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
      },
    },
    scales: {
      x: {
        grid: {
          color: themeColors.border,
        },
        ticks: {
          color: themeColors.foreground,
        },
      },
      y: {
        grid: {
          color: themeColors.border,
        },
        ticks: {
          color: themeColors.foreground,
        },
      },
    },
  };
};

// Common chart container styles
export const chartContainerStyle = {
  position: 'relative' as const,
  height: '300px',
  width: '100%',
  padding: '15px',
};
