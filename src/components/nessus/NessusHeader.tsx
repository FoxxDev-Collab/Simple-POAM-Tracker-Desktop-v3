import React from 'react';
import { Shield, Save, Download, X } from 'lucide-react';
import { Button } from '../ui/button';

interface NessusHeaderProps {
  currentSystemName: string;
  hasResults: boolean;
  loading: boolean;
  onOpenPrepDialog: () => void;
  onExport: () => void;
  onDeleteMapping: () => void;
}

export const NessusHeader: React.FC<NessusHeaderProps> = ({
  currentSystemName,
  hasResults,
  loading,
  onOpenPrepDialog,
  onExport,
  onDeleteMapping
}) => {
  return (
    <div className="responsive-header">
      <div className="flex items-center gap-3 title-row">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nessus Center</h1>
          <p className="text-muted-foreground">
            Analyze and manage Nessus vulnerability scans for {currentSystemName}
          </p>
        </div>
      </div>

      {hasResults && (
        <div className="button-group">
          <Button
            variant="outline" 
            onClick={onOpenPrepDialog}
            disabled={loading}
            className="btn-responsive"
          >
            <Save className="mr-2 h-4 w-4" />
            <span className="hide-mobile">Create Prep List</span>
            <span className="show-mobile">Prep</span>
          </Button>
          <Button
            variant="outline"
            onClick={onExport}
            disabled={loading}
            className="btn-responsive"
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hide-mobile">Export</span>
            <span className="show-mobile">Export</span>
          </Button>
          <Button 
            variant="destructive" 
            onClick={onDeleteMapping}
            disabled={loading}
            className="btn-responsive"
          >
            <X className="mr-2 h-4 w-4" />
            <span className="hide-mobile">Delete Analysis</span>
            <span className="show-mobile">Delete</span>
          </Button>
        </div>
      )}
    </div>
  );
};