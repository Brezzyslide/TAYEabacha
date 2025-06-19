import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { canManageCompanies } from "@/lib/auth";
import { 
  Building, 
  User, 
  FileText, 
  Eye, 
  Pill, 
  ClipboardList, 
  BarChart3, 
  AlertTriangle, 
  MessageSquare,
  Calendar,
  Clock,
  TrendingUp,
  Shield,
  Users,
  DollarSign,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supportWorkNavigation = [
  { name: "Client Profiles", href: "/support-work/client-profile", icon: Users },
  { name: "Case Notes", href: "/case-notes", icon: FileText },
  { name: "Hourly Observations", href: "/hourly-observations", icon: Eye },
  { name: "Medication Tracker", href: "/medications", icon: Pill },
  { name: "Care Support Plans", href: "/care-support-plans", icon: ClipboardList },
  { name: "NDIS Budget Management", href: "/budget-management", icon: DollarSign },
  { name: "Workflow Dashboard", href: "/workflow-dashboard", icon: BarChart3 },
  { name: "Incident Management", href: "/incident-management", icon: AlertTriangle },
  { name: "Messages", href: "/messages", icon: MessageSquare },
];

const shiftManagementNavigation = [
  { name: "Shift Calendar", href: "/shift", icon: Calendar },
  { name: "My Availability", href: "/staff-availability", icon: Clock },
  { name: "Staff Hour Allocations", href: "/staff-hour-allocations", icon: TrendingUp },
];

const staffManagementNavigation = [
  { name: "Roles & Permissions", href: "/roles-permissions", icon: Shield },
  { name: "User Management", href: "/staff", icon: Users },
];

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isActive = (href: string) => {
    if (href === "/support-work/client-profile") {
      return location.startsWith("/support-work");
    }
    return location === href || location.startsWith(href + "/");
  };

  const NavigationItem = ({ item }: { item: any }) => {
    const Icon = item.icon;
    return (
      <Link href={item.href}>
        <div
          className={cn(
            "modern-nav-item group cursor-pointer",
            isActive(item.href) && "active"
          )}
          onClick={onClose}
        >
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              isActive(item.href) 
                ? "bg-cyan-500 shadow-lg shadow-cyan-500/25" 
                : "bg-white/10 group-hover:bg-white/20"
            )}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <span className="font-medium text-white">{item.name}</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-80 glass-nav shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col relative overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-4 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-4 w-20 h-20 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gradient-primary">NeedCareAI+</h2>
              <p className="text-sm text-slate-300 capitalize font-medium">{user.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-3 rounded-2xl hover:bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-8 min-h-0">
          {/* Support Work Section */}
          <div>
            <div className="px-4 py-3 rounded-2xl mb-4 backdrop-blur-sm border border-white/10 bg-gradient-to-r from-emerald-500/30 to-teal-500/30">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">SUPPORT WORK</h3>
            </div>
            <nav className="space-y-2">
              {supportWorkNavigation.map((item) => (
                <NavigationItem key={item.name} item={item} />
              ))}
            </nav>
          </div>

          {/* Shift Management Section */}
          <div>
            <div className="px-4 py-3 rounded-2xl mb-4 backdrop-blur-sm border border-white/10 bg-gradient-to-r from-cyan-500/30 to-blue-500/30">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">SHIFT MANAGEMENT</h3>
            </div>
            <nav className="space-y-2">
              {shiftManagementNavigation.map((item) => (
                <NavigationItem key={item.name} item={item} />
              ))}
            </nav>
          </div>

          {/* Staff Management Section - Only for Admins */}
          {(user.role.toLowerCase() === "admin" || user.role.toLowerCase() === "consolemanager") && (
            <div>
              <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Staff Management
              </h3>
              <nav className="space-y-1">
                {staffManagementNavigation.map((item) => (
                  <NavigationItem key={item.name} item={item} />
                ))}
              </nav>
            </div>
          )}

          {/* Console Management - Only for ConsoleManager */}
          {canManageCompanies(user) && (
            <div>
              <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Console Management
              </h3>
              <nav className="space-y-1">
                <NavigationItem 
                  item={{ 
                    name: "Company Management", 
                    href: "/console", 
                    icon: Building 
                  }} 
                />
              </nav>
            </div>
          )}
        </div>
      </div>
    </>
  );
}