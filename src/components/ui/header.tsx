import React from 'react'
import { Search, Bell, User, Settings, LogOut, Moon, Sun } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { cn } from '../../lib/utils'

interface HeaderProps {
  className?: string
  onThemeToggle?: () => void
  isDark?: boolean
}

export function Header({ className, onThemeToggle, isDark }: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false)
  const [showNotifications, setShowNotifications] = React.useState(false)

  return (
    <header className={cn(
      "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "border-b border-border sticky top-0 z-50",
      className
    )}>
      <div className="responsive-header px-6 py-3 title-row">
        {/* Search */}
        <div className="flex items-center space-x-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search POAMs, milestones..."
              className="pl-9 w-full-mobile"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="button-group">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onThemeToggle}
            className="h-9 w-9"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs"></span>
            </Button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">POAM #123 is overdue</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Milestone completed</p>
                      <p className="text-xs text-muted-foreground">4 hours ago</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <User className="h-4 w-4" />
            </Button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-border">
                  <p className="font-medium">Admin User</p>
                  <p className="text-sm text-muted-foreground">admin@example.com</p>
                </div>
                <div className="p-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                  <hr className="my-2" />
                  <Button variant="ghost" size="sm" className="w-full justify-start text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
} 