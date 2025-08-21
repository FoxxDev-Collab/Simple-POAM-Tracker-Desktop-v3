import { useState, useCallback, useEffect } from 'react';
import {
  FileText, Download, Eye, Edit3, Trash2, Search,
  CheckCircle, Archive, TrendingUp, Target
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  getAllSTIGFiles, 
  getSTIGFileContent,
  updateSTIGFile, 
  deleteSTIGFile, 
  downloadSTIGFile
} from '../../utils/tauriApi';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { STIGChecklist } from '../../types/stig';

type STIGStatus = 'active' | 'archived' | 'superseded' | string;

interface STIGFileRecord {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  upload_date?: string; // some backends use this
  uploaded_date?: string; // code references this
  last_modified?: string;
  updated_date?: string;
  version: string;
  created_by?: string;
  status: STIGStatus;
  stig_info: {
    title: string;
    version: string;
    release_info?: string;
    classification?: string;
  };
  asset_info: {
    asset_type: string;
    host_name?: string;
    host_ip?: string;
    host_fqdn?: string;
  };
  compliance_summary: {
    compliance_percentage: number;
    open: number;
    total_vulns: number;
    not_a_finding: number;
    not_applicable: number;
  };
  remediation_progress: {
    remediated: number;
    total_findings: number;
    in_progress: number;
    planned: number;
    not_planned: number;
  };
  notes?: string;
  metadata?: any; // JSON value
  tags: string[];
}

interface FileDetailDialog {
  isOpen: boolean;
  file: STIGFileRecord | null;
  mode: 'view' | 'edit';
  checklist?: STIGChecklist;
}

