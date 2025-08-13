import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSystem } from '../../context/SystemContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Shield } from 'lucide-react';

interface POAM {
  id: number;
  title: string;
  status: string;
}

interface ControlAssociation {
  id: string;
  control_id: string;
  poam_id: number;
  association_date: string;
}

export default function NistAssociationSummary() {
  const { currentSystem } = useSystem();
  const [poams, setPoams] = useState<POAM[]>([]);
  const [associationsByPoam, setAssociationsByPoam] = useState<Record<number, ControlAssociation[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!currentSystem?.id) return;
      setLoading(true);
      try {
        const loadedPoams = await invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id }).catch(() => []);
        if (isCancelled) return;
        setPoams(loadedPoams || []);

        const assocMap: Record<number, ControlAssociation[]> = {};
        // fetch associations for each POAM (desktop scope)
        await Promise.all(
          (loadedPoams || []).map(async (p) => {
            try {
              const items = await invoke<ControlAssociation[]>('get_control_associations_by_poam', {
                poamId: p.id,
                systemId: currentSystem.id,
              });
              assocMap[p.id] = items || [];
            } catch {
              assocMap[p.id] = [];
            }
          })
        );
        if (isCancelled) return;
        setAssociationsByPoam(assocMap);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };
    load();
    return () => { isCancelled = true; };
  }, [currentSystem?.id]);

  const summary = useMemo(() => {
    const totalPoams = poams.length;
    const poamsWithAssociations = poams.filter((p) => (associationsByPoam[p.id]?.length || 0) > 0).length;
    const totalAssociations = Object.values(associationsByPoam).reduce((acc, list) => acc + (list?.length || 0), 0);

    // Top controls by count
    const controlCount: Record<string, number> = {};
    Object.values(associationsByPoam).forEach((list) => {
      (list || []).forEach((a) => {
        controlCount[a.control_id] = (controlCount[a.control_id] || 0) + 1;
      });
    });
    const topControls = Object.entries(controlCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalPoams, poamsWithAssociations, totalAssociations, topControls };
  }, [poams, associationsByPoam]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          NIST Associations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">POAMs with NIST controls</div>
                <div className="text-2xl font-semibold">{summary.poamsWithAssociations}/{summary.totalPoams}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Total associations</div>
                <div className="text-2xl font-semibold">{summary.totalAssociations}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <div className="text-xs text-muted-foreground">Avg controls per POAM</div>
                <div className="text-2xl font-semibold">
                  {summary.totalPoams > 0 ? (summary.totalAssociations / summary.totalPoams).toFixed(1) : '0.0'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Top associated controls</div>
              {summary.topControls.length === 0 ? (
                <div className="text-sm text-muted-foreground">No associations yet</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.topControls.map(([controlId, count]) => (
                    <Badge key={controlId} variant="outline">
                      {controlId} — {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


