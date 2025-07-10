

interface BrandedLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  text?: string;
  className?: string;
}

export function BrandedLoader({ 
  size = 'md', 
  showText = true, 
  text = 'Loading...', 
  className = '' 
}: BrandedLoaderProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Animated Logo */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Spinning border */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-primary/20 border-t-primary rounded-full animate-spin`}></div>
        
        {/* Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            viewBox="0 0 32 32" 
            className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-8 h-8' : 'w-12 h-12'} text-primary`}
            fill="currentColor"
          >
            <path d="M16 2L4 7v11c0 6.075 5.149 11.671 12 13c6.851-1.329 12-6.925 12-13V7L16 2z" />
            <rect x="8.5" y="9.5" width="15" height="2.5" rx="1.25" fill="white" opacity="0.95"/>
            <rect x="8.5" y="14" width="15" height="2.5" rx="1.25" fill="white" opacity="0.8"/>
            <rect x="8.5" y="18.5" width="15" height="2.5" rx="1.25" fill="white" opacity="0.65"/>
            
            <circle cx="6.5" cy="10.75" r="1.5" fill="#10B981"/>
            <circle cx="6.5" cy="15.25" r="1.5" fill="#F59E0B"/>
            <circle cx="6.5" cy="19.75" r="1.5" fill="#EF4444"/>
          </svg>
        </div>
      </div>

      {/* Loading Text */}
      {showText && (
        <div className="text-center">
          <p className={`${textSizes[size]} font-medium text-foreground animate-pulse`}>
            {text}
          </p>
          {size === 'lg' && (
            <p className="text-sm text-muted-foreground mt-1">
              Security Compliance Management
            </p>
          )}
        </div>
      )}

      {/* Loading dots animation */}
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}

export default BrandedLoader; 