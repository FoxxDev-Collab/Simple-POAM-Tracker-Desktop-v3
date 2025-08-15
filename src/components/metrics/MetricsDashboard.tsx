import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSystem } from '../../context/SystemContext';
import { useToast } from '../../context/ToastContext';
import StatusDistribution from './StatusDistribution';
import MilestoneProgressBars from './MilestoneProgressBars';
import PriorityDistribution from './PriorityDistribution';
import CompletionTimeline from './CompletionTimeline';
import MilestoneStatusDistribution from './MilestoneStatusDistribution';
import STIGComplianceChart from './STIGComplianceChart';
import SecurityTestingChart from './SecurityTestingChart';
import NessusVulnerabilityChart from './NessusVulnerabilityChart';
import { NistAssociationSummary } from '.';
// Unified styles via global patterns and Tailwind
import { BarChart3 } from 'lucide-react';

interface POAM {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  priority: string;
  riskLevel: string;
  milestones: any[];
}

interface STIGMapping {
  id: string;
  name: string;
  mapping_result: {
    mapped_controls: Array<{
      nist_control: string;
      compliance_status: string;
      risk_level: string;
    }>;
    summary?: {
      total_controls: number;
      compliant_controls: number;
      non_compliant_controls: number;
      high_risk_findings: number;
    };
  };
}

interface SecurityTestPlan {
  id: string;
  name: string;
  status: string;
  test_cases: Array<{
    id: string;
    status: string;
    evidence_files?: string[];
    risk_rating: string;
  }>;
}

interface NessusScan {
  id: string;
  name: string;
  imported_date: string;
  version: number;
  system_id: string;
}

interface NessusFinding {
  id: string;
  scan_id: string;
  severity?: string;
  risk_factor?: string;
  host?: string;
}

const MetricsDashboard: React.FC = () => {
  const [poams, setPOAMs] = useState<POAM[]>([]);
  const [stigMappings, setSTIGMappings] = useState<STIGMapping[]>([]);
  const [testPlans, setTestPlans] = useState<SecurityTestPlan[]>([]);
  const [nessusScans, setNessusScans] = useState<NessusScan[]>([]);
  const [nessusFindings, setNessusFindings] = useState<NessusFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentSystem } = useSystem();
  const { showToast } = useToast();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to view metrics.</p>
      </div>
    );
  }

  useEffect(() => {
    loadAllData();
    
    // Add event listener for theme change to refresh charts
    const handleThemeChange = () => {
      // Force re-render when theme changes
      setPOAMs(prevPoams => [...prevPoams]);
    };
    
    window.addEventListener('themechange', handleThemeChange);
    
    return () => {
      window.removeEventListener('themechange', handleThemeChange);
    };
  }, [currentSystem?.id]);

  const loadAllData = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping metrics load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('MetricsDashboard: Loading data from backend for system:', currentSystem.id);
      
      // Load all data in parallel
      const [poamData, stigData, testPlanData, nessusScansData] = await Promise.all([
        invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id }).catch(() => []),
        invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: currentSystem.id }).catch(() => []),
        invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: currentSystem.id }).catch(() => []),
        invoke<NessusScan[]>('get_nessus_scans', { systemId: currentSystem.id }).catch(() => [])
      ]);
      
      // Load all findings from all scans
      let allFindings: NessusFinding[] = [];
      if (nessusScansData && nessusScansData.length > 0) {
        const findingPromises = nessusScansData.map(scan => 
          invoke<NessusFinding[]>('get_nessus_findings_by_scan', { 
            scanId: scan.id, 
            systemId: currentSystem.id 
          }).catch(() => [])
        );
        const findingResults = await Promise.all(findingPromises);
        allFindings = findingResults.flat();
      }
      
      console.log('MetricsDashboard: Received data from backend:');
      console.log('- POAMs:', poamData);
      console.log('- STIG Mappings:', stigData);
      console.log('- Test Plans:', testPlanData);
      console.log('- Nessus Scans:', nessusScansData);
      console.log('- Nessus Findings:', allFindings);
      
      setPOAMs(poamData || []);
      setSTIGMappings(stigData || []);
      setTestPlans(testPlanData || []);
      setNessusScans(nessusScansData || []);
      setNessusFindings(allFindings || []);
    } catch (err) {
      console.error('MetricsDashboard: Error loading data:', err);
      const errorMessage = `Failed to load metrics data: ${err}`;
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Calculate comprehensive stats
  const calculateSTIGStats = () => {
    let totalControls = 0;
    let compliantControls = 0;
    let nonCompliantControls = 0;
    let highRiskFindings = 0;

    stigMappings.forEach(mapping => {
      // Use the summary data directly from the mapping result (same as STIG Mapper component)
      if (mapping.mapping_result?.summary) {
        totalControls += mapping.mapping_result.summary.total_controls || 0;
        compliantControls += mapping.mapping_result.summary.compliant_controls || 0;
        nonCompliantControls += mapping.mapping_result.summary.non_compliant_controls || 0;
        highRiskFindings += mapping.mapping_result.summary.high_risk_findings || 0;
      }
    });

    return { totalControls, compliantControls, nonCompliantControls, highRiskFindings };
  };

  const calculateTestPlanStats = () => {
    let totalTestCases = 0;
    let passedTests = 0;
    let failedTests = 0;
    let evidenceCollected = 0;
    let totalEvidenceFiles = 0;

    testPlans.forEach(plan => {
      if (plan.test_cases) {
        totalTestCases += plan.test_cases.length;
        passedTests += plan.test_cases.filter(tc => tc.status === 'Passed').length;
        failedTests += plan.test_cases.filter(tc => tc.status === 'Failed').length;
        
        plan.test_cases.forEach(tc => {
          if (tc.evidence_files && tc.evidence_files.length > 0) {
            evidenceCollected++;
            totalEvidenceFiles += tc.evidence_files.length;
          }
        });
      }
    });

    return { totalTestCases, passedTests, failedTests, evidenceCollected, totalEvidenceFiles };
  };

  // Calculate Nessus scan statistics
  const calculateNessusStats = () => {
    const totalScans = nessusScans.length;
    const totalFindings = nessusFindings.length;
    const totalHosts = new Set(nessusFindings.map(f => f.host).filter(Boolean)).size;
    
    const criticalFindings = nessusFindings.filter(f => 
      f.risk_factor?.toLowerCase() === 'critical' || f.severity === '4'
    ).length;
    
    const highFindings = nessusFindings.filter(f => 
      f.risk_factor?.toLowerCase() === 'high' || f.severity === '3'
    ).length;
    
    const mediumFindings = nessusFindings.filter(f => 
      f.risk_factor?.toLowerCase() === 'medium' || f.severity === '2'
    ).length;
    
    const lowFindings = nessusFindings.filter(f => 
      f.risk_factor?.toLowerCase() === 'low' || f.severity === '1'
    ).length;
    
    // Calculate most recent scan date
    const mostRecentScan = nessusScans.length > 0 
      ? new Date(Math.max(...nessusScans.map(scan => new Date(scan.imported_date).getTime())))
      : null;
    
    // Calculate monthly compliance
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const scansInLastMonth = nessusScans.filter(scan => 
      new Date(scan.imported_date) >= thirtyDaysAgo
    ).length;
    
    // Monthly scan compliance (1+ scans per month is compliant)
    const monthlyCompliance = scansInLastMonth >= 1;
    
    // Calculate days since last scan
    const daysSinceLastScan = mostRecentScan 
      ? Math.floor((now.getTime() - mostRecentScan.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    
    return {
      totalScans,
      totalFindings,
      totalHosts,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      mostRecentScan,
      highRiskFindings: criticalFindings + highFindings,
      scansInLastMonth,
      monthlyCompliance,
      daysSinceLastScan
    };
  };

  const stigStats = calculateSTIGStats();
  const testPlanStats = calculateTestPlanStats();
  const nessusStats = calculateNessusStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 bg-primary/10 rounded-3xl inline-block mb-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Loading Security Metrics</h2>
          <p className="text-muted-foreground text-lg">Analyzing data and generating insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="p-6 bg-red-500/10 rounded-3xl inline-block mb-8">
            <div className="w-12 h-12 bg-red-500 rounded-2xl"></div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Error Loading Metrics</h2>
          <p className="text-muted-foreground text-lg mb-8">{error}</p>
          <button 
            onClick={loadAllData} 
            className="px-8 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Enhanced Header */}
      <div className="p-8 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl shadow-sm">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Security Metrics Dashboard
              </h1>
              <p className="text-muted-foreground text-lg mt-2">
                Comprehensive security insights and compliance analytics for{' '}
                <span className="font-semibold text-primary">{currentSystem.name}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={loadAllData}
            className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
          >
            Refresh Data
          </button>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total POAMs</p>
                <p className="text-3xl font-bold text-foreground mt-1">{poams.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Active security items
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {poams.length > 0 ? Math.round((poams.filter(p => p.status === 'Completed').length / poams.length) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              POAMs completed successfully
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">STIG Compliance</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {stigStats.totalControls > 0 ? Math.round((stigStats.compliantControls / stigStats.totalControls) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Security controls compliant
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk Items</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {poams.filter(p => p.riskLevel === 'High' || p.riskLevel === 'Very High' || p.riskLevel === 'Critical').length}
                </p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl">
                <div className="w-6 h-6 bg-red-500 rounded-full"></div>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Require immediate attention
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics Sections */}
      <div className="p-8 space-y-12">
        {/* POAM Analytics */}
        <div className="bg-gradient-to-br from-card/50 to-card/30 border border-border/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <div className="w-8 h-8 bg-blue-500 rounded-xl"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Plan of Action & Milestones</h2>
              <p className="text-muted-foreground">Detailed breakdown of POAM status and progress</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{poams.length}</div>
              <div className="text-sm font-medium text-muted-foreground">Total POAMs</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-green-600 mb-2">{poams.filter(p => p.status === 'Completed').length}</div>
              <div className="text-sm font-medium text-muted-foreground">Completed</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-yellow-600 mb-2">{poams.filter(p => p.status === 'In Progress').length}</div>
              <div className="text-sm font-medium text-muted-foreground">In Progress</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-gray-600 mb-2">{poams.filter(p => p.status === 'Not Started').length}</div>
              <div className="text-sm font-medium text-muted-foreground">Not Started</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-red-600 mb-2">{poams.filter(p => p.riskLevel === 'High' || p.riskLevel === 'Very High' || p.riskLevel === 'Critical').length}</div>
              <div className="text-sm font-medium text-muted-foreground">High Risk</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-orange-600 mb-2">{poams.filter(p => p.priority === 'High' || p.priority === 'Critical').length}</div>
              <div className="text-sm font-medium text-muted-foreground">High Priority</div>
            </div>
          </div>
        </div>

        {/* STIG Compliance Analytics */}
        <div className="bg-gradient-to-br from-card/50 to-card/30 border border-border/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-purple-500/10 rounded-2xl">
              <div className="w-8 h-8 bg-purple-500 rounded-xl"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">STIG Compliance Overview</h2>
              <p className="text-muted-foreground">Security Technical Implementation Guide compliance metrics</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-purple-600 mb-2">{stigMappings.length}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Mappings</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stigStats.totalControls}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Controls</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-green-600 mb-2">{stigStats.compliantControls}</div>
              <div className="text-sm font-medium text-muted-foreground">Compliant</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-red-600 mb-2">{stigStats.nonCompliantControls}</div>
              <div className="text-sm font-medium text-muted-foreground">Non-Compliant</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-orange-600 mb-2">{stigStats.highRiskFindings}</div>
              <div className="text-sm font-medium text-muted-foreground">High Risk</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-primary mb-2">
                {stigStats.totalControls > 0 ? Math.round((stigStats.compliantControls / stigStats.totalControls) * 100) : 0}%
              </div>
              <div className="text-sm font-medium text-muted-foreground">Compliance Rate</div>
            </div>
          </div>
        </div>

        {/* Vulnerability Scan Analytics */}
        <div className="bg-gradient-to-br from-card/50 to-card/30 border border-border/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-red-500/10 rounded-2xl">
              <div className="w-8 h-8 bg-red-500 rounded-xl"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Vulnerability Assessment</h2>
              <p className="text-muted-foreground">Nessus scan results and vulnerability findings</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{nessusStats.totalScans}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Scans</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-gray-600 mb-2">{nessusStats.totalFindings}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Findings</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-purple-600 mb-2">{nessusStats.totalHosts}</div>
              <div className="text-sm font-medium text-muted-foreground">Hosts Scanned</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-red-600 mb-2">{nessusStats.criticalFindings}</div>
              <div className="text-sm font-medium text-muted-foreground">Critical</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-orange-600 mb-2">{nessusStats.highFindings}</div>
              <div className="text-sm font-medium text-muted-foreground">High</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-2xl font-bold text-muted-foreground mb-2">
                {nessusStats.mostRecentScan 
                  ? `${nessusStats.daysSinceLastScan}d`
                  : '∞'
                }
              </div>
              <div className="text-sm font-medium text-muted-foreground">Days Since Scan</div>
            </div>
            <div className={`bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow`}>
              <div className={`text-2xl font-bold mb-2 ${nessusStats.monthlyCompliance ? 'text-green-600' : 'text-red-600'}`}>
                {nessusStats.monthlyCompliance ? '✓' : '✗'}
              </div>
              <div className="text-sm font-medium text-muted-foreground">Monthly Status</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{nessusStats.scansInLastMonth}</div>
              <div className="text-sm font-medium text-muted-foreground">Recent Scans</div>
            </div>
          </div>
        </div>

        {/* Security Testing Analytics */}
        <div className="bg-gradient-to-br from-card/50 to-card/30 border border-border/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-green-500/10 rounded-2xl">
              <div className="w-8 h-8 bg-green-500 rounded-xl"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Security Test Plans</h2>
              <p className="text-muted-foreground">Test execution progress and results summary</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{testPlans.length}</div>
              <div className="text-sm font-medium text-muted-foreground">Total Plans</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-gray-600 mb-2">{testPlanStats.totalTestCases}</div>
              <div className="text-sm font-medium text-muted-foreground">Test Cases</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-green-600 mb-2">{testPlanStats.passedTests}</div>
              <div className="text-sm font-medium text-muted-foreground">Passed</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-red-600 mb-2">{testPlanStats.failedTests}</div>
              <div className="text-sm font-medium text-muted-foreground">Failed</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-purple-600 mb-2">{testPlanStats.totalEvidenceFiles}</div>
              <div className="text-sm font-medium text-muted-foreground">Evidence Files</div>
            </div>
            <div className="bg-background/50 border border-border/30 rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-primary mb-2">
                {testPlanStats.totalTestCases > 0 
                  ? `${Math.round((testPlanStats.passedTests / testPlanStats.totalTestCases) * 100)}%`
                  : '0%'
                }
              </div>
              <div className="text-sm font-medium text-muted-foreground">Pass Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Charts & Visualizations */}
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-3">Data Visualizations</h2>
          <p className="text-muted-foreground text-lg">Interactive charts and graphs for deeper insights</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Chart Grid Items */}
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <NistAssociationSummary />
          </div>
          
          <div className="lg:col-span-2 xl:col-span-3 bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <MilestoneProgressBars poams={poams} />
          </div>
          
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <StatusDistribution poams={poams} />
          </div>
          
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <MilestoneStatusDistribution poams={poams} />
          </div>
          
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <STIGComplianceChart 
              compliantControls={stigStats.compliantControls}
              nonCompliantControls={stigStats.nonCompliantControls}
              notReviewedControls={stigStats.totalControls - stigStats.compliantControls - stigStats.nonCompliantControls}
            />
          </div>
          
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <SecurityTestingChart testPlans={testPlans} />
          </div>
          
          <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <PriorityDistribution poams={poams} />
          </div>
          
          <div className="lg:col-span-2 xl:col-span-3 bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <NessusVulnerabilityChart scans={nessusScans} findings={nessusFindings} />
          </div>
          
          <div className="lg:col-span-2 xl:col-span-3 bg-gradient-to-br from-card/80 to-card/40 border border-border/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <CompletionTimeline poams={poams} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-border/50 bg-background/80">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">
            <p className="font-medium">Security Metrics Dashboard</p>
            <p className="text-sm">Last updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
