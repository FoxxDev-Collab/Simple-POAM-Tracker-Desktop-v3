import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useToast } from '../../context/ToastContext';
import { 
  Download,
  Upload,
  HardDrive,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Shield,
  Database,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface GroupExportImportProps {
  groupId: string;
  groupName: string;
  systems: any[];
}

interface ExportProgress {
  phase: string;
  systemName?: string;
  progress: number;
  total: number;
  currentFile?: string;
}

interface ExportSummary {
  groupName: string;
  systemCount: number;
  totalPoams: number;
  totalNotes: number;
  totalStigMappings: number;
  totalTestPlans: number;
  totalEvidenceFiles: number;
  exportDate: string;
  exportSize: string;
}

// Simple Progress component
const ProgressComponent = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-muted rounded-full ${className}`}>
    <div 
      className="bg-primary h-full rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// Simple Alert components
const Alert = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-border bg-card text-card-foreground p-4 ${className}`}>
    {children}
  </div>
);

const AlertTitle = ({ children }: { children: React.ReactNode }) => (
  <h5 className="mb-1 font-medium leading-none tracking-tight">{children}</h5>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-muted-foreground">{children}</div>
);

// Simple Dialog components
const Dialog = ({ open, onOpenChange, children }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  children: React.ReactNode 
}) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-background rounded-lg border shadow-lg max-w-md w-full max-h-[85vh] overflow-auto">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">{children}</div>
);

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-1.5 text-center sm:text-left mb-4">{children}</div>
);

const DialogTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

const DialogDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

