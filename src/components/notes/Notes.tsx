import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { useSystem } from '../../context/SystemContext';
import { 
  Search, 
  Plus, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Grid3X3, 
  List, 
  FileText, 
  Tag, 
  FolderOpen, 
  Calendar,
  Users,
  Edit,
  Trash2,
  Eye,
  X,
  Folder,
  ChevronRight,
  Archive
} from 'lucide-react';

import { Note, POAM, NoteModal as NoteModalType, SortableNoteKey, NoteResponse } from '../../types/notes';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import NoteModal from './NoteModal';
import { createEmptyNote, sortNotes, filterNotes } from './noteUtils';

type ViewMode = 'grid' | 'list';

const Notes: React.FC = () => {
  // Core state
  const [notes, setNotes] = useState<Note[]>([]);
  const [poams, setPoams] = useState<POAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPoams, setLoadingPoams] = useState(true);
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Modal state
  const [modal, setModal] = useState<NoteModalType | null>(null);
  const [poamSearchQuery, setPoamSearchQuery] = useState('');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortableNoteKey | null; direction: 'asc' | 'desc' }>({ 
    key: 'date', 
    direction: 'desc' 
  });

  const { showToast } = useToast();
  const { currentSystem } = useSystem();

  // Check if system is selected
  if (!currentSystem) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No system selected. Please select a system to view notes.</p>
      </div>
    );
  }

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [currentSystem?.id]);

  // Get folder structure with note counts
  const folderStructure = useMemo(() => {
    const folderMap = new Map<string, Note[]>();
    const notesWithoutFolder: Note[] = [];
    
    notes.forEach(note => {
      if (note.folder && note.folder.trim()) {
        if (!folderMap.has(note.folder)) {
          folderMap.set(note.folder, []);
        }
        folderMap.get(note.folder)!.push(note);
      } else {
        notesWithoutFolder.push(note);
      }
    });

    const folders = Array.from(folderMap.entries())
      .map(([name, folderNotes]) => ({
        name,
        notes: folderNotes,
        count: folderNotes.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      folders,
      notesWithoutFolder,
      totalNotes: notes.length
    };
  }, [notes]);

  // Get unique tags from notes
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      if (note.tags) note.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [notes]);

  // Get current notes based on selected folder
  const currentFolderNotes = useMemo(() => {
    if (selectedFolder === null) {
      return notes;
    } else if (selectedFolder === '') {
      return folderStructure.notesWithoutFolder;
    } else {
      const folder = folderStructure.folders.find(f => f.name === selectedFolder);
      return folder ? folder.notes : [];
    }
  }, [notes, selectedFolder, folderStructure]);

  // Filter and sort notes
  const processedNotes = useMemo(() => {
    let filtered = filterNotes(currentFolderNotes, searchQuery);
    
    if (selectedTag) {
      filtered = filtered.filter(note => 
        note.tags && note.tags.includes(selectedTag)
      );
    }
    
    return sortNotes(filtered, sortConfig);
  }, [currentFolderNotes, searchQuery, selectedTag, sortConfig]);

  // Load notes and POAMs data
  const loadData = async () => {
    if (!currentSystem?.id) {
      console.log('No current system selected, skipping notes load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const [notesData, poamsData] = await Promise.all([
        invoke<NoteResponse[]>('get_all_notes', { systemId: currentSystem.id }),
        invoke<POAM[]>('get_all_poams', { systemId: currentSystem.id }).catch(() => [])
      ]);
      
      // Convert backend response to frontend Note format
      const processedNotes = notesData.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        date: note.date,
        poamIds: note.poam_ids?.map(id => typeof id === 'string' ? parseInt(id, 10) : id) || [],
        poamTitles: note.poam_titles || [],
        folder: note.folder,
        tags: note.tags || []
      }));
      
      setNotes(processedNotes);
      setPoams(poamsData || []);
      setLoadingPoams(false);
      
    } catch (error) {
      console.error('Error loading notes:', error);
      showToast('error', `Failed to load notes: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle table sorting
  const handleSort = (key: SortableNoteKey) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Modal handlers
  const openCreateModal = () => {
    const newNote = createEmptyNote();
    // If a folder is selected, pre-populate it
    if (selectedFolder && selectedFolder !== '') {
      newNote.folder = selectedFolder;
    }
    setModal({
      mode: 'create',
      note: newNote,
      isFullscreen: false
    });
    setPoamSearchQuery('');
  };

  const openEditModal = (note: Note) => {
    setModal({
      mode: 'edit',
      note: { ...note },
      isFullscreen: false
    });
    setPoamSearchQuery('');
  };

  const openViewModal = (note: Note) => {
    setModal({
      mode: 'view',
      note: { ...note },
      isFullscreen: false
    });
  };

  const closeModal = () => {
    setModal(null);
    setPoamSearchQuery('');
  };

  const switchToEditMode = () => {
    if (modal && modal.mode === 'view') {
      setModal({
        ...modal,
        mode: 'edit'
      });
    }
  };

  const toggleFullscreen = () => {
    if (modal) {
      setModal({
        ...modal,
        isFullscreen: !modal.isFullscreen
      });
    }
  };

  // Note operations
  const handleDeleteNote = async (id: string) => {
    try {
      await invoke('delete_note', { 
        noteId: id,
        systemId: currentSystem.id 
      });
      setNotes(notes.filter(note => note.id !== id));
      showToast('success', 'Note deleted successfully');
      if (modal && modal.note.id === id) {
        closeModal();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('error', `Failed to delete note: ${error}`);
    }
  };

  const handleSaveNote = async (noteToSave: Note) => {
    try {
      if (modal?.mode === 'create') {
        await invoke('create_note', { 
          note: noteToSave,
          systemId: currentSystem.id 
        });
        setNotes([...notes, noteToSave]);
        showToast('success', 'Note created successfully');
      } else if (modal?.mode === 'edit') {
        await invoke('update_note', { 
          note: noteToSave,
          systemId: currentSystem.id 
        });
        setNotes(notes.map(note => note.id === noteToSave.id ? noteToSave : note));
        showToast('success', 'Note updated successfully');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving note:', error);
      showToast('error', `Failed to save note: ${error}`);
    }
  };

  const handlePoamSelectionChange = (poam: POAM, isChecked: boolean) => {
    if (!modal) return;

    const updatedNote = { ...modal.note };
    
    if (isChecked) {
      if (!updatedNote.poamIds.includes(poam.id)) {
        updatedNote.poamIds = [...updatedNote.poamIds, poam.id];
        updatedNote.poamTitles = [...updatedNote.poamTitles, poam.title];
      }
    } else {
      const index = updatedNote.poamIds.indexOf(poam.id);
      if (index > -1) {
        updatedNote.poamIds = updatedNote.poamIds.filter(id => id !== poam.id);
        updatedNote.poamTitles = updatedNote.poamTitles.filter((_, i) => i !== index);
      }
    }

    setModal({
      ...modal,
      note: updatedNote
    });
  };

  const handleNoteModalChange = (field: keyof Note, value: any) => {
    if (!modal) return;
    setModal({
      ...modal,
      note: { ...modal.note, [field]: value }
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCurrentFolderName = () => {
    if (selectedFolder === null) return 'All Notes';
    if (selectedFolder === '') return 'No Folder';
    return selectedFolder;
  };

  const getCurrentFolderCount = () => {
    if (selectedFolder === null) return folderStructure.totalNotes;
    if (selectedFolder === '') return folderStructure.notesWithoutFolder.length;
    const folder = folderStructure.folders.find(f => f.name === selectedFolder);
    return folder ? folder.count : 0;
  };

  const renderNoteCard = (note: Note) => (
    <Card key={note.id} className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <CardHeader className="pb-3" onClick={() => openViewModal(note)}>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {note.title || 'Untitled Note'}
          </CardTitle>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(note);
              }}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this note?')) {
                  handleDeleteNote(note.id);
                }
              }}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(note.date)}
          </div>
          {note.poamTitles.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {note.poamTitles.length} POAM{note.poamTitles.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={() => openViewModal(note)}>
        <div className="space-y-2">
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-full"
                >
                  <Tag className="h-2 w-2" />
                  {tag}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{note.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderListItem = (note: Note) => (
    <Card key={note.id} className="hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 cursor-pointer" onClick={() => openViewModal(note)}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-lg hover:text-primary transition-colors">
                {note.title || 'Untitled Note'}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(note.date)}
                </div>
                {note.poamTitles.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {note.poamTitles.length}
                  </div>
                )}
              </div>
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {note.tags.slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-full"
                  >
                    <Tag className="h-2 w-2" />
                    {tag}
                  </span>
                ))}
                {note.tags.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{note.tags.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openViewModal(note)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(note)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this note?')) {
                  handleDeleteNote(note.id);
                }
              }}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Folder Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-card border-r border-border flex flex-col transition-all duration-200`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <div className="p-1 bg-primary/10 rounded">
                  <Folder className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-sm">Folders</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>

        {/* Folder List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {/* All Notes */}
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors hover:bg-accent ${
                  selectedFolder === null ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  <span>All Notes</span>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {folderStructure.totalNotes}
                </span>
              </button>

              {/* Individual Folders */}
              {folderStructure.folders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => setSelectedFolder(folder.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors hover:bg-accent ${
                    selectedFolder === folder.name ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">
                    {folder.count}
                  </span>
                </button>
              ))}

              {/* No Folder */}
              {folderStructure.notesWithoutFolder.length > 0 && (
                <button
                  onClick={() => setSelectedFolder('')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors hover:bg-accent ${
                    selectedFolder === '' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>No Folder</span>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">
                    {folderStructure.notesWithoutFolder.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-background">
          <div className="responsive-header mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {getCurrentFolderName()}
                </h1>
                <p className="text-muted-foreground">
                  {getCurrentFolderCount()} note{getCurrentFolderCount() !== 1 ? 's' : ''}
                  {selectedFolder !== null && ` in ${getCurrentFolderName()}`}
                </p>
              </div>
            </div>
            
            <Button onClick={openCreateModal} size="lg" className="btn-responsive">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hide-mobile">New Note</span>
              <span className="show-mobile">New</span>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="filter-group mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-full-mobile"
              />
            </div>
            
            <div className="button-group">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-responsive ${showFilters ? "bg-accent" : ""}`}
              >
                <Filter className="mr-2 h-4 w-4" />
                <span className="hide-mobile">Filters</span>
              </Button>
              
              <div className="flex border border-input rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-none ${viewMode === 'grid' ? 'bg-accent' : ''}`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`rounded-none ${viewMode === 'list' ? 'bg-accent' : ''}`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Tag</label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    >
                      <option value="">All Tags</option>
                      {availableTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <div className="flex gap-2">
                      <select
                        value={sortConfig.key || ''}
                        onChange={(e) => handleSort(e.target.value as SortableNoteKey)}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="">No Sort</option>
                        <option value="title">Title</option>
                        <option value="date">Date</option>
                        <option value="poamTitles">POAMs</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (sortConfig.key) {
                            setSortConfig(prev => ({
                              ...prev,
                              direction: prev.direction === 'asc' ? 'desc' : 'asc'
                            }));
                          }
                        }}
                        disabled={!sortConfig.key}
                      >
                        {sortConfig.direction === 'asc' ? (
                          <SortAsc className="h-4 w-4" />
                        ) : (
                          <SortDesc className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-end">
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {processedNotes.length} of {getCurrentFolderCount()} notes
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {selectedTag && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                  <Tag className="h-3 w-3" />
                  {selectedTag}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes Display */}
        <div className="flex-1 overflow-y-auto p-6">
          {processedNotes.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No notes found</h3>
                <p className="text-muted-foreground mb-4">
                  {currentFolderNotes.length === 0 
                    ? `No notes in ${getCurrentFolderName()}.`
                    : "Try adjusting your search or filters."
                  }
                </p>
                <Button onClick={openCreateModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Note
                  {selectedFolder && selectedFolder !== '' && ` in ${selectedFolder}`}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }>
              {processedNotes.map(note => 
                viewMode === 'grid' ? renderNoteCard(note) : renderListItem(note)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <NoteModal
          modal={modal}
          poams={poams}
          poamSearchQuery={poamSearchQuery}
          loadingPoams={loadingPoams}
          onClose={closeModal}
          onToggleFullscreen={toggleFullscreen}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onSwitchToEdit={switchToEditMode}
          onNoteChange={handleNoteModalChange}
          onPoamSearchChange={setPoamSearchQuery}
          onPoamSelectionChange={handlePoamSelectionChange}
        />
      )}
    </div>
  );
};

export default Notes; 