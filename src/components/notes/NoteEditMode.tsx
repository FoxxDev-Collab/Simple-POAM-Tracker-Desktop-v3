import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  X, 
  FolderOpen, 
  Tag, 
  Users, 
  Calendar,
  ChevronDown,
  Check,
  Folder,
  Hash
} from 'lucide-react';
import { Note, POAM } from '../../types/notes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import QuillEditor from './QuillEditor';

interface NoteEditModeProps {
  note: Note;
  poams: POAM[];
  poamSearchQuery: string;
  loadingPoams: boolean;
  onNoteChange: (field: keyof Note, value: any) => void;
  onPoamSearchChange: (query: string) => void;
  onPoamSelectionChange: (poam: POAM, isChecked: boolean) => void;
}

const NoteEditMode: React.FC<NoteEditModeProps> = ({
  note,
  poams,
  poamSearchQuery,
  loadingPoams,
  onNoteChange,
  onPoamSearchChange,
  onPoamSelectionChange,
}) => {
  const [poamDropdownOpen, setPoamDropdownOpen] = useState(false);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [newFolderInput, setNewFolderInput] = useState('');
  
  // Get all available folders from localStorage or create empty array
  const [availableFolders, setAvailableFolders] = useState<string[]>(() => {
    const storedFolders = localStorage.getItem('note-folders');
    return storedFolders ? JSON.parse(storedFolders) : [];
  });
  
  // Filter POAMs for the dropdown based on search
  const filteredPoamsForList = useMemo(() => {
    return poams
      .filter(poam => poam.title.toLowerCase().includes(poamSearchQuery.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [poams, poamSearchQuery]);
  
  const selectedPoamCount = note.poamIds?.length || 0;
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (poamDropdownOpen) {
        const container = document.querySelector('.poam-dropdown-container');
        const toggleButton = document.querySelector('.poam-dropdown-button');
        
        if ((container && container.contains(e.target as Node)) || 
            (toggleButton && toggleButton.contains(e.target as Node))) {
          return;
        }
        
        setPoamDropdownOpen(false);
      }
      
      if (folderDropdownOpen) {
        const container = document.querySelector('.folder-dropdown-container');
        const toggleButton = document.querySelector('.folder-dropdown-button');
        
        if ((container && container.contains(e.target as Node)) || 
            (toggleButton && toggleButton.contains(e.target as Node))) {
          return;
        }
        
        setFolderDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [poamDropdownOpen, folderDropdownOpen]);
  
  // Handle adding a new tag
  const handleAddTag = () => {
    if (tagInput.trim() && !note.tags?.includes(tagInput.trim())) {
      const newTags = [...(note.tags || []), tagInput.trim()];
      onNoteChange('tags', newTags);
      setTagInput('');
    }
  };
  
  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = note.tags?.filter(tag => tag !== tagToRemove) || [];
    onNoteChange('tags', newTags);
  };
  
  // Handle adding a new folder
  const handleAddFolder = () => {
    if (newFolderInput.trim() && !availableFolders.includes(newFolderInput.trim())) {
      const newFolders = [...availableFolders, newFolderInput.trim()].sort();
      setAvailableFolders(newFolders);
      localStorage.setItem('note-folders', JSON.stringify(newFolders));
      onNoteChange('folder', newFolderInput.trim());
      setNewFolderInput('');
      setFolderDropdownOpen(false);
    }
  };
  
  // Handle selecting an existing folder
  const handleSelectFolder = (folder: string) => {
    onNoteChange('folder', folder);
    setFolderDropdownOpen(false);
  };

  // Handle tag input key press
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle folder input key press
  const handleFolderKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFolder();
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Note Details</CardTitle>
          <CardDescription>Basic information about your note</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="note-title" className="text-sm font-medium">
              Title *
            </label>
            <input
              id="note-title"
              type="text"
              value={note.title}
              onChange={(e) => onNoteChange('title', e.target.value)}
              placeholder="Enter note title..."
              className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="note-date" className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date
            </label>
            <input
              id="note-date"
              type="date"
              value={note.date}
              onChange={(e) => onNoteChange('date', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Organization</CardTitle>
          <CardDescription>Organize your note with folders and tags</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Folder Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Folder
            </label>
            
            <div className="folder-dropdown-container relative">
              <Button
                type="button"
                variant="outline"
                className="folder-dropdown-button w-full justify-between"
                onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
              >
                <span className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  {note.folder || 'Select folder...'}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${folderDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              {folderDropdownOpen && (
                <div className="folder-dropdown-menu absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  <div className="p-3 border-b border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        onKeyPress={handleFolderKeyPress}
                        placeholder="Create new folder..."
                        className="flex-1 px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddFolder}
                        disabled={!newFolderInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    {note.folder && (
                      <button
                        onClick={() => handleSelectFolder('')}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                      >
                        <X className="h-3 w-3" />
                        Remove folder
                      </button>
                    )}
                    
                    {availableFolders.map((folder) => (
                      <button
                        key={folder}
                        onClick={() => handleSelectFolder(folder)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                          note.folder === folder ? 'bg-accent' : ''
                        }`}
                      >
                        <Folder className="h-3 w-3" />
                        {folder}
                        {note.folder === folder && <Check className="h-3 w-3 ml-auto" />}
                      </button>
                    ))}
                    
                    {availableFolders.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No folders yet. Create one above.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagKeyPress}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <Button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || note.tags?.includes(tagInput.trim())}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-full border"
                  >
                    <Hash className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* POAMs */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Associated POAMs
            {selectedPoamCount > 0 && (
              <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                {selectedPoamCount} selected
              </span>
            )}
          </CardTitle>
          <CardDescription>Link this note to relevant POAMs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="poam-dropdown-container relative">
            <Button
              type="button"
              variant="outline"
              className="poam-dropdown-button w-full justify-between"
              onClick={() => setPoamDropdownOpen(!poamDropdownOpen)}
              disabled={loadingPoams}
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {loadingPoams ? 'Loading POAMs...' : `Select POAMs (${selectedPoamCount} selected)`}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${poamDropdownOpen ? 'rotate-180' : ''}`} />
            </Button>
            
            {poamDropdownOpen && (
              <div className="poam-dropdown-menu absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-lg z-10 max-h-64 overflow-hidden">
                <div className="p-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={poamSearchQuery}
                      onChange={(e) => onPoamSearchChange(e.target.value)}
                      placeholder="Search POAMs..."
                      className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                
                <div className="max-h-48 overflow-y-auto">
                  {filteredPoamsForList.length > 0 ? (
                    filteredPoamsForList.map((poam) => {
                      const isSelected = note.poamIds?.includes(poam.id) || false;
                      return (
                        <label
                          key={poam.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onPoamSelectionChange(poam, e.target.checked)}
                            className="rounded border-input focus:ring-ring"
                          />
                          <span className="text-sm flex-1">{poam.title}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </label>
                      );
                    })
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {poamSearchQuery ? 'No POAMs match your search' : 'No POAMs available'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {note.poamTitles && note.poamTitles.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected POAMs:</label>
              <div className="space-y-1">
                {note.poamTitles.map((title, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-accent rounded-lg border"
                  >
                    <span className="text-sm">{title}</span>
                    <button
                      onClick={() => {
                        const poam = poams.find(p => p.title === title);
                        if (poam) {
                          onPoamSelectionChange(poam, false);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Content</CardTitle>
          <CardDescription>Write your note content using the rich text editor</CardDescription>
        </CardHeader>
        <CardContent>
          <QuillEditor
            value={note.content || ''}
            onChange={(value) => onNoteChange('content', value)}
            placeholder="Start writing your note..."
            className="w-full"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Rich text editor - Use the toolbar to format your text
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoteEditMode;