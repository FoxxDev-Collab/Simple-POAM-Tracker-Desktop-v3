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
import './Metrics.css';
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

const MetricsDashboard: React.FC = () => {
  const [poams, setPOAMs] = useState<POAM[]>([]);
  const [stigMappings, setSTIGMappings] = useState<STIGMapping[]>([]);
  const [testPlans, setTestPlans] = useState<SecurityTestPlan[]>([]);
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
      const [poamData, stigData, testPlanData] = await Promise.all([
        invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id }).catch(() => []),
        invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: currentSystem.id }).catch(() => []),
        invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: currentSystem.id }).catch(() => [])
      ]);
      
      console.log('MetricsDashboard: Received data from backend:');
      console.log('- POAMs:', poamData);
      console.log('- STIG Mappings:', stigData);
      console.log('- Test Plans:', testPlanData);
      
      setPOAMs(poamData || []);
      setSTIGMappings(stigData || []);
      setTestPlans(testPlanData || []);
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

  const stigStats = calculateSTIGStats();
  const testPlanStats = calculateTestPlanStats();

  if (loading) {
    return (
      <div className="metrics-dashboard loading-container">
        <div className="loading-indicator">Loading metrics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="metrics-dashboard error-container">
        <div className="error-message">
          <h3>Error Loading Metrics</h3>
          <p>{error}</p>
          <button onClick={loadAllData} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-dashboard">
      <div className="responsive-header metrics-header">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Security Metrics Dashboard</h1>
            <p className="text-muted-foreground">Visual overview of POAMs, STIG compliance, and security testing progress for {currentSystem.name}</p>
          </div>
        </div>
        
        <button onClick={loadAllData} className="btn btn-primary btn-responsive">
          <span className="hide-mobile">Refresh Data</span>
          <span className="show-mobile">Refresh</span>
        </button>
      </div>

      {/* POAM Summary */}
      <div className="metrics-summary">
        <div className="summary-section">
          <h3>Plan of Action & Milestones (POAM)</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <h4>Total POAMs</h4>
              <div className="summary-value">{poams.length}</div>
            </div>
            <div className="summary-item">
              <h4>Completed</h4>
              <div className="summary-value">{poams.filter(p => p.status === 'Completed').length}</div>
            </div>
            <div className="summary-item">
              <h4>In Progress</h4>
              <div className="summary-value">{poams.filter(p => p.status === 'In Progress').length}</div>
            </div>
            <div className="summary-item">
              <h4>Not Started</h4>
              <div className="summary-value">{poams.filter(p => p.status === 'Not Started').length}</div>
            </div>
            <div className="summary-item">
              <h4>High Risk</h4>
              <div className="summary-value">{poams.filter(p => p.riskLevel === 'High' || p.riskLevel === 'Very High').length}</div>
            </div>
            <div className="summary-item">
              <h4>High Priority</h4>
              <div className="summary-value">{poams.filter(p => p.priority === 'High' || p.priority === 'Critical').length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* STIG Compliance Summary */}
      <div className="metrics-summary">
        <div className="summary-section">
          <h3>STIG Compliance</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <h4>Total Mappings</h4>
              <div className="summary-value">{stigMappings.length}</div>
            </div>
            <div className="summary-item">
              <h4>Total Controls</h4>
              <div className="summary-value">{stigStats.totalControls}</div>
            </div>
            <div className="summary-item success">
              <h4>Compliant</h4>
              <div className="summary-value">{stigStats.compliantControls}</div>
            </div>
            <div className="summary-item danger">
              <h4>Non-Compliant</h4>
              <div className="summary-value">{stigStats.nonCompliantControls}</div>
            </div>
                         <div className="summary-item warning">
               <h4>High Risk</h4>
               <div className="summary-value">{stigStats.highRiskFindings}</div>
             </div>
            <div className="summary-item">
              <h4>Compliance Rate</h4>
              <div className="summary-value">
                {stigStats.totalControls > 0 
                  ? `${Math.round((stigStats.compliantControls / stigStats.totalControls) * 100)}%`
                  : '0%'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Test Plans Summary */}
      <div className="metrics-summary">
        <div className="summary-section">
          <h3>Security Test Plans</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <h4>Total Plans</h4>
              <div className="summary-value">{testPlans.length}</div>
            </div>
            <div className="summary-item">
              <h4>Test Cases</h4>
              <div className="summary-value">{testPlanStats.totalTestCases}</div>
            </div>
            <div className="summary-item success">
              <h4>Passed Tests</h4>
              <div className="summary-value">{testPlanStats.passedTests}</div>
            </div>
            <div className="summary-item danger">
              <h4>Failed Tests</h4>
              <div className="summary-value">{testPlanStats.failedTests}</div>
            </div>
            <div className="summary-item">
              <h4>Evidence Files</h4>
              <div className="summary-value">{testPlanStats.totalEvidenceFiles}</div>
            </div>
            <div className="summary-item">
              <h4>Pass Rate</h4>
              <div className="summary-value">
                {testPlanStats.totalTestCases > 0 
                  ? `${Math.round((testPlanStats.passedTests / testPlanStats.totalTestCases) * 100)}%`
                  : '0%'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="grid-item grid-item-full">
          <MilestoneProgressBars poams={poams} />
        </div>
        <div className="grid-item">
          <StatusDistribution poams={poams} />
        </div>
        <div className="grid-item">
          <MilestoneStatusDistribution poams={poams} />
        </div>
        <div className="grid-item">
          <STIGComplianceChart 
            compliantControls={stigStats.compliantControls}
            nonCompliantControls={stigStats.nonCompliantControls}
            notReviewedControls={stigStats.totalControls - stigStats.compliantControls - stigStats.nonCompliantControls}
          />
        </div>
        <div className="grid-item">
          <SecurityTestingChart testPlans={testPlans} />
        </div>
        <div className="grid-item">
          <PriorityDistribution poams={poams} />
        </div>
        <div className="grid-item grid-item-full">
          <CompletionTimeline poams={poams} />
        </div>
      </div>

      <div className="metrics-footer">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default MetricsDashboard;
