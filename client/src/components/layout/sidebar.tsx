import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { canManageCompanies } from "@/lib/auth";
import { canViewBilling, isAdminLevel } from "@/lib/role-utils";
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
  DollarSign,
  Receipt,
  CreditCard,
  FileCheck
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

const getShiftManagementNavigation = (isAdmin: boolean) => [
  { name: "Shift Calendar", href: "/shift", icon: Calendar },
  { 
    name: isAdmin ? "Staff Availability" : "My Availability", 
    href: isAdmin ? "/manage-staff-availability" : "/staff-availability", 
    icon: Clock 
  },
  { name: "Staff Hour Allocations", href: "/staff-hour-allocations", icon: TrendingUp },
  { name: "Timesheet & Pay Scales", href: "/timesheet", icon: Receipt },
];

const staffManagementNavigation = [
  { name: "Roles & Permissions", href: "/roles-permissions", icon: Shield },
  { name: "User Management", href: "/staff", icon: Users },
  { name: "Manage Staff Availability", href: "/manage-staff-availability", icon: Clock },
];

const complianceNavigation = [
  { name: "Compliance Centre", href: "/compliance", icon: FileCheck },
];

const billingNavigation = [
  { name: "Billing Analytics", href: "/billing", icon: CreditCard },
];

const companyManagementNavigation = [
  { name: "Company List", href: "/admin/companies", icon: Building },
  { name: "Create Company", href: "/admin/create-company", icon: Plus },
  { name: "Billing Management", href: "/billing", icon: CreditCard },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = isAdminLevel(user);
  const canManageCompaniesAccess = canManageCompanies(user);
  const canViewBillingAccess = canViewBilling(user);

  const renderNavigationSection = (title: string, items: { name: string; href: string; icon: any }[], headerColor: string) => (
    <div className="mb-6">
      <div className={cn("px-3 py-2 rounded-lg mb-3 border", headerColor)}>
        <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href} 
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="hidden lg:block w-64 bg-card border-r border-border flex-shrink-0 card-elevated">
      {/* NeedCareAI+ Sidebar Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">AI+</span>
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">NeedCareAI+</h2>
            <p className="text-xs text-muted-foreground">Care Management Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="p-4 space-y-6">
        {/* Support Work Section */}
        {renderNavigationSection(
          "SUPPORT WORK", 
          supportWorkNavigation, 
          "bg-primary/10 text-primary border-primary/20"
        )}

        {/* Shift Management Section */}
        {renderNavigationSection(
          "SHIFT MANAGEMENT", 
          getShiftManagementNavigation(isAdmin), 
          "bg-info/10 text-info border-info/20"
        )}

        {/* Staff Management Section - Only for Admins */}
        {isAdmin && renderNavigationSection(
          "STAFF MANAGEMENT", 
          staffManagementNavigation, 
          "bg-warning/10 text-warning border-warning/20"
        )}

        {/* Compliance Section - Admin and Coordinator access */}
        {(user?.role?.toLowerCase() === "admin" || 
          user?.role?.toLowerCase() === "coordinator" || 
          user?.role?.toLowerCase() === "consolemanager" ||
          user?.role?.toLowerCase() === "programcoordinator") && renderNavigationSection(
          "COMPLIANCE", 
          complianceNavigation, 
          "bg-emerald-50/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
        )}

        {/* Billing Section - Admin, TeamLeader, Coordinator */}
        {canViewBillingAccess && !canManageCompaniesAccess && renderNavigationSection(
          "BILLING", 
          billingNavigation, 
          "bg-blue-50/80 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
        )}

        {/* Company Management Section - ConsoleManager Only */}
        {canManageCompaniesAccess && renderNavigationSection(
          "CONSOLE MANAGEMENT", 
          companyManagementNavigation, 
          "bg-destructive/10 text-destructive border-destructive/20"
        )}
      </nav>
    </aside>
  );
}
