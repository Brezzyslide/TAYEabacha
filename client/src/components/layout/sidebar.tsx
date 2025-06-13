import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supportWorkNavigation = [
  { name: "Client Profile", href: "/client/1", icon: User },
  { name: "Case Notes", href: "/case-notes", icon: FileText },
  { name: "Hourly Observations", href: "/observations", icon: Eye },
  { name: "Medication Tracker", href: "/medications", icon: Pill },
  { name: "Care Support Plans", href: "/care-plans", icon: ClipboardList },
  { name: "Workflow Dashboard", href: "/", icon: BarChart3 },
  { name: "Incident Report", href: "/incidents", icon: AlertTriangle },
  { name: "Messages", href: "/messages", icon: MessageSquare },
];

const shiftManagementNavigation = [
  { name: "Shifts", href: "/shifts", icon: Calendar },
  { name: "My Availability", href: "/availability", icon: Clock },
  { name: "Allocations", href: "/allocations", icon: TrendingUp },
];

const staffManagementNavigation = [
  { name: "Roles & Permissions", href: "/permissions", icon: Shield },
  { name: "User Management", href: "/staff", icon: Users },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const renderNavigationSection = (title: string, items: { name: string; href: string; icon: any }[], headerColor: string) => (
    <div className="mb-6">
      <div className={cn("px-4 py-2 rounded-lg mb-2", headerColor)}>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-gray-800 text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              )}>
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-64 bg-slate-50 flex-shrink-0 hidden lg:block border-r border-gray-200">
      {/* Navigation Menu */}
      <nav className="p-4 space-y-6">
        {/* Support Work Section */}
        {renderNavigationSection(
          "SUPPORT WORK", 
          supportWorkNavigation, 
          "bg-yellow-200"
        )}

        {/* Shift Management Section */}
        {renderNavigationSection(
          "SHIFT MANAGEMENT", 
          shiftManagementNavigation, 
          "bg-yellow-200"
        )}

        {/* Staff Management Section */}
        {renderNavigationSection(
          "STAFF MANAGEMENT", 
          staffManagementNavigation, 
          "bg-yellow-200"
        )}
      </nav>
    </aside>
  );
}
