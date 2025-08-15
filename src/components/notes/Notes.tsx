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
    <Card key={note.id} className="h-full hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer group border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4" onClick={() => openViewModal(note)}>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {note.title || 'Untitled Note'}
          </CardTitle>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(note);
              }}
              className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Edit Note"
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
              className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete Note"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-muted/50 rounded">
              <Calendar className="h-3 w-3" />
            </div>
            <span className="font-medium">{formatDate(note.date)}</span>
          </div>
          {note.poamTitles.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 rounded">
                <Users className="h-3 w-3 text-primary" />
              </div>
              <span className="font-medium text-primary">
                {note.poamTitles.length} POAM{note.poamTitles.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={() => openViewModal(note)}>
        <div className="space-y-3">
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-full font-medium hover:bg-primary/20 transition-colors"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="inline-flex items-center px-2.5 py-1 text-xs text-muted-foreground bg-muted/50 rounded-full font-medium">
                  +{note.tags.length - 3} more
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground/80 mt-auto">
            Click to view full note
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderListItem = (note: Note) => (
    <Card key={note.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 bg-gradient-to-r from-card to-card/50 backdrop-blur-sm group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 cursor-pointer" onClick={() => openViewModal(note)}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-xl hover:text-primary transition-colors leading-tight">
                {note.title || 'Untitled Note'}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-muted/50 rounded">
                    <Calendar className="h-3 w-3" />
                  </div>
                  <span className="font-medium">{formatDate(note.date)}</span>
                </div>
                {note.poamTitles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-primary/10 rounded">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <span className="font-medium text-primary">
                      {note.poamTitles.length} POAM{note.poamTitles.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-full font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
                {note.tags.length > 4 && (
                  <span className="inline-flex items-center px-2.5 py-1 text-xs text-muted-foreground bg-muted/50 rounded-full font-medium">
                    +{note.tags.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 ml-6 opacity-60 group-hover:opacity-100 transition-all duration-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openViewModal(note)}
              className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
              title="View Note"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(note)}
              className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Edit Note"
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
              className="h-9 w-9 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete Note"
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
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="p-4 bg-primary/10 rounded-2xl inline-block mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Loading Notes</h3>
            <p className="text-muted-foreground">Please wait while we fetch your notes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Folder Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-72'} bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col transition-all duration-300 shadow-lg`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shadow-sm">
                  <Folder className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-sm text-foreground">Folders</span>
                  <p className="text-xs text-muted-foreground">Organize your notes</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-9 w-9 p-0 hover:bg-primary/10 transition-colors"
            >
              <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>

        {/* Folder List */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {/* All Notes */}
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm rounded-xl transition-all duration-200 hover:shadow-sm ${
                  selectedFolder === null 
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${selectedFolder === null ? 'bg-primary/20' : 'bg-muted/50'}`}>
                    <Archive className="h-4 w-4" />
                  </div>
                  <span className="font-medium">All Notes</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  selectedFolder === null 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {folderStructure.totalNotes}
                </span>
              </button>

              {/* Individual Folders */}
              {folderStructure.folders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => setSelectedFolder(folder.name)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm rounded-xl transition-all duration-200 hover:shadow-sm ${
                    selectedFolder === folder.name 
                      ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedFolder === folder.name ? 'bg-primary/20' : 'bg-muted/50'}`}>
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <span className="font-medium truncate">{folder.name}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                    selectedFolder === folder.name 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {folder.count}
                  </span>
                </button>
              ))}

              {/* No Folder */}
              {folderStructure.notesWithoutFolder.length > 0 && (
                <button
                  onClick={() => setSelectedFolder('')}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm rounded-xl transition-all duration-200 hover:shadow-sm ${
                    selectedFolder === '' 
                      ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${selectedFolder === '' ? 'bg-primary/20' : 'bg-muted/50'}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Uncategorized</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    selectedFolder === '' 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {folderStructure.notesWithoutFolder.length}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-accent/5">
        {/* Header */}
        <div className="p-8 border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl shadow-sm">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                  {getCurrentFolderName()}
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  {getCurrentFolderCount()} note{getCurrentFolderCount() !== 1 ? 's' : ''}
                  {selectedFolder !== null && selectedFolder !== '' && (
                    <span className="ml-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {getCurrentFolderName()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <Button 
              onClick={openCreateModal} 
              size="lg" 
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="font-semibold">New Note</span>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notes by title, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-background/80 border border-input/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 text-base placeholder:text-muted-foreground/70"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-xl border-input/50 transition-all duration-200 ${
                  showFilters 
                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                    : "hover:bg-accent/50"
                }`}
              >
                <Filter className="mr-2 h-4 w-4" />
                <span className="font-medium">Filters</span>
              </Button>
              
              <div className="flex border border-input/50 rounded-xl overflow-hidden shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-none px-4 py-3 ${
                    viewMode === 'grid' 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-accent/50'
                  }`}
                  title="Grid View"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`rounded-none px-4 py-3 ${
                    viewMode === 'list' 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-accent/50'
                  }`}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="mb-6 border-border/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <label className="text-sm font-semibold mb-3 block text-foreground">Filter by Tag</label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="w-full px-4 py-3 bg-background/80 border border-input/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200"
                    >
                      <option value="">All Tags</option>
                      {availableTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <label className="text-sm font-semibold mb-3 block text-foreground">Sort Order</label>
                    <div className="flex gap-3">
                      <select
                        value={sortConfig.key || ''}
                        onChange={(e) => handleSort(e.target.value as SortableNoteKey)}
                        className="flex-1 px-4 py-3 bg-background/80 border border-input/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200"
                      >
                        <option value="">Default Order</option>
                        <option value="title">Title (A-Z)</option>
                        <option value="date">Date Created</option>
                        <option value="poamTitles">POAM Count</option>
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
                        className="px-4 py-3 rounded-xl border-input/50 hover:bg-accent/50"
                        title={`Sort ${sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'}`}
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
                    <Button 
                      variant="outline" 
                      onClick={clearFilters}
                      className="px-4 py-3 rounded-xl border-input/50 hover:bg-accent/50 transition-colors"
                    >
                      <X className="mr-2 h-4 w-4" />
                      <span className="font-medium">Clear Filters</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{processedNotes.length}</span> of <span className="font-semibold text-foreground">{getCurrentFolderCount()}</span> notes
                {searchQuery && (
                  <span className="ml-2">
                    matching <span className="font-medium text-primary">"{searchQuery}"</span>
                  </span>
                )}
              </span>
            </div>
            {selectedTag && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  <Tag className="h-3 w-3" />
                  {selectedTag}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes Display */}
        <div className="flex-1 overflow-y-auto p-8">
          {processedNotes.length === 0 ? (
            <Card className="text-center py-20 border-border/50 bg-gradient-to-br from-card/50 to-muted/30 backdrop-blur-sm">
              <CardContent>
                <div className="max-w-md mx-auto">
                  <div className="p-4 bg-primary/10 rounded-2xl inline-block mb-6">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">No notes found</h3>
                  <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                    {currentFolderNotes.length === 0 
                      ? `Start building your knowledge base by creating your first note${selectedFolder && selectedFolder !== '' ? ` in ${selectedFolder}` : ''}.`
                      : "Your search didn't match any notes. Try adjusting your search terms or filters."
                    }
                  </p>
                  <Button 
                    onClick={openCreateModal}
                    size="lg"
                    className="px-8 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Plus className="mr-3 h-5 w-5" />
                    <span className="font-semibold">
                      Create Your First Note
                      {selectedFolder && selectedFolder !== '' && ` in ${selectedFolder}`}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-6"
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