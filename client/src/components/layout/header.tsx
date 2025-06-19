import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Menu, MapPin, ChevronDown, Home, LogOut, X } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MobileSidebar from "./mobile-sidebar";
import CompanyLogo from "@/components/ui/company-logo";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Fetch company information
  const { data: company } = useQuery<{
    id: string;
    name: string;
    customLogo?: string;
  }>({
    queryKey: ['/api/company'],
    enabled: !!user,
  });

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
    <>
      <MobileSidebar 
        isOpen={showMobileSidebar} 
        onClose={() => setShowMobileSidebar(false)} 
      />
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <Button 
              variant="ghost" 
              size="sm"
              className="lg:hidden text-gray-500 hover:text-gray-700 flex-shrink-0"
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            {/* Company Logo */}
            <div className="flex items-center space-x-3 min-w-0">
              <CompanyLogo 
                companyName={company?.name || "Default Company"}
                customLogo={company?.customLogo}
                size="sm"
                showName={false}
              />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Dashboard</h1>
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-gray-800 font-bold truncate">
                    {company?.name || "XYZ LTD"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Welcome back, <span className="font-medium">{user.fullName}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        
          <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
          {/* Dashboard Button - Hidden on mobile, icon only on tablet */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDashboard}
            className="hidden sm:flex items-center space-x-2 flex-shrink-0"
          >
            <Home className="h-4 w-4" />
            <span className="hidden md:inline">Dashboard</span>
          </Button>

          {/* Mobile-only Logout Button - Icon only */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="sm:hidden flex items-center p-2 text-red-600 hover:bg-red-50 flex-shrink-0"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
          
          {/* Location Status */}
          <div className="hidden md:flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex-shrink-0">
            <MapPin className="h-4 w-4" />
            <span>Location Verified</span>
          </div>
          
          {/* Notifications - Mobile optimized */}
          <Button variant="ghost" size="sm" className="relative flex-shrink-0 p-2">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs">
              3
            </span>
          </Button>
          
          {/* User Menu - Mobile optimized */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-1 sm:space-x-3 text-gray-700 hover:text-gray-900 flex-shrink-0 p-1 sm:p-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {userInitials}
                </div>
                <span className="hidden lg:block font-medium text-sm">{user.fullName}</span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <DropdownMenuLabel className="text-sm">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.fullName}</span>
                  <span className="text-xs text-gray-500 capitalize">{user.role}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Desktop logout in dropdown */}
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-red-600 hidden sm:flex"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
