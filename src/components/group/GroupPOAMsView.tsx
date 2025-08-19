import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Target, Plus, Edit, Trash2, Clock, AlertTriangle, Users } from 'lucide-react';
import type { GroupPOAM } from '../../types/group';

interface GroupPOAMsViewProps {
  groupPOAMs: GroupPOAM[];
  isLoading: boolean;
  systems: any[];
  onEditPOAM: (poam: GroupPOAM) => void;
  onDeletePOAM: (poamId: number) => void;
  onCreatePOAM: () => void;
}

export default function GroupPOAMsView({ 
  groupPOAMs, 
  isLoading, 
  systems,
  onEditPOAM,
  onDeletePOAM,
  onCreatePOAM
}: GroupPOAMsViewProps) {

  const getSystemName = (systemId: string) => {
    const system = systems.find(s => s.id === systemId);
    return system?.name || systemId;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const isOverdue = (endDate: string, status: string) => {
    if (!endDate || status.toLowerCase() === 'completed' || status.toLowerCase() === 'closed') {
      return false;
    }
    return new Date(endDate) < new Date();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'default';
      case 'in progress': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      case 'low': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const calculateStats = () => {
    const total = groupPOAMs.length;
    const completed = groupPOAMs.filter(p => p.status.toLowerCase() === 'completed').length;
    const active = groupPOAMs.filter(p => p.status.toLowerCase() === 'in progress').length;
    const overdue = groupPOAMs.filter(p => isOverdue(p.end_date, p.status)).length;
    const totalSystems = new Set(groupPOAMs.flatMap(p => p.affected_systems)).size;
    return { total, completed, active, overdue, totalSystems };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Group POAMs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Cross-system action items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active POAMs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue POAMs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Systems Affected</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSystems}</div>
            <p className="text-xs text-muted-foreground">Unique systems involved</p>
          </CardContent>
        </Card>
      </div>

      {/* POAMs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Group POAMs</CardTitle>
              <CardDescription>Action items that span across multiple systems in the group</CardDescription>
            </div>
            <Button onClick={onCreatePOAM}>
              <Plus className="w-4 h-4 mr-2" />
              Create Group POAM
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8"><div className="text-muted-foreground">Loading group POAMs...</div></div>
          ) : groupPOAMs.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Group POAMs</h3>
              <p className="text-muted-foreground mb-4">Create your first Group POAM to track cross-system security issues</p>
              <Button onClick={onCreatePOAM}>
                <Plus className="w-4 h-4 mr-2" />
                Create Group POAM
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Affected Systems</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupPOAMs.map((poam) => (
                  <TableRow key={poam.id}>
                    <TableCell>
                      <div className="font-medium">{poam.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{poam.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(poam.status)}>{poam.status}</Badge>
                      {isOverdue(poam.end_date, poam.status) && (
                        <Badge variant="destructive" className="ml-1">OVERDUE</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={getPriorityBadgeVariant(poam.priority)}>{poam.priority}</Badge></TableCell>
                    <TableCell><div className={`font-medium ${getRiskLevelColor(poam.risk_level)}`}>{poam.risk_level}</div></TableCell>
                    <TableCell>
                      <div className="font-medium">{poam.affected_systems.length} systems</div>
                      <div className="text-sm text-muted-foreground">
                        {poam.affected_systems.slice(0, 2).map(systemId => getSystemName(systemId)).join(', ')}
                        {poam.affected_systems.length > 2 && ` +${poam.affected_systems.length - 2} more`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatDate(poam.end_date)}</div>
                      {poam.milestones.length > 0 && (
                        <div className="text-sm text-muted-foreground">{poam.milestones.length} milestones</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditPOAM(poam)} title="Edit POAM">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeletePOAM(poam.id)} title="Delete POAM">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
