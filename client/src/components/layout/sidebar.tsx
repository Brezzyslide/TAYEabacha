import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Building, LayoutDashboard, Users, UserRound, Clock, FileText, BarChart3, Download, Settings, Shield, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Staff", href: "/staff", icon: UserRound },
  { name: "Shift Logging", href: "/shifts", icon: Clock },
  { name: "Forms", href: "/forms", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Export Data", href: "/export", icon: Download },
];

const adminNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Permissions", href: "/permissions", icon: Shield },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <aside className="w-64 bg-white shadow-lg flex-shrink-0 hidden lg:block border-r">
      {/* Tenant Selector */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Building className="text-primary-foreground text-sm" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Sunrise Care Center</h3>
            <p className="text-xs text-gray-500">Healthcare Facility</p>
          </div>
          <Button variant="ghost" size="sm" className="h-auto p-1">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-600 hover:bg-gray-50"
              )}>
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
                {item.name === "Clients" && (
                  <Badge variant="secondary" className="ml-auto text-xs">248</Badge>
                )}
                {item.name === "Shift Logging" && (
                  <Badge variant="default" className="ml-auto text-xs">Active</Badge>
                )}
              </a>
            </Link>
          );
        })}
        
        {/* Admin Only Section */}
        {isAdmin && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Administration</p>
            {adminNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <a className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-600 hover:bg-gray-50"
                  )}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </aside>
  );
}
