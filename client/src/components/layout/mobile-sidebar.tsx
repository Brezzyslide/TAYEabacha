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
  Receipt,
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
  { name: "Timesheet & Pay Scales", href: "/timesheet", icon: Receipt },
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
            "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
            isActive(item.href)
              ? "bg-primary/10 text-primary border-r-2 border-primary"
              : "text-gray-700 hover:bg-gray-100"
          )}
          onClick={onClose}
        >
          <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
          {item.name}
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
          "fixed top-0 left-0 z-50 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">CareConnect</h2>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {/* Support Work Section */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Support Work
            </h3>
            <nav className="space-y-1">
              {supportWorkNavigation.map((item) => (
                <NavigationItem key={item.name} item={item} />
              ))}
            </nav>
          </div>

          {/* Shift Management Section */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Shift Management
            </h3>
            <nav className="space-y-1">
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