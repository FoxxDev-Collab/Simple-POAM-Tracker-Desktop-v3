import React, { useEffect, useState } from 'react';
import { Toast as ToastType } from '../../context/ToastContext';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
  };

  const getToastStyles = () => {
    const baseStyles = "flex items-start gap-3 p-4 bg-card border border-border rounded-lg shadow-lg min-w-[320px] max-w-[480px] pointer-events-auto transform transition-all duration-300 ease-in-out";
    
    if (!isVisible) {
      return `${baseStyles} translate-x-full opacity-0 scale-95`;
    }
    
    return `${baseStyles} translate-x-0 opacity-100 scale-100`;
  };

  const getIconColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const getToastIcon = () => {
    const iconProps = {
      size: 20,
      className: `${getIconColor()} flex-shrink-0 mt-0.5`
    };

    switch (toast.type) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'warning':
        return <AlertTriangle {...iconProps} />;
      case 'info':
      default:
        return <Info {...iconProps} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-4 border-l-green-500';
      case 'error':
        return 'border-l-4 border-l-red-500';
      case 'warning':
        return 'border-l-4 border-l-yellow-500';
      case 'info':
      default:
        return 'border-l-4 border-l-blue-500';
    }
  };

  return (
    <div className={`${getToastStyles()} ${getBorderColor()}`}>
      {/* Icon */}
      <div className="flex-shrink-0">
        {getToastIcon()}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-relaxed">
          {toast.message}
        </p>
      </div>
      
      {/* Close Button */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
        aria-label="Dismiss notification"
      >
        <X size={16} className="text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
};

export default Toast; 