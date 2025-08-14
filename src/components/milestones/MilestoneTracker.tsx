import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import MilestoneModal from './MilestoneModal';
import { formatDateDisplay } from '../../utils/dateUtils';
import { Milestone } from '../../types/Milestone';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { Target } from 'lucide-react';

interface POAM {
  id: number;
  title: string;
  milestones: Milestone[];
}

export default function MilestoneTracker() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [filteredMilestones, setFilteredMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filters and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [poamFilter, setPoamFilter] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Milestone | ''; direction: 'asc' | 'desc' }>({ 
    key: '', 
    direction: 'asc' 
  });
  
  // Highlighting from calendar navigation
  const [highlightedMilestone, setHighlightedMilestone] = useState<string | null>(null);
  
  const { showToast } = useToast();
  const { currentSystem } = useSystem();
  const { notifyMilestoneCompleted, notifySystemEvent } = useNotificationGenerator();

  // Get user's timezone from settings (would come from context in real app)
  const [timezone, setTimezone] = useState<string | undefined>(undefined);

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to view milestones.</p>
      </div>
    );
  }
  
  useEffect(() => {
    console.log('MilestoneTracker: Initializing component...');
    loadMilestones();
    loadSettings();
  }, [currentSystem?.id]);

  // Check for calendar navigation highlighting after milestones are loaded
  useEffect(() => {
    if (milestones.length > 0) {
      checkForCalendarNavigation();
    }
  }, [milestones]);

  // Check if we navigated from calendar and need to highlight a milestone
  const checkForCalendarNavigation = () => {
    console.log('MilestoneTracker: Checking for calendar navigation...');
    const highlightMilestoneId = sessionStorage.getItem('highlightMilestone');
    
    if (highlightMilestoneId) {
      console.log('MilestoneTracker: Found milestone to highlight:', highlightMilestoneId);
      
      // Check if the milestone exists in our current list
      const milestoneExists = milestones.find(m => m.id === highlightMilestoneId);
      
      if (milestoneExists) {
        console.log('MilestoneTracker: Milestone found, setting highlight');
        setHighlightedMilestone(highlightMilestoneId);
        
        // Clear the session storage
        sessionStorage.removeItem('highlightMilestone');
        sessionStorage.removeItem('highlightPOAM');
        
        // Scroll to the highlighted milestone after a short delay
        setTimeout(() => {
          const element = document.querySelector('.highlighted-milestone');
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 500);
        
        // Auto-clear highlighting after 10 seconds or when user clicks elsewhere
        setTimeout(() => {
          console.log('MilestoneTracker: Auto-clearing highlight after 10 seconds');
          setHighlightedMilestone(null);
        }, 10000);
      } else {
        console.warn('MilestoneTracker: Milestone not found in current list:', highlightMilestoneId);
        // Clear session storage even if milestone not found
        sessionStorage.removeItem('highlightMilestone');
        sessionStorage.removeItem('highlightPOAM');
      }
    } else {
      console.log('MilestoneTracker: No milestone to highlight');
    }
  };

  // Clear highlighting when user interacts with the table
  const clearHighlighting = () => {
    if (highlightedMilestone) {
      console.log('MilestoneTracker: Clearing highlight due to user interaction');
      setHighlightedMilestone(null);
    }
  };

  // Load settings from localStorage if available
  const loadSettings = () => {
    try {
      console.log('MilestoneTracker: Loading settings from localStorage...');
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings.timezone) {
          setTimezone(parsedSettings.timezone);
        }
      }
    } catch (error) {
      console.error('MilestoneTracker: Error loading settings:', error);
    }
  };

  // Apply filters and search whenever dependencies change
  useEffect(() => {
    console.log('MilestoneTracker: Applying filters and search...');
    let result = [...milestones];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(milestone => 
        milestone.title.toLowerCase().includes(query) || 
        milestone.description.toLowerCase().includes(query) ||
        (milestone.poamTitle && milestone.poamTitle.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(milestone => milestone.status === statusFilter);
    }
    
    // Apply "Hide Completed" filter
    if (hideCompleted) {
      result = result.filter(milestone => milestone.status !== 'Completed');
    }
    
    // Apply POAM filter
    if (poamFilter) {
      result = result.filter(milestone => milestone.poamTitle === poamFilter);
    }
    
    // Apply date filter logic
    if (dateFilter === 'upcoming') {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      result = result.filter(milestone => {
        const dueDate = new Date(milestone.dueDate);
        return dueDate >= today && dueDate <= nextWeek;
      });
    } else if (dateFilter === 'overdue') {
      const today = new Date();
      
      result = result.filter(milestone => {
        const dueDate = new Date(milestone.dueDate);
        return dueDate < today && milestone.status !== 'Completed';
      });
    }
    
    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === '') return 0;
        
        const aValue = a[sortConfig.key as keyof Milestone];
        const bValue = b[sortConfig.key as keyof Milestone];
        
        // Handle undefined or null values
        if (aValue === undefined || aValue === null) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bValue === undefined || bValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredMilestones(result);
  }, [milestones, searchQuery, statusFilter, dateFilter, poamFilter, hideCompleted, sortConfig]);

  // Load milestones from backend
  const loadMilestones = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping milestone load');
      setLoading(false);
      return;
    }

    try {
      console.log('MilestoneTracker: Loading milestones from backend for system:', currentSystem.id);
      setLoading(true);
      const poams = await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id });
      
      console.log('MilestoneTracker: Received POAMs from backend:', poams);
      
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
      
      console.log('MilestoneTracker: Extracted milestones:', allMilestones);
      
      setMilestones(allMilestones);
    } catch (error) {
      console.error('MilestoneTracker: Error loading milestones:', error);
      showToast('error', `Failed to load milestones: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const openMilestoneModal = (milestone: Milestone) => {
    console.log('MilestoneTracker: Opening milestone modal with data:', milestone);
    
    // Clear highlighting when user interacts with a milestone
    clearHighlighting();
    
    // Ensure we have all required fields before opening the modal
    if (!milestone.id) {
      console.error('MilestoneTracker: Milestone is missing ID property:', milestone);
      showToast('error', 'Cannot edit milestone: Invalid data');
      return;
    }
    
    if (!milestone.poamId) {
      console.error('MilestoneTracker: Milestone is missing POAM ID:', milestone);
      showToast('error', 'Cannot edit milestone: Missing POAM reference');
      return;
    }
    
    setSelectedMilestone(milestone);
    setIsModalOpen(true);
  };

  const closeMilestoneModal = () => {
    setIsModalOpen(false);
    setSelectedMilestone(null);
  };

  const handleMilestoneSave = async (updatedMilestone: Milestone) => {
    try {
      console.log('MilestoneTracker: Saving updated milestone:', updatedMilestone);
      
      // Find the POAM this milestone belongs to
      if (updatedMilestone.poamId) {
        // Get the current POAM data
        const poamData = await invoke<POAM | null>('get_poam_by_id', { 
          id: updatedMilestone.poamId,
          systemId: currentSystem.id 
        });
        
        if (poamData) {
          // Find original milestone for comparison
          const originalMilestone = milestones.find(m => m.id === updatedMilestone.id);
          
          // Get user's timezone preference from settings (for potential future use)
          
          // Ensure the dueDate is in the proper format for the backend
          let formattedDueDate = updatedMilestone.dueDate;
          
          // For date-only values, keep them as YYYY-MM-DD format to avoid timezone issues
          if (formattedDueDate && !formattedDueDate.includes('T')) {
            // If it's already in YYYY-MM-DD format, keep it as is
            if (formattedDueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Already in the correct format
              console.log(`MilestoneTracker: Date kept as ${formattedDueDate} (no conversion needed)`);
            } else {
              // Try to convert from other formats to YYYY-MM-DD
              try {
                const parts = formattedDueDate.split('-');
                if (parts.length === 3) {
                  const year = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10);
                  const day = parseInt(parts[2], 10);
                  
                  if (year && month && day) {
                    const formattedMonth = String(month).padStart(2, '0');
                    const formattedDay = String(day).padStart(2, '0');
                    formattedDueDate = `${year}-${formattedMonth}-${formattedDay}`;
                    console.log(`MilestoneTracker: Date converted to ${formattedDueDate}`);
                  }
                }
              } catch (dateError) {
                console.error('MilestoneTracker: Error formatting date:', dateError);
                // Keep the original value if conversion fails
              }
            }
          }
          
          // Update the milestone in the POAM's milestones array
          const updatedPoam = {
            ...poamData,
            milestones: poamData.milestones.map(m => 
              m.id === updatedMilestone.id 
                ? {
                    id: updatedMilestone.id,
                    title: updatedMilestone.title,
                    dueDate: formattedDueDate,
                    status: updatedMilestone.status,
                    description: updatedMilestone.description
                  }
                : m
            )
          };
          
          console.log('MilestoneTracker: Saving updated POAM with milestones:', updatedPoam);
          
          // Save the updated POAM with the modified milestone
          await invoke('update_poam', { 
            poam: updatedPoam,
            systemId: currentSystem.id 
          });
          
          // Check if milestone was just completed and notify
          if (originalMilestone && originalMilestone.status !== 'Completed' && updatedMilestone.status === 'Completed') {
            notifyMilestoneCompleted(updatedMilestone);
          }
          
          // Notify about successful milestone update
          notifySystemEvent({
            type: 'sync',
            message: `Milestone "${updatedMilestone.title}" updated successfully`,
            success: true
          });
          
          // Update the local state
          setMilestones(milestones.map(milestone => 
            milestone.id === updatedMilestone.id 
              ? {
                  ...updatedMilestone,
                  dueDate: formattedDueDate, // Use the formatted date for consistency
                  poamTitle: updatedMilestone.poamTitle || milestone.poamTitle,
                  poamId: updatedMilestone.poamId || milestone.poamId
                }
              : milestone
          ));
          
          console.log('MilestoneTracker: Milestone updated successfully');
          showToast('success', 'Milestone updated successfully');
        } else {
          console.error('MilestoneTracker: POAM not found for milestone update');
          showToast('error', 'Failed to update milestone: POAM not found');
          
          notifySystemEvent({
            type: 'error',
            message: `Failed to update milestone "${updatedMilestone.title}": POAM not found`,
            success: false
          });
        }
      } else {
        console.error('MilestoneTracker: No associated POAM for milestone update');
        showToast('error', 'Failed to update milestone: No associated POAM');
        
        notifySystemEvent({
          type: 'error',
          message: `Failed to update milestone "${updatedMilestone.title}": No associated POAM`,
          success: false
        });
      }
    } catch (error) {
      console.error('MilestoneTracker: Error updating milestone:', error);
      showToast('error', `Failed to update milestone: ${error}`);
      
      notifySystemEvent({
        type: 'error',
        message: `Failed to update milestone "${updatedMilestone.title}"`,
        success: false,
        details: String(error)
      });
    } finally {
      closeMilestoneModal();
    }
  };

  // Sort handler for table headers
  const handleSort = (key: keyof Milestone) => {
    console.log('MilestoneTracker: Sorting by:', key);
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Function to render sort indicator
  const renderSortIndicator = (key: keyof Milestone) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = useCallback((key: keyof Milestone) => {
    console.log('MilestoneTracker: Getting unique values for:', key);
    const values = new Set<string>();
    milestones.forEach(milestone => {
      const value = milestone[key];
      if (typeof value === 'string') {
        values.add(value);
      }
    });
    return Array.from(values);
  }, [milestones]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setDateFilter('');
    setPoamFilter('');
    setHideCompleted(false);
    setSortConfig({ key: '', direction: 'asc' });
  };

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600 bg-green-50';
      case 'In Progress': return 'text-blue-600 bg-blue-50';
      case 'On Hold': return 'text-yellow-600 bg-yellow-50';
      case 'Not Started': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Milestone Tracker</h1>
            <p className="text-muted-foreground">
              Track progress across all POAMs for {currentSystem.name}
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <button
            onClick={clearFilters}
            className="btn btn-outline btn-responsive"
          >
            Clear Filters
          </button>
          <button
            onClick={loadMilestones}
            className="btn btn-primary btn-responsive"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="container-responsive bg-card rounded-lg p-6 space-y-4">
        <div className="responsive-header">
          <div className="flex items-center gap-2 title-row">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">Filters & Search</h2>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="w-full">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search milestones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
            />
          </div>
        </div>
        
        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors w-full sm:w-auto"
            >
              <option value="">All Dates</option>
              <option value="upcoming">Due This Week</option>
              <option value="overdue">Overdue</option>
            </select>
            
            <select
              value={poamFilter}
              onChange={(e) => setPoamFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors w-full sm:w-auto"
            >
              <option value="">All POAMs</option>
              {getUniqueValues('poamTitle').map(poam => (
                <option key={poam} value={poam}>{poam}</option>
              ))}
            </select>
          </div>
          
          {/* Hide Completed moved to results bar below */}
        </div>
      </div>

      {/* Results Summary and Quick Filter */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Showing {filteredMilestones.length} of {milestones.length} milestones
        </div>
        <label className="flex items-center gap-2 px-3 py-2 font-medium text-foreground cursor-pointer rounded-md transition-colors border border-border bg-card hover:bg-accent whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="rounded border-input focus:ring-2 focus:ring-ring/20 h-4 w-4"
          />
          Hide Completed
        </label>
      </div>
      
      {/* Milestone Table */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading milestones...</p>
        </div>
      ) : filteredMilestones.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {milestones.length === 0 ? 'No milestones found. Import data or create a new POAM with milestones.' : 'No milestones match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg overflow-hidden border border-border">
          <div className="table-responsive">
            <table className="w-full table-fixed">
              <thead className="bg-muted/50">
                <tr>
                  <th 
                    className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 w-[34%]"
                    onClick={() => handleSort('title')}
                  >
                    Milestone {renderSortIndicator('title')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 w-[24%]"
                    onClick={() => handleSort('poamTitle')}
                  >
                    POAM {renderSortIndicator('poamTitle')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 w-[16%]"
                    onClick={() => handleSort('dueDate')}
                  >
                    Due Date {renderSortIndicator('dueDate')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 w-[16%]"
                    onClick={() => handleSort('status')}
                  >
                    Status {renderSortIndicator('status')}
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMilestones.map((milestone) => (
                  <tr 
                    key={milestone.id} 
                    className={`border-t border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                      highlightedMilestone === milestone.id ? 'highlighted-milestone bg-primary/10 border-primary/30' : ''
                    }`}
                    onClick={() => {
                      clearHighlighting();
                      openMilestoneModal(milestone);
                    }}
                  >
                    <td className="p-4">
                      <div className="font-medium text-foreground truncate" title={milestone.title}>{milestone.title}</div>
                      {milestone.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {milestone.description}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm truncate" title={milestone.poamTitle}>{milestone.poamTitle}</td>
                    <td className="p-4 text-sm whitespace-nowrap">{formatDateDisplay(milestone.dueDate, timezone)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                        {milestone.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button 
                        className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openMilestoneModal(milestone);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {isModalOpen && selectedMilestone && (
        <MilestoneModal 
          milestone={selectedMilestone}
          onClose={closeMilestoneModal}
          onSave={handleMilestoneSave}
        />
      )}
    </div>
  );
} 