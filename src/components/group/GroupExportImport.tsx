import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useToast } from '../../context/ToastContext';

// Import TestCase interface
interface TestCase {
  id: string;
  nist_control: string;
  cci_ref: string;
  stig_vuln_id: string;
  test_description: string;
  test_procedure: string;
  expected_result: string;
  actual_result?: string;
  status: 'Not Started' | 'In Progress' | 'Passed' | 'Failed' | 'Not Applicable';
  stig_compliance_status?: 'Open' | 'NotAFinding' | 'Not_Applicable' | 'Not_Reviewed';
  notes?: string;
  evidence_files?: string[];
  tested_by?: string;
  tested_date?: string;
  risk_rating: 'Low' | 'Medium' | 'High' | 'Critical';
}

// POAM interface
interface POAM {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  [key: string]: any; // Allow for additional properties
}
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
  const [isExportingReport, setIsExportingReport] = useState(false);

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

  const handleGroupReportExport = async () => {
    try {
      setIsExportingReport(true);

      const exportPath = await save({
        filters: [{
          name: 'HTML Files',
          extensions: ['html']
        }],
        defaultPath: `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_Professional_Report_${new Date().toISOString().split('T')[0]}.html`
      });

      if (!exportPath) {
        setIsExportingReport(false);
        return;
      }

      // Generate the professional HTML report
      await generateGroupProfessionalReport(exportPath);

      showToast('success', `Group professional report generated successfully at ${exportPath}`);

      // Open the report
      await invoke('open_file', { path: exportPath });

    } catch (error) {
      console.error('Group report export error:', error);
      showToast('error', `Failed to export group report: ${error}`);
    } finally {
      setIsExportingReport(false);
    }
  };

  const generateGroupProfessionalReport = async (savePath: string) => {
    try {
      // Fetch comprehensive data for all systems in the group
      const systemDataPromises = systems.map(async (system) => {
        try {
          const [poams, notes, stigMappings, testPlans, groupPoams] = await Promise.all([
            invoke<any[]>('get_all_poams', { systemId: system.id }).catch(() => []),
            invoke<any[]>('get_all_notes', { systemId: system.id }).catch(() => []),
            invoke<any[]>('get_all_stig_mappings', { systemId: system.id }).catch(() => []),
            invoke<any[]>('get_all_security_test_plans', { systemId: system.id }).catch(() => []),
            invoke<any[]>('get_group_poams', { groupId }).catch(() => [])
          ]);

          return {
            system,
            poams: poams || [],
            notes: notes || [],
            stigMappings: stigMappings || [],
            testPlans: testPlans || [],
            groupPoams: groupPoams || []
          };
        } catch (error) {
          console.error(`Error loading data for system ${system.name}:`, error);
          return {
            system,
            poams: [],
            notes: [],
            stigMappings: [],
            testPlans: [],
            groupPoams: []
          };
        }
      });

      const systemsData = await Promise.all(systemDataPromises);
      
      // Aggregate all data
      const allPoams = systemsData.flatMap(sd => sd.poams);
      const allGroupPoams = systemsData.length > 0 ? systemsData[0].groupPoams : [];
      const allNotes = systemsData.flatMap(sd => sd.notes);
      const allStigMappings = systemsData.flatMap(sd => sd.stigMappings);
      const allTestPlans = systemsData.flatMap(sd => sd.testPlans);

      // Generate the HTML report with group-specific data
      const reportHtml = generateGroupReportHTML(
        systemsData,
        allPoams,
        allGroupPoams,
        allNotes,
        allStigMappings,
        allTestPlans
      );

      // Write the HTML file
      await invoke('write_file', {
        path: savePath,
        content: reportHtml
      });

    } catch (error) {
      console.error('Error generating group professional report:', error);
      throw error;
    }
  };

  const generateGroupReportHTML = (
    systemsData: any[],
    allPoams: any[],
    allGroupPoams: any[],
    allNotes: any[],
    allStigMappings: any[],
    allTestPlans: any[]
  ): string => {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const reportTime = now.toLocaleTimeString('en-US');

    // Calculate comprehensive group statistics
    const totalSystems = systemsData.length;
    const totalSystemPoams = allPoams.length;
    const totalGroupPoams = allGroupPoams.length;
    const totalPoams = totalSystemPoams + totalGroupPoams;
    const totalNotes = allNotes.length;
    const totalStigMappings = allStigMappings.length;
    const totalTestPlans = allTestPlans.length;

    // Calculate combined POAM statistics
    const combinedPoams = [
      ...allPoams,
      ...allGroupPoams.map(gp => ({
        ...gp,
        startDate: gp.start_date,
        endDate: gp.end_date,
        riskLevel: gp.risk_level,
        milestones: gp.milestones || []
      }))
    ];

    const statusCounts = combinedPoams.reduce((counts, poam) => {
      counts[poam.status] = (counts[poam.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const priorityCounts = combinedPoams.reduce((counts, poam) => {
      counts[poam.priority] = (counts[poam.priority] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const riskCounts = combinedPoams.reduce((counts, poam) => {
      const risk = poam.riskLevel || poam.risk_level;
      counts[risk] = (counts[risk] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Calculate STIG compliance statistics
    let totalControls = 0;
    let compliantControls = 0;
    let nonCompliantControls = 0;
    let highRiskFindings = 0;

    allStigMappings.forEach(mapping => {
      if (mapping.mapping_result?.summary) {
        totalControls += mapping.mapping_result.summary.total_controls || 0;
        compliantControls += mapping.mapping_result.summary.compliant_controls || 0;
        nonCompliantControls += mapping.mapping_result.summary.non_compliant_controls || 0;
        highRiskFindings += mapping.mapping_result.summary.high_risk_findings || 0;
      }
    });

    // Calculate Security Test Plan statistics
    let totalTestCases = 0;
    let passedTests = 0;
    let failedTests = 0;
    let evidenceCollected = 0;

    allTestPlans.forEach(plan => {
      if (plan.test_cases) {
        totalTestCases += plan.test_cases.length;
        passedTests += plan.test_cases.filter((tc: TestCase) => tc.status === 'Passed').length;
        failedTests += plan.test_cases.filter((tc: TestCase) => tc.status === 'Failed').length;
        evidenceCollected += plan.test_cases.filter((tc: TestCase) => tc.evidence_files && tc.evidence_files.length > 0).length;
      }
    });

    // Calculate group security scores
    const systemScores = systemsData.map(sd => {
      const systemPoams = sd.poams;
      const openPoams = systemPoams.filter((p: POAM) => p.status !== 'Completed' && p.status !== 'Closed');
      const criticalPoams = openPoams.filter((p: POAM) => p.priority === 'Critical').length;
      const highPoams = openPoams.filter((p: POAM) => p.priority === 'High').length;
      
      let score = 100;
      score -= (criticalPoams * 15) + (highPoams * 10) + (openPoams.length * 2);
      
      return {
        system: sd.system,
        score: Math.max(0, Math.min(100, Math.round(score))),
        poamCount: systemPoams.length,
        openPoams: openPoams.length,
        criticalPoams,
        highPoams
      };
    });

    const avgSecurityScore = systemScores.length > 0 ? 
      Math.round(systemScores.reduce((sum, s) => sum + s.score, 0) / systemScores.length) : 0;

    // Helper function to generate progress bars
    const generateProgressBar = (percentage: number, color: string = '#0066cc') => {
      return `
        <div class="progress-bar-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
          </div>
          <span class="progress-text">${percentage}%</span>
        </div>
      `;
    };

    // Generate donut charts
    const generateDonutChart = (data: Array<{label: string, value: number, color: string}>, title: string) => {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      if (total === 0) return `<div class="chart-placeholder">No data available for ${title}</div>`;
      
      let currentAngle = 0;
      const radius = 80;
      const centerX = 100;
      const centerY = 100;
      
      const paths = data.map(item => {
        const angle = (item.value / total) * 360;
        const endAngle = currentAngle + angle;
        
        const x1 = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
        const y1 = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);
        const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
        const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        
        const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        currentAngle = endAngle;
        
        return `<path d="${pathData}" fill="${item.color}" stroke="#fff" stroke-width="2"/>`;
      }).join('');
      
      const legend = data.map(item => `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${item.color};"></div>
          <span>${item.label}: ${item.value} (${Math.round((item.value / total) * 100)}%)</span>
        </div>
      `).join('');
      
      return `
        <div class="chart-container">
          <h4 class="chart-title">${title}</h4>
          <div class="chart-content">
            <svg viewBox="0 0 200 200" class="donut-chart">
              ${paths}
              <circle cx="100" cy="100" r="45" fill="white"/>
              <text x="100" y="95" text-anchor="middle" class="chart-center-text">${total}</text>
              <text x="100" y="110" text-anchor="middle" class="chart-center-label">Total</text>
            </svg>
            <div class="chart-legend">
              ${legend}
            </div>
          </div>
        </div>
      `;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Professional Report - ${groupName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 30px rgba(0,0,0,0.1);
            border-radius: 12px;
            margin-top: 20px;
            margin-bottom: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
            pointer-events: none;
        }
        
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
        }
        
        .header .group-name {
            font-size: 1.8em;
            font-weight: 300;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
        }
        
        .date-info {
            font-size: 1em;
            opacity: 0.8;
            position: relative;
            z-index: 1;
        }
        
        .executive-summary {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 40px;
            border-left: 6px solid #667eea;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .executive-summary h2 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.6em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .executive-summary p {
            margin-bottom: 15px;
            font-size: 1.1em;
            line-height: 1.7;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 25px;
            margin: 40px 0;
        }
        
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        
        .stat-number {
            font-size: 2.8em;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
            display: block;
        }
        
        .stat-label {
            color: #6b7280;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.9em;
            letter-spacing: 0.5px;
        }
        
        .section {
            margin: 50px 0;
        }
        
        .section h2 {
            color: #667eea;
            border-bottom: 3px solid #e5e7eb;
            padding-bottom: 15px;
            margin-bottom: 30px;
            font-size: 1.8em;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin: 40px 0;
        }
        
        .chart-container {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border: 1px solid #e5e7eb;
        }
        
        .chart-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 20px;
            color: #374151;
            text-align: center;
        }
        
        .chart-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }
        
        .donut-chart {
            width: 200px;
            height: 200px;
        }
        
        .chart-center-text {
            font-size: 18px;
            font-weight: bold;
            fill: #374151;
        }
        
        .chart-center-label {
            font-size: 12px;
            fill: #6b7280;
        }
        
        .chart-legend {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9em;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            flex-shrink: 0;
        }
        
        .chart-placeholder {
            text-align: center;
            color: #6b7280;
            font-style: italic;
            padding: 40px;
        }
        
        .system-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border: 1px solid #e5e7eb;
        }
        
        .system-table th, .system-table td {
            padding: 15px 12px;
            text-align: left;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .system-table th {
            background: linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%);
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }
        
        .system-table tr:hover {
            background-color: #f9fafb;
        }
        
        .progress-bar-container {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }
        
        .progress-bar-bg {
            flex: 1;
            height: 20px;
            background-color: #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
        }
        
        .progress-bar-fill {
            height: 100%;
            border-radius: 10px;
            transition: width 0.3s ease;
            background: linear-gradient(90deg, #10b981, #34d399);
        }
        
        .progress-text {
            font-size: 0.8em;
            font-weight: 600;
            color: #374151;
            min-width: 35px;
        }
        
        .group-section {
            background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
            border-left: 6px solid #8b5cf6;
        }
        
        .group-section h3 {
            color: #8b5cf6;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .footer {
            margin-top: 60px;
            padding: 30px 0;
            border-top: 3px solid #e5e7eb;
            text-align: center;
            background: linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%);
            border-radius: 12px;
        }
        
        .footer h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .footer p {
            color: #6b7280;
            font-size: 0.9em;
            margin: 5px 0;
        }
        
        @media print {
            body { background: white; }
            .container { box-shadow: none; margin: 0; padding: 15px; }
            .section { page-break-inside: avoid; }
            .chart-container { page-break-inside: avoid; }
            .header { page-break-after: avoid; }
        }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
            .charts-grid { grid-template-columns: 1fr; }
            .container { margin: 10px; padding: 15px; }
            .header h1 { font-size: 2em; }
            .header .group-name { font-size: 1.3em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 Group Professional Report</h1>
            <div class="group-name">${groupName}</div>
            <div class="subtitle">Comprehensive Security and Compliance Analysis</div>
            <div class="date-info">Generated on ${reportDate} at ${reportTime}</div>
        </div>
        
        <div class="executive-summary">
            <h2>📊 Executive Summary</h2>
            <p>This comprehensive report provides a detailed analysis of all security assets, Plan of Action and Milestones (POAMs), STIG compliance mappings, and security testing progress across <strong>${totalSystems} systems</strong> in the <strong>${groupName}</strong> group. The report includes visual analytics, progress tracking, and compliance metrics to support informed decision-making and security governance.</p>
            <p><strong>📈 Group Overview:</strong> ${totalSystems} systems with ${totalPoams} total POAMs (${totalSystemPoams} system-level, ${totalGroupPoams} group-level)</p>
            <p><strong>🔒 Security Posture:</strong> Average security score of ${avgSecurityScore}% across all systems</p>
            <p><strong>📊 Compliance Status:</strong> ${totalControls} STIG controls mapped with ${Math.round((compliantControls / Math.max(totalControls, 1)) * 100)}% compliance rate</p>
            <p><strong>🧪 Testing Progress:</strong> ${totalTestCases} test cases executed with ${Math.round((passedTests / Math.max(totalTestCases, 1)) * 100)}% pass rate</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${totalSystems}</div>
                <div class="stat-label">Systems in Group</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalPoams}</div>
                <div class="stat-label">Total POAMs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalNotes}</div>
                <div class="stat-label">Documentation Items</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalStigMappings}</div>
                <div class="stat-label">STIG Mappings</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalTestPlans}</div>
                <div class="stat-label">Security Test Plans</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${avgSecurityScore}%</div>
                <div class="stat-label">Avg Security Score</div>
            </div>
        </div>
        
        <div class="charts-grid">
            ${generateDonutChart([
              { label: 'Completed', value: statusCounts['Completed'] || 0, color: '#10b981' },
              { label: 'In Progress', value: statusCounts['In Progress'] || 0, color: '#f59e0b' },
              { label: 'Not Started', value: statusCounts['Not Started'] || 0, color: '#ef4444' },
              { label: 'On Hold', value: statusCounts['On Hold'] || 0, color: '#6b7280' }
            ], 'Combined POAM Status Distribution')}
            
            ${generateDonutChart([
              { label: 'High', value: priorityCounts['High'] || 0, color: '#dc2626' },
              { label: 'Medium', value: priorityCounts['Medium'] || 0, color: '#f59e0b' },
              { label: 'Low', value: priorityCounts['Low'] || 0, color: '#10b981' },
              { label: 'Critical', value: priorityCounts['Critical'] || 0, color: '#7c2d12' }
            ], 'Priority Distribution')}
            
            ${generateDonutChart([
              { label: 'High Risk', value: riskCounts['High'] || 0, color: '#dc2626' },
              { label: 'Medium Risk', value: riskCounts['Medium'] || 0, color: '#f59e0b' },
              { label: 'Low Risk', value: riskCounts['Low'] || 0, color: '#10b981' },
              { label: 'Critical Risk', value: riskCounts['Critical'] || 0, color: '#7c2d12' }
            ], 'Risk Level Distribution')}
            
            ${totalControls > 0 ? generateDonutChart([
              { label: 'Compliant', value: compliantControls, color: '#10b981' },
              { label: 'Non-Compliant', value: nonCompliantControls, color: '#ef4444' },
              { label: 'Not Reviewed', value: totalControls - compliantControls - nonCompliantControls, color: '#f59e0b' }
            ], 'Group STIG Compliance Status') : ''}
        </div>
        
        ${totalGroupPoams > 0 ? `
        <div class="section">
            <h2>🎯 Group-Level POAMs</h2>
            <div class="group-section">
                <h3>Cross-System Security Issues</h3>
                <p>These POAMs address security concerns that span multiple systems within the group, requiring coordinated remediation efforts.</p>
            </div>
            <table class="system-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Risk Level</th>
                        <th>Affected Systems</th>
                        <th>Due Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${allGroupPoams.map(poam => `
                        <tr>
                            <td><strong>#${poam.id}</strong></td>
                            <td>
                                <strong>${poam.title}</strong>
                                <br><small style="color: #6b7280;">${poam.description.substring(0, 100)}${poam.description.length > 100 ? '...' : ''}</small>
                            </td>
                            <td><span style="padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 600; ${
                              poam.status === 'Completed' ? 'background: #dcfce7; color: #16a34a;' :
                              poam.status === 'In Progress' ? 'background: #fef3c7; color: #d97706;' :
                              'background: #fee2e2; color: #dc2626;'
                            }">${poam.status}</span></td>
                            <td><span style="padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 600; ${
                              poam.priority === 'Critical' ? 'background: #7c2d12; color: white;' :
                              poam.priority === 'High' ? 'background: #dc2626; color: white;' :
                              poam.priority === 'Medium' ? 'background: #f59e0b; color: white;' :
                              'background: #10b981; color: white;'
                            }">${poam.priority}</span></td>
                            <td><span style="color: ${
                              poam.risk_level === 'Critical' ? '#7c2d12' :
                              poam.risk_level === 'High' ? '#dc2626' :
                              poam.risk_level === 'Medium' ? '#f59e0b' :
                              '#10b981'
                            }; font-weight: 600;">${poam.risk_level}</span></td>
                            <td>${poam.affected_systems?.length || 0} systems</td>
                            <td>${new Date(poam.end_date).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="section">
            <h2>🖥️ System-Level Analysis</h2>
            <table class="system-table">
                <thead>
                    <tr>
                        <th>System</th>
                        <th>POAMs</th>
                        <th>Security Score</th>
                        <th>Critical Issues</th>
                        <th>STIG Mappings</th>
                        <th>Test Plans</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${systemScores.map(sysScore => `
                        <tr>
                            <td>
                                <strong>${sysScore.system.name}</strong>
                                ${sysScore.system.description ? `<br><small style="color: #6b7280;">${sysScore.system.description}</small>` : ''}
                            </td>
                            <td>
                                <div style="font-weight: 600;">${sysScore.poamCount}</div>
                                <small style="color: #6b7280;">${sysScore.openPoams} open</small>
                            </td>
                            <td>
                                ${generateProgressBar(sysScore.score, sysScore.score >= 80 ? '#10b981' : sysScore.score >= 60 ? '#f59e0b' : '#ef4444')}
                            </td>
                            <td>
                                <span style="font-weight: 600; color: ${sysScore.criticalPoams > 0 ? '#dc2626' : '#10b981'};">
                                    ${sysScore.criticalPoams} Critical
                                </span>
                                <br><small style="color: #6b7280;">${sysScore.highPoams} High</small>
                            </td>
                            <td>${systemsData.find(sd => sd.system.id === sysScore.system.id)?.stigMappings.length || 0}</td>
                            <td>${systemsData.find(sd => sd.system.id === sysScore.system.id)?.testPlans.length || 0}</td>
                            <td>${systemsData.find(sd => sd.system.id === sysScore.system.id)?.notes.length || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        ${totalStigMappings > 0 ? `
        <div class="section">
            <h2>🔒 Group STIG Compliance Overview</h2>
            <div class="group-section">
                <h3>Security Controls Summary</h3>
                <p><strong>Total Controls:</strong> ${totalControls} | <strong>Compliant:</strong> ${compliantControls} | <strong>Non-Compliant:</strong> ${nonCompliantControls} | <strong>High Risk Findings:</strong> ${highRiskFindings}</p>
                <p>Compliance Rate: <strong>${Math.round((compliantControls / Math.max(totalControls, 1)) * 100)}%</strong></p>
            </div>
        </div>
        ` : ''}
        
        ${totalTestPlans > 0 ? `
        <div class="section">
            <h2>🧪 Group Security Testing Overview</h2>
            <div class="group-section">
                <h3>Testing Progress Summary</h3>
                <p><strong>Total Test Cases:</strong> ${totalTestCases} | <strong>Passed:</strong> ${passedTests} | <strong>Failed:</strong> ${failedTests} | <strong>Evidence Collected:</strong> ${evidenceCollected}</p>
                <p>Pass Rate: <strong>${Math.round((passedTests / Math.max(totalTestCases, 1)) * 100)}%</strong></p>
            </div>
        </div>
        ` : ''}
        
        <div class="footer">
            <h3>🏢 Group Professional Report</h3>
            <p><strong>Group:</strong> ${groupName} | <strong>Generated:</strong> ${reportDate} ${reportTime}</p>
            <p>Report includes ${totalSystems} systems, ${totalPoams} POAMs, ${totalStigMappings} STIG mappings, and ${totalTestPlans} security test plans</p>
            <p style="margin-top: 15px; font-size: 0.8em; color: #9ca3af;">
                This report contains sensitive security information and should be handled according to your organization's data classification policies.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
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

      {/* Professional Report Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Generate Professional Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a comprehensive HTML report with executive summary, visual charts, and detailed analysis across all group systems. Perfect for presentations and compliance documentation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Executive-ready summary
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Interactive visual charts
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Group and system metrics
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              STIG compliance analysis
            </div>
          </div>
          <Button
            onClick={handleGroupReportExport}
            disabled={!canExport || isExportingReport}
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isExportingReport ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>Generating Professional Report...</span>
              </div>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate Professional Report (HTML)
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
