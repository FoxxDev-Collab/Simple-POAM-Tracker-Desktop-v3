import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Download, Upload, CheckCircle, AlertCircle, FileText, BarChart3, Users, FileSpreadsheet, Shield, Settings, HardDrive, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { useNotificationGenerator } from '../../hooks/useNotificationGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

// Add interfaces for the data types
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

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  folder?: string;
  tags?: string[];
  poam_ids?: number[];
  poam_titles?: string[];
}

interface STIGMapping {
  id: string;
  name: string;
  stig_info?: {
    title?: string;
    version?: string;
  };
  mapping_result?: {
    summary?: {
      total_controls?: number;
      compliant_controls?: number;
      non_compliant_controls?: number;
      high_risk_findings?: number;
      medium_risk_findings?: number;
      low_risk_findings?: number;
    };
  };
}

interface TestCase {
  id: string;
  status: string;
  evidence_files?: string[];
}

interface SecurityTestPlan {
  id: string;
  name: string;
  description?: string;
  status: string;
  updated_date: string;
  test_cases?: TestCase[];
}

export default function ImportExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const [exportType, setExportType] = useState<'poams' | 'stig' | 'stp' | 'system-backup'>('poams');
  const { showToast } = useToast();
  const { currentSystem } = useSystem();
  const { notifySystemEvent } = useNotificationGenerator();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to use Import/Export functionality.</p>
      </div>
    );
  }

  // Enhanced export options
  const exportOptions = [
    {
      id: 'poams',
      title: 'POAMs & Notes',
      description: 'Export POAMs, milestones, and notes',
      icon: FileText,
      color: 'blue',
      includes: ['POAMs with complete metadata', 'All milestones and deadlines', 'Notes and associations']
    },
    {
      id: 'stig',
      title: 'STIG Mappings',
      description: 'Export STIG mappings and compliance data',
      icon: Shield,
      color: 'green',
      includes: ['STIG mapping configurations', 'Compliance status data', 'Security control mappings']
    },
    {
      id: 'stp',
      title: 'Security Test Plans',
      description: 'Export security test plans and results',
      icon: Settings,
      color: 'purple',
      includes: ['Test plan configurations', 'Test case results', 'Evidence and documentation']
    },
    {
      id: 'system-backup',
      title: 'Complete System Backup',
      description: 'Export everything - full system backup with evidence files',
      icon: HardDrive,
      color: 'red',
      includes: ['All POAMs, milestones, and notes', 'STIG mappings and compliance data', 'Security test plans and results', 'NIST Control associations', 'All evidence files and attachments', 'Complete system configuration']
    }
  ];

  const handleJSONImport = async () => {
    try {
      setIsImporting(true);
      
      // Open file dialog
      const file = await open({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!file) return;

      await invoke('import_json_file', { 
        filePath: file as string,
        systemId: currentSystem.id 
      });
      
      showToast('success', 'Data imported successfully');
      
      // Notify about successful import
      notifySystemEvent({
        type: 'import',
        message: `Data imported successfully from JSON file`,
        success: true,
        details: `Imported to system: ${currentSystem.name}`
      });

      // Reload to show new data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Import error:', error);
      showToast('error', `Import failed: ${error}`);
      
      // Notify about import failure
      notifySystemEvent({
        type: 'import',
        message: `Data import failed`,
        success: false,
        details: String(error)
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportPOAMs = async () => {
    try {
      setIsExporting(true);
      setExportProgress(10);
      
      // Show save dialog
      const savePath = await save({
        filters: [{
          name: 'JSON Files',
          extensions: ['json']
        }],
        defaultPath: `${currentSystem.name}_poams_notes_export.json`
      });
      
      if (!savePath) {
        showToast('info', 'Export cancelled');
        setIsExporting(false);
        return;
      }
      
      setExportProgress(30);
      
      // Export POAMs and notes for current system
      await invoke('export_data', {
        exportPath: savePath,
        systemId: currentSystem.id
      });
      
      setExportProgress(100);
      showToast('success', `POAMs and Notes exported successfully from ${currentSystem.name}`);
    } catch (error) {
      console.error('Export error:', error);
      showToast('error', `Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSTIG = async () => {
    try {
      setIsExporting(true);
      setExportProgress(10);
      
      // Show save dialog
      const savePath = await save({
        filters: [{
          name: 'JSON Files',
          extensions: ['json']
        }],
        defaultPath: `${currentSystem.name}_stig_mappings_export.json`
      });
      
      if (!savePath) {
        showToast('info', 'Export cancelled');
        setIsExporting(false);
        return;
      }
      
      setExportProgress(30);
      
      // Export STIG mappings for current system
      await invoke('export_stig_mappings', {
        exportPath: savePath,
        systemId: currentSystem.id
      });
      
      setExportProgress(100);
      showToast('success', `STIG Mappings exported successfully from ${currentSystem.name}`);
    } catch (error) {
      console.error('Export error:', error);
      showToast('error', `Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSTP = async () => {
    try {
      setIsExporting(true);
      setExportProgress(10);
      
      // Show save dialog
      const savePath = await save({
        filters: [{
          name: 'JSON Files',
          extensions: ['json']
        }],
        defaultPath: `${currentSystem.name}_security_test_plans_export.json`
      });
      
      if (!savePath) {
        showToast('info', 'Export cancelled');
        setIsExporting(false);
        return;
      }
      
      setExportProgress(30);
      
      // Export Security Test Plans for current system
      await invoke('export_security_test_plans', {
        exportPath: savePath,
        systemId: currentSystem.id
      });
      
      setExportProgress(100);
      showToast('success', `Security Test Plans exported successfully from ${currentSystem.name}`);
    } catch (error) {
      console.error('Export error:', error);
      showToast('error', `Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSystemBackup = async () => {
    try {
      setIsExporting(true);
      setExportProgress(10);
      
      // Show save dialog
      const savePath = await save({
        filters: [{
          name: 'ZIP Files (System Backup)',
          extensions: ['zip']
        }],
        defaultPath: `${currentSystem.name}_COMPLETE_SYSTEM_BACKUP.zip`
      });
      
      if (!savePath) {
        showToast('info', 'Export cancelled');
        setIsExporting(false);
        return;
      }
      
      setExportProgress(20);
      
      // Export complete system backup
      await invoke('export_complete_system_backup', {
        exportPath: savePath,
        systemId: currentSystem.id
      });
      
      setExportProgress(100);
      showToast('success', `Complete system backup exported successfully from ${currentSystem.name}`);
    } catch (error) {
      console.error('Export error:', error);
      showToast('error', `Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    switch (exportType) {
      case 'poams':
        return handleExportPOAMs();
      case 'stig':
        return handleExportSTIG();
      case 'stp':
        return handleExportSTP();
      case 'system-backup':
        return handleSystemBackup();
      default:
        return handleExportPOAMs();
    }
  };

  const generateProfessionalReport = async () => {
    try {
      setIsGeneratingReport(true);
      setReportProgress(10);
      
      // Show save dialog
      const savePath = await save({
        filters: [{
          name: 'HTML Files',
          extensions: ['html']
        }],
        defaultPath: `${currentSystem.name}_POAM_Professional_Report.html`
      });
      
      if (!savePath) {
        showToast('info', 'Report generation cancelled');
        setIsGeneratingReport(false);
        return;
      }
      
      setReportProgress(20);
      
      // Fetch all data for current system
      const [poams, notes, stigMappings, testPlans] = await Promise.all([
        invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id }),
        invoke<Note[]>('get_all_notes', { systemId: currentSystem.id }),
        invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: currentSystem.id }).catch(() => [] as STIGMapping[]),
        invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: currentSystem.id }).catch(() => [] as SecurityTestPlan[])
      ]);
      
      setReportProgress(60);
      
      // Generate the HTML report
      const reportHtml = generateReportHTML(poams, notes, stigMappings, testPlans);
      
      // Write the HTML file
      await invoke('write_file', {
        path: savePath,
        content: reportHtml
      });
      
      setReportProgress(100);
      showToast('success', `Professional report generated successfully for ${currentSystem.name}`);
      
      // Open the report
      await invoke('open_file', { path: savePath });
      
    } catch (error) {
      console.error('Report generation error:', error);
      showToast('error', `Report generation failed: ${error}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const generateReportHTML = (poams: POAM[], _notes: Note[], stigMappings: STIGMapping[] = [], testPlans: SecurityTestPlan[] = []): string => {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const reportTime = now.toLocaleTimeString('en-US');

    // Calculate comprehensive statistics
    const totalPOAMs = poams.length;
    const totalMilestones = poams.reduce((sum, poam) => sum + poam.milestones.length, 0);
    const totalSTIGMappings = stigMappings.length;
    const totalTestPlans = testPlans.length;
    
    const statusCounts = poams.reduce((counts, poam) => {
      counts[poam.status] = (counts[poam.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const priorityCounts = poams.reduce((counts, poam) => {
      counts[poam.priority] = (counts[poam.priority] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const riskCounts = poams.reduce((counts, poam) => {
      counts[poam.riskLevel] = (counts[poam.riskLevel] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Calculate STIG compliance statistics
    let totalControls = 0;
    let compliantControls = 0;
    let nonCompliantControls = 0;
    let highRiskFindings = 0;

    stigMappings.forEach(mapping => {
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

    testPlans.forEach(plan => {
      if (plan.test_cases) {
        totalTestCases += plan.test_cases.length;
        passedTests += plan.test_cases.filter(tc => tc.status === 'Passed').length;
        failedTests += plan.test_cases.filter(tc => tc.status === 'Failed').length;
        evidenceCollected += plan.test_cases.filter(tc => tc.evidence_files && tc.evidence_files.length > 0).length;
      }
    });

    // Calculate progress metrics
    const completedMilestones = poams.reduce((sum, poam) => 
      sum + poam.milestones.filter(m => m.status === 'Completed').length, 0);
    
    const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
    
    const poamsWithProgress = poams.map(poam => {
      const completedCount = poam.milestones.filter(m => m.status === 'Completed').length;
      const totalCount = poam.milestones.length;
      const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      return {
        ...poam,
        progressPercent: progress,
        completedMilestones: completedCount,
        totalMilestones: totalCount
      };
    });

    // Progress distribution
    
    const avgProgress = poamsWithProgress.length > 0 ? 
      Math.round(poamsWithProgress.reduce((sum, p) => sum + p.progressPercent, 0) / poamsWithProgress.length) : 0;

    // Helper function to generate SVG progress bars
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

    // Generate SVG charts for better visuals
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
    <title>POAM Professional Report - ${currentSystem.name}</title>
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
        
        .header .system-name {
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
        
        .poam-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border: 1px solid #e5e7eb;
        }
        
        .poam-table th, .poam-table td {
            padding: 15px 12px;
            text-align: left;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .poam-table th {
            background: linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%);
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }
        
        .poam-table tr:hover {
            background-color: #f9fafb;
        }
        
        .status-completed { 
            background: #10b981; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: 600;
            display: inline-block;
        }
        .status-in-progress { 
            background: #f59e0b; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: 600;
            display: inline-block;
        }
        .status-not-started { 
            background: #ef4444; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: 600;
            display: inline-block;
        }
        .status-on-hold { 
            background: #6b7280; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: 600;
            display: inline-block;
        }
        
        .priority-high { 
            background: #fee2e2; 
            color: #dc2626; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
            border: 1px solid #fca5a5;
        }
        .priority-medium { 
            background: #fef3c7; 
            color: #d97706; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
            border: 1px solid #fcd34d;
        }
        .priority-low { 
            background: #dcfce7; 
            color: #16a34a; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
            border: 1px solid #86efac;
        }
        
        .risk-high { 
            background: #dc2626; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
        }
        .risk-medium { 
            background: #f59e0b; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
        }
        .risk-low { 
            background: #10b981; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 6px; 
            font-size: 0.8em; 
            font-weight: 600;
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
        
        .stig-table, .stp-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border: 1px solid #e5e7eb;
        }
        
        .stig-table th, .stig-table td,
        .stp-table th, .stp-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .stig-table th, .stp-table th {
            background: linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%);
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            font-size: 0.85em;
        }
        
        .compliance-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 600;
            display: inline-block;
        }
        
        .compliance-compliant {
            background: #dcfce7;
            color: #16a34a;
        }
        
        .compliance-non-compliant {
            background: #fee2e2;
            color: #dc2626;
        }
        
        .compliance-not-reviewed {
            background: #fef3c7;
            color: #d97706;
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
        
        .security-section {
            background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
            border-left: 6px solid #8b5cf6;
        }
        
        .security-section h3 {
            color: #8b5cf6;
            margin-bottom: 15px;
            font-size: 1.3em;
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
            .header .system-name { font-size: 1.3em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ POAM Professional Report</h1>
            <div class="system-name">${currentSystem.name}</div>
            <div class="subtitle">Plan of Action and Milestones Comprehensive Analysis</div>
            <div class="date-info">Generated on ${reportDate} at ${reportTime}</div>
        </div>
        
        <div class="executive-summary">
            <h2>📊 Executive Summary</h2>
            <p>This comprehensive report provides a detailed analysis of all Plan of Action and Milestones (POAMs), STIG compliance mappings, and security testing progress for <strong>${currentSystem.name}</strong>. The report includes visual analytics, progress tracking, and compliance metrics to support informed decision-making and security governance.</p>
            <p><strong>📈 Overall Progress:</strong> ${overallProgress}% of all milestones completed (${completedMilestones} of ${totalMilestones})</p>
            <p><strong>📊 Average POAM Completion:</strong> ${avgProgress}% completion rate across all POAMs</p>
            <p><strong>🔒 Security Compliance:</strong> ${totalControls} STIG controls mapped with ${Math.round((compliantControls / Math.max(totalControls, 1)) * 100)}% compliance rate</p>
            <p><strong>🧪 Testing Progress:</strong> ${totalTestCases} test cases with ${Math.round((passedTests / Math.max(totalTestCases, 1)) * 100)}% pass rate</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${totalPOAMs}</div>
                <div class="stat-label">Total POAMs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalMilestones}</div>
                <div class="stat-label">Total Milestones</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalSTIGMappings}</div>
                <div class="stat-label">STIG Mappings</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalTestPlans}</div>
                <div class="stat-label">Test Plans</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalControls}</div>
                <div class="stat-label">Security Controls</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalTestCases}</div>
                <div class="stat-label">Test Cases</div>
            </div>
        </div>
        
        <div class="charts-grid">
            ${generateDonutChart([
              { label: 'Completed', value: statusCounts['Completed'] || 0, color: '#10b981' },
              { label: 'In Progress', value: statusCounts['In Progress'] || 0, color: '#f59e0b' },
              { label: 'Not Started', value: statusCounts['Not Started'] || 0, color: '#ef4444' },
              { label: 'On Hold', value: statusCounts['On Hold'] || 0, color: '#6b7280' }
            ], 'POAM Status Distribution')}
            
            ${generateDonutChart([
              { label: 'High', value: priorityCounts['High'] || 0, color: '#dc2626' },
              { label: 'Medium', value: priorityCounts['Medium'] || 0, color: '#f59e0b' },
              { label: 'Low', value: priorityCounts['Low'] || 0, color: '#10b981' }
            ], 'Priority Distribution')}
            
            ${generateDonutChart([
              { label: 'High Risk', value: riskCounts['High'] || 0, color: '#dc2626' },
              { label: 'Medium Risk', value: riskCounts['Medium'] || 0, color: '#f59e0b' },
              { label: 'Low Risk', value: riskCounts['Low'] || 0, color: '#10b981' }
            ], 'Risk Level Distribution')}
            
            ${totalControls > 0 ? generateDonutChart([
              { label: 'Compliant', value: compliantControls, color: '#10b981' },
              { label: 'Non-Compliant', value: nonCompliantControls, color: '#ef4444' },
              { label: 'Not Reviewed', value: totalControls - compliantControls - nonCompliantControls, color: '#f59e0b' }
            ], 'STIG Compliance Status') : ''}
        </div>
        
        <div class="section">
            <h2>📋 POAM Summary Table</h2>
            ${totalPOAMs === 0 ? '<p class="chart-placeholder">No POAMs found in the system.</p>' : `
                <table class="poam-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Risk</th>
                            <th>Progress</th>
                            <th>Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${poamsWithProgress.map(poam => `
                            <tr>
                                <td><strong>#${poam.id}</strong></td>
                                <td>
                                    <strong>${poam.title}</strong>
                                    <br><small style="color: #6b7280;">${poam.description.substring(0, 100)}${poam.description.length > 100 ? '...' : ''}</small>
                                </td>
                                <td><span class="status-${poam.status.toLowerCase().replace(/\s+/g, '-')}">${poam.status}</span></td>
                                <td><span class="priority-${poam.priority.toLowerCase()}">${poam.priority}</span></td>
                                <td><span class="risk-${poam.riskLevel.toLowerCase()}">${poam.riskLevel}</span></td>
                                <td style="min-width: 120px;">
                                    ${generateProgressBar(poam.progressPercent, poam.progressPercent === 100 ? '#10b981' : poam.progressPercent > 0 ? '#f59e0b' : '#ef4444')}
                                    <small style="color: #6b7280; display: block; margin-top: 4px;">
                                        ${poam.completedMilestones}/${poam.totalMilestones} milestones
                                    </small>
                                </td>
                                <td>${new Date(poam.endDate).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
        
        ${totalSTIGMappings > 0 ? `
        <div class="section">
            <h2>🔒 STIG Compliance Overview</h2>
            <div class="security-section">
                <h3>Security Controls Summary</h3>
                <p><strong>Total Controls:</strong> ${totalControls} | <strong>Compliant:</strong> ${compliantControls} | <strong>Non-Compliant:</strong> ${nonCompliantControls} | <strong>High Risk Findings:</strong> ${highRiskFindings}</p>
            </div>
            <table class="stig-table">
                <thead>
                    <tr>
                        <th>Mapping Name</th>
                        <th>STIG Info</th>
                        <th>Controls</th>
                        <th>Compliance Rate</th>
                        <th>Risk Findings</th>
                    </tr>
                </thead>
                <tbody>
                    ${stigMappings.map(mapping => {
                      const summary = mapping.mapping_result?.summary || {};
                      const totalMappingControls = summary.total_controls || 0;
                      const compliantMappingControls = summary.compliant_controls || 0;
                      const complianceRate = totalMappingControls > 0 ? Math.round((compliantMappingControls / totalMappingControls) * 100) : 0;
                      return `
                        <tr>
                            <td><strong>${mapping.name}</strong></td>
                            <td>
                                ${mapping.stig_info ? mapping.stig_info.title || 'N/A' : 'N/A'}
                                <br><small style="color: #6b7280;">Version: ${mapping.stig_info ? mapping.stig_info.version || 'N/A' : 'N/A'}</small>
                            </td>
                            <td>${totalMappingControls}</td>
                            <td>
                                ${generateProgressBar(complianceRate, complianceRate >= 80 ? '#10b981' : complianceRate >= 60 ? '#f59e0b' : '#ef4444')}
                            </td>
                            <td>
                                <span style="color: #dc2626; font-weight: 600;">High: ${summary.high_risk_findings || 0}</span><br>
                                <span style="color: #f59e0b; font-weight: 600;">Medium: ${summary.medium_risk_findings || 0}</span><br>
                                <span style="color: #10b981; font-weight: 600;">Low: ${summary.low_risk_findings || 0}</span>
                            </td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        ${totalTestPlans > 0 ? `
        <div class="section">
            <h2>🧪 Security Test Plans Overview</h2>
            <div class="security-section">
                <h3>Testing Progress Summary</h3>
                <p><strong>Total Test Cases:</strong> ${totalTestCases} | <strong>Passed:</strong> ${passedTests} | <strong>Failed:</strong> ${failedTests} | <strong>Evidence Collected:</strong> ${evidenceCollected}</p>
            </div>
            <table class="stp-table">
                <thead>
                    <tr>
                        <th>Test Plan</th>
                        <th>Status</th>
                        <th>Test Cases</th>
                        <th>Pass Rate</th>
                        <th>Evidence Collection</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${testPlans.map(plan => {
                      const planTestCases = plan.test_cases || [];
                      const planPassed = planTestCases.filter(tc => tc.status === 'Passed').length;
                      const planFailed = planTestCases.filter(tc => tc.status === 'Failed').length;
                      const planTotal = planTestCases.length;
                      const planPassRate = planTotal > 0 ? Math.round((planPassed / (planPassed + planFailed || 1)) * 100) : 0;
                      const planEvidence = planTestCases.filter(tc => tc.evidence_files && tc.evidence_files.length > 0).length;
                      const evidenceRate = planTotal > 0 ? Math.round((planEvidence / planTotal) * 100) : 0;
                      
                      return `
                        <tr>
                            <td>
                                <strong>${plan.name}</strong>
                                ${plan.description ? `<br><small style="color: #6b7280;">${plan.description.substring(0, 80)}${plan.description.length > 80 ? '...' : ''}</small>` : ''}
                            </td>
                            <td><span class="status-${plan.status.toLowerCase().replace(/\s+/g, '-')}">${plan.status}</span></td>
                            <td>${planTotal}</td>
                            <td>
                                ${planTotal > 0 ? generateProgressBar(planPassRate, planPassRate >= 80 ? '#10b981' : planPassRate >= 60 ? '#f59e0b' : '#ef4444') : 'N/A'}
                                <small style="color: #6b7280; display: block; margin-top: 4px;">
                                    ${planPassed} passed, ${planFailed} failed
                                </small>
                            </td>
                            <td>
                                ${planTotal > 0 ? generateProgressBar(evidenceRate, evidenceRate >= 80 ? '#10b981' : evidenceRate >= 50 ? '#f59e0b' : '#ef4444') : 'N/A'}
                                <small style="color: #6b7280; display: block; margin-top: 4px;">
                                    ${planEvidence}/${planTotal} with evidence
                                </small>
                            </td>
                            <td>${new Date(plan.updated_date).toLocaleDateString()}</td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="footer">
            <h3>🛡️ POAM Tracker Professional Report</h3>
            <p><strong>System:</strong> ${currentSystem.name} | <strong>Generated:</strong> ${reportDate} ${reportTime}</p>
            <p>Report includes ${totalPOAMs} POAMs, ${totalMilestones} milestones, ${totalSTIGMappings} STIG mappings, and ${totalTestPlans} security test plans</p>
            <p style="margin-top: 15px; font-size: 0.8em; color: #9ca3af;">
                This report contains sensitive security information and should be handled according to your organization's data classification policies.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  };

  // Enhanced import with comprehensive support
  const handleFileImportComprehensive = async () => {
    try {
      setIsImporting(true);
      setImportProgress(10);
      
      // Show file selection dialog
      const selected = await open({
        filters: [{
          name: 'JSON Files',
          extensions: ['json']
        }]
      });
      
      if (!selected || selected === null) {
        showToast('info', 'File import cancelled');
        setIsImporting(false);
        return;
      }
      
      setSelectedFile(selected as string);
      setImportProgress(30);
      
      // Import the selected file with comprehensive data to current system
      await invoke('import_comprehensive_backup', {
        filePath: selected,
        systemId: currentSystem.id
      });
      
      setImportProgress(100);
      showToast('success', `Comprehensive data imported successfully to ${currentSystem.name}`);
      
      // Reload the page to show the imported data
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      showToast('error', `Import failed: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const selectedOption = exportOptions.find(option => option.id === exportType);

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Import & Export</h1>
            <p className="text-muted-foreground">
              Manage your data for {currentSystem.name}
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <Button
            onClick={generateProfessionalReport}
            disabled={isGeneratingReport}
            className="btn-responsive"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            <span className="hide-mobile">Generate Report</span>
            <span className="show-mobile">Report</span>
          </Button>
        </div>
      </div>
      
      {/* Export Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Export Options
          </CardTitle>
          <CardDescription>Choose what data you want to export from {currentSystem.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {exportOptions.map((option) => {
              const IconComponent = option.icon;
              const isSelected = exportType === option.id;
              return (
                <div 
                  key={option.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setExportType(option.id as any)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${
                      option.color === 'blue' ? 'bg-blue-500/10 text-blue-500' :
                      option.color === 'green' ? 'bg-green-500/10 text-green-500' :
                      option.color === 'purple' ? 'bg-purple-500/10 text-purple-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{option.title}</h3>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {option.includes.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Import Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Upload className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Import Data</CardTitle>
                <CardDescription>Import data from JSON files</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Import supports:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  POAMs & Notes (basic format)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Complete system backups
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Automatic format detection
                </li>
              </ul>
            </div>
            
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {selectedFile && (
              <div className="p-3 bg-accent/50 border border-accent rounded-lg">
                <p className="text-sm font-medium mb-1">Selected file:</p>
                <p className="text-xs text-muted-foreground break-all">{selectedFile}</p>
              </div>
            )}
            
            <div className="space-y-2 pt-2">
              <Button 
                onClick={handleJSONImport} 
                disabled={isImporting}
                className="w-full"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "Importing..." : "Import Basic Data"}
              </Button>
              <Button 
                onClick={handleFileImportComprehensive} 
                disabled={isImporting}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "Importing..." : "Import System Backup"}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Export Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                selectedOption?.color === 'blue' ? 'bg-blue-500/10' :
                selectedOption?.color === 'green' ? 'bg-green-500/10' :
                selectedOption?.color === 'purple' ? 'bg-purple-500/10' :
                'bg-red-500/10'
              }`}>
                <Download className={`h-5 w-5 ${
                  selectedOption?.color === 'blue' ? 'text-blue-500' :
                  selectedOption?.color === 'green' ? 'text-green-500' :
                  selectedOption?.color === 'purple' ? 'text-purple-500' :
                  'text-red-500'
                }`} />
              </div>
              <div>
                <CardTitle className="text-lg">Export {selectedOption?.title}</CardTitle>
                <CardDescription>{selectedOption?.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Export includes:</h4>
              <div className="space-y-2">
                {selectedOption?.includes.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exporting...</span>
                  <span>{exportProgress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <Button 
                onClick={handleExport}
                disabled={isExporting}
                className={`w-full ${
                  exportType === 'system-backup' ? 'bg-red-600 hover:bg-red-700' :
                  exportType === 'stig' ? 'bg-green-600 hover:bg-green-700' :
                  exportType === 'stp' ? 'bg-purple-600 hover:bg-purple-700' :
                  ''
                }`}
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : `Export ${selectedOption?.title}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Professional Report Card */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Professional Report</CardTitle>
                <CardDescription>Generate comprehensive HTML report</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">Enhanced Report includes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-purple-500" />
                  Interactive visual charts and graphs
                </li>
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="h-3 w-3 text-purple-500" />
                  Concise POAM table with progress bars
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-purple-500" />
                  STIG compliance mappings and metrics
                </li>
                <li className="flex items-center gap-2">
                  <Settings className="h-3 w-3 text-purple-500" />
                  Security test plan progress tracking
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-purple-500" />
                  Executive-ready professional formatting
                </li>
              </ul>
            </div>
            
            {isGeneratingReport && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Generating...</span>
                  <span>{reportProgress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${reportProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <Button 
                onClick={generateProfessionalReport} 
                disabled={isGeneratingReport}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isGeneratingReport ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Information Section */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">POAMs & Notes Export</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Exports core POAM data</li>
                  <li>• Includes all milestones</li>
                  <li>• Contains all notes and associations</li>
                  <li>• Compatible with older versions</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">STIG Mappings Export</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Security control mappings</li>
                  <li>• Compliance status data</li>
                  <li>• STIG configuration settings</li>
                  <li>• Assessment results</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Security Test Plans Export</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Test plan configurations</li>
                  <li>• Test case definitions</li>
                  <li>• Execution results</li>
                  <li>• Evidence files and documentation</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Complete System Backup</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Everything from all categories</li>
                  <li>• Full data integrity preserved</li>
                  <li>• Complete disaster recovery</li>
                  <li>• System migration ready</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}