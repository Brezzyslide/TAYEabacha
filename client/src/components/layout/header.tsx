import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Menu, MapPin, ChevronDown, Home, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  if (!user) return null;

  const handleDashboard = () => {
    setLocation("/dashboard");
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  };

  const userInitials = user.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Welcome back, <span className="font-medium">{user.fullName}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-2 min-w-0">
          {/* Dashboard Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDashboard}
            className="flex items-center space-x-2 flex-shrink-0"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>

          {/* Logout Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50 flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span>
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </span>
          </Button>
          
          {/* Location Status */}
          <div className="hidden md:flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex-shrink-0">
            <MapPin className="h-4 w-4" />
            <span>Location Verified</span>
          </div>
          
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative flex-shrink-0">
            <Bell className="h-5 w-5 text-gray-500" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              3
            </span>
          </Button>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 flex-shrink-0">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {userInitials}
                </div>
                <span className="hidden md:block font-medium">{user.fullName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="font-medium">{user.fullName}</span>
                  <span className="text-sm text-gray-500 capitalize">{user.role}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile Settings</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-red-600"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
