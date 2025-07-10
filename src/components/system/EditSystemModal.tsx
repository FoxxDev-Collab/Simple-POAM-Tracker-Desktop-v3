import React, { useState, useEffect } from 'react';
import { X, Building, User, Shield, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface EditSystemModalProps {
  system: any;
  onClose: () => void;
  onSubmit: (systemData: any) => Promise<void>;
}

export default function EditSystemModal({ system, onClose, onSubmit }: EditSystemModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    classification: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (system) {
      setFormData({
        name: system.name || '',
        description: system.description || '',
        owner: system.owner || '',
        classification: system.classification || '',
        tags: system.tags || [],
      });
    }
  }, [system]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      
      const submitData = {
        id: system.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        owner: formData.owner.trim() || null,
        classification: formData.classification || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        created_date: system.created_date,
        updated_date: new Date().toISOString(),
        is_active: system.is_active ?? true,
        last_accessed: system.last_accessed,
        poam_count: system.poam_count
      };
      
      console.log('EditSystemModal - Submitting data:', submitData);
      console.log('EditSystemModal - Original system:', system);
      console.log('EditSystemModal - Form data:', formData);
      
      await onSubmit(submitData);
    } catch (error) {
      console.error('Failed to update system:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Edit System</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              System Name *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter system name"
              required
              autoFocus
              disabled={system?.id === 'default'}
            />
            {system?.id === 'default' && (
              <p className="text-xs text-muted-foreground mt-1">
                Default system name cannot be changed
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter system description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Owner
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={formData.owner}
                onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                placeholder="System owner"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Classification
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <select
                value={formData.classification}
                onChange={(e) => setFormData(prev => ({ ...prev, classification: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Select classification</option>
                <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                <option value="SECRET">SECRET</option>
                <option value="TOP SECRET">TOP SECRET</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a tag"
                  className="pl-10"
                />
              </div>
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-primary/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!formData.name.trim() || isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update System'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 