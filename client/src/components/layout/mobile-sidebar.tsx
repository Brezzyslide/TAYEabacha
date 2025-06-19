import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
// Helper function for company management permissions
function canManageCompanies(user: any): boolean {
  return user?.role === "ConsoleManager";
}
import { 
  Users, Calendar, Clock, FileText, Stethoscope, AlertTriangle, 
  Activity, Building, Plus, Settings, UserCog, DollarSign, 
  MessageSquare, X, ClipboardList, Zap, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const canManageCompaniesAccess = canManageCompanies(user);

  const supportWorkNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: Activity },
    { name: "Clients", href: "/support-work/clients", icon: Users },
    { name: "Staff Management", href: "/staff", icon: UserCog },
    { name: "Case Notes", href: "/case-notes", icon: FileText },
    { name: "Medications", href: "/medications", icon: Stethoscope },
    { name: "Incident Reports", href: "/incident-management", icon: AlertTriangle },
    { name: "Care Support Plans", href: "/care-support-plans", icon: ClipboardList },
    { name: "Workflow Dashboard", href: "/workflow-dashboard", icon: Zap },
  ];

  const shiftManagementNavigation = [
    { name: "Calendar", href: "/shift/calendar", icon: Calendar },
    { name: "My Shifts", href: "/shift/my-shifts", icon: Clock },
  ];

  const staffManagementNavigation = [
    { name: "Hour Allocation", href: "/staff-hour-allocation", icon: TrendingUp },
    { name: "Roles & Permissions", href: "/roles-permissions", icon: Settings },
    { name: "Internal Messaging", href: "/messaging", icon: MessageSquare },
    { name: "Budget Management", href: "/budget-management", icon: DollarSign },
  ];

  const companyManagementNavigation = [
    { name: "Company List", href: "/admin/companies", icon: Building },
    { name: "Create Company", href: "/admin/create-company", icon: Plus },
  ];

  const renderNavigationSection = (title: string, items: { name: string; href: string; icon: any }[], headerColor: string) => (
    <div className="mb-6">
      <div className={cn("px-3 py-2 rounded-lg mb-2", headerColor)}>
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href} 
              onClick={onClose}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-gray-800 text-white" 
                  : "text-gray-700 hover:bg-gray-100"
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
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 bg-slate-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-6">
          {/* Support Work Section */}
          {renderNavigationSection(
            "Support Work", 
            supportWorkNavigation, 
            "bg-yellow-200"
          )}

          {/* Shift Management Section */}
          {renderNavigationSection(
            "Shift Management", 
            shiftManagementNavigation, 
            "bg-blue-200"
          )}

          {/* Staff Management Section */}
          {renderNavigationSection(
            "Staff Management", 
            staffManagementNavigation, 
            "bg-green-200"
          )}

          {/* Company Management Section - ConsoleManager Only */}
          {canManageCompaniesAccess && renderNavigationSection(
            "Company Management", 
            companyManagementNavigation, 
            "bg-purple-200"
          )}
        </nav>
      </aside>
    </>
  );
}