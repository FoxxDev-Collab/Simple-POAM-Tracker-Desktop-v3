import React from 'react';
import { X, Maximize2, Minimize2, Edit, Save, Trash2, Eye } from 'lucide-react';
import { Note, NoteModal as NoteModalType, POAM } from '../../types/notes';
import { Button } from '../ui/button';
import NoteViewMode from './NoteViewMode';
import NoteEditMode from './NoteEditMode';

interface NoteModalProps {
  modal: NoteModalType;
  poams: POAM[];
  poamSearchQuery: string;
  loadingPoams: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onSave: (note: Note) => void;
  onDelete: (id: string) => void;
  onSwitchToEdit: () => void;
  onNoteChange: (field: keyof Note, value: any) => void;
  onPoamSearchChange: (query: string) => void;
  onPoamSelectionChange: (poam: POAM, isChecked: boolean) => void;
}

const NoteModal: React.FC<NoteModalProps> = ({
  modal,
  poams,
  poamSearchQuery,
  loadingPoams,
  onClose,
  onToggleFullscreen,
  onSave,
  onDelete,
  onSwitchToEdit,
  onNoteChange,
  onPoamSearchChange,
  onPoamSelectionChange
}) => {
  const getModalTitle = () => {
    switch (modal.mode) {
      case 'create':
        return 'Create New Note';
      case 'edit':
        return 'Edit Note';
      case 'view':
        return modal.note.title || 'Untitled Note';
      default:
        return 'Note';
    }
  };

  const getModalIcon = () => {
    switch (modal.mode) {
      case 'view':
        return <Eye className="h-5 w-5" />;
      case 'edit':
        return <Edit className="h-5 w-5" />;
      case 'create':
        return <Edit className="h-5 w-5" />;
      default:
        return <Edit className="h-5 w-5" />;
    }
  };

  const handleSave = () => {
    // Basic validation
    if (!modal.note.title.trim()) {
      alert('Please enter a title for the note.');
      return;
    }
    
    onSave(modal.note);
  };

  const handleDelete = () => {
    const confirmMessage = `Are you sure you want to delete "${modal.note.title || 'this note'}"?`;
    if (window.confirm(confirmMessage)) {
      onDelete(modal.note.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-background border border-border rounded-lg shadow-2xl flex flex-col transition-all duration-200 ${
        modal.isFullscreen 
          ? 'fixed inset-4 w-auto h-auto' 
          : 'w-full max-w-5xl h-[85vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {getModalIcon()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {getModalTitle()}
              </h2>
              {modal.mode !== 'create' && (
                <p className="text-sm text-muted-foreground">
                  {modal.mode === 'view' ? 'Viewing note' : 'Editing note'}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullscreen}
              className="h-8 w-8 p-0"
            >
              {modal.isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {modal.mode === 'view' ? (
            <NoteViewMode note={modal.note} />
          ) : (
            <NoteEditMode 
              note={modal.note}
              poams={poams}
              poamSearchQuery={poamSearchQuery}
              loadingPoams={loadingPoams}
              onNoteChange={onNoteChange}
              onPoamSearchChange={onPoamSearchChange}
              onPoamSelectionChange={onPoamSelectionChange}
            />
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-card rounded-b-lg flex-shrink-0">
          <div className="flex items-center gap-3">
            {modal.mode === 'edit' && (
              <Button 
                variant="destructive"
                onClick={handleDelete}
                size="sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Note
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {modal.mode === 'view' ? (
              <>
                <Button 
                  variant="outline"
                  onClick={onClose}
                >
                  Close
                </Button>
                <Button 
                  onClick={onSwitchToEdit}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Note
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {modal.mode === 'create' ? 'Create Note' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteModal;