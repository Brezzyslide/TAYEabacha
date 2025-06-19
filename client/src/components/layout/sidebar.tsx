import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { canManageCompanies } from "@/lib/auth";
import { 
  Building, 
  ChevronDown, 
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
  Plus,
  Play,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const companyManagementNavigation = [
  { name: "Company List", href: "/admin/companies", icon: Building },
  { name: "Create Company", href: "/admin/create-company", icon: Plus },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role.toLowerCase() === "admin" || user.role.toLowerCase() === "consolemanager";
  const canManageCompaniesAccess = canManageCompanies(user);

  const renderNavigationSection = (title: string, items: { name: string; href: string; icon: any }[], gradientColor: string) => (
    <div className="mb-8">
      <div className={cn("px-4 py-3 rounded-2xl mb-4 backdrop-blur-sm border border-white/10", gradientColor)}>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href} 
              className={cn(
                "modern-nav-item group",
                isActive && "active"
              )}>
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-cyan-500 shadow-lg shadow-cyan-500/25" 
                    : "bg-white/10 group-hover:bg-white/20"
                )}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium text-white">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="hidden lg:block w-72 glass-nav flex-shrink-0 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-4 w-32 h-32 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-4 w-24 h-24 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation Menu */}
      <nav className="relative z-10 p-6 space-y-8 h-full overflow-y-auto">
        {/* Support Work Section */}
        {renderNavigationSection(
          "SUPPORT WORK", 
          supportWorkNavigation, 
          "bg-gradient-to-r from-emerald-500/30 to-teal-500/30"
        )}

        {/* Shift Management Section */}
        {renderNavigationSection(
          "SHIFT MANAGEMENT", 
          shiftManagementNavigation, 
          "bg-gradient-to-r from-cyan-500/30 to-blue-500/30"
        )}

        {/* Staff Management Section - Only for Admins */}
        {isAdmin && renderNavigationSection(
          "STAFF MANAGEMENT", 
          staffManagementNavigation, 
          "bg-gradient-to-r from-purple-500/30 to-violet-500/30"
        )}

        {/* Company Management Section - ConsoleManager Only */}
        {canManageCompaniesAccess && renderNavigationSection(
          "COMPANY MANAGEMENT", 
          companyManagementNavigation, 
          "bg-gradient-to-r from-amber-500/30 to-orange-500/30"
        )}
      </nav>
    </aside>
  );
}
