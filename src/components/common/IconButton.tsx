import React from 'react';
import { 
  Trash2, 
  XCircle, 
  Save, 
  Pencil, 
  Plus, 
  FileDown, 
  FileUp, 
  Search, 
  Filter, 
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Download,
  Upload,
  Settings as SettingsIcon,
  PlusCircle,
  X,
  Check
} from 'lucide-react';

export type IconType = 
  | 'delete' 
  | 'cancel' 
  | 'save' 
  | 'edit' 
  | 'add' 
  | 'export' 
  | 'import' 
  | 'search' 
  | 'filter'
  | 'expand'
  | 'collapse'
  | 'date'
  | 'time'
  | 'view'
  | 'hide'
  | 'document'
  | 'download'
  | 'upload'
  | 'settings'
  | 'close'
  | 'add-circle'
  | 'check';

interface IconButtonProps {
  icon: IconType;
  label?: string;
  onClick?: () => void;
  className?: string;
  size?: number;
  color?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

const iconComponents = {
  'delete': Trash2,
  'cancel': XCircle,
  'save': Save,
  'edit': Pencil,
  'add': Plus,
  'export': FileDown,
  'import': FileUp,
  'search': Search,
  'filter': Filter,
  'expand': ChevronDown,
  'collapse': ChevronUp,
  'date': Calendar,
  'time': Clock,
  'view': Eye,
  'hide': EyeOff,
  'document': FileText,
  'download': Download,
  'upload': Upload,
  'settings': SettingsIcon,
  'add-circle': PlusCircle,
  'close': X,
  'check': Check
};

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  onClick,
  className = '',
  size = 18,
  color,
  disabled = false,
  type = 'button',
  title
}) => {
  const IconComponent = iconComponents[icon];
  
  const style = color ? { color } : {};
  
  return (
    <button
      type={type}
      className={`btn icon-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <IconComponent size={size} style={style} />
      {label && <span>{label}</span>}
    </button>
  );
};

export default IconButton; 