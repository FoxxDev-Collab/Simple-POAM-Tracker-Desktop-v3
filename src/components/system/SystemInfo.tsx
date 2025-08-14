import { useSystem } from '../../context/SystemContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Building, Database, Shield, Tag, User, Clock } from 'lucide-react';

export default function SystemInfo() {
  const { currentSystem } = useSystem();

  if (!currentSystem) {
    return (
      <div className="text-center p-12 text-muted-foreground">
        No system selected.
      </div>
    );
  }

  const getClassificationClasses = (classification?: string) => {
    switch (classification?.toUpperCase()) {
      case 'UNCLASSIFIED':
        return 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
      case 'CONFIDENTIAL':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
      case 'SECRET':
        return 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
      case 'TOP SECRET':
        return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
    }
  };

  const getSystemStats = () => {
    const stats: string[] = [];
    if (currentSystem.poam_count > 0) stats.push(`${currentSystem.poam_count} POAMs`);
    if (currentSystem.notes_count > 0) stats.push(`${currentSystem.notes_count} Notes`);
    if (currentSystem.stig_mappings_count > 0) stats.push(`${currentSystem.stig_mappings_count} STIG Mappings`);
    if (currentSystem.test_plans_count > 0) stats.push(`${currentSystem.test_plans_count} Test Plans`);
    return stats.length > 0 ? stats.join(' • ') : 'No data yet';
  };

  const formatLastAccessed = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold tracking-tight title-row">System Info</h1>
          <p className="text-muted-foreground mt-1">Details of the active system</p>
        </div>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Building className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{currentSystem.name || 'Unnamed System'}</CardTitle>
              <CardDescription>{currentSystem.description || 'No description'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              {currentSystem.owner && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Owner: <span className="font-medium text-foreground">{currentSystem.owner}</span>
                  </span>
                </div>
              )}
              {currentSystem.classification && (
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    Classification:
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getClassificationClasses(currentSystem.classification)}`}>
                      {currentSystem.classification}
                    </span>
                  </div>
                </div>
              )}
              {currentSystem.tags && currentSystem.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {currentSystem.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span>{getSystemStats()}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Last accessed: {formatLastAccessed(currentSystem.last_accessed)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


