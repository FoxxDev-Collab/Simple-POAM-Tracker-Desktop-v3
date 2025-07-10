import { Note, SortableNoteKey } from '../../types/notes';

// Utility function to create an empty note template
export const createEmptyNote = (): Note => ({
  id: Date.now().toString(),
  title: '',
  content: '',
  date: new Date().toISOString().split('T')[0],
  poamIds: [],
  poamTitles: [],
  folder: '',
  tags: []
});

// Filter notes based on search query
export const filterNotes = (notes: Note[], searchQuery: string): Note[] => {
  if (!searchQuery.trim()) return notes;
  
  const query = searchQuery.toLowerCase();
  return notes.filter(note => 
    note.title.toLowerCase().includes(query) ||
    note.content.toLowerCase().includes(query) ||
    (note.poamTitles && note.poamTitles.some(title => 
      title.toLowerCase().includes(query)
    )) ||
    (note.folder && note.folder.toLowerCase().includes(query)) ||
    (note.tags && note.tags.some(tag => 
      tag.toLowerCase().includes(query)
    ))
  );
};

// Sort notes based on sortConfig
export const sortNotes = (
  notes: Note[], 
  sortConfig: { key: SortableNoteKey | null; direction: 'asc' | 'desc' }
): Note[] => {
  if (!sortConfig.key) return notes;
  
  return [...notes].sort((a, b) => {
    const aValue = a[sortConfig.key as keyof Note];
    const bValue = b[sortConfig.key as keyof Note];

    // Handle potentially undefined values (like poamTitles)
    const valA = aValue === undefined || aValue === null ? '' : String(aValue).toLowerCase();
    const valB = bValue === undefined || bValue === null ? '' : String(bValue).toLowerCase();

    let comparison = 0;
    if (sortConfig.key === 'date') {
      // Compare dates directly
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else {
      // Compare strings
      comparison = valA.localeCompare(valB);
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
};