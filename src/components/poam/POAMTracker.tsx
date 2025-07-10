import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import { useEditPOAM } from '../../App';
import '../poams/POAMs.css';

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
}

export default function POAMTracker() {
  const [poams, setPOAMs] = useState<POAM[]>([]);
  const [filteredPOAMs, setFilteredPOAMs] = useState<POAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ 
    key: '', 
    direction: 'asc' 
  });

  const { showToast } = useToast();
  const { currentSystem } = useSystem();
  const { openEditPOAM } = useEditPOAM();

  // Load POAMs whenever the current system changes
  useEffect(() => {
    if (currentSystem?.id) {
      loadPOAMs();
    }
  }, [currentSystem?.id]);

  // Apply filters and search whenever the dependencies change
  useEffect(() => {
    let result = [...poams];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(poam => 
        poam.title.toLowerCase().includes(query) || 
        poam.description.toLowerCase().includes(query) ||
        poam.id.toString().includes(query)
      );
    }
    
    // Apply filters
    if (statusFilter) {
      result = result.filter(poam => poam.status === statusFilter);
    }
    
    if (priorityFilter) {
      result = result.filter(poam => poam.priority === priorityFilter);
    }
    
    if (riskFilter) {
      result = result.filter(poam => poam.riskLevel === riskFilter);
    }
    
    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === '') return 0;
        
        const aValue = a[sortConfig.key as keyof POAM];
        const bValue = b[sortConfig.key as keyof POAM];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredPOAMs(result);
  }, [poams, searchQuery, statusFilter, priorityFilter, riskFilter, sortConfig]);

  // Load POAMs from backend
  const loadPOAMs = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping POAM load');
      setLoading(false);
      return;
    }

    try {
      console.log('POAMTracker: Loading POAMs from backend for system:', currentSystem.id);
      setLoading(true);
      const data = await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id });
      console.log('POAMTracker: Received POAMs from backend:', data);
      setPOAMs(data || []);
    } catch (error) {
      console.error('POAMTracker: Error loading POAMs:', error);
      showToast('error', `Failed to load POAMs: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle editing a POAM
  const handleEditPOAM = (poam: POAM) => {
    openEditPOAM(poam.id);
  };

  // Handle sorting
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setRiskFilter('');
    setSortConfig({ key: '', direction: 'asc' });
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (key: keyof POAM): string[] => {
    return [...new Set(poams.map(poam => {
      const value = poam[key];
      return typeof value === 'string' ? value : '';
    }))].filter(Boolean);
  };

  // Calculate progress percentage for a POAM
  const calculateProgress = (poam: POAM) => {
    if (!poam.milestones || poam.milestones.length === 0) {
      // If no milestones, base progress on status
      switch (poam.status) {
        case 'Not Started': return 0;
        case 'In Progress': return 50;
        case 'Completed': return 100;
        case 'On Hold': return 25;
        default: return 0;
      }
    }
    
    const completedMilestones = poam.milestones.filter(m => m.status === 'Completed').length;
    return Math.round((completedMilestones / poam.milestones.length) * 100);
  };

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-green-600';
      case 'In Progress': return 'text-blue-600';
      case 'On Hold': return 'text-yellow-600';
      case 'Not Started': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  // Get priority color class
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get risk level color class
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High': return 'text-red-600 bg-red-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to view POAMs.</p>
      </div>
    );
  }

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <div className="h-6 w-6 text-primary">📋</div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">POAM Tracker</h1>
            <p className="text-muted-foreground">
              Manage and track your Plan of Action and Milestones for {currentSystem.name}
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <button
            onClick={loadPOAMs}
            disabled={loading}
            className="btn btn-primary btn-responsive"
          >
            <span className="hide-mobile">{loading ? 'Refreshing...' : 'Refresh'}</span>
            <span className="show-mobile">{loading ? '↻' : '↻'}</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card rounded-lg p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search POAMs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All Statuses</option>
            {getUniqueValues('status').map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All Priorities</option>
            {getUniqueValues('priority').map(priority => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All Risk Levels</option>
            {getUniqueValues('riskLevel').map(risk => (
              <option key={risk} value={risk}>{risk}</option>
            ))}
          </select>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors whitespace-nowrap"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredPOAMs.length} of {poams.length} POAMs
      </div>

      {/* POAM Table */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading POAMs...</p>
        </div>
      ) : filteredPOAMs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {poams.length === 0 ? 'No POAMs found. Create your first POAM to get started.' : 'No POAMs match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg overflow-hidden">
          <div className="table-responsive">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('id')}
                  >
                    ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('title')}
                  >
                    Title {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('priority')}
                  >
                    Priority {sortConfig.key === 'priority' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('riskLevel')}
                  >
                    Risk {sortConfig.key === 'riskLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="text-left p-4 cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort('endDate')}
                  >
                    Due Date {sortConfig.key === 'endDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left p-4">Progress</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOAMs.map((poam) => (
                  <tr 
                    key={poam.id} 
                    className="border-t border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEditPOAM(poam)}
                  >
                    <td className="p-4 font-mono text-sm">{poam.id}</td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-foreground">{poam.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {poam.description}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${getStatusColor(poam.status)}`}>
                        {poam.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(poam.priority)}`}>
                        {poam.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(poam.riskLevel)}`}>
                        {poam.riskLevel}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {formatDateDisplay(poam.endDate)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${calculateProgress(poam)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {calculateProgress(poam)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click when button is clicked
                          handleEditPOAM(poam);
                        }}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
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
    </div>
  );
}