import { useEffect, useMemo, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  BarChart3,
  RefreshCcw,
  Target,
  Shield,
  CheckCircle2,
  Bug,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';

interface EnhancedGroupOverviewProps {
  groupId: string;
  systems: Array<{
    id: string;
    name: string;
    description?: string;
    owner?: string;
    classification?: string;
    tags?: string[];
  }>;
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

interface POAM {
  id: number;
  status: string;
  priority: string;
}

interface STIGMapping {
  id: string;
  mapping_result?: {
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
  test_cases: Array<{
    id: string;
    status: string;
  }>;
}

interface NessusScan {
  id: string;
  system_id: string;
}

interface NessusFinding {
  id: string;
  scan_id: string;
  risk_factor?: string; // Critical/High/Medium/Low
}

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface SystemStats {
  systemId: string;
  systemName: string;
  owner?: string;
  classification?: string;
  poamCount: number;
  stigCount: number;
  testPlanCount: number;
  vulnCount: number;
  securityScore: number;     // 0-100
  complianceScore: number;   // 0-100
  riskLevel: RiskLevel;
}

type SortKey = 'name' | 'security' | 'compliance' | 'risk';
type SortDir = 'asc' | 'desc';

export default function EnhancedGroupOverview({
  groupId,
  systems,
  onSwitchToSystem
}: EnhancedGroupOverviewProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<SystemStats[]>([]);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Colors consistent with GroupMetrics.tsx
  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case 'Critical': return 'text-red-600 bg-red-50 border border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border border-orange-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border border-green-200';
      default: return 'text-gray-600 bg-gray-50 border border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Scoring logic aligned with GroupMetrics.tsx
  const calculateSecurityScore = (
    poams: POAM[],
    stigs: STIGMapping[],
    testPlans: SecurityTestPlan[],
    findings: NessusFinding[]
  ): number => {
    let score = 100;

    const openPoams = poams.filter(p => p.status !== 'Completed' && p.status !== 'Closed');
    const criticalPoams = openPoams.filter(p => p.priority === 'Critical').length;
    const highPoams = openPoams.filter(p => p.priority === 'High').length;
    score -= (criticalPoams * 15) + (highPoams * 10) + (openPoams.length * 2);

    stigs.forEach(stig => {
      if (stig.mapping_result?.summary) {
        const total = stig.mapping_result.summary.total_controls || 0;
        const compliant = stig.mapping_result.summary.compliant_controls || 0;
        const complianceRate = total > 0 ? compliant / total : 0;
        score -= (1 - complianceRate) * 20;
      }
    });

    testPlans.forEach(plan => {
      const failedTests = plan.test_cases?.filter(tc => tc.status === 'Failed').length || 0;
      score -= failedTests * 3;
    });

    const criticalFindings = findings.filter(f => f.risk_factor === 'Critical').length;
    const highFindings = findings.filter(f => f.risk_factor === 'High').length;
    score -= (criticalFindings * 10) + (highFindings * 5);

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const calculateComplianceScore = (
    stigs: STIGMapping[],
    testPlans: SecurityTestPlan[]
  ): number => {
    let totalControls = 0;
    let compliantControls = 0;

    stigs.forEach(stig => {
      if (stig.mapping_result?.summary) {
        totalControls += stig.mapping_result.summary.total_controls || 0;
        compliantControls += stig.mapping_result.summary.compliant_controls || 0;
      }
    });
    const stigCompliance = totalControls > 0 ? (compliantControls / totalControls) * 100 : 0;

    let totalTests = 0;
    let passedTests = 0;
    testPlans.forEach(plan => {
      const tests = plan.test_cases || [];
      totalTests += tests.length;
      passedTests += tests.filter(tc => tc.status === 'Passed').length;
    });
    const testCompliance = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // 70% STIG compliance, 30% test compliance
    return Math.round((stigCompliance * 0.7) + (testCompliance * 0.3));
  };

  const calculateRiskLevel = (
    poams: POAM[],
    findings: NessusFinding[],
    securityScore: number
  ): RiskLevel => {
    const criticalPoams = poams.filter(p => p.priority === 'Critical' && p.status !== 'Completed').length;
    const criticalFindings = findings.filter(f => f.risk_factor === 'Critical').length;

    if (criticalPoams > 0 || criticalFindings > 5 || securityScore < 30) return 'Critical';
    if (securityScore < 50 || criticalFindings > 0) return 'High';
    if (securityScore < 70) return 'Medium';
    return 'Low';
  };

  // Load comprehensive stats for each system
  const loadSystemsStats = useCallback(async () => {
    if (!systems || systems.length === 0) {
      setStats([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const results = await Promise.all(
        systems.map(async (system) => {
          try {
            const [
              poams,
              stigs,
              testPlans,
              nessusScans
            ] = await Promise.all([
              invoke<POAM[]>('get_all_poams', { systemId: system.id }).catch(() => []),
              invoke<STIGMapping[]>('get_all_stig_mappings', { systemId: system.id }).catch(() => []),
              invoke<SecurityTestPlan[]>('get_all_security_test_plans', { systemId: system.id }).catch(() => []),
              invoke<NessusScan[]>('get_nessus_scans', { systemId: system.id }).catch(() => []),
            ]);

            let allFindings: NessusFinding[] = [];
            if (nessusScans && nessusScans.length > 0) {
              const findingBatches = await Promise.all(
                nessusScans.map(scan =>
                  invoke<NessusFinding[]>('get_nessus_findings_by_scan', {
                    scanId: scan.id,
                    systemId: system.id
                  }).catch(() => [])
                )
              );
              allFindings = findingBatches.flat();
            }

            const securityScore = calculateSecurityScore(poams || [], stigs || [], testPlans || [], allFindings || []);
            const complianceScore = calculateComplianceScore(stigs || [], testPlans || []);
            const riskLevel = calculateRiskLevel(poams || [], allFindings || [], securityScore);

            const item: SystemStats = {
              systemId: system.id,
              systemName: system.name,
              owner: system.owner,
              classification: system.classification,
              poamCount: (poams || []).length,
              stigCount: (stigs || []).length,
              testPlanCount: (testPlans || []).length,
              vulnCount: (allFindings || []).length,
              securityScore,
              complianceScore,
              riskLevel
            };
            return item;
          } catch (e) {
            // Return a safe default row for this system
            return {
              systemId: system.id,
              systemName: system.name,
              owner: system.owner,
              classification: system.classification,
              poamCount: 0,
              stigCount: 0,
              testPlanCount: 0,
              vulnCount: 0,
              securityScore: 0,
              complianceScore: 0,
              riskLevel: 'Medium' as RiskLevel
            } as SystemStats;
          }
        })
      );

      setStats(results);
    } catch (e) {
      const msg = `Failed to load overview stats: ${e}`;
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  }, [systems]);

  useEffect(() => {
    loadSystemsStats();
  }, [groupId, systems, loadSystemsStats]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = stats.filter(s => {
      if (!q) return true;
      return (
        s.systemName.toLowerCase().includes(q) ||
        (s.owner?.toLowerCase().includes(q) ?? false) ||
        (s.classification?.toLowerCase().includes(q) ?? false)
      );
    });

    rows = rows.sort((a, b) => {
      let val = 0;
      switch (sortKey) {
        case 'name':
          val = a.systemName.localeCompare(b.systemName);
          break;
        case 'security':
          val = a.securityScore - b.securityScore;
          break;
        case 'compliance':
          val = a.complianceScore - b.complianceScore;
          break;
        case 'risk': {
          // Order: Critical > High > Medium > Low (desc means Critical first)
          const order: Record<RiskLevel, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          val = order[a.riskLevel] - order[b.riskLevel];
          break;
        }
      }
      return sortDir === 'asc' ? val : -val;
    });

    return rows;
  }, [stats, query, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="container-responsive py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading systems overview…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-responsive py-8">
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Overview</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadSystemsStats}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
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
            <h1 className="text-3xl font-bold text-foreground">Group Systems Overview</h1>
            <p className="text-muted-foreground">
              Quick view of systems with key security and compliance stats
            </p>
          </div>
        </div>
        <div className="button-group">
          <Button onClick={loadSystemsStats} variant="outline">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by system name, owner, or classification…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Enhanced Systems Grid */}
      <div className="space-y-4">
        {/* Sort Controls */}
        <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-slate-700">Sort by:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={sortKey === 'name' ? 'default' : 'outline'}
                  onClick={() => toggleSort('name')}
                  className="h-8"
                >
                  Name
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === 'security' ? 'default' : 'outline'}
                  onClick={() => toggleSort('security')}
                  className="h-8"
                >
                  Security
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === 'compliance' ? 'default' : 'outline'}
                  onClick={() => toggleSort('compliance')}
                  className="h-8"
                >
                  Compliance
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === 'risk' ? 'default' : 'outline'}
                  onClick={() => toggleSort('risk')}
                  className="h-8"
                >
                  Risk Level
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="ml-auto text-sm text-slate-600">
                {filteredAndSorted.length} system{filteredAndSorted.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Systems Cards */}
        {filteredAndSorted.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No systems found</h3>
              <p className="text-slate-500">Try adjusting your search criteria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:gap-6">
            {filteredAndSorted.map(row => (
              <Card 
                key={row.systemId} 
                className="group hover:shadow-lg transition-all duration-300 border-l-4 hover:border-l-primary bg-gradient-to-r from-white to-slate-50/30"
                style={{
                  borderLeftColor: row.riskLevel === 'Critical' ? '#dc2626' :
                                 row.riskLevel === 'High' ? '#ea580c' :
                                 row.riskLevel === 'Medium' ? '#d97706' : '#16a34a'
                }}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* System Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {row.systemName}
                          </h3>
                          <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-600">
                            {row.owner && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Owner:</span> {row.owner}
                              </span>
                            )}
                            {row.classification && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Class:</span> 
                                <Badge variant="secondary" className="text-xs">{row.classification}</Badge>
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={`${getRiskLevelColor(row.riskLevel)} font-semibold`}>
                          {row.riskLevel} Risk
                        </Badge>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
                      {/* Security Score */}
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(row.securityScore)}`}>
                          {row.securityScore}%
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Security</div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              row.securityScore >= 80 ? 'bg-green-500' :
                              row.securityScore >= 60 ? 'bg-blue-500' :
                              row.securityScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${row.securityScore}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Compliance Score */}
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(row.complianceScore)}`}>
                          {row.complianceScore}%
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Compliance</div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              row.complianceScore >= 80 ? 'bg-green-500' :
                              row.complianceScore >= 60 ? 'bg-blue-500' :
                              row.complianceScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${row.complianceScore}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* POAMs */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-2xl font-bold text-foreground">{row.poamCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">POAMs</div>
                      </div>

                      {/* STIGs */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Shield className="h-4 w-4 text-purple-600" />
                          <span className="text-2xl font-bold text-foreground">{row.stigCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">STIGs</div>
                      </div>

                      {/* Test Plans */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-2xl font-bold text-foreground">{row.testPlanCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Tests</div>
                      </div>

                      {/* Vulnerabilities */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Bug className="h-4 w-4 text-red-600" />
                          <span className="text-2xl font-bold text-foreground">{row.vulnCount}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Vulns</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 lg:min-w-[140px]">
                      <Button
                        size="sm"
                        onClick={() => onSwitchToSystem?.(row.systemId, 'metrics')}
                        className="w-full justify-start bg-primary hover:bg-primary/90"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSwitchToSystem?.(row.systemId, 'poams')}
                          className="text-xs"
                        >
                          POAMs
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSwitchToSystem?.(row.systemId, 'stig')}
                          className="text-xs"
                        >
                          STIG
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSwitchToSystem?.(row.systemId, 'testing')}
                          className="text-xs"
                        >
                          Testing
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSwitchToSystem?.(row.systemId, 'vulnerabilities')}
                          className="text-xs"
                        >
                          Vulns
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}