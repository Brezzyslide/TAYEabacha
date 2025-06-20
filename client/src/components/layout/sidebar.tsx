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
      <div className="px-4 py-3 rounded-lg mb-4 bg-slate-800 border border-slate-700">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href} 
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-300 hover:bg-slate-800 hover:text-white"
              )}>
              <div className={cn(
                "p-2 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-blue-500 text-white" 
                  : "bg-slate-700 text-gray-300 group-hover:bg-slate-600 group-hover:text-white"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="hidden lg:block w-72 bg-slate-900 flex-shrink-0 relative">
      {/* Navigation Menu */}
      <nav className="p-6 space-y-8 h-full overflow-y-auto">
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
