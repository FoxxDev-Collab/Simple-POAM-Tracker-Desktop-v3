import { useState } from 'react';
import { Shield, Lock, Unlock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useAppLock } from '../../context/AppLockContext';
import { useToast } from '../../context/ToastContext';

export default function AppLockSettings() {
  const { isAppLockEnabled, setupAppLock, disableAppLock, lockApp } = useAppLock();
  const { showToast } = useToast();
  
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSetupAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      showToast('error', 'Password must be at least 6 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }

    setIsProcessing(true);
    try {
      const success = await setupAppLock(password);
      if (success) {
        setShowSetupForm(false);
        setPassword('');
        setConfirmPassword('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword.trim()) {
      showToast('error', 'Please enter your current password');
      return;
    }

    setIsProcessing(true);
    try {
      const success = await disableAppLock(currentPassword);
      if (success) {
        setShowDisableForm(false);
        setCurrentPassword('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualLock = () => {
    lockApp();
    showToast('info', 'Application locked manually');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <CardTitle>Application Lock</CardTitle>
        </div>
        <CardDescription>
          Secure your application with a password and automatic inactivity lock
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-3">
            {isAppLockEnabled ? (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <Lock className="w-4 h-4" />
                <span className="font-medium">App Lock Enabled</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <Unlock className="w-4 h-4" />
                <span className="font-medium">App Lock Disabled</span>
              </div>
            )}
          </div>
          
          {isAppLockEnabled && (
            <Button
              onClick={handleManualLock}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>Lock Now</span>
            </Button>
          )}
        </div>

        {/* Security Features Info */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Security Features:</h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Automatic lock after 10 minutes of inactivity</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Secure password storage using Argon2 hashing</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Protection against brute force attacks</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Manual lock option for immediate security</span>
            </li>
          </ul>
        </div>

        {/* Setup/Disable Controls */}
        {!isAppLockEnabled ? (
          <div className="space-y-4">
            {!showSetupForm ? (
              <Button
                onClick={() => setShowSetupForm(true)}
                className="w-full"
              >
                <Shield className="w-4 h-4 mr-2" />
                Enable App Lock
              </Button>
            ) : (
              <form onSubmit={handleSetupAppLock} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a secure password (min 6 characters)"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={isProcessing || !password || !confirmPassword}
                    className="flex-1"
                  >
                    {isProcessing ? 'Setting up...' : 'Enable App Lock'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSetupForm(false);
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {!showDisableForm ? (
              <Button
                onClick={() => setShowDisableForm(true)}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Disable App Lock
              </Button>
            ) : (
              <form onSubmit={handleDisableAppLock} className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <div className="flex items-center space-x-2 text-red-800 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Warning</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    Disabling app lock will remove password protection from your application.
                  </p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isProcessing || !currentPassword.trim()}
                    className="flex-1"
                  >
                    {isProcessing ? 'Disabling...' : 'Disable App Lock'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDisableForm(false);
                      setCurrentPassword('');
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 