export default function GroupExportImport({ groupId, groupName, systems }: GroupExportImportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [importProgress, setImportProgress] = useState<ExportProgress | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const { showToast } = useToast();

  const handleGroupExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress({ phase: 'Initializing...', progress: 0, total: 100 });

      // Show save dialog
      const exportPath = await save({
        filters: [{
          name: 'Group Backup',
          extensions: ['zip']
        }],
        defaultPath: `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.zip`
      });

      if (!exportPath) {
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      console.log('Starting group export for:', groupId, 'to:', exportPath);

      // Start the export with progress tracking
      const result = await invoke<string>('export_complete_group_backup', {
        exportPath,
        groupId,
        progressCallback: (progress: ExportProgress) => {
          setExportProgress(progress);
        }
      });

      // Parse the result to get export summary
      const lines = result.split('\n');
      const summaryData: any = {};
      
      lines.forEach(line => {
        if (line.includes('Group:')) summaryData.groupName = line.split(':')[1]?.trim();
        if (line.includes('Systems:')) summaryData.systemCount = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('POAMs:')) summaryData.totalPoams = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('Notes:')) summaryData.totalNotes = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('STIG Mappings:')) summaryData.totalStigMappings = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('Test Plans:')) summaryData.totalTestPlans = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('Evidence Files:')) summaryData.totalEvidenceFiles = parseInt(line.split(':')[1]?.trim() || '0');
        if (line.includes('File Size:')) summaryData.exportSize = line.split(':')[1]?.trim();
      });
      
      setExportSummary({
        ...summaryData,
        exportDate: new Date().toLocaleString()
      });

      showToast('success', `Group backup exported successfully to ${exportPath}`);
      setShowExportDialog(true);

    } catch (error) {
      console.error('Group export error:', error);
      showToast('error', `Failed to export group: ${error}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleSystemImport = async () => {
    try {
      setIsImporting(true);
      setImportProgress({ phase: 'Preparing import...', progress: 5, total: 100 });

      // Show open dialog
      const importPath = await open({
        filters: [{
          name: 'System Backup',
          extensions: ['zip', 'json']
        }],
        multiple: false
      });

      if (!importPath) {
        setIsImporting(false);
        setImportProgress(null);
        return;
      }

      console.log('Starting system import from:', importPath);
      
      const pathString = Array.isArray(importPath) ? importPath[0] : importPath;
      setImportProgress({ 
        phase: 'Reading backup file...', 
        progress: 20, 
        total: 100,
        currentFile: pathString.split('/').pop() || pathString.split('\\').pop() || 'backup file'
      });

      // Simulate reading file progress
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setImportProgress({ 
        phase: 'Processing system data...', 
        progress: 40, 
        total: 100,
        currentFile: 'Extracting and validating data'
      });

      // Import the system backup
      const result = await invoke<any>('import_system_backup', {
        filePath: pathString
      });

      setImportProgress({ 
        phase: 'Finalizing import...', 
        progress: 85, 
        total: 100,
        systemName: result.systemName || 'Imported System'
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      setImportProgress({ 
        phase: 'Import completed!', 
        progress: 100, 
        total: 100,
        systemName: result.systemName || 'Imported System'
      });

      const importSummary = result.counts 
        ? Object.entries(result.counts).map(([key, value]) => `${value} ${key}`).join(', ')
        : 'system data';

      showToast('success', `System "${result.systemName || 'Unknown'}" imported with ${importSummary}`);
      setShowImportDialog(true);

      // Refresh the page to show imported data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('System import error:', error);
      showToast('error', `Failed to import system: ${error}`);
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(null);
      }, 1000);
    }
  };

  const validateGroupForExport = () => {
    const issues = [];
    
    if (!systems || systems.length === 0) {
      issues.push('No systems found in this group');
    }
    
    return issues;
  };

  const exportIssues = validateGroupForExport();
  const canExport = exportIssues.length === 0;

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <HardDrive className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Group Export/Import</h1>
            <p className="text-muted-foreground">
              Backup and restore complete group data with full integrity
            </p>
          </div>
        </div>
      </div>

      {/* Group Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Group Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">{groupName}</div>
                <div className="text-sm text-muted-foreground">Group Name</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Database className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium">{systems?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Systems</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Full Backup</div>
                <div className="text-sm text-muted-foreground">Export Type</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileArchive className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="font-medium">ZIP Format</div>
                <div className="text-sm text-muted-foreground">With Evidence</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Group Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canExport && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cannot Export</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {exportIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold">Complete Group Backup Includes:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Group metadata and configuration
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                All system data and configurations
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                POAMs, milestones, and notes
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                STIG mappings and compliance data
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Security test plans and results
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                All evidence files and attachments
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Group POAMs and cross-system data
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Complete system relationships
              </div>
            </div>
          </div>

          {exportProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{exportProgress.phase}</span>
                <span className="text-sm text-muted-foreground">
                  {exportProgress.progress}/{exportProgress.total}
                </span>
              </div>
              <ProgressComponent value={(exportProgress.progress / exportProgress.total) * 100} className="h-2" />
              {exportProgress.systemName && (
                <p className="text-xs text-muted-foreground">
                  Processing: {exportProgress.systemName}
                </p>
              )}
              {exportProgress.currentFile && (
                <p className="text-xs text-muted-foreground">
                  File: {exportProgress.currentFile}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleGroupExport}
            disabled={!canExport || isExporting}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="animate-pulse">
                  {exportProgress?.phase || 'Exporting Group...'}
                </span>
              </div>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Complete Group Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import System to Group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Import Information</AlertTitle>
            <AlertDescription>
              Import a system backup file to add another system to this group. The imported system will retain all 
              its POAMs, notes, STIG mappings, and test plans. This is useful for migrating systems between environments.
            </AlertDescription>
          </Alert>

          {importProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{importProgress.phase}</span>
                <span className="text-sm text-muted-foreground">
                  {importProgress.progress}/{importProgress.total}
                </span>
              </div>
              <ProgressComponent value={(importProgress.progress / importProgress.total) * 100} className="h-2" />
              {importProgress.systemName && (
                <p className="text-xs text-muted-foreground">
                  Processing: {importProgress.systemName}
                </p>
              )}
              {importProgress.currentFile && (
                <p className="text-xs text-muted-foreground">
                  File: {importProgress.currentFile}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleSystemImport}
            disabled={isImporting}
            className="w-full"
            size="lg"
            variant="outline"
          >
            {isImporting ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="animate-pulse">
                  {importProgress?.phase || 'Importing System...'}
                </span>
              </div>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import System Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Export Success Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Export Completed Successfully
            </DialogTitle>
            <DialogDescription>
              Your group backup has been created with complete data integrity.
            </DialogDescription>
          </DialogHeader>
          
          {exportSummary && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold">Export Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Group: <span className="font-medium">{exportSummary.groupName}</span></div>
                  <div>Systems: <span className="font-medium">{exportSummary.systemCount}</span></div>
                  <div>POAMs: <span className="font-medium">{exportSummary.totalPoams}</span></div>
                  <div>Notes: <span className="font-medium">{exportSummary.totalNotes}</span></div>
                  <div>STIG Mappings: <span className="font-medium">{exportSummary.totalStigMappings}</span></div>
                  <div>Test Plans: <span className="font-medium">{exportSummary.totalTestPlans}</span></div>
                  <div>Evidence Files: <span className="font-medium">{exportSummary.totalEvidenceFiles}</span></div>
                  <div>File Size: <span className="font-medium">{exportSummary.exportSize}</span></div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Exported: {exportSummary.exportDate}
                </div>
              </div>
              
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Backup Complete</AlertTitle>
                <AlertDescription>
                  Your group backup is now ready for storage or transfer to air-gapped environments. 
                  The ZIP file contains all data and evidence files needed for complete restoration.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Success Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              System Import Completed Successfully
            </DialogTitle>
            <DialogDescription>
              The system backup has been imported with all POAMs, notes, and data restored as a new system.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Page Refresh Required</AlertTitle>
            <AlertDescription>
              The page will automatically refresh in a few seconds to display the imported system.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>

      {/* Import Loading Overlay */}
      {(isImporting || isExporting) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-lg border shadow-xl p-8 max-w-lg w-full mx-4">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse"></div>
              </div>
              
              <div className="text-center space-y-3 w-full">
                <h3 className="text-xl font-semibold">
                  {isExporting ? 'Exporting Group' : 'Importing System'}
                </h3>
                
                {/* Progress Information */}
                {isImporting && importProgress && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {importProgress.phase}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(importProgress.progress / importProgress.total) * 100}%` }}
                      />
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {importProgress.progress}/{importProgress.total} - {Math.round((importProgress.progress / importProgress.total) * 100)}%
                    </div>
                    
                    {importProgress.systemName && (
                      <p className="text-sm font-medium text-primary">
                        Processing: {importProgress.systemName}
                      </p>
                    )}
                    
                    {importProgress.currentFile && (
                      <p className="text-xs text-muted-foreground truncate max-w-sm">
                        File: {importProgress.currentFile}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Export Progress */}
                {isExporting && exportProgress && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground animate-pulse">
                      {exportProgress.phase}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${(exportProgress.progress / exportProgress.total) * 100}%` }}
                      />
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {exportProgress.progress}/{exportProgress.total} - {Math.round((exportProgress.progress / exportProgress.total) * 100)}%
                    </div>
                    
                    {exportProgress.systemName && (
                      <p className="text-sm font-medium text-primary">
                        Processing: {exportProgress.systemName}
                      </p>
                    )}
                    
                    {exportProgress.currentFile && (
                      <p className="text-xs text-muted-foreground truncate max-w-sm">
                        File: {exportProgress.currentFile}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  Please wait while we process your {isExporting ? 'export' : 'import'}...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
