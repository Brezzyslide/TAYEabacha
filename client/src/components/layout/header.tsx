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
import { AccessibilitySettings } from "@/components/accessibility-settings";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Fetch company information with error handling
  const { data: company, error: companyError, isLoading: companyLoading } = useQuery<{
    id: string;
    name: string;
    customLogo?: string;
  }>({
    queryKey: ['/api/company'],
    enabled: !!user,
    retry: 3,
    retryDelay: 1000,
  });

  // AWS Production Debug: Log company data
  console.log('[HEADER DEBUG] Company data:', company);
  console.log('[HEADER DEBUG] Company error:', companyError);
  console.log('[HEADER DEBUG] Company loading:', companyLoading);

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
      <header className="bg-white dark:bg-card shadow-sm border-b border-border px-4 sm:px-6 py-3 sm:py-4 card-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <Button 
              variant="ghost" 
              size="sm"
              className="lg:hidden text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            {/* TUSK/NeedCareAI+ Branding */}
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary via-secondary to-accent rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                <span className="text-white font-bold text-sm sm:text-base drop-shadow-md">AI+</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">NeedsCareAI+</h1>
                  <CompanyLogo 
                    companyName={company?.name || "NeedsCareAI+"}
                    customLogo={company?.customLogo}
                    size="sm"
                    showName={false}
                  />
                </div>
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-foreground font-medium truncate">
                    {company?.name || "Care Organization"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Welcome back, <span className="font-medium text-primary">{user.fullName}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        
          <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
          {/* Dashboard Button - Professional styling */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDashboard}
            className="hidden sm:flex items-center space-x-2 flex-shrink-0 border-primary/20 text-primary hover:bg-primary/5"
          >
            <Home className="h-4 w-4" />
            <span className="hidden md:inline font-medium">Dashboard</span>
          </Button>

          {/* Mobile-only Logout Button - Professional styling */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="sm:hidden flex items-center p-2 text-destructive hover:bg-destructive/10 flex-shrink-0 rounded-lg"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
          
          {/* Location Status - Professional styling */}
          <div className="hidden md:flex items-center space-x-2 bg-success/10 text-success px-3 py-1.5 rounded-lg text-sm flex-shrink-0 border border-success/20">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">Verified</span>
          </div>
          
          {/* Accessibility Settings */}
          <AccessibilitySettings />
          
          {/* Notifications - Real-time system */}
          <NotificationDropdown />
          
          {/* User Menu - Professional styling */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-1 sm:space-x-3 text-foreground hover:bg-accent flex-shrink-0 p-1 sm:p-2 rounded-lg">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm shadow-md">
                  {userInitials}
                </div>
                <span className="hidden lg:block font-medium text-sm">{user.fullName}</span>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56 card-elevated">
              <DropdownMenuLabel className="text-sm font-medium">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-foreground">{user.fullName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Desktop logout in dropdown */}
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive hidden sm:flex hover:bg-destructive/10 py-2"
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