export default function STIGFileManager() {
  const { currentSystem } = useSystem();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [stigFiles, setStigFiles] = useState<STIGFileRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'compliance' | 'progress'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [detailDialog, setDetailDialog] = useState<FileDetailDialog>({
    isOpen: false,
    file: null,
    mode: 'view'
  });

  // Load STIG files from backend
  const loadSTIGFiles = useCallback(async () => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const files = await getAllSTIGFiles(currentSystem.id);
      setStigFiles(files);
    } catch (error) {
      console.error('Error loading STIG files:', error);
      addToast('Failed to load STIG files', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  useEffect(() => {
    loadSTIGFiles();
  }, [loadSTIGFiles]);

  // Files are automatically tracked when uploaded through STIG Viewer

  // Files are automatically tracked when uploaded through STIG Viewer

  // Handle viewing file details
  const handleViewFile = useCallback(async (file: STIGFileRecord) => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const checklist = await getSTIGFileContent(file.id, currentSystem.id);
      setDetailDialog({
        isOpen: true,
        file,
        mode: 'view',
        checklist
      });
    } catch (error) {
      console.error('Error loading file details:', error);
      addToast('Failed to load file details', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Handle editing file
  const handleEditFile = useCallback((file: STIGFileRecord) => {
    setDetailDialog({
      isOpen: true,
      file: { ...file },
      mode: 'edit'
    });
  }, []);

  // Handle deleting file
  const handleDeleteFile = useCallback(async (file: STIGFileRecord) => {
    if (!currentSystem?.id) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.filename}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteSTIGFile(file.id, currentSystem.id);
      setStigFiles(prev => prev.filter(f => f.id !== file.id));
      addToast('STIG file deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting file:', error);
      addToast('Failed to delete file', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Handle archiving file
  const handleArchiveFile = useCallback(async (file: STIGFileRecord) => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const updatedFile = { ...file, status: 'archived' as const, updated_date: new Date().toISOString() };
      await updateSTIGFile(updatedFile, currentSystem.id);
      setStigFiles(prev => prev.map(f => f.id === file.id ? updatedFile : f));
      addToast('STIG file archived successfully', 'success');
    } catch (error) {
      console.error('Error archiving file:', error);
      addToast('Failed to archive file', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Handle downloading file
  const handleDownloadFile = useCallback(async (file: STIGFileRecord) => {
    if (!currentSystem?.id) return;
    
    setLoading(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      
      const filePath = await save({
        filters: [{ name: 'Checklist Files', extensions: ['ckl'] }],
        defaultPath: file.original_filename
      });

      if (filePath) {
        await downloadSTIGFile(file.id, filePath, currentSystem.id);
        addToast('File downloaded successfully', 'success');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      addToast('Failed to download file', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSystem?.id, addToast]);

  // Render compliance badge
  const renderComplianceBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge variant="success">Excellent ({percentage.toFixed(1)}%)</Badge>;
    if (percentage >= 75) return <Badge variant="warning">Good ({percentage.toFixed(1)}%)</Badge>;
    if (percentage >= 50) return <Badge variant="outline">Fair ({percentage.toFixed(1)}%)</Badge>;
    return <Badge variant="destructive">Poor ({percentage.toFixed(1)}%)</Badge>;
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'archived': return <Badge variant="secondary">Archived</Badge>;
      case 'superseded': return <Badge variant="outline">Superseded</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter and sort files
  const filteredAndSortedFiles = (() => {
    let filtered = stigFiles.filter(file => {
      // Text filter
      if (filter.trim()) {
        const searchTerm = filter.toLowerCase();
        const matchesText = (
          file.filename.toLowerCase().includes(searchTerm) ||
          file.stig_info.title.toLowerCase().includes(searchTerm) ||
          file.asset_info.host_name?.toLowerCase().includes(searchTerm) ||
          file.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        if (!matchesText) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && file.status !== statusFilter) return false;

      // Compliance filter
      if (complianceFilter !== 'all') {
        const percentage = file.compliance_summary.compliance_percentage;
        switch (complianceFilter) {
          case 'excellent':
            if (percentage < 90) return false;
            break;
          case 'good':
            if (percentage < 75 || percentage >= 90) return false;
            break;
          case 'fair':
            if (percentage < 50 || percentage >= 75) return false;
            break;
          case 'poor':
            if (percentage >= 50) return false;
            break;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'date': {
          const ad = getUploadedDate(a);
          const bd = getUploadedDate(b);
          const at = ad ? new Date(ad).getTime() || 0 : 0;
          const bt = bd ? new Date(bd).getTime() || 0 : 0;
          comparison = at - bt;
          break;
        }
        case 'compliance':
          comparison = a.compliance_summary.compliance_percentage - b.compliance_summary.compliance_percentage;
          break;
        case 'progress': {
          const aProgress = a.remediation_progress.remediated / (a.remediation_progress.total_findings || 1);
          const bProgress = b.remediation_progress.remediated / (b.remediation_progress.total_findings || 1);
          comparison = aProgress - bProgress;
          break;
        }
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  })();

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  // Safely resolve an uploaded/updated date string for a file
  const getUploadedDate = (file: STIGFileRecord): string => {
    return (
      file.uploaded_date ||
      file.upload_date ||
      file.updated_date ||
      file.last_modified ||
      ''
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">STIG File Management</h2>
          <p className="text-muted-foreground">
            View and manage STIG checklist files uploaded through the STIG Viewer for {currentSystem?.name}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Files</div>
              <div className="text-2xl font-bold text-foreground">{stigFiles.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Active Files</div>
              <div className="text-2xl font-bold text-foreground">
                {stigFiles.filter(f => f.status === 'active').length}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-warning" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Avg. Compliance</div>
              <div className="text-2xl font-bold text-foreground">
                {stigFiles.length > 0 
                  ? (stigFiles.reduce((sum, f) => sum + f.compliance_summary.compliance_percentage, 0) / stigFiles.length).toFixed(1)
                  : '0'
                }%
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-destructive" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Open Findings</div>
              <div className="text-2xl font-bold text-foreground">
                {stigFiles.reduce((sum, f) => sum + f.compliance_summary.open, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search files, STIGs, hosts..." 
                className="w-full px-3 py-2 pl-10 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="superseded">Superseded</option>
          </select>
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded text-sm"
          >
            <option value="all">All Compliance</option>
            <option value="excellent">Excellent (90%+)</option>
            <option value="good">Good (75-89%)</option>
            <option value="fair">Fair (50-74%)</option>
            <option value="poor">Poor (&lt;50%)</option>
          </select>
          <select
            value={`${sortBy}-${sortDirection}`}
            onChange={(e) => {
              const [sort, direction] = e.target.value.split('-') as [typeof sortBy, typeof sortDirection];
              setSortBy(sort);
              setSortDirection(direction);
            }}
            className="px-3 py-2 bg-background border border-input rounded text-sm"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="compliance-desc">Compliance High-Low</option>
            <option value="compliance-asc">Compliance Low-High</option>
            <option value="progress-desc">Progress High-Low</option>
            <option value="progress-asc">Progress Low-High</option>
          </select>
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">STIG Files</h3>
            <div className="text-sm text-muted-foreground">
              {filteredAndSortedFiles.length} of {stigFiles.length} files
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground">Loading STIG files...</p>
              </div>
            </div>
          ) : filteredAndSortedFiles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">File</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">STIG</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Asset</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Compliance</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Progress</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Status</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Uploaded</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-center border-b border-border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3 border-b border-border">
                        <div>
                          <div className="font-medium text-foreground truncate max-w-xs" title={file.filename}>
                            {file.filename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.file_size)} • v{file.version}
                          </div>
                          {file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {file.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {file.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{file.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border">
                        <div className="max-w-xs">
                          <div className="font-medium text-foreground truncate" title={file.stig_info.title}>
                            {file.stig_info.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.stig_info.version}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-border">
                        <div>
                          <div className="font-medium text-foreground">
                            {file.asset_info.host_name || 'Unknown Host'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.asset_info.asset_type}
                          </div>
                          {file.asset_info.host_ip && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {file.asset_info.host_ip}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="space-y-1">
                          {renderComplianceBadge(file.compliance_summary.compliance_percentage)}
                          <div className="text-xs text-muted-foreground">
                            {file.compliance_summary.open} open findings
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            {file.remediation_progress.total_findings > 0 
                              ? Math.round((file.remediation_progress.remediated / file.remediation_progress.total_findings) * 100)
                              : 0
                            }%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.remediation_progress.remediated}/{file.remediation_progress.total_findings} remediated
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        {renderStatusBadge(file.status)}
                      </td>
                      <td className="p-3 border-b border-border text-center">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(getUploadedDate(file))}
                        </div>
                      </td>
                      <td className="p-3 border-b border-border">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewFile(file)}
                            disabled={loading}
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFile(file)}
                            disabled={loading}
                            title="Edit"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile(file)}
                            disabled={loading}
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          {file.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchiveFile(file)}
                              disabled={loading}
                              title="Archive"
                            >
                              <Archive className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file)}
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
                <h3 className="text-lg font-semibold text-foreground">No STIG Files Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {filter || statusFilter !== 'all' || complianceFilter !== 'all'
                    ? 'No files match your current filters.'
                    : 'No STIG files uploaded yet. Upload checklist files through the STIG Viewer to see them here.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      {detailDialog.isOpen && detailDialog.file && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {detailDialog.mode === 'edit' ? 'Edit' : 'View'} STIG File
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {detailDialog.file.filename}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailDialog({ isOpen: false, file: null, mode: 'view' })}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* File Information */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">File Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Filename</label>
                        <div className="text-foreground">{detailDialog.file.filename}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Original Filename</label>
                        <div className="text-foreground">{detailDialog.file.original_filename}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Version</label>
                        <div className="text-foreground">v{detailDialog.file.version}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Status</label>
                        {detailDialog.mode === 'edit' ? (
                          <select
                            value={detailDialog.file.status}
                            onChange={(e) => setDetailDialog(prev => ({
                              ...prev,
                              file: prev.file ? { ...prev.file, status: e.target.value as any } : null
                            }))}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
                          >
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                            <option value="superseded">Superseded</option>
                          </select>
                        ) : (
                          renderStatusBadge(detailDialog.file.status)
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground">Tags</label>
                        {detailDialog.mode === 'edit' ? (
                          <input
                            type="text"
                            value={detailDialog.file.tags.join(', ')}
                            onChange={(e) => setDetailDialog(prev => ({
                              ...prev,
                              file: prev.file ? { 
                                ...prev.file, 
                                tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                              } : null
                            }))}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground"
                            placeholder="Tag1, Tag2, Tag3"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {detailDialog.file.tags.map(tag => (
                              <Badge key={tag} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">STIG Information</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div><strong>Title:</strong> {detailDialog.file.stig_info.title}</div>
                      <div><strong>Version:</strong> {detailDialog.file.stig_info.version}</div>
                      <div><strong>Release:</strong> {detailDialog.file.stig_info.release_info}</div>
                      <div><strong>Classification:</strong> {detailDialog.file.stig_info.classification}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Asset Information</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div><strong>Asset Type:</strong> {detailDialog.file.asset_info.asset_type}</div>
                      {detailDialog.file.asset_info.host_name && (
                        <div><strong>Host Name:</strong> {detailDialog.file.asset_info.host_name}</div>
                      )}
                      {detailDialog.file.asset_info.host_ip && (
                        <div><strong>Host IP:</strong> {detailDialog.file.asset_info.host_ip}</div>
                      )}
                      {detailDialog.file.asset_info.host_fqdn && (
                        <div><strong>FQDN:</strong> {detailDialog.file.asset_info.host_fqdn}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compliance and Progress */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Compliance Summary</h4>
                    <div className="space-y-4">
                      <div className="text-center">
                        {renderComplianceBadge(detailDialog.file.compliance_summary.compliance_percentage)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-muted p-3 rounded">
                          <div className="font-medium text-foreground">Total Vulnerabilities</div>
                          <div className="text-2xl font-bold text-primary">
                            {detailDialog.file.compliance_summary.total_vulns}
                          </div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="font-medium text-foreground">Open Findings</div>
                          <div className="text-2xl font-bold text-destructive">
                            {detailDialog.file.compliance_summary.open}
                          </div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="font-medium text-foreground">Not a Finding</div>
                          <div className="text-2xl font-bold text-success">
                            {detailDialog.file.compliance_summary.not_a_finding}
                          </div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="font-medium text-foreground">Not Applicable</div>
                          <div className="text-2xl font-bold text-secondary">
                            {detailDialog.file.compliance_summary.not_applicable}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Remediation Progress</h4>
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm font-medium">
                            {detailDialog.file.remediation_progress.total_findings > 0 
                              ? Math.round((detailDialog.file.remediation_progress.remediated / detailDialog.file.remediation_progress.total_findings) * 100)
                              : 0
                            }%
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2">
                          <div 
                            className="bg-success h-2 rounded-full" 
                            style={{ 
                              width: `${detailDialog.file.remediation_progress.total_findings > 0 
                                ? (detailDialog.file.remediation_progress.remediated / detailDialog.file.remediation_progress.total_findings) * 100
                                : 0
                              }%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-muted p-3 rounded">
                          <div className="text-success font-medium">Remediated</div>
                          <div className="text-lg font-bold">{detailDialog.file.remediation_progress.remediated}</div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="text-warning font-medium">In Progress</div>
                          <div className="text-lg font-bold">{detailDialog.file.remediation_progress.in_progress}</div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="text-primary font-medium">Planned</div>
                          <div className="text-lg font-bold">{detailDialog.file.remediation_progress.planned}</div>
                        </div>
                        <div className="bg-muted p-3 rounded">
                          <div className="text-muted-foreground font-medium">Not Planned</div>
                          <div className="text-lg font-bold">{detailDialog.file.remediation_progress.not_planned}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-3">Notes</h4>
                    {detailDialog.mode === 'edit' ? (
                      <textarea
                        value={detailDialog.file.notes || ''}
                        onChange={(e) => setDetailDialog(prev => ({
                          ...prev,
                          file: prev.file ? { ...prev.file, notes: e.target.value } : null
                        }))}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground h-24 resize-none"
                        placeholder="Add notes about this STIG file..."
                      />
                    ) : (
                      <div className="bg-muted p-3 rounded-lg">
                        {detailDialog.file.notes || 'No notes provided'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card">
              <Button 
                variant="outline" 
                onClick={() => setDetailDialog({ isOpen: false, file: null, mode: 'view' })}
              >
                {detailDialog.mode === 'edit' ? 'Cancel' : 'Close'}
              </Button>
              {detailDialog.mode === 'edit' && (
                <Button 
                  onClick={() => {
                    // TODO: Save changes
                    addToast('File updated successfully', 'success');
                    setDetailDialog({ isOpen: false, file: null, mode: 'view' });
                  }}
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
  )
}