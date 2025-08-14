import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { 
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Target,
  TrendingUp,
  Plus,
  FileText,
  Shield,
  Paperclip} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useToast } from '../../context/ToastContext'
import { useSystem } from '../../context/SystemContext'
import { useTabNavigation } from '../../context/TabContext'
import { formatDate } from '../../lib/utils'
import { Doughnut } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import { Milestone } from '../../types/Milestone'

Chart.register(...registerables)

interface POAMStats {
  total: number
  open: number
  closed: number
  overdue: number
}

interface MilestoneStats {
  total: number
  completed: number
  inProgress: number
  notStarted: number
  delayed: number
}

interface STIGStats {
  totalMappings: number
  totalControls: number
  compliantControls: number
  nonCompliantControls: number
  notReviewedControls: number
}

interface SecurityTestPlanStats {
  totalPlans: number
  activePlans: number
  completedPlans: number
  totalTestCases: number
  passedTests: number
  failedTests: number
  evidenceCollected: number
  totalEvidenceFiles: number
}

export default function ModernDashboard() {
  const [poamStats, setPOAMStats] = useState<POAMStats>({
    total: 0,
    open: 0,
    closed: 0,
    overdue: 0
  })
  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    delayed: 0
  })
  const [stigStats, setSTIGStats] = useState<STIGStats>({
    totalMappings: 0,
    totalControls: 0,
    compliantControls: 0,
    nonCompliantControls: 0,
    notReviewedControls: 0
  })
  const [testPlanStats, setTestPlanStats] = useState<SecurityTestPlanStats>({
    totalPlans: 0,
    activePlans: 0,
    completedPlans: 0,
    totalTestCases: 0,
    passedTests: 0,
    failedTests: 0,
    evidenceCollected: 0,
    totalEvidenceFiles: 0
  })
  const [upcomingMilestones, setUpcomingMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const { currentSystem } = useSystem()
  const { setActiveTab } = useTabNavigation()

  useEffect(() => {
    if (currentSystem) {
      loadDashboardData()
    }
  }, [currentSystem])

  const loadDashboardData = async () => {
    if (!currentSystem) {
      showToast('error', 'No system selected')
      return
    }

    try {
      setLoading(true)
      
      // Load all data in parallel
      const [poams, stigMappings, testPlans] = await Promise.all([
        invoke<any[]>('get_all_poams', { systemId: currentSystem.id }).catch(() => []),
        invoke<any[]>('get_all_stig_mappings', { systemId: currentSystem.id }).catch(() => []),
        invoke<any[]>('get_all_security_test_plans', { systemId: currentSystem.id }).catch(() => [])
      ])

      // Calculate POAM stats
      if (poams) {
        const total = poams.length
        const closed = poams.filter(poam => poam.status === 'Completed' || poam.status === 'Closed').length
        const open = total - closed
        const overdue = poams.filter(poam => {
          return poam.status !== 'Completed' && 
                 poam.status !== 'Closed' && 
                 new Date(poam.dueDate) < new Date()
        }).length

        setPOAMStats({ total, open, closed, overdue })

        // Extract and analyze milestones
        const allMilestones: Milestone[] = []
        poams.forEach(poam => {
          const poamMilestones = poam.milestones.map((milestone: any) => ({
            ...milestone,
            poamTitle: poam.title,
            poamId: poam.id
          }))
          allMilestones.push(...poamMilestones)
        })

        // Calculate milestone stats
        const milestoneTotal = allMilestones.length
        const milestoneCompleted = allMilestones.filter(m => m.status === 'Completed').length
        const milestoneInProgress = allMilestones.filter(m => m.status === 'In Progress').length
        const milestoneNotStarted = allMilestones.filter(m => m.status === 'Not Started').length
        const milestoneDelayed = allMilestones.filter(m => m.status === 'Delayed').length

        setMilestoneStats({
          total: milestoneTotal,
          completed: milestoneCompleted,
          inProgress: milestoneInProgress,
          notStarted: milestoneNotStarted,
          delayed: milestoneDelayed
        })

        // Get upcoming milestones (next 30 days)
        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)

        const upcoming = allMilestones
          .filter(milestone => {
            const dueDate = new Date(milestone.dueDate)
            return milestone.status !== 'Completed' && 
                   dueDate >= today && 
                   dueDate <= thirtyDaysFromNow
          })
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, 5) // Limit to 5 most upcoming

        setUpcomingMilestones(upcoming)
      }

      // Calculate STIG Mapping stats
      if (stigMappings) {
        const totalMappings = stigMappings.length
        let totalControls = 0
        let compliantControls = 0
        let nonCompliantControls = 0
        let highRiskFindings = 0

        stigMappings.forEach(mapping => {
          // Use the summary data directly from the mapping result (same as STIG Mapper component)
          if (mapping.mapping_result?.summary) {
            totalControls += mapping.mapping_result.summary.total_controls || 0
            compliantControls += mapping.mapping_result.summary.compliant_controls || 0
            nonCompliantControls += mapping.mapping_result.summary.non_compliant_controls || 0
            highRiskFindings += mapping.mapping_result.summary.high_risk_findings || 0
          }
        })

        setSTIGStats({
          totalMappings,
          totalControls,
          compliantControls,
          nonCompliantControls,
          notReviewedControls: totalControls - compliantControls - nonCompliantControls
        })
      }

      // Calculate Security Test Plan stats
      if (testPlans) {
        const totalPlans = testPlans.length
        const activePlans = testPlans.filter(p => p.status === 'In Progress').length
        const completedPlans = testPlans.filter(p => p.status === 'Completed').length
        
        let totalTestCases = 0
        let passedTests = 0
        let failedTests = 0
        let evidenceCollected = 0
        let totalEvidenceFiles = 0

        testPlans.forEach(plan => {
          if (plan.test_cases) {
            totalTestCases += plan.test_cases.length
            passedTests += plan.test_cases.filter((tc: any) => tc.status === 'Passed').length
            failedTests += plan.test_cases.filter((tc: any) => tc.status === 'Failed').length
            
            plan.test_cases.forEach((tc: any) => {
              if (tc.evidence_files && tc.evidence_files.length > 0) {
                evidenceCollected++
                totalEvidenceFiles += tc.evidence_files.length
              }
            })
          }
        })

        setTestPlanStats({
          totalPlans,
          activePlans,
          completedPlans,
          totalTestCases,
          passedTests,
          failedTests,
          evidenceCollected,
          totalEvidenceFiles
        })
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      showToast('error', `Failed to load dashboard data: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Chart configurations
  const statusChartData = {
    labels: ['Not Started', 'In Progress', 'Completed', 'Delayed'],
    datasets: [{
      data: [milestoneStats.notStarted, milestoneStats.inProgress, milestoneStats.completed, milestoneStats.delayed],
      backgroundColor: [
        '#9ca3af',
        '#2563eb',
        '#10b981',
        '#f59e0b'
      ],
      borderWidth: 0
    }]
  }

  const statusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 }
        }
      }
    }
  }

  const StatCard = ({ title, value, description, icon: Icon, trend }: {
    title: string
    value: string | number
    description: string
    icon: React.ComponentType<{ className?: string }>
    trend?: string
  }) => (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const MilestoneCard = ({ milestone }: { milestone: Milestone }) => {
    const daysUntil = Math.ceil((new Date(milestone.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntil < 0
    
    return (
      <div className="flex items-center space-x-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
        <div className={`w-2 h-2 rounded-full ${
          milestone.status === 'Completed' ? 'bg-green-500' :
          milestone.status === 'In Progress' ? 'bg-blue-500' :
          milestone.status === 'Delayed' || isOverdue ? 'bg-red-500' :
          'bg-gray-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{milestone.title}</p>
          <p className="text-xs text-muted-foreground truncate">{milestone.poamTitle}</p>
        </div>
        <div className="text-right">
          <Badge variant={isOverdue ? 'destructive' : 'secondary'} size="sm">
            {isOverdue ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(milestone.dueDate)}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold title-row">Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="skeleton h-4 w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="skeleton h-8 w-16 mb-2"></div>
                <div className="skeleton h-3 w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="responsive-header title-row">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your POAMs, STIG mappings, and security testing progress.
          </p>
        </div>
        <Button className="btn-responsive flex items-center gap-2" onClick={() => setActiveTab('create-poam')}>
          <Plus className="h-4 w-4" />
          Create POAM
        </Button>
      </div>

      {/* POAM Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total POAMs"
          value={poamStats.total}
          description="Active plans of action"
          icon={Target}
          trend="+2 from last month"
        />
        <StatCard
          title="Open POAMs"
          value={poamStats.open}
          description="Currently in progress"
          icon={Clock}
        />
        <StatCard
          title="Completed"
          value={poamStats.closed}
          description="Successfully closed"
          icon={CheckCircle}
        />
        <StatCard
          title="Overdue"
          value={poamStats.overdue}
          description="Require immediate attention"
          icon={AlertTriangle}
        />
      </div>

      {/* STIG and Security Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="STIG Controls"
          value={stigStats.totalControls}
          description="Security controls mapped"
          icon={Shield}
        />
        <StatCard
          title="Compliant Controls"
          value={stigStats.compliantControls}
          description="Meeting requirements"
          icon={CheckCircle}
        />
        <StatCard
          title="Test Plans"
          value={testPlanStats.totalPlans}
          description="Security test plans"
          icon={FileText}
        />
        <StatCard
          title="Evidence Files"
          value={testPlanStats.totalEvidenceFiles}
          description="Supporting evidence"
          icon={Paperclip}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Milestone Status Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Milestone Status</CardTitle>
            <CardDescription>Distribution of milestone completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Doughnut data={statusChartData} options={statusChartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Security Test Progress */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Security Testing Progress</CardTitle>
            <CardDescription>Test execution and evidence collection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Test Cases Passed</span>
                <span>{testPlanStats.passedTests}/{testPlanStats.totalTestCases}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${testPlanStats.totalTestCases > 0 ? (testPlanStats.passedTests / testPlanStats.totalTestCases) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Evidence Collected</span>
                <span>{testPlanStats.evidenceCollected}/{testPlanStats.totalTestCases}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${testPlanStats.totalTestCases > 0 ? (testPlanStats.evidenceCollected / testPlanStats.totalTestCases) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{testPlanStats.passedTests}</div>
                <div className="text-xs text-muted-foreground">Passed Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{testPlanStats.failedTests}</div>
                <div className="text-xs text-muted-foreground">Failed Tests</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Milestones */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
            <CardDescription>Next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMilestones.length > 0 ? (
                upcomingMilestones.map((milestone) => (
                  <MilestoneCard key={milestone.id} milestone={milestone} />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming milestones</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STIG Compliance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>STIG Compliance Overview</CardTitle>
          <CardDescription>Security Technical Implementation Guide compliance status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid-responsive grid-responsive-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stigStats.compliantControls}</div>
              <div className="text-sm text-green-600">Compliant</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stigStats.nonCompliantControls}</div>
              <div className="text-sm text-red-600">Non-Compliant</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stigStats.notReviewedControls}</div>
              <div className="text-sm text-yellow-600">Not Reviewed</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stigStats.totalMappings}</div>
              <div className="text-sm text-blue-600">STIG Mappings</div>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  )
} 