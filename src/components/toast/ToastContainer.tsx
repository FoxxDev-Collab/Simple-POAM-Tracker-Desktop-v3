import React from 'react';
import Toast from './Toast';
import { useToast } from '../../context/ToastContext';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="absolute top-6 right-6 z-[9999] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast 
          key={toast.id}
          toast={toast}
          onRemove={removeToast} 
        />
      ))}
    </div>
  );
};

export default ToastContainer; 