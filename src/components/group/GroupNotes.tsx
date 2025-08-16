import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../context/ToastContext';
import { 
  Search, 
  Plus, 
  Filter, 
  FileText, 
  FolderOpen, 
  Tag, 
  Users,
  Edit,
  ExternalLink,
  Calendar,
  StickyNote,
  BookOpen,
  Layers
} from 'lucide-react';

import { Note, POAM, NoteModal as NoteModalType } from '../../types/notes';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
import NoteModal from '../notes/NoteModal';
import { createEmptyNote } from '../notes/noteUtils';

interface GroupNote {
  id: string;
  title: string;
  content: string;
  date: string;
  folder: string;
  tags: string[];
  groupId: string;
  createdBy?: string;
  associatedSystems?: string[]; // System IDs this note applies to
}

interface SystemNoteData {
  systemId: string;
  systemName: string;
  notes: Note[];
  totalNotes: number;
  recentNotes: Note[];
  folderCounts: { [folder: string]: number };
  tagCounts: { [tag: string]: number };
  lastUpdated: string;
}

interface GroupNotesProps {
  groupId: string;
  systems: any[];
  onSwitchToSystem?: (systemId: string, targetTab?: string) => void;
}

export default function GroupNotes({ groupId, systems, onSwitchToSystem }: GroupNotesProps) {
  // Group Notes state
  const [groupNotes, setGroupNotes] = useState<GroupNote[]>([]);
  const [groupPoams, setGroupPoams] = useState<POAM[]>([]);
  
  // System Notes oversight state
  const [systemNotes, setSystemNotes] = useState<SystemNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroupPoams, setLoadingGroupPoams] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'group' | 'systems'>('group');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  
  // Modal state
  const [modal, setModal] = useState<NoteModalType | null>(null);
  const [poamSearchQuery, setPoamSearchQuery] = useState('');
  
  const { showToast } = useToast();

  // Load all group and system notes
  const loadAllNotes = useCallback(async () => {
    if (!systems || systems.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('GroupNotes: Loading notes for all systems in group');
      
      // Load Group POAMs for note associations
      try {
        const groupPoamsData = await invoke<POAM[]>('get_group_poams', { groupId });
        setGroupPoams(groupPoamsData || []);
      } catch (error) {
        console.error('Error loading group POAMs:', error);
        setGroupPoams([]);
      } finally {
        setLoadingGroupPoams(false);
      }
      
      // TODO: Load group-level notes (when backend is implemented)
      // For now, initialize empty group notes
      setGroupNotes([]);
      
      // Load notes for each system in parallel
      const systemPromises = systems.map(async (system) => {
        try {
          const notes = await invoke<Note[]>('get_all_notes', { systemId: system.id });
          
          // Process notes and calculate statistics
          const totalNotes = notes.length;
          const recentNotes = notes
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
          
          // Count notes by folder
          const folderCounts: { [folder: string]: number } = {};
          notes.forEach(note => {
            const folder = note.folder || 'General';
            folderCounts[folder] = (folderCounts[folder] || 0) + 1;
          });
          
          // Count notes by tag
          const tagCounts: { [tag: string]: number } = {};
          notes.forEach(note => {
            note.tags?.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          });
          
          // Find most recent update
          const lastUpdated = notes.length > 0 
            ? notes.reduce((latest, note) => 
                note.date > latest ? note.date : latest, 
                notes[0].date
              )
            : '';
          
          return {
            systemId: system.id,
            systemName: system.name,
            notes,
            totalNotes,
            recentNotes,
            folderCounts,
            tagCounts,
            lastUpdated
          };
        } catch (error) {
          console.error(`Error loading notes for system ${system.name}:`, error);
          return {
            systemId: system.id,
            systemName: system.name,
            notes: [],
            totalNotes: 0,
            recentNotes: [],
            folderCounts: {},
            tagCounts: {},
            lastUpdated: ''
          };
        }
      });
      
      const results = await Promise.all(systemPromises);
      setSystemNotes(results);
      
    } catch (error) {
      console.error('Error loading group notes:', error);
      showToast('error', `Failed to load group notes: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [systems, groupId, showToast]);

  useEffect(() => {
    loadAllNotes();
  }, [loadAllNotes]);

  // Get all unique folders and tags across group and systems
  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    
    // Add group note folders
    groupNotes.forEach(note => {
      if (note.folder) folders.add(note.folder);
    });
    
    // Add system note folders
    systemNotes.forEach(system => {
      Object.keys(system.folderCounts).forEach(folder => folders.add(folder));
    });
    
    return Array.from(folders).sort();
  }, [groupNotes, systemNotes]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    
    // Add group note tags
    groupNotes.forEach(note => {
      note.tags?.forEach(tag => tags.add(tag));
    });
    
    // Add system note tags
    systemNotes.forEach(system => {
      Object.keys(system.tagCounts).forEach(tag => tags.add(tag));
    });
    
    return Array.from(tags).sort();
  }, [groupNotes, systemNotes]);

  // Filter group notes
  const filteredGroupNotes = useMemo(() => {
    let result = [...groupNotes];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note => 
        note.title.toLowerCase().includes(query) || 
        note.content.toLowerCase().includes(query)
      );
    }
    
    if (folderFilter !== 'all') {
      result = result.filter(note => note.folder === folderFilter);
    }
    
    if (tagFilter !== 'all') {
      result = result.filter(note => note.tags?.includes(tagFilter));
    }
    
    // Sort results
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title);
        case 'date': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'folder': return (a.folder || '').localeCompare(b.folder || '');
        default: return 0;
      }
    });
    
    return result;
  }, [groupNotes, searchQuery, folderFilter, tagFilter, sortBy]);

  // Filter system notes
  const filteredSystemNotes = useMemo(() => {
    let result = [...systemNotes];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(system => 
        system.systemName.toLowerCase().includes(query) ||
        system.notes.some(note => 
          note.title.toLowerCase().includes(query) || 
          note.content.toLowerCase().includes(query)
        )
      );
    }
    
    if (systemFilter === 'has-notes') {
      result = result.filter(system => system.totalNotes > 0);
    } else if (systemFilter === 'no-notes') {
      result = result.filter(system => system.totalNotes === 0);
    }
    
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.systemName.localeCompare(b.systemName);
        case 'notes': return b.totalNotes - a.totalNotes;
        case 'updated': return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default: return 0;
      }
    });
  }, [systemNotes, searchQuery, systemFilter, sortBy]);

  // Calculate group statistics
  const groupStats = {
    totalGroupNotes: groupNotes.length,
    totalSystemNotes: systemNotes.reduce((sum, s) => sum + s.totalNotes, 0),
    systemsWithNotes: systemNotes.filter(s => s.totalNotes > 0).length,
    totalSystems: systems.length,
    mostActiveSystem: systemNotes.reduce((max, system) => 
      system.totalNotes > max.totalNotes ? system : max, 
      { systemName: 'None', totalNotes: 0 }
    )
  };

  // Modal handlers
  const openCreateGroupNoteModal = () => {
    const newNote = createEmptyNote();
    setModal({
      mode: 'create',
      note: newNote,
      isFullscreen: false
    });
    setPoamSearchQuery('');
  };

  const openEditGroupNoteModal = (note: GroupNote) => {
    // Convert GroupNote to Note format for the modal
    const noteForModal: Note = {
      id: note.id,
      title: note.title,
      content: note.content,
      date: note.date,
      folder: note.folder,
      tags: note.tags,
      poamIds: [], // Group notes can associate with Group POAMs
      poamTitles: []
    };
    
    setModal({
      mode: 'edit',
      note: noteForModal,
      isFullscreen: false
    });
    setPoamSearchQuery('');
  };

  const handleViewSystemNotes = (systemId: string) => {
    if (onSwitchToSystem) {
      onSwitchToSystem(systemId, 'notes');
    }
  };

  const handleSaveGroupNote = async (note: Note) => {
    try {
      console.log('Saving group note:', note);
      
      // TODO: Implement group note save when backend is ready
      // For now, show a placeholder message
      showToast('info', 'Group note functionality will be available in a future update');
      
      // Example of what the implementation would look like:
      // const groupNote: GroupNote = {
      //   ...note,
      //   groupId,
      //   associatedSystems: [] // Could be selected in modal
      // };
      // 
      // if (modal?.mode === 'create') {
      //   await invoke('create_group_note', { note: groupNote });
      //   setGroupNotes(prev => [...prev, groupNote]);
      // } else {
      //   await invoke('update_group_note', { note: groupNote });
      //   setGroupNotes(prev => prev.map(n => n.id === groupNote.id ? groupNote : n));
      // }
      
      setModal(null);
    } catch (error) {
      console.error('Error saving group note:', error);
      showToast('error', `Failed to save group note: ${error}`);
    }
  };

  const handleDeleteGroupNote = async (noteId: string) => {
    try {
      console.log('Deleting group note:', noteId);
      
      // TODO: Implement group note deletion when backend is ready
      showToast('info', 'Group note functionality will be available in a future update');
      
      setModal(null);
    } catch (error) {
      console.error('Error deleting group note:', error);
      showToast('error', `Failed to delete group note: ${error}`);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container-responsive space-y-6">
      {/* Header */}
      <div className="responsive-header">
        <div className="flex items-center gap-3 title-row">
          <div className="p-2 bg-primary/10 rounded-lg">
            <StickyNote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Group Notes</h1>
            <p className="text-muted-foreground">
              Manage group-level notes and monitor system notes
            </p>
          </div>
        </div>
        
        <div className="button-group">
          <Button
            onClick={loadAllNotes}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Group Notes</p>
                <p className="text-2xl font-bold text-foreground">{groupStats.totalGroupNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Notes</p>
                <p className="text-2xl font-bold text-foreground">{groupStats.totalSystemNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Systems with Notes</p>
                <p className="text-2xl font-bold text-foreground">
                  {groupStats.systemsWithNotes}/{groupStats.totalSystems}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Most Active</p>
                <p className="text-lg font-bold text-foreground truncate">
                  {groupStats.mostActiveSystem.systemName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {groupStats.mostActiveSystem.totalNotes} notes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes or systems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
                {allFolders.map(folder => (
                  <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTab === 'systems' && (
              <Select value={systemFilter} onValueChange={setSystemFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter systems" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  <SelectItem value="has-notes">Systems with Notes</SelectItem>
                  <SelectItem value="no-notes">Systems without Notes</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {activeTab === 'group' ? (
                  <>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="name">System Name</SelectItem>
                    <SelectItem value="notes">Note Count</SelectItem>
                    <SelectItem value="updated">Last Updated</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'group' | 'systems')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="group" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Group Notes ({groupStats.totalGroupNotes})
          </TabsTrigger>
          <TabsTrigger value="systems" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            System Notes ({groupStats.totalSystemNotes})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              Showing {filteredGroupNotes.length} of {groupStats.totalGroupNotes} group notes
            </p>
            <Button onClick={openCreateGroupNoteModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Group Note
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading group notes...</p>
            </div>
          ) : filteredGroupNotes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Group Notes</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first group note to get started
                </p>
                <Button onClick={openCreateGroupNoteModal} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Group Note
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGroupNotes.map((note) => (
                <Card key={note.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{note.title}</h3>
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(note.date)}
                          </div>
                          {note.folder && (
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-4 w-4" />
                              {note.folder}
                            </div>
                          )}
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-4 w-4" />
                              <div className="flex gap-1">
                                {note.tags.slice(0, 2).map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {note.tags.length > 2 && (
                                  <span className="text-xs">+{note.tags.length - 2}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditGroupNoteModal(note)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="systems" className="space-y-4">
          <p className="text-muted-foreground">
            Showing {filteredSystemNotes.length} of {groupStats.totalSystems} systems
          </p>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading system notes...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSystemNotes.map((system) => (
                <Card key={system.systemId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">{system.systemName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {system.totalNotes} notes
                          {system.lastUpdated && (
                            <span> • Last updated {formatDate(system.lastUpdated)}</span>
                          )}
                        </p>
                      </div>
                      
                      <Button
                        onClick={() => handleViewSystemNotes(system.systemId)}
                        variant={system.totalNotes > 0 ? "default" : "outline"}
                        className="flex items-center gap-2"
                      >
                        {system.totalNotes > 0 ? (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            View Notes
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Create Notes
                          </>
                        )}
                      </Button>
                    </div>

                    {system.totalNotes > 0 ? (
                      <div className="space-y-3">
                        {/* Folder and Tag Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.keys(system.folderCounts).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Folders</h4>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(system.folderCounts).slice(0, 3).map(([folder, count]) => (
                                  <Badge key={folder} variant="outline" className="text-xs">
                                    {folder} ({count})
                                  </Badge>
                                ))}
                                {Object.keys(system.folderCounts).length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{Object.keys(system.folderCounts).length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {Object.keys(system.tagCounts).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Tags</h4>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(system.tagCounts).slice(0, 3).map(([tag, count]) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag} ({count})
                                  </Badge>
                                ))}
                                {Object.keys(system.tagCounts).length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{Object.keys(system.tagCounts).length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Recent Notes */}
                        {system.recentNotes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Recent Notes</h4>
                            <div className="space-y-2">
                              {system.recentNotes.slice(0, 3).map((note) => (
                                <div key={note.id} className="p-3 bg-muted/30 rounded-lg">
                                  <div className="font-medium text-sm">{note.title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(note.date)}
                                    {note.folder && ` • ${note.folder}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notes created yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Note Modal */}
      {modal && (
        <NoteModal
          modal={modal}
          poams={groupPoams}
          poamSearchQuery={poamSearchQuery}
          loadingPoams={loadingGroupPoams}
          onClose={() => setModal(null)}
          onToggleFullscreen={() => setModal(prev => prev ? { ...prev, isFullscreen: !prev.isFullscreen } : null)}
          onSave={handleSaveGroupNote}
          onDelete={handleDeleteGroupNote}
          onSwitchToEdit={() => setModal(prev => prev ? { ...prev, mode: 'edit' } : null)}
          onNoteChange={(field: keyof Note, value: any) => {
            setModal(prev => prev ? { 
              ...prev, 
              note: { ...prev.note, [field]: value } 
            } : null);
          }}
          onPoamSearchChange={setPoamSearchQuery}
          onPoamSelectionChange={(poam: POAM, isChecked: boolean) => {
            setModal(prev => {
              if (!prev) return null;
              
              const currentPoamIds = prev.note.poamIds || [];
              const currentPoamTitles = prev.note.poamTitles || [];
              
              let newPoamIds: number[];
              let newPoamTitles: string[];
              
              if (isChecked) {
                // Add POAM
                newPoamIds = [...currentPoamIds, poam.id];
                newPoamTitles = [...currentPoamTitles, poam.title];
              } else {
                // Remove POAM
                newPoamIds = currentPoamIds.filter(id => id !== poam.id);
                newPoamTitles = currentPoamTitles.filter(title => title !== poam.title);
              }
              
              return {
                ...prev,
                note: { 
                  ...prev.note, 
                  poamIds: newPoamIds, 
                  poamTitles: newPoamTitles 
                }
              };
            });
          }}
        />
      )}
    </div>
  );
}
