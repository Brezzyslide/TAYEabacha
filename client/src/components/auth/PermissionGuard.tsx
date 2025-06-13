import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/auth";
import { ReactNode } from "react";

interface PermissionGuardProps {
  children: ReactNode;
  module: string;
  action: string;
  targetCompanyId?: string;
  targetClientId?: number;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export function PermissionGuard({
  children,
  module,
  action,
  targetCompanyId,
  targetClientId,
  fallback = null
}: PermissionGuardProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;

  const canAccess = hasPermission(user, module, action, targetCompanyId, targetClientId);

  return canAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook for permission checking in components
 */
export function usePermission(
  module: string,
  action: string,
  targetCompanyId?: string,
  targetClientId?: number
) {
  const { user } = useAuth();

  if (!user) return false;

  return hasPermission(user, module, action, targetCompanyId, targetClientId);
}