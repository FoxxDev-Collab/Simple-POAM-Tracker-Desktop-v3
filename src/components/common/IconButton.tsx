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
import { Icon } from '../ui/icon';

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
  const mappedSize = size <= 14 ? 'xs' : size <= 16 ? 'sm' : size <= 20 ? 'md' : size <= 24 ? 'lg' : 'xl';
  
  return (
    <button
      type={type}
      className={`btn icon-btn inline-flex items-center justify-center gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Icon icon={IconComponent} size={mappedSize as any} style={style as any} />
      {label && <span>{label}</span>}
    </button>
  );
};

export default IconButton; 