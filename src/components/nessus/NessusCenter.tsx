import { useState, useCallback, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { 
  NessusAnalysisResult, 
  NessusFinding, 
  NessusPrepDialog as NessusPrepDialogState, 
  ProcessingStep, 
  SortField, 
  SortDirection 
} from './types';
import { 
  calculateScanSummary, 
  extractCVEs,
  getSeverityScore,
  getSeverityLabel,
  buildHostsFromFindings
} from './utils';
import { 
  getNessusScans, 
  importNessusFiles, 
  getNessusFindingsByScan, 
  saveNessusPrepList, 
  getAllNessusPrepLists, 
  deleteNessusPrepList 
} from '../../utils/tauriApi';

// Component imports
import { NessusHeader } from './NessusHeader';
import { NessusFileUpload } from './NessusFileUpload';
import { NessusPrepListManager } from './NessusPrepListManager';
import { NessusProcessingSteps } from './NessusProcessingSteps';
import { NessusSummaryCards } from './NessusSummaryCards';
import { NessusFindingsTable } from './NessusFindingsTable';
import { NessusPrepDialog } from './NessusPrepDialog';

export default function NessusCenter() {
  const { currentSystem } = useSystem();
  const { addToast } = useToast();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to use Nessus Center functionality.</p>
      </div>
    );
  }

  // State management
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<NessusAnalysisResult | null>(null);
  const [savedScans, setSavedScans] = useState<any[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [groupByCve, setGroupByCve] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [nessusPrepLists, setNessusPrepLists] = useState<any[]>([]);
  const [nessusPrepDialog, setNessusPrepDialog] = useState<NessusPrepDialogState>({
    isOpen: false,
    name: '',
    description: ''
  });

  // Load prep lists
  const loadNessusPrepLists = useCallback(async () => {
    try {
      const prepLists = await getAllNessusPrepLists(currentSystem.id);
      setNessusPrepLists(prepLists);
    } catch (error) {
      console.error('Error loading Nessus prep lists:', error);
    }
  }, [currentSystem.id]);

  // Load saved scans on mount
  useEffect(() => {
    const loadSavedScans = async () => {
      try {
        setLoading(true);
        const scans = await getNessusScans(currentSystem.id);
        setSavedScans(scans);
        
        if (scans.length > 0) {
          const mostRecent = scans[0];
          setSelectedScanId(mostRecent.id);
          
          // Load findings and hosts for the most recent scan
          const findings = await getNessusFindingsByScan(mostRecent.id, currentSystem.id);
          const hosts = buildHostsFromFindings(findings as NessusFinding[]);
          
          // Calculate comprehensive summary
          const summary = calculateScanSummary(findings as NessusFinding[], hosts);
          
          const result: NessusAnalysisResult = {
            scan_meta: mostRecent,
            findings: findings as NessusFinding[],
            hosts: hosts,
            summary
          };
          
          setAnalysisResult(result);
          setIsProcessingComplete(true);
        }
      } catch (error) {
        console.error('Error loading saved scans:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedScans();
    loadNessusPrepLists();
  }, [currentSystem.id, loadNessusPrepLists]);

  // Initialize processing steps
  const initializeProcessingSteps = useCallback(() => {
    const steps: ProcessingStep[] = [
      { id: 'parse', label: 'Parsing Nessus scan files', status: 'pending' },
      { id: 'analyze', label: 'Loading scan findings', status: 'pending' },
      { id: 'complete', label: 'Processing complete', status: 'pending' }
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

  // Handle file selection and import
  const handleNessusFileSelect = useCallback(async () => {
    setLoading(true);
    initializeProcessingSteps();
    
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'Nessus Files', extensions: ['nessus'] }],
        multiple: true,
      });
      
      const filePaths = Array.isArray(selected) ? selected : (selected ? [selected] : []);

      if (filePaths.length > 0) {
        // Step 1: Parse files
        updateProcessingStep('parse', 'processing', `Parsing ${filePaths.length} Nessus file(s)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await importNessusFiles(filePaths, currentSystem.id);
        updateProcessingStep('parse', 'completed', `Parsed ${filePaths.length} Nessus file(s)`);
        
        // Step 2: Load findings
        updateProcessingStep('analyze', 'processing', 'Loading scan findings...');
        const scans = await getNessusScans(currentSystem.id);
        setSavedScans(scans);
        
        if (scans.length > 0) {
          const latestScan = scans[0];
          setSelectedScanId(latestScan.id);
          const findings = await getNessusFindingsByScan(latestScan.id, currentSystem.id);
          const hosts = buildHostsFromFindings(findings as NessusFinding[]);
          
          const summary = calculateScanSummary(findings as NessusFinding[], hosts);
          
          const result: NessusAnalysisResult = {
            scan_meta: latestScan,
            findings: findings as NessusFinding[],
            hosts: hosts,
            summary
          };
          
          setAnalysisResult(result);
          updateProcessingStep('analyze', 'completed', `Analyzed ${findings.length} findings from ${summary.total_hosts} hosts`);
          
          // Step 3: Complete
          updateProcessingStep('complete', 'processing', 'Finalizing...');
          await new Promise(resolve => setTimeout(resolve, 200));
          updateProcessingStep('complete', 'completed', 'Ready for prep list creation');
          
          setIsProcessingComplete(true);
          setSelectedFindings(new Set());
          
          addToast(`Successfully imported and analyzed ${filePaths.length} Nessus file(s)`, 'success');
        } else {
          throw new Error('No scans found after import');
        }
      }
    } catch (error) {
      console.error('Error processing Nessus file(s):', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
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
      
      addToast(`Failed to process Nessus file(s): ${errorMessage}`, 'error');
      setAnalysisResult(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, initializeProcessingSteps, updateProcessingStep, currentSystem.id]);

  // Handle scan selection
  const handleScanSelection = useCallback(async (scanId: string) => {
    if (!scanId) return;
    
    setLoading(true);
    try {
      const selectedScan = savedScans.find(scan => scan.id === scanId);
      if (!selectedScan) throw new Error('Scan not found');
      
      const findings = await getNessusFindingsByScan(scanId, currentSystem.id);
      const hosts = buildHostsFromFindings(findings as NessusFinding[]);
      
      const summary = calculateScanSummary(findings as NessusFinding[], hosts);

      const result: NessusAnalysisResult = {
        scan_meta: selectedScan,
        findings: findings as NessusFinding[],
        hosts: hosts,
        summary
      };
      
      setAnalysisResult(result);
      setSelectedScanId(scanId);
      setSelectedFindings(new Set());
      setExpandedFindings(new Set());
      
      addToast(`Loaded scan: ${selectedScan.name}`, 'success');
    } catch (error) {
      console.error('Error loading scan:', error);
      addToast(`Failed to load scan: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [savedScans, currentSystem.id, addToast]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle selection
  const handleFindingSelection = (findingId: string, checked: boolean) => {
    const newSelected = new Set(selectedFindings);
    if (checked) {
      newSelected.add(findingId);
    } else {
      newSelected.delete(findingId);
    }
    setSelectedFindings(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!analysisResult?.findings) return;
    
    if (checked) {
      const allFindingIds = new Set(analysisResult.findings.map(finding => finding.id));
      setSelectedFindings(allFindingIds);
    } else {
      setSelectedFindings(new Set());
    }
  };

  // Handle expansion
  const handleToggleFindingExpansion = (findingId: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(findingId)) {
      newExpanded.delete(findingId);
    } else {
      newExpanded.add(findingId);
    }
    setExpandedFindings(newExpanded);
  };

  // Handle prep list creation
  const handleOpenNessusPrepDialog = useCallback(() => {
    if (!analysisResult || selectedFindings.size === 0) {
      addToast('Please select at least one finding to create a prep list.', 'warning');
      return;
    }
    
    const scanTitle = analysisResult.scan_meta?.name || 'Unknown Scan';
    const defaultName = `Nessus Prep - ${scanTitle} - ${selectedFindings.size} findings`;
    
    setNessusPrepDialog({
      isOpen: true,
      name: defaultName,
      description: `Vulnerability prep list with ${selectedFindings.size} selected findings from ${scanTitle}`
    });
  }, [analysisResult, selectedFindings.size, addToast]);

  const handleSaveNessusPrep = useCallback(async () => {
    if (!analysisResult || !nessusPrepDialog.name.trim() || selectedFindings.size === 0) return;

    setLoading(true);
    try {
      // Get selected findings
      const findingsToPrep = analysisResult.findings?.filter(finding => 
        selectedFindings.has(finding.id)
      ) || [];

      // Group findings by CVE for milestone creation
      const cveGroups = new Map<string, NessusFinding[]>();
      const milestones: any[] = [];
      
      findingsToPrep.forEach(finding => {
        const cves = extractCVEs(finding.cve);
        if (cves.length === 0) {
          const key = 'No CVE';
          const arr = cveGroups.get(key) ?? [];
          arr.push(finding);
          cveGroups.set(key, arr);
        } else {
          cves.forEach(cve => {
            const key = cve.trim();
            const arr = cveGroups.get(key) ?? [];
            arr.push(finding);
            cveGroups.set(key, arr);
          });
        }
      });

      // Create milestones for each CVE group
      cveGroups.forEach((findings, cve) => {
        if (cve !== 'No CVE' && findings.length > 0) {
          const maxSeverity = Math.max(...findings.map(f => getSeverityScore(f.severity, f.risk_factor)));
          const affectedHosts = Array.from(new Set(findings.map(f => f.host || f.ip_address).filter(Boolean)));
          
          milestones.push({
            id: crypto.randomUUID(),
            title: `Remediate ${cve}`,
            description: `Address ${cve} affecting ${findings.length} finding(s) on ${affectedHosts.length} host(s)`,
            cve_id: cve,
            priority: getSeverityLabel(maxSeverity).toLowerCase(),
            severity: getSeverityLabel(maxSeverity),
            affected_hosts: affectedHosts,
            finding_count: findings.length,
            type: 'cve_remediation',
            status: 'pending',
            created_date: new Date().toISOString(),
            target_date: new Date(Date.now() + (maxSeverity >= 3 ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString(),
            related_findings: findings.map(f => f.id),
            notes: `CVE identified in Nessus scan: ${analysisResult.scan_meta?.name || 'Unknown scan'}`
          });
        }
      });

      // Create Nessus prep data structure with CVE-based milestones
      const nessusPrepData = {
        id: crypto.randomUUID(),
        name: nessusPrepDialog.name.trim(),
        description: nessusPrepDialog.description.trim(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        source_scan_id: analysisResult.scan_meta.id,
        scan_info: analysisResult.scan_meta || {},
        asset_info: {
          total_hosts: analysisResult.summary.total_hosts,
          scan_name: analysisResult.scan_meta.name
        },
        prep_status: 'ready',
        selected_findings: findingsToPrep.map(finding => ({
          id: finding.id,
          plugin_id: finding.plugin_id,
          plugin_name: finding.plugin_name,
          severity: finding.severity,
          risk_factor: finding.risk_factor,
          cve: finding.cve,
          cvss_score: finding.cvss_base_score,
          host: finding.host,
          port: finding.port,
          synopsis: finding.synopsis,
          solution: finding.solution,
          exploit_available: finding.exploit_available
        })),
        finding_count: findingsToPrep.length,
        milestones: milestones,
        cve_analysis: {
          total_cves: cveGroups.size - (cveGroups.has('No CVE') ? 1 : 0),
          critical_cves: milestones.filter(m => m.priority === 'critical').length,
          high_cves: milestones.filter(m => m.priority === 'high').length,
          medium_cves: milestones.filter(m => m.priority === 'medium').length,
          low_cves: milestones.filter(m => m.priority === 'low').length,
          exploitable_cves: milestones.filter(m => m.related_findings.some((fId: string) => 
            findingsToPrep.find(f => f.id === fId)?.exploit_available
          )).length
        },
        summary: {
          critical: findingsToPrep.filter(f => getSeverityScore(f.severity, f.risk_factor) === 4).length,
          high: findingsToPrep.filter(f => getSeverityScore(f.severity, f.risk_factor) === 3).length,
          medium: findingsToPrep.filter(f => getSeverityScore(f.severity, f.risk_factor) === 2).length,
          low: findingsToPrep.filter(f => getSeverityScore(f.severity, f.risk_factor) === 1).length,
        }
      };

      await saveNessusPrepList(nessusPrepData, currentSystem.id);
      
      setNessusPrepDialog({ isOpen: false, name: '', description: '' });
      setSelectedFindings(new Set());
      await loadNessusPrepLists();
      
      const cveCount = nessusPrepData.cve_analysis.total_cves;
      addToast(`Nessus prep list "${nessusPrepDialog.name}" saved successfully with ${findingsToPrep.length} findings and ${cveCount} CVE milestones`, 'success');
    } catch (error) {
      console.error('Error saving Nessus prep list:', error);
      addToast(`Failed to save prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [analysisResult, nessusPrepDialog, selectedFindings, addToast, currentSystem.id, loadNessusPrepLists]);

  // Handle prep list management (placeholder implementations)
  const handleViewNessusPrepList = useCallback(async (id: string) => {
    // TODO: Implement view functionality
    console.log('View prep list:', id);
  }, []);

  const handleEditNessusPrepList = useCallback((prepList: any) => {
    // TODO: Implement edit functionality
    console.log('Edit prep list:', prepList);
  }, []);

  const handleDeleteNessusPrepList = useCallback(async (id: string, name: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the prep list "${name}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteNessusPrepList(id, currentSystem.id);
      await loadNessusPrepLists();
      addToast(`Prep list "${name}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting prep list:', error);
      addToast(`Failed to delete prep list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, currentSystem.id, loadNessusPrepLists]);

  const handleOpenPrepManager = useCallback(() => {
    // TODO: Implement prep manager modal
    console.log('Open prep manager');
  }, []);

  // Handle other actions (placeholder implementations)
  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    console.log('Export analysis');
  }, []);

  const handleDeleteAnalysis = useCallback(() => {
    const confirmDelete = window.confirm('Are you sure you want to delete this analysis?');
    if (!confirmDelete) return;

    setAnalysisResult(null);
    setSelectedFindings(new Set());
    setExpandedFindings(new Set());
    setFilter('');
    setIsProcessingComplete(false);
    setProcessingSteps([]);
    
    addToast('Analysis deleted. Ready to start a new analysis.', 'info');
  }, [addToast]);

  const toggleCveGrouping = () => {
    setGroupByCve(!groupByCve);
  };

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <NessusHeader
        currentSystemName={currentSystem.name}
        hasResults={!!analysisResult}
        loading={loading}
        onOpenPrepDialog={handleOpenNessusPrepDialog}
        onExport={handleExport}
        onDeleteMapping={handleDeleteAnalysis}
      />

      {/* File Upload Section */}
      <NessusFileUpload
        loading={loading}
        savedScans={savedScans}
        selectedScanId={selectedScanId}
        onFileSelect={handleNessusFileSelect}
        onScanSelection={handleScanSelection}
      />

      {/* Prep List Manager */}
      <NessusPrepListManager
        prepLists={nessusPrepLists}
        onViewPrepList={handleViewNessusPrepList}
        onEditPrepList={handleEditNessusPrepList}
        onDeletePrepList={handleDeleteNessusPrepList}
        onOpenManager={handleOpenPrepManager}
      />

      {/* Processing Steps */}
      <NessusProcessingSteps
        loading={loading}
        processingSteps={processingSteps}
        isProcessingComplete={isProcessingComplete}
      />

      {/* Results Section */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <NessusSummaryCards
            summary={analysisResult.summary}
            selectedCount={selectedFindings.size}
            onCreatePrepList={handleOpenNessusPrepDialog}
          />

          {/* Findings Table */}
          <NessusFindingsTable
            findings={analysisResult.findings}
            hosts={analysisResult.hosts}
            selectedFindings={selectedFindings}
            expandedFindings={expandedFindings}
            filter={filter}
            sortField={sortField}
            sortDirection={sortDirection}
            groupByCve={groupByCve}
            onFindingSelection={handleFindingSelection}
            onSelectAll={handleSelectAll}
            onToggleExpansion={handleToggleFindingExpansion}
            onFilterChange={setFilter}
            onSort={handleSort}
            onToggleCveGrouping={toggleCveGrouping}
            onCreatePrepList={handleOpenNessusPrepDialog}
          />
        </div>
      )}

      {/* Prep Dialog */}
      <NessusPrepDialog
        dialog={nessusPrepDialog}
        loading={loading}
        onClose={() => setNessusPrepDialog({ isOpen: false, name: '', description: '' })}
        onSave={handleSaveNessusPrep}
        onNameChange={(name) => setNessusPrepDialog(prev => ({ ...prev, name }))}
        onDescriptionChange={(description) => setNessusPrepDialog(prev => ({ ...prev, description }))}
      />
    </div>
  );
}