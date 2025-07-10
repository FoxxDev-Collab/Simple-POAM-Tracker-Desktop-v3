// Note and POAM interfaces
export interface POAM {
  id: number;
  title: string;
}

// Backend response type for notes (snake_case)
export interface NoteResponse {
  id: string;
  title: string;
  content: string;
  date: string;
  poam_ids?: number[];
  poam_titles?: string[];
  folder?: string;
  tags?: string[];
}

// Frontend note type (camelCase)
export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  poamIds: number[];
  poamTitles: string[];
  folder?: string;
  tags?: string[];
}

// Define the keys that can be sorted
export type SortableNoteKey = 'title' | 'date' | 'poamTitles' | 'folder';

export type ModalMode = 'create' | 'edit' | 'view';

export interface NoteModal {
  mode: ModalMode;
  note: Note;
  isFullscreen: boolean;
}