import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export default function UniversalHeader() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Generate breadcrumbs based on current path
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/", icon: <Home className="w-4 h-4" /> }
    ];

    if (location.startsWith("/support-work")) {
      breadcrumbs.push({ label: "Support Work", href: "/support-work" });
      
      if (location.includes("/client-profile")) {
        breadcrumbs.push({ label: "Client Profile" });
      }
    } else if (location.startsWith("/shift")) {
      breadcrumbs.push({ label: "Shift Management" });
    } else if (location.startsWith("/hourly-observations")) {
      breadcrumbs.push({ label: "Hourly Observations" });
    } else if (location.startsWith("/staff-availability")) {
      breadcrumbs.push({ label: "Staff Availability" });
    } else if (location.startsWith("/clients")) {
      breadcrumbs.push({ label: "Clients" });
    } else if (location.startsWith("/staff")) {
      breadcrumbs.push({ label: "Staff" });
    } else if (location.startsWith("/forms")) {
      breadcrumbs.push({ label: "Forms" });
    } else if (location.startsWith("/reports")) {
      breadcrumbs.push({ label: "Reports" });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentPage = breadcrumbs[breadcrumbs.length - 1];
  const parentPage = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  // Don't show header on dashboard (home page)
  if (location === "/") return null;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Breadcrumbs */}
          <div className="flex items-center space-x-2">
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center space-x-2">
                  {index > 0 && <span className="text-gray-300">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-600 hover:text-gray-900">
                        {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                        {crumb.label}
                      </Button>
                    </Link>
                  ) : (
                    <span className="px-2 py-1 text-gray-900 font-medium">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Right side - Back button and user info */}
          <div className="flex items-center space-x-4">
            {/* Back Button */}
            {parentPage && (
              <Link href={parentPage.href || "/"}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to {parentPage.label}
                </Button>
              </Link>
            )}
            
            {/* User Info */}
            {user && (
              <div className="text-sm text-gray-600">
                Welcome, {user.username}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}