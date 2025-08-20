import React from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '../ui/button';
import { NessusPrepDialog as NessusPrepDialogType } from './types';

interface NessusPrepDialogProps {
  dialog: NessusPrepDialogType;
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}

export const NessusPrepDialog: React.FC<NessusPrepDialogProps> = ({
  dialog,
  loading,
  onClose,
  onSave,
  onNameChange,
  onDescriptionChange
}) => {
  if (!dialog.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Create Nessus Prep List</h3>
              <p className="text-sm text-muted-foreground">
                Create a new vulnerability preparation list
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Prep List Name *
            </label>
            <input
              type="text"
              value={dialog.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Enter a descriptive name for this prep list"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              value={dialog.description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent h-20 resize-none"
              placeholder="Optional description of this prep list"
              disabled={loading}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-card rounded-b-lg">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={onSave}
            disabled={!dialog.name.trim() || loading}
          >
            {loading ? 'Saving...' : 'Save Prep List'}
          </Button>
        </div>
      </div>
    </div>
  );
};