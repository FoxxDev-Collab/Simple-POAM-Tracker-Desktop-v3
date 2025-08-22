import React, { useState, useCallback } from 'react';
import { Shield, FileText, Download, Eye, Edit3, Trash2, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { getNessusPrepListById, updateNessusPrepList, deleteNessusPrepList } from '../../utils/tauriApi';

interface NessusPrepList {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  updated_date: string;
  finding_count: number;
  prep_status?: string;
  source_scan_id?: string;
  scan_info?: {
    id: string;
    name: string;
    scan_date?: string;
  };
  asset_info?: {
    total_hosts: number;
    scan_name: string;
  };
  cve_analysis?: {
    total_cves: number;
    critical_cves: number;
    high_cves: number;
    medium_cves: number;
    low_cves: number;
    exploitable_cves: number;
  };
  milestones?: Array<{
    id: string;
    title: string;
    description: string;
    cve_id: string;
    priority: string;
    severity: string;
    finding_count: number;
    affected_hosts: string[];
    target_date: string;
    status?: string;
    notes?: string;
  }>;
  summary?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  selected_findings?: Array<{
    id: string;
    plugin_id: string;
    plugin_name: string;
    severity: string;
    risk_factor: string;
    cve: string;
    cvss_score?: number;
    host: string;
    port?: string;
    synopsis?: string;
    solution?: string;
    exploit_available?: boolean;
  }>;
}

interface PrepListDetailDialog {
  isOpen: boolean;
  prepList: NessusPrepList | null;
  mode: 'view' | 'edit';
}

interface NessusPrepListManagerProps {
  prepLists: NessusPrepList[];
  onRefreshPrepLists: () => Promise<void>;
}

export const NessusPrepListManager: React.FC<NessusPrepListManagerProps> = ({
  prepLists,
  onRefreshPrepLists
}) => {
  const { currentSystem } = useSystem();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailDialog, setDetailDialog] = useState<PrepListDetailDialog>({
    isOpen: false,
    prepList: null,
    mode: 'view'
  });

  // Handle viewing prep list details
  const handleViewPrepList = useCallback(async (id: string) => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const prepList = await getNessusPrepListById(id, currentSystem.id);
      if (prepList) {
        setDetailDialog({
          isOpen: true,
          prepList,
          mode: 'view'
        });
      }
    } catch (error) {
      console.error('Error loading prep list details:', error);
      addToast('Failed to load prep list details', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Handle editing prep list
  const handleEditPrepList = useCallback(async (id: string) => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const prepList = await getNessusPrepListById(id, currentSystem.id);
      if (prepList) {
        setDetailDialog({
          isOpen: true,
          prepList,
          mode: 'edit'
        });
      }
    } catch (error) {
      console.error('Error loading prep list for editing:', error);
      addToast('Failed to load prep list for editing', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Handle deleting prep list
  const handleDeletePrepList = useCallback(async (id: string, name: string) => {
    if (!currentSystem?.id) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the prep list "${name}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteNessusPrepList(id, currentSystem.id);
      await onRefreshPrepLists();
      addToast(`Prep list "${name}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting prep list:', error);
      addToast(`Failed to delete prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast, onRefreshPrepLists]);

  // Handle updating prep list
  const handleUpdatePrepList = useCallback(async (updatedPrepList: NessusPrepList) => {
    if (!currentSystem?.id) return;

    setLoading(true);
    try {
      await updateNessusPrepList(updatedPrepList, currentSystem.id);
      await onRefreshPrepLists();
      setDetailDialog({ isOpen: false, prepList: null, mode: 'view' });
      addToast('Prep list updated successfully', 'success');
    } catch (error) {
      console.error('Error updating prep list:', error);
      addToast(`Failed to update prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast, onRefreshPrepLists]);

  // Handle exporting prep list
  const handleExportPrepList = useCallback(async (prepList: NessusPrepList) => {
    setLoading(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      
      const filePath = await save({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        defaultPath: `nessus-prep-${prepList.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`
      });

      if (filePath) {
        const exportData = {
          ...prepList,
          exported_date: new Date().toISOString(),
          system_info: {
            id: currentSystem?.id,
            name: currentSystem?.name
          }
        };

        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        addToast('Prep list exported successfully', 'success');
      }
    } catch (error) {
      console.error('Error exporting prep list:', error);
      addToast(`Failed to export prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, currentSystem]);

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ready':
        return <Badge variant="success">Ready</Badge>;
      case 'in_use':
        return <Badge variant="warning">In Use</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  // Filter prep lists
  const filteredPrepLists = prepLists.filter(prepList => {
    // Text filter
    if (filter.trim()) {
      const searchTerm = filter.toLowerCase();
      const matchesText = (
        prepList.name.toLowerCase().includes(searchTerm) ||
        prepList.description?.toLowerCase().includes(searchTerm) ||
        prepList.scan_info?.name?.toLowerCase().includes(searchTerm)
      );
      if (!matchesText) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (prepList.prep_status !== statusFilter) return false;
    }

    return true;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nessus Prep Lists</h2>
          <p className="text-muted-foreground">
            Manage and export Nessus vulnerability preparation lists for {currentSystem?.name}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search prep lists..." 
                className="w-full px-3 py-2 pl-10 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded text-sm min-w-32"
          >
            <option value="all">All Status</option>
            <option value="ready">Ready</option>
            <option value="in_use">In Use</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Prep Lists Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Preparation Lists</h3>
            <div className="text-sm text-muted-foreground">
              {filteredPrepLists.length} of {prepLists.length} prep lists
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground">Loading prep lists...</p>
              </div>
            </div>
          ) : filteredPrepLists.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Name</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Scan</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Findings</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">CVEs</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Status</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Created</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrepLists.map((prepList) => (
                    <tr key={prepList.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 border-b border-border">
                        <div>
                          <div className="font-medium text-foreground">{prepList.name}</div>
                          {prepList.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                              {prepList.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border">
                        <div className="text-sm">
                          <div className="font-medium text-foreground truncate max-w-xs">
                            {prepList.scan_info?.name || 'Unknown Scan'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {prepList.asset_info?.total_hosts || 0} hosts
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="font-medium text-primary">
                          {prepList.finding_count || 0}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="space-y-1">
                          <div className="font-medium text-destructive">
                            {prepList.cve_analysis?.total_cves || 0}
                          </div>
                          {(prepList.cve_analysis?.exploitable_cves || 0) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {prepList.cve_analysis?.exploitable_cves} exploitable
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        {renderStatusBadge(prepList.prep_status || 'ready')}
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(prepList.created_date)}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPrepList(prepList.id)}
                            disabled={loading}
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrepList(prepList.id)}
                            disabled={loading}
                            title="Edit"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPrepList(prepList)}
                            disabled={loading}
                            title="Export"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePrepList(prepList.id, prepList.name)}
                            disabled={loading}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                <FileText className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <h3 className="text-lg font-semibold text-foreground">No Prep Lists Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {filter || statusFilter !== 'all' 
                    ? 'No prep lists match your current filters.'
                    : 'Create your first Nessus prep list from the Nessus Viewer tab.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      {detailDialog.isOpen && detailDialog.prepList && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {detailDialog.mode === 'edit' ? 'Edit' : 'View'} Nessus Prep List
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {detailDialog.prepList.name}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailDialog({ isOpen: false, prepList: null, mode: 'view' })}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Basic Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Name</label>
                        {detailDialog.mode === 'edit' ? (
                          <input
                            type="text"
                            value={detailDialog.prepList.name}
                            onChange={(e) => setDetailDialog(prev => ({
                              ...prev,
                              prepList: prev.prepList ? { ...prev.prepList, name: e.target.value } : null
                            }))}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
                          />
                        ) : (
                          <div className="text-foreground font-medium">{detailDialog.prepList.name}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Status</label>
                        {detailDialog.mode === 'edit' ? (
                          <select
                            value={detailDialog.prepList.prep_status || 'ready'}
                            onChange={(e) => setDetailDialog(prev => ({
                              ...prev,
                              prepList: prev.prepList ? { ...prev.prepList, prep_status: e.target.value } : null
                            }))}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
                          >
                            <option value="ready">Ready</option>
                            <option value="in_use">In Use</option>
                            <option value="archived">Archived</option>
                          </select>
                        ) : (
                          renderStatusBadge(detailDialog.prepList.prep_status || 'ready')
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Description</label>
                        {detailDialog.mode === 'edit' ? (
                          <textarea
                            value={detailDialog.prepList.description || ''}
                            onChange={(e) => setDetailDialog(prev => ({
                              ...prev,
                              prepList: prev.prepList ? { ...prev.prepList, description: e.target.value } : null
                            }))}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground h-20 resize-none"
                            placeholder="Optional description..."
                          />
                        ) : (
                          <div className="text-muted-foreground bg-muted p-3 rounded">
                            {detailDialog.prepList.description || 'No description provided'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Scan Information</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div><strong>Scan Name:</strong> {detailDialog.prepList.scan_info?.name || 'Unknown'}</div>
                      <div><strong>Total Hosts:</strong> {detailDialog.prepList.asset_info?.total_hosts || 0}</div>
                      <div><strong>Total Findings:</strong> {detailDialog.prepList.finding_count || 0}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Vulnerability Summary</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-red-50 border border-red-200 p-3 rounded">
                        <div className="text-red-800 font-medium">Critical</div>
                        <div className="text-lg font-bold text-red-900">{detailDialog.prepList.summary?.critical || 0}</div>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                        <div className="text-orange-800 font-medium">High</div>
                        <div className="text-lg font-bold text-orange-900">{detailDialog.prepList.summary?.high || 0}</div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                        <div className="text-yellow-800 font-medium">Medium</div>
                        <div className="text-lg font-bold text-yellow-900">{detailDialog.prepList.summary?.medium || 0}</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                        <div className="text-blue-800 font-medium">Low</div>
                        <div className="text-lg font-bold text-blue-900">{detailDialog.prepList.summary?.low || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CVE Analysis and Milestones */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">CVE Analysis</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div><strong>Total CVEs:</strong> {detailDialog.prepList.cve_analysis?.total_cves || 0}</div>
                      <div><strong>Exploitable CVEs:</strong> {detailDialog.prepList.cve_analysis?.exploitable_cves || 0}</div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Critical</div>
                          <div className="font-bold text-destructive">{detailDialog.prepList.cve_analysis?.critical_cves || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">High</div>
                          <div className="font-bold text-warning">{detailDialog.prepList.cve_analysis?.high_cves || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Medium</div>
                          <div className="font-bold text-primary">{detailDialog.prepList.cve_analysis?.medium_cves || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Low</div>
                          <div className="font-bold text-secondary">{detailDialog.prepList.cve_analysis?.low_cves || 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">
                      CVE Milestones ({detailDialog.prepList.milestones?.length || 0})
                    </h4>
                    <div className="bg-muted rounded-lg max-h-60 overflow-y-auto">
                      {detailDialog.prepList.milestones?.map((milestone, index) => (
                        <div key={index} className="p-3 border-b border-border last:border-b-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-foreground">{milestone.cve_id}</div>
                            <Badge variant={
                              milestone.priority === 'critical' ? 'destructive' :
                              milestone.priority === 'high' ? 'warning' :
                              milestone.priority === 'medium' ? 'outline' : 'secondary'
                            }>
                              {milestone.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {milestone.affected_hosts.length} host(s) affected
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Target: {new Date(milestone.target_date).toLocaleDateString()}
                          </div>
                        </div>
                      )) || (
                        <div className="p-3 text-center text-muted-foreground">
                          No CVE milestones created
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div><strong>Created:</strong> {formatDate(detailDialog.prepList.created_date)}</div>
                    <div><strong>Updated:</strong> {formatDate(detailDialog.prepList.updated_date)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card">
              <Button 
                variant="outline" 
                onClick={() => setDetailDialog({ isOpen: false, prepList: null, mode: 'view' })}
              >
                {detailDialog.mode === 'edit' ? 'Cancel' : 'Close'}
              </Button>
              {detailDialog.mode === 'edit' && (
                <Button 
                  onClick={() => handleUpdatePrepList(detailDialog.prepList!)}
                  disabled={loading}
                >
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};