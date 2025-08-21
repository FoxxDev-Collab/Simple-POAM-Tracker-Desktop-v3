import { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Shield, Search, Save, Download, ChevronUp, ChevronDown, ChevronRight, Edit3, Check, X, AlertTriangle, Info, CheckCircle, XCircle, List, FolderOpen
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { STIGChecklist } from '../../types/stig';
import { parseMultipleSTIGChecklists, saveStpPrepList, getAllStpPrepLists, getStpPrepListById, updateStpPrepList, deleteStpPrepList, saveSTIGFile } from '../../utils/tauriApi';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import STIGPrepListManager from './STIGPrepListManager';
import STIGFileManager from './STIGFileManager';

interface FileUploadState {
  checklistFilePath: string | null;
  checklistFileName: string | null;
  checklistLoaded: boolean;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

interface StpPrepDialog {
  isOpen: boolean;
  name: string;
  description: string;
}

interface EditingStigState {
  vulnNum: string;
  field: 'status' | 'finding_details' | 'comments' | 'severity_override';
  value: string;
}

export default function STIGCenter() {
  const { currentSystem } = useSystem();
  const { addToast } = useToast();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to use STIG Center functionality.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'viewer' | 'prep-lists' | 'file-manager'>('viewer');
  const [loading, setLoading] = useState(false);
  const [fileState, setFileState] = useState<FileUploadState>({
    checklistFilePath: null,
    checklistFileName: null,
    checklistLoaded: false
  });
  const [checklist, setChecklist] = useState<STIGChecklist | null>(null);
  const [selectedVulns, setSelectedVulns] = useState<Set<string>>(new Set());
  const [expandedVulns, setExpandedVulns] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [editingStig, setEditingStig] = useState<EditingStigState | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [stpPrepLists, setStpPrepLists] = useState<any[]>([]);
  const [stpPrepDialog, setStpPrepDialog] = useState<StpPrepDialog>({
    isOpen: false,
    name: '',
    description: ''
  });

  // STIG Status options
  const STIG_STATUS_OPTIONS = [
    { value: 'Open', label: 'Open', color: 'destructive' },
    { value: 'NotAFinding', label: 'Not a Finding', color: 'success' },
    { value: 'Not_Applicable', label: 'Not Applicable', color: 'secondary' },
    { value: 'Not_Reviewed', label: 'Not Reviewed', color: 'warning' }
  ];

  const SEVERITY_OPTIONS = [
    { value: '', label: 'No Override', color: 'secondary' },
    { value: 'high', label: 'High', color: 'destructive' },
    { value: 'medium', label: 'Medium', color: 'warning' },
    { value: 'low', label: 'Low', color: 'success' }
  ];

  // Load STP prep lists
  const loadStpPrepLists = useCallback(async () => {
    try {
      const prepLists = await getAllStpPrepLists(currentSystem.id);
      setStpPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading STP prep lists:', error);
    }
  }, [currentSystem.id]);

  useEffect(() => {
    loadStpPrepLists();
  }, [loadStpPrepLists]);

  // Initialize processing steps
  const initializeProcessingSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      { id: 'parse', label: 'Parsing STIG checklist files', status: 'pending' },
      { id: 'load', label: 'Loading STIG vulnerabilities', status: 'pending' },
      { id: 'complete', label: 'Ready for review', status: 'pending' }
    ];
    setProcessingSteps(steps);
    setIsProcessingComplete(false);
  }, []);

  // Update processing step status
  const updateProcessingStep = useCallback((stepId: string, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message } : step
    ));
  }, []);

  // Handle checklist file selection
  const handleChecklistFileSelect = useCallback(async () => {
    setLoading(true);
    initializeProcessingSteps();
    
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'Checklist Files', extensions: ['ckl'] }],
        multiple: true,
      });
      
      const filePaths = Array.isArray(selected) ? selected : (selected ? [selected] : []);

      if (filePaths.length > 0) {
        console.log(`Selected ${filePaths.length} checklist file(s):`, filePaths);
        
        // Step 1: Parse files
        updateProcessingStep('parse', 'processing', `Parsing ${filePaths.length} file(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const checklistResult = await parseMultipleSTIGChecklists(filePaths);
        console.log('Parsed checklist:', checklistResult);
        
        if (!checklistResult) {
          throw new Error('Failed to parse checklist files');
        }
        
        // Handle array result from parseMultipleSTIGChecklists
        const singleChecklist = (Array.isArray(checklistResult) ? checklistResult[0] : checklistResult) as STIGChecklist;
        updateProcessingStep('parse', 'completed', `Parsed ${singleChecklist?.vulnerabilities?.length || 0} vulnerabilities`);
        
        // Step 2: Load vulnerabilities
        updateProcessingStep('load', 'processing', 'Loading STIG vulnerabilities...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setChecklist(singleChecklist);
        updateProcessingStep('load', 'completed', `Loaded ${singleChecklist?.vulnerabilities?.length || 0} vulnerabilities`);
        
        // Step 3: Save to File Manager
        updateProcessingStep('complete', 'processing', 'Saving to File Manager...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Save each uploaded file to the File Manager
        for (const filePath of filePaths) {
          try {
            const fileName = filePath.split(/[/\\]/).pop() || 'unknown.ckl';
            const now = new Date().toISOString();
            
            // Calculate compliance summary
            const totalVulns = singleChecklist.vulnerabilities.length;
            const statusCounts = singleChecklist.vulnerabilities.reduce((acc, vuln) => {
              const status = vuln.status || 'Not_Reviewed';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            const compliant = (statusCounts['NotAFinding'] || 0) + (statusCounts['Not_Applicable'] || 0);
            const compliancePercentage = totalVulns > 0 ? (compliant / totalVulns) * 100 : 0;
            
            const fileRecord = {
              id: crypto.randomUUID(),
              filename: fileName,
              file_path: filePath,
              upload_date: now,
              last_modified: now,
              version: '1',
              created_by: 'current-user', // You might want to get this from a user context
              compliance_summary: {
                total_vulns: totalVulns,
                open: statusCounts['Open'] || 0,
                not_a_finding: statusCounts['NotAFinding'] || 0,
                not_applicable: statusCounts['Not_Applicable'] || 0,
                not_reviewed: statusCounts['Not_Reviewed'] || 0,
                compliance_percentage: Math.round(compliancePercentage * 10) / 10,
                last_assessed: now
              },
              remediation_progress: {
                total_findings: statusCounts['Open'] || 0,
                remediated: statusCounts['NotAFinding'] || 0,
                in_progress: 0,
                planned: 0,
                not_planned: statusCounts['Open'] || 0
              },
              metadata: {
                stig_info: singleChecklist.stig_info || {},
                asset_info: singleChecklist.asset || {},
                status: 'active'
              },
              tags: [singleChecklist.stig_info?.title?.includes('Windows') ? 'Windows' : 'Other']
            };
            
            await saveSTIGFile(fileRecord, singleChecklist, currentSystem.id);
          } catch (error) {
            console.warn('Failed to save file to File Manager:', error);
            // Don't fail the entire upload if File Manager save fails
          }
        }
        
        updateProcessingStep('complete', 'completed', 'Ready for STIG review and prep list creation');
        
        // Update state
        setFileState({
          checklistFilePath: filePaths.join(', '),
          checklistFileName: `${filePaths.length} file(s) selected`,
          checklistLoaded: true
        });
        
        setIsProcessingComplete(true);
        setSelectedVulns(new Set()); // Reset selections
        
        const vulnCount = singleChecklist?.vulnerabilities?.length || 0;
        addToast(`Successfully loaded STIG checklist with ${vulnCount} vulnerabilities.`, 'success');
      }
    } catch (error) {
      console.error('Error processing checklist file(s):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update current processing step to error
      setProcessingSteps(prev => {
        const currentStep = prev.find(step => step.status === 'processing');
        if (currentStep) {
          return prev.map(step => 
            step.id === currentStep.id 
              ? { ...step, status: 'error', message: errorMessage }
              : step
          );
        }
        return prev;
      });
      
      addToast(`Failed to process checklist file(s): ${errorMessage}`, 'error');
      
      setChecklist(null);
      setFileState({
        checklistFilePath: null,
        checklistFileName: null,
        checklistLoaded: false
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, initializeProcessingSteps, updateProcessingStep]);

  // Handle vulnerability selection
  const handleVulnSelection = (vulnNum: string, checked: boolean) => {
    const newSelected = new Set(selectedVulns);
    if (checked) {
      newSelected.add(vulnNum);
    } else {
      newSelected.delete(vulnNum);
    }
    setSelectedVulns(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allVulnIds = new Set(filteredVulnerabilities.map(vuln => vuln.vuln_num));
      setSelectedVulns(allVulnIds);
    } else {
      setSelectedVulns(new Set());
    }
  };

  // Handle expanding/collapsing vulnerability details
  const toggleVulnExpansion = (vulnNum: string) => {
    const newExpanded = new Set(expandedVulns);
    if (newExpanded.has(vulnNum)) {
      newExpanded.delete(vulnNum);
    } else {
      newExpanded.add(vulnNum);
    }
    setExpandedVulns(newExpanded);
  };

  // Handle STIG editing
  const handleStigEdit = (vulnNum: string, field: EditingStigState['field'], currentValue: string) => {
    setEditingStig({
      vulnNum,
      field,
      value: currentValue
    });
  };

  const handleStigUpdate = () => {
    if (!editingStig || !checklist) return;

    // Find and update the STIG in the checklist
    const updatedChecklist = { ...checklist };
    const vuln = updatedChecklist.vulnerabilities.find(v => v.vuln_num === editingStig.vulnNum);
    
    if (vuln) {
      // Update the field
      switch (editingStig.field) {
        case 'status':
          vuln.status = editingStig.value;
          break;
        case 'finding_details':
          vuln.finding_details = editingStig.value;
          break;
        case 'comments':
          vuln.comments = editingStig.value;
          break;
        case 'severity_override':
          vuln.severity_override = editingStig.value || undefined;
          break;
      }

      setChecklist(updatedChecklist);
      addToast('STIG updated successfully', 'success');
    }

    setEditingStig(null);
  };

  const handleStigCancel = () => {
    setEditingStig(null);
  };

  // Handle opening STP prep dialog
  const handleOpenStpPrepDialog = useCallback(() => {
    if (!checklist || selectedVulns.size === 0) {
      addToast('Please select at least one vulnerability to create a prep list.', 'warning');
      return;
    }
    
    // Generate default name based on STIG info and selection
    const stigTitle = checklist.stig_info?.title || 'Unknown STIG';
    const defaultName = `STP Prep - ${stigTitle} - ${selectedVulns.size} vulnerabilities`;
    
    setStpPrepDialog({
      isOpen: true,
      name: defaultName,
      description: `STP prep list with ${selectedVulns.size} selected vulnerabilities from ${stigTitle}`
    });
  }, [checklist, selectedVulns.size, addToast]);

  // Handle saving STP prep list
  const handleSaveStpPrep = useCallback(async () => {
    if (!checklist || !stpPrepDialog.name.trim() || selectedVulns.size === 0) return;

    setLoading(true);
    try {
      // Get selected vulnerabilities
      const vulnsToPrep = checklist.vulnerabilities?.filter(vuln => 
        selectedVulns.has(vuln.vuln_num)
      ) || [];

      // Create STP prep data structure compatible with backend expectations
      // Since we're working with pure STIGs without NIST controls, we'll create pseudo-controls
      // where each vulnerability becomes its own "control" for compatibility
      const stpPrepData = {
        id: crypto.randomUUID(),
        name: stpPrepDialog.name.trim(),
        description: stpPrepDialog.description.trim(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        source_mapping_id: null, // No source mapping since this is direct STIG prep
        stig_info: {
          title: checklist.stig_info?.title || 'Unknown STIG',
          version: checklist.stig_info?.version || '1',
          release_info: checklist.stig_info?.release_info || 'Unknown',
          classification: checklist.stig_info?.classification || 'UNCLASSIFIED',
          description: checklist.stig_info?.description || null
        },
        asset_info: {
          asset_type: checklist.asset?.asset_type || 'Unknown',
          host_name: checklist.asset?.host_name || null,
          host_ip: checklist.asset?.host_ip || null,
          host_mac: checklist.asset?.host_mac || null,
          host_fqdn: checklist.asset?.host_fqdn || null,
          target_comment: checklist.asset?.target_comment || null
        },
        prep_status: 'ready',
        selected_controls: vulnsToPrep.map(vuln => ({
          nist_control: `STIG-${vuln.vuln_num}`, // Use STIG vuln num as pseudo-control ID
          ccis: vuln.cci_refs || [],
          stigs: [{
            vuln_num: vuln.vuln_num,
            stig_id: vuln.stig_id,
            severity: vuln.severity,
            group_title: vuln.group_title,
            rule_id: vuln.rule_id,
            rule_ver: vuln.rule_ver || 'Unknown',
            rule_title: vuln.rule_title,
            vuln_discuss: vuln.vuln_discuss || '',
            check_content: vuln.check_content || '',
            fix_text: vuln.fix_text || '',
            cci_refs: vuln.cci_refs || [],
            status: vuln.status,
            finding_details: vuln.finding_details || '',
            comments: vuln.comments || '',
            severity_override: vuln.severity_override || null,
            severity_justification: vuln.severity_justification || null
          }],
          compliance_status: vuln.status === 'NotAFinding' ? 'compliant' : 
                           vuln.status === 'Not_Applicable' ? 'not-applicable' :
                           vuln.status === 'Open' ? 'non-compliant' : 'not-reviewed',
          risk_level: vuln.severity?.toLowerCase() === 'high' ? 'high' :
                     vuln.severity?.toLowerCase() === 'medium' ? 'medium' : 'low',
          notes: `Direct STIG prep from ${checklist.stig_info?.title || 'STIG checklist'}`,
          selected_for_stp: true
        })),
        control_count: vulnsToPrep.length
      };

      // Save as STP prep list to database
      await saveStpPrepList(stpPrepData, currentSystem.id);
      
      setStpPrepDialog({ isOpen: false, name: '', description: '' });
      setSelectedVulns(new Set()); // Clear selection after saving
      
      // Refresh the prep lists
      await loadStpPrepLists();
      
      addToast(`STP prep list "${stpPrepDialog.name}" saved successfully with ${vulnsToPrep.length} vulnerabilities`, 'success');
    } catch (error) {
      console.error('Error saving STP prep list:', error);
      addToast(`Failed to save STP prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [checklist, stpPrepDialog, selectedVulns, addToast, currentSystem.id, loadStpPrepLists]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!checklist) return;

    setLoading(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      // Export updated .ckl file
      const cklFilePath = await save({
        filters: [{ name: 'Checklist Files', extensions: ['ckl'] }],
        defaultPath: `updated-checklist-${new Date().toISOString().split('T')[0]}.ckl`
      });

      if (cklFilePath) {
        await invoke('export_updated_checklist', { 
          filePath: cklFilePath,
          checklist: checklist
        });
        addToast('Updated .ckl file exported successfully', 'success');
      }

    } catch (error) {
      console.error('Error exporting checklist:', error);
      addToast(`Failed to export checklist: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [checklist, addToast]);

  // Handle deleting checklist and restarting
  const handleDeleteChecklist = useCallback(() => {
    const confirmDelete = window.confirm(
      'Are you sure you want to clear this checklist and restart?'
    );
    if (!confirmDelete) return;

    // Reset all state
    setChecklist(null);
    setFileState({
      checklistFilePath: null,
      checklistFileName: null,
      checklistLoaded: false
    });
    setSelectedVulns(new Set());
    setExpandedVulns(new Set());
    setEditingStig(null);
    setFilter('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setIsProcessingComplete(false);
    setProcessingSteps([]);
    
    addToast('Checklist cleared. Ready to load a new checklist.', 'info');
  }, [addToast]);

  // Render compliance status badge
  const renderComplianceStatus = (status: string) => {
    const getStatusConfig = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'notafinding':
        case 'not_a_finding':
          return { variant: 'success', icon: CheckCircle };
        case 'open':
          return { variant: 'destructive', icon: XCircle };
        case 'not_applicable':
        case 'not applicable':
          return { variant: 'secondary', icon: Info };
        case 'not_reviewed':
        case 'not reviewed':
        default:
          return { variant: 'outline', icon: AlertTriangle };
      }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status || 'Not Reviewed'}
      </Badge>
    );
  };

  // Filter and sort vulnerabilities
  const filteredVulnerabilities = (() => {
    if (!checklist?.vulnerabilities) return [];

    let filtered = checklist.vulnerabilities.filter(vuln => {
      // Text filter
      if (filter.trim()) {
        const searchTerm = filter.toLowerCase();
        const matchesText = (
          vuln.vuln_num?.toLowerCase().includes(searchTerm) ||
          vuln.stig_id?.toLowerCase().includes(searchTerm) ||
          vuln.rule_title?.toLowerCase().includes(searchTerm) ||
          vuln.group_title?.toLowerCase().includes(searchTerm)
        );
        if (!matchesText) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (vuln.status !== statusFilter) return false;
      }

      // Severity filter
      if (severityFilter !== 'all') {
        if (vuln.severity !== severityFilter) return false;
      }

      return true;
    });

    // Sort by severity (high to low) then by vuln_num
    return filtered.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity; // High to low
      }
      
      return (a.vuln_num || '').localeCompare(b.vuln_num || '');
    });
  })();

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">STIG Center</h1>
            <p className="text-muted-foreground">
              View and manage STIG checklists for {currentSystem.name}
            </p>
          </div>
        </div>

        <div className="button-group">
          {activeTab === 'viewer' && checklist && (
            <>
              <Button
                variant="outline" 
                onClick={handleOpenStpPrepDialog}
                disabled={loading || selectedVulns.size === 0}
                className="btn-responsive"
              >
                <Save className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Create STP Prep List</span>
                <span className="show-mobile">STP</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={loading}
                className="btn-responsive"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Export</span>
                <span className="show-mobile">Export</span>
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteChecklist}
                disabled={loading}
                className="btn-responsive"
              >
                <X className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Clear Checklist</span>
                <span className="show-mobile">Clear</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border border-border rounded-lg p-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('viewer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'viewer'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Shield className="w-4 h-4" />
            STIG Viewer
          </button>
          <button
            onClick={() => setActiveTab('prep-lists')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'prep-lists'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <List className="w-4 h-4" />
            Prep Lists
          </button>
          <button
            onClick={() => setActiveTab('file-manager')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'file-manager'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            File Manager
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'viewer' ? (
        <div className="space-y-6">
          {/* File Upload Section */}
      <div className="mb-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Upload STIG Checklist(s) (.ckl)
          </h3>
          <div className={`upload-zone ${fileState.checklistLoaded ? 'uploaded' : ''}`}>
            <div className="upload-content" onClick={handleChecklistFileSelect}>
              <Upload className="w-8 h-8 mb-2" />
              {fileState.checklistLoaded ? (
                <div className="text-center">
                  <p className="text-success font-medium"> {fileState.checklistFileName}</p>
                  <p className="text-sm text-muted-foreground">Checklist loaded</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-1 text-foreground">Click to select STIG checklist file(s)</p>
                  <p className="text-sm text-muted-foreground">Browse for .ckl file(s) - supports multiple files</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Processing Steps Animation */}
      {loading && processingSteps.length > 0 && (
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-semibold text-foreground">Processing STIG Checklist</h3>
          </div>
          <div className="space-y-3">
            {processingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                {/* Step Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.status === 'completed' 
                    ? 'bg-success/20 text-success' 
                    : step.status === 'processing'
                    ? 'bg-primary/20 text-primary'
                    : step.status === 'error'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.status === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : step.status === 'processing' ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : step.status === 'error' ? (
                    <X className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                
                {/* Step Content */}
                <div className="flex-1">
                  <div className={`font-medium ${
                    step.status === 'completed' 
                      ? 'text-success' 
                      : step.status === 'processing'
                      ? 'text-primary'
                      : step.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </div>
                  {step.message && (
                    <div className="text-sm text-muted-foreground">{step.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Complete Confirmation */}
      {isProcessingComplete && !loading && checklist && (
        <div className="mb-8 p-6 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-success/20 text-success rounded-full flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">STIG Checklist Loaded!</h3>
              <p className="text-success/90">Your STIG checklist is ready for review and editing.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Total Vulnerabilities</div>
              <div className="text-lg font-bold text-primary">
                {checklist.vulnerabilities?.length || 0}
              </div>
            </div>
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">STIG Title</div>
              <div className="text-sm font-medium text-foreground">
                {checklist.stig_info?.title || 'Unknown STIG'}
              </div>
            </div>
            <div className="bg-card border border-border p-3 rounded">
              <div className="font-medium text-foreground">Asset Type</div>
              <div className="text-sm font-medium text-foreground">
                {checklist.asset?.asset_type || 'Unknown'}
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded">
            <div className="text-sm text-primary">
              <strong>Next Steps:</strong> Review vulnerabilities below, update statuses and findings, then create STP prep lists for testing.
            </div>
          </div>
        </div>
      )}

      {/* Simple Loading State for other operations */}
      {loading && processingSteps.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {checklist && (
        <div className="space-y-6">
          {/* Selection Summary */}
          {selectedVulns.size > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    Selection Summary
                  </h3>
                  <p className="text-foreground">
                    <strong>{selectedVulns.size}</strong> vulnerability(ies) selected for prep list creation
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOpenStpPrepDialog}
                  disabled={loading}
                  className="ml-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create STP Prep List
                </Button>
              </div>
            </div>
          )}

          {/* STIG Vulnerabilities Table */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">STIG Vulnerabilities</h3>
              <div className="flex items-center gap-4">
                {/* Filters */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1 bg-background border border-input rounded text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="Open">Open</option>
                  <option value="NotAFinding">Not a Finding</option>
                  <option value="Not_Applicable">Not Applicable</option>
                  <option value="Not_Reviewed">Not Reviewed</option>
                </select>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3 py-1 bg-background border border-input rounded text-sm"
                >
                  <option value="all">All Severity</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text"
                    placeholder="Filter vulnerabilities..." 
                    className="w-full px-3 py-2 pl-10 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">
                      <input
                        type="checkbox"
                        checked={filteredVulnerabilities.length > 0 && filteredVulnerabilities.every(vuln => selectedVulns.has(vuln.vuln_num))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="mr-2"
                      />
                      Select
                    </th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Vuln ID</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">STIG ID</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Title</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Severity</th>
                    <th className="bg-muted text-foreground font-semibold p-3 text-left border-b border-border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVulnerabilities.length > 0 ? (
                    filteredVulnerabilities.map((vuln) => (
                      <>
                        <tr key={vuln.vuln_num} className="hover:bg-muted/50 transition-colors">
                          <td className="p-3 border-b border-border">
                            <input
                              type="checkbox"
                              checked={selectedVulns.has(vuln.vuln_num)}
                              onChange={(e) => handleVulnSelection(vuln.vuln_num, e.target.checked)}
                            />
                          </td>
                          <td 
                            className="font-medium cursor-pointer group p-3 border-b border-border"
                            onClick={() => toggleVulnExpansion(vuln.vuln_num)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedVulns.has(vuln.vuln_num) ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                              )}
                              <span className="text-foreground group-hover:text-primary transition-colors">
                                {vuln.vuln_num}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 border-b border-border">
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {vuln.stig_id || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 border-b border-border max-w-md">
                            <div className="truncate" title={vuln.rule_title}>
                              {vuln.rule_title || 'No title'}
                            </div>
                          </td>
                          <td className="p-3 border-b border-border">
                            <Badge variant={
                              vuln.severity?.toLowerCase() === 'high' ? 'destructive' :
                              vuln.severity?.toLowerCase() === 'medium' ? 'warning' :
                              vuln.severity?.toLowerCase() === 'low' ? 'success' : 'secondary'
                            }>
                              {vuln.severity || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="p-3 border-b border-border">
                            <div className="flex items-center gap-2">
                              {renderComplianceStatus(vuln.status)}
                              <button
                                onClick={() => handleStigEdit(vuln.vuln_num, 'status', vuln.status || 'Not_Reviewed')}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"
                                title="Edit Status"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedVulns.has(vuln.vuln_num) && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="p-0">
                              <div className="p-4 border-t border-border">
                                <div className="space-y-4">
                                  <h4 className="font-medium text-foreground">
                                    Vulnerability Details - {vuln.vuln_num}
                                  </h4>
                                  
                                  {/* Basic Info */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <span className="text-sm font-medium text-muted-foreground">Group Title:</span>
                                      <p className="text-sm text-foreground mt-1">
                                        {vuln.group_title || 'No group title available'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-sm font-medium text-muted-foreground">Rule ID:</span>
                                      <p className="text-sm text-foreground mt-1 font-mono">
                                        {vuln.rule_id || 'No rule ID available'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* CCI References */}
                                  {vuln.cci_refs && vuln.cci_refs.length > 0 && (
                                    <div>
                                      <span className="text-sm font-medium text-muted-foreground">CCI References:</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {vuln.cci_refs.map((cci: string) => (
                                          <Badge key={cci} variant="secondary" className="text-xs">
                                            {cci}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Rule Description */}
                                  {vuln.vuln_discuss && (
                                    <div>
                                      <span className="text-sm font-medium text-muted-foreground">Description:</span>
                                      <p className="text-sm text-foreground mt-1 bg-muted p-2 rounded">
                                        {vuln.vuln_discuss}
                                      </p>
                                    </div>
                                  )}

                                  {/* Check and Fix Text */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {vuln.check_content && (
                                      <div>
                                        <span className="text-sm font-medium text-muted-foreground">Check Text:</span>
                                        <p className="text-sm text-foreground mt-1 bg-muted p-2 rounded">
                                          {vuln.check_content}
                                        </p>
                                      </div>
                                    )}
                                    {vuln.fix_text && (
                                      <div>
                                        <span className="text-sm font-medium text-muted-foreground">Fix Text:</span>
                                        <p className="text-sm text-foreground mt-1 bg-muted p-2 rounded">
                                          {vuln.fix_text}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Editable Fields */}
                                  <div className="space-y-4 border-t pt-4">
                                    <h5 className="font-medium text-foreground">Editable Fields</h5>
                                    
                                    {/* Status */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-muted-foreground">Status:</span>
                                        {!(editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'status') && (
                                          <button
                                            onClick={() => handleStigEdit(vuln.vuln_num, 'status', vuln.status || 'Not_Reviewed')}
                                            className="text-xs text-primary hover:underline"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                      {editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'status' ? (
                                        <div className="flex items-center gap-2">
                                          <select
                                            value={editingStig.value}
                                            onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                                            className="px-3 py-1 bg-background border border-input rounded"
                                          >
                                            {STIG_STATUS_OPTIONS.map(option => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                          <Button size="sm" onClick={handleStigUpdate}>
                                            <Check className="w-3 h-3" />
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={handleStigCancel}>
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        renderComplianceStatus(vuln.status)
                                      )}
                                    </div>

                                    {/* Finding Details */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-muted-foreground">Finding Details:</span>
                                        {!(editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'finding_details') && (
                                          <button
                                            onClick={() => handleStigEdit(vuln.vuln_num, 'finding_details', vuln.finding_details || '')}
                                            className="text-xs text-primary hover:underline"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                      {editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'finding_details' ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editingStig.value}
                                            onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground"
                                            rows={4}
                                            placeholder="Enter finding details..."
                                          />
                                          <div className="flex items-center gap-2">
                                            <Button size="sm" onClick={handleStigUpdate}>
                                              <Check className="w-3 h-3 mr-1" />
                                              Save
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleStigCancel}>
                                              <X className="w-3 h-3 mr-1" />
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                          {vuln.finding_details || 'No finding details provided. Click edit to add details.'}
                                        </div>
                                      )}
                                    </div>

                                    {/* Comments */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-muted-foreground">Comments:</span>
                                        {!(editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'comments') && (
                                          <button
                                            onClick={() => handleStigEdit(vuln.vuln_num, 'comments', vuln.comments || '')}
                                            className="text-xs text-primary hover:underline"
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                      {editingStig?.vulnNum === vuln.vuln_num && editingStig?.field === 'comments' ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editingStig.value}
                                            onChange={(e) => setEditingStig({ ...editingStig, value: e.target.value })}
                                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground"
                                            rows={3}
                                            placeholder="Enter comments..."
                                          />
                                          <div className="flex items-center gap-2">
                                            <Button size="sm" onClick={handleStigUpdate}>
                                              <Check className="w-3 h-3 mr-1" />
                                              Save
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleStigCancel}>
                                              <X className="w-3 h-3 mr-1" />
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                          {vuln.comments || 'No comments provided. Click edit to add comments.'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {checklist.vulnerabilities?.length === 0 ? 'No vulnerabilities found in this checklist.' : 'No vulnerabilities match your filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STP Prep Dialog */}
      {stpPrepDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Save className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Create STP Prep List</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a new STP preparation list
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStpPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Prep List Name *
                </label>
                <input
                  type="text"
                  value={stpPrepDialog.name}
                  onChange={(e) => setStpPrepDialog(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Enter a descriptive name for this prep list"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={stpPrepDialog.description}
                  onChange={(e) => setStpPrepDialog(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
                  placeholder="Optional description of this prep list"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
              <Button 
                variant="outline" 
                onClick={() => setStpPrepDialog({ isOpen: false, name: '', description: '' })}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveStpPrep}
                disabled={!stpPrepDialog.name.trim() || loading}
                loading={loading}
              >
                Save STP Prep List
              </Button>
            </div>
          </div>
        </div>
      )}
        </div>
      ) : activeTab === 'prep-lists' ? (
        <STIGPrepListManager />
      ) : (
        <STIGFileManager />
      )}
    </div>
  );
}