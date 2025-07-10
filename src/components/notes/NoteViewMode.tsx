import React from 'react';
import { Calendar, FolderOpen, Tag, Users, FileText } from 'lucide-react';
import { Note } from '../../types/notes';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface NoteViewModeProps {
  note: Note;
}

const NoteViewMode: React.FC<NoteViewModeProps> = ({ note }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 leading-tight">
          {note.title || 'Untitled Note'}
        </h1>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Note Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-sm text-foreground">{formatDate(note.date)}</p>
              </div>
            </div>

            {/* Folder */}
            {note.folder && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FolderOpen className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Folder</p>
                  <p className="text-sm text-foreground">{note.folder}</p>
                </div>
              </div>
            )}

            {/* POAMs */}
            {note.poamTitles && note.poamTitles.length > 0 && (
              <div className="flex items-start gap-3 md:col-span-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Associated POAMs ({note.poamTitles.length})
                  </p>
                  <div className="space-y-1">
                    {note.poamTitles.map((title, index) => (
                      <div 
                        key={index}
                        className="px-3 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <p className="text-sm text-foreground">{title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
              <div className="flex items-start gap-3 md:col-span-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Tag className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Tags ({note.tags.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-full border"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Content</CardTitle>
        </CardHeader>
        <CardContent>
          {note.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div 
                className="ql-editor text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: note.content || "<p class='text-muted-foreground italic'>This note has no content.</p>" 
                }}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">This note has no content.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NoteViewMode; 