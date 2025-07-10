import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { LockScreenProps } from '../../types/appLock';

export default function LockScreen({ onUnlock, isUnlocking }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeLeft, setBlockTimeLeft] = useState(0);

  // Block access for 30 seconds after 3 failed attempts
  const MAX_ATTEMPTS = 3;
  const BLOCK_DURATION = 30; // seconds

  useEffect(() => {
    let interval: number | null = null;
    
    if (isBlocked && blockTimeLeft > 0) {
      interval = window.setInterval(() => {
        setBlockTimeLeft((prev) => {
          if (prev <= 1) {
            setIsBlocked(false);
            setAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBlocked, blockTimeLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked || isUnlocking || !password.trim()) return;

    const success = await onUnlock(password);
    
    if (success) {
      setPassword('');
      setAttempts(0);
      setIsBlocked(false);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPassword('');
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setIsBlocked(true);
        setBlockTimeLeft(BLOCK_DURATION);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isBlocked && !isUnlocking && password.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800" />
      
      <Card className="relative w-full max-w-md mx-4 shadow-2xl border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Application Locked
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Enter your password to unlock the application
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter password..."
                disabled={isBlocked || isUnlocking}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isBlocked || isUnlocking}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {attempts > 0 && attempts < MAX_ATTEMPTS && (
              <div className="text-sm text-red-600 dark:text-red-400 text-center">
                Incorrect password. {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining.
              </div>
            )}

            {isBlocked && (
              <div className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
                Too many failed attempts. Please wait {blockTimeLeft} seconds.
              </div>
            )}

            <Button
              type="submit"
              disabled={isBlocked || isUnlocking || !password.trim()}
              className="w-full py-3 text-lg font-medium"
            >
              {isUnlocking ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Unlocking...</span>
                </div>
              ) : isBlocked ? (
                `Blocked (${blockTimeLeft}s)`
              ) : (
                'Unlock Application'
              )}
            </Button>
          </form>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            The application will automatically lock after 10 minutes of inactivity
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 