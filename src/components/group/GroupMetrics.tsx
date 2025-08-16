import { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { 
  BarChart3, 
  Shield, 
  Target, 
  AlertTriangle,
  CheckCircle2,
  Users,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';

// Simple Progress component
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-muted rounded-full ${className}`}>
    <div 
      className="bg-primary h-full rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// Import existing metric components to reuse
import StatusDistribution from '../metrics/StatusDistribution';
import PriorityDistribution from '../metrics/PriorityDistribution';
import STIGComplianceChart from '../metrics/STIGComplianceChart';
import SecurityTestingChart from '../metrics/SecurityTestingChart';
import NessusVulnerabilityChart from '../metrics/NessusVulnerabilityChart';

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

interface GroupPOAM {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  risk_level: string;
  affected_systems: string[];
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

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  folder?: string;
  tags?: string[];
}

interface NessusScan {
  id: string;
  name: string;
  scan_date: string;
  status: string;
  imported_date: string;
  version: number;
  system_id: string;
}

interface NessusFinding {
  id: string;
  scan_id: string;
  risk_factor?: string;
  host?: string;
}

interface SystemMetrics {
  systemId: string;
  systemName: string;
  poams: POAM[];
  stigMappings: STIGMapping[];
  testPlans: SecurityTestPlan[];
  notes: Note[];
  nessusScans: NessusScan[];
  nessusFindings: NessusFinding[];
  securityScore: number;
  complianceScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface GroupMetricsProps {
  groupId: string;
  systems: any[];
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

export default function GroupMetrics({ groupId, systems, onSwitchToSystem }: GroupMetricsProps) {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [groupPoams, setGroupPoams] = useState<GroupPOAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { showToast } = useToast();

  // Load comprehensive metrics for all systems
  const loadGroupMetrics = async () => {
    if (!systems || systems.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('GroupMetrics: Loading comprehensive data for all systems');

      // Load Group POAMs
      try {
        const groupPoamsData = await invoke<GroupPOAM[]>('get_group_poams', { groupId });
        setGroupPoams(groupPoamsData || []);
      } catch (error) {
        console.error('Error loading group POAMs:', error);
        setGroupPoams([]);
      }

      // Load metrics for each system in parallel
      const systemPromises = systems.map(async (system) => {
        try {
          console.log(`Loading data for system: ${system.name}`);
          
          // Load all data types for this system in parallel
          const [
            poamData,
            stigData,
            testPlanData,
            notesData,
            nessusScansData
          ] = await Promise.all([
            invoke<POAM[]>('get_all_poams', { systemId: system.id }).catch(() => []),
            invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: system.id }).catch(() => []),
            invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: system.id }).catch(() => []),
            invoke<Note[]>('get_all_notes', { systemId: system.id }).catch(() => []),
            invoke<NessusScan[]>('get_nessus_scans', { systemId: system.id }).catch(() => [])
          ]);

          // Load Nessus findings for all scans
          let allFindings: NessusFinding[] = [];
          if (nessusScansData && nessusScansData.length > 0) {
            const findingPromises = nessusScansData.map(scan => 
              invoke<NessusFinding[]>('get_nessus_findings_by_scan', { 
                scanId: scan.id, 
                systemId: system.id 
              }).catch(() => [])
            );
            const findingResults = await Promise.all(findingPromises);
            allFindings = findingResults.flat();
          }

          // Calculate security and compliance scores
          const securityScore = calculateSecurityScore(poamData, stigData, testPlanData, allFindings);
          const complianceScore = calculateComplianceScore(stigData, testPlanData);
          const riskLevel = calculateRiskLevel(poamData, allFindings, securityScore);

          return {
            systemId: system.id,
            systemName: system.name,
            poams: poamData || [],
            stigMappings: stigData || [],
            testPlans: testPlanData || [],
            notes: notesData || [],
            nessusScans: nessusScansData || [],
            nessusFindings: allFindings || [],
            securityScore,
            complianceScore,
            riskLevel
          } as SystemMetrics;

        } catch (error) {
          console.error(`Error loading data for system ${system.name}:`, error);
          return {
            systemId: system.id,
            systemName: system.name,
            poams: [],
            stigMappings: [],
            testPlans: [],
            notes: [],
            nessusScans: [],
            nessusFindings: [],
            securityScore: 0,
            complianceScore: 0,
            riskLevel: 'Medium' as const
          };
        }
      });

      const results = await Promise.all(systemPromises);
      setSystemMetrics(results);

    } catch (error) {
      console.error('Error loading group metrics:', error);
      setError(String(error));
      showToast('error', `Failed to load group metrics: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupMetrics();
  }, [groupId, systems]);

  // Calculate security score based on multiple factors
  const calculateSecurityScore = (
    poams: POAM[], 
    stigs: STIGMapping[], 
    testPlans: SecurityTestPlan[], 
    findings: NessusFinding[]
  ): number => {
    let score = 100;
    
    // Deduct for open POAMs
    const openPoams = poams.filter(p => p.status !== 'Completed' && p.status !== 'Closed');
    const criticalPoams = openPoams.filter(p => p.priority === 'Critical').length;
    const highPoams = openPoams.filter(p => p.priority === 'High').length;
    
    score -= (criticalPoams * 15) + (highPoams * 10) + (openPoams.length * 2);
    
    // Deduct for STIG compliance issues
    stigs.forEach(stig => {
      if (stig.mapping_result?.summary) {
        const complianceRate = stig.mapping_result.summary.compliant_controls / 
                              stig.mapping_result.summary.total_controls;
        score -= (1 - complianceRate) * 20;
      }
    });
    
    // Deduct for failed tests
    testPlans.forEach(plan => {
      const failedTests = plan.test_cases?.filter(tc => tc.status === 'Failed').length || 0;
      score -= failedTests * 3;
    });
    
    // Deduct for Nessus findings
    const criticalFindings = findings.filter(f => f.risk_factor === 'Critical').length;
    const highFindings = findings.filter(f => f.risk_factor === 'High').length;
    
    score -= (criticalFindings * 10) + (highFindings * 5);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const calculateComplianceScore = (stigs: STIGMapping[], testPlans: SecurityTestPlan[]): number => {
    let totalControls = 0;
    let compliantControls = 0;
    
    stigs.forEach(stig => {
      if (stig.mapping_result?.summary) {
        totalControls += stig.mapping_result.summary.total_controls;
        compliantControls += stig.mapping_result.summary.compliant_controls;
      }
    });
    
    const stigCompliance = totalControls > 0 ? (compliantControls / totalControls) * 100 : 0;
    
    // Factor in test results
    let totalTests = 0;
    let passedTests = 0;
    
    testPlans.forEach(plan => {
      const tests = plan.test_cases || [];
      totalTests += tests.length;
      passedTests += tests.filter(tc => tc.status === 'Passed').length;
    });
    
    const testCompliance = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    // Weight: 70% STIG compliance, 30% test compliance
    return Math.round((stigCompliance * 0.7) + (testCompliance * 0.3));
  };

  const calculateRiskLevel = (
    poams: POAM[], 
    findings: NessusFinding[], 
    securityScore: number
  ): 'Low' | 'Medium' | 'High' | 'Critical' => {
    const criticalPoams = poams.filter(p => p.priority === 'Critical' && p.status !== 'Completed').length;
    const criticalFindings = findings.filter(f => f.risk_factor === 'Critical').length;
    
    if (criticalPoams > 0 || criticalFindings > 5 || securityScore < 30) return 'Critical';
    if (securityScore < 50 || criticalFindings > 0) return 'High';
    if (securityScore < 70) return 'Medium';
    return 'Low';
  };

  // Aggregate all system data for group-wide metrics
  const groupAggregatedData = useMemo(() => {
    const allPoams = systemMetrics.flatMap(s => s.poams);
    const allStigs = systemMetrics.flatMap(s => s.stigMappings);
    const allTestPlans = systemMetrics.flatMap(s => s.testPlans);
    const allNotes = systemMetrics.flatMap(s => s.notes);
    const allNessusScans = systemMetrics.flatMap(s => s.nessusScans);
    const allNessusFindings = systemMetrics.flatMap(s => s.nessusFindings);
    
    const avgSecurityScore = systemMetrics.length > 0 ? 
      Math.round(systemMetrics.reduce((sum, s) => sum + s.securityScore, 0) / systemMetrics.length) : 0;
    
    const avgComplianceScore = systemMetrics.length > 0 ? 
      Math.round(systemMetrics.reduce((sum, s) => sum + s.complianceScore, 0) / systemMetrics.length) : 0;

    return {
      poams: allPoams,
      groupPoams,
      stigMappings: allStigs,
      testPlans: allTestPlans,
      notes: allNotes,
      nessusScans: allNessusScans,
      nessusFindings: allNessusFindings,
      avgSecurityScore,
      avgComplianceScore,
      systemCount: systems.length,
      activeSystemCount: systemMetrics.filter(s => 
        s.poams.length > 0 || s.stigMappings.length > 0 || s.testPlans.length > 0
      ).length
    };
  }, [systemMetrics, groupPoams, systems.length]);

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="container-responsive py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading comprehensive group metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-responsive py-8">
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Metrics</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadGroupMetrics}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Group Metrics</h1>
            <p className="text-muted-foreground">
              Comprehensive security analytics across all group systems
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <Button
            onClick={loadGroupMetrics}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* High-Level Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Systems</p>
                <p className="text-2xl font-bold text-foreground">
                  {groupAggregatedData.activeSystemCount}/{groupAggregatedData.systemCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Security Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(groupAggregatedData.avgSecurityScore)}`}>
                  {groupAggregatedData.avgSecurityScore}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Compliance</p>
                <p className={`text-2xl font-bold ${getScoreColor(groupAggregatedData.avgComplianceScore)}`}>
                  {groupAggregatedData.avgComplianceScore}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total POAMs</p>
                <p className="text-2xl font-bold text-foreground">
                  {groupAggregatedData.poams.length + groupAggregatedData.groupPoams.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {groupAggregatedData.groupPoams.length} group • {groupAggregatedData.poams.length} system
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="systems">Systems</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Group-wide charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>POAM Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusDistribution poams={[
                  ...groupAggregatedData.poams, 
                  ...groupAggregatedData.groupPoams.map(gp => ({
                    ...gp,
                    startDate: gp.start_date,
                    endDate: gp.end_date,
                    riskLevel: gp.risk_level
                  }))
                ]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <PriorityDistribution poams={[
                  ...groupAggregatedData.poams, 
                  ...groupAggregatedData.groupPoams.map(gp => ({
                    ...gp,
                    startDate: gp.start_date,
                    endDate: gp.end_date,
                    riskLevel: gp.risk_level
                  }))
                ]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>STIG Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <STIGComplianceChart 
                  compliantControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + (s.mapping_result?.summary?.compliant_controls || 0), 0
                  )}
                  nonCompliantControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + (s.mapping_result?.summary?.non_compliant_controls || 0), 0
                  )}
                  notReviewedControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + Math.max(0, (s.mapping_result?.summary?.total_controls || 0) - 
                      (s.mapping_result?.summary?.compliant_controls || 0) - 
                      (s.mapping_result?.summary?.non_compliant_controls || 0)), 0
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <SecurityTestingChart testPlans={groupAggregatedData.testPlans} />
              </CardContent>
            </Card>
          </div>

          {/* Nessus Vulnerability Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Vulnerability Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <NessusVulnerabilityChart 
                scans={groupAggregatedData.nessusScans} 
                findings={groupAggregatedData.nessusFindings} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systems" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {systemMetrics.map((system) => (
              <Card key={system.systemId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{system.systemName}</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge className={getRiskLevelColor(system.riskLevel)}>
                          {system.riskLevel} Risk
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {system.poams.length} POAMs • {system.notes.length} Notes
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Security</div>
                          <div className={`text-lg font-bold ${getScoreColor(system.securityScore)}`}>
                            {system.securityScore}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Compliance</div>
                          <div className={`text-lg font-bold ${getScoreColor(system.complianceScore)}`}>
                            {system.complianceScore}%
                          </div>
                        </div>
                        <Button
                          onClick={() => onSwitchToSystem?.(system.systemId, 'metrics')}
                          variant="outline"
                          size="sm"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium">{system.poams.length}</div>
                        <div className="text-xs text-muted-foreground">POAMs</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-sm font-medium">{system.stigMappings.length}</div>
                        <div className="text-xs text-muted-foreground">STIG Mappings</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-purple-600" />
                      <div>
                        <div className="text-sm font-medium">{system.testPlans.length}</div>
                        <div className="text-xs text-muted-foreground">Test Plans</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange-600" />
                      <div>
                        <div className="text-sm font-medium">{system.nessusFindings.length}</div>
                        <div className="text-xs text-muted-foreground">Vulnerabilities</div>
                      </div>
                    </div>
                  </div>

                  {/* System Security Progress */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Overall Security Posture</span>
                      <span>{system.securityScore}%</span>
                    </div>
                    <Progress value={system.securityScore} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Security Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemMetrics.map((system) => (
                    <div key={system.systemId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{system.systemName}</div>
                        <Progress value={system.securityScore} className="h-2 mt-1" />
                      </div>
                      <div className={`ml-4 font-bold ${getScoreColor(system.securityScore)}`}>
                        {system.securityScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Level Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Level Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Critical', 'High', 'Medium', 'Low'].map(level => {
                    const count = systemMetrics.filter(s => s.riskLevel === level).length;
                    const percentage = systemMetrics.length > 0 ? (count / systemMetrics.length) * 100 : 0;
                    
                    return (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getRiskLevelColor(level)}>{level}</Badge>
                          <span className="text-sm">{count} systems</span>
                        </div>
                        <div className="text-sm font-medium">{Math.round(percentage)}%</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vulnerability Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Vulnerability Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <NessusVulnerabilityChart 
                scans={groupAggregatedData.nessusScans} 
                findings={groupAggregatedData.nessusFindings} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemMetrics.map((system) => (
                    <div key={system.systemId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{system.systemName}</div>
                        <Progress value={system.complianceScore} className="h-2 mt-1" />
                      </div>
                      <div className={`ml-4 font-bold ${getScoreColor(system.complianceScore)}`}>
                        {system.complianceScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* STIG Compliance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>STIG Compliance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <STIGComplianceChart 
                  compliantControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + (s.mapping_result?.summary?.compliant_controls || 0), 0
                  )}
                  nonCompliantControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + (s.mapping_result?.summary?.non_compliant_controls || 0), 0
                  )}
                  notReviewedControls={groupAggregatedData.stigMappings.reduce((sum, s) => 
                    sum + Math.max(0, (s.mapping_result?.summary?.total_controls || 0) - 
                      (s.mapping_result?.summary?.compliant_controls || 0) - 
                      (s.mapping_result?.summary?.non_compliant_controls || 0)), 0
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Security Testing Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Security Testing Status</CardTitle>
            </CardHeader>
            <CardContent>
              <SecurityTestingChart testPlans={groupAggregatedData.testPlans} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-8 p-6 border-t border-border bg-muted/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground">
            <p className="font-medium">Group Security Metrics Dashboard</p>
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
}
