import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, UserCheck, Settings } from "lucide-react";

interface ApprovalBadgeProps {
  status: string;
  approvedBy?: number | null;
  className?: string;
}

export function ApprovalBadge({ status, approvedBy, className }: ApprovalBadgeProps) {
  if (status === "approved") {
    const isSystemApproved = approvedBy === -1;
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge 
          variant="outline" 
          className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5"
        >
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
        <Badge 
          variant="secondary" 
          className={`text-xs ${
            isSystemApproved 
              ? "bg-blue-50 text-blue-700 border-blue-200" 
              : "bg-orange-50 text-orange-700 border-orange-200"
          }`}
        >
          {isSystemApproved ? (
            <>
              <Settings className="h-3 w-3 mr-1" />
              System Auto-Approved
            </>
          ) : (
            <>
              <UserCheck className="h-3 w-3 mr-1" />
              Admin Approved
            </>
          )}
        </Badge>
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1.5 ${className}`}
      >
        <Clock className="h-3 w-3" />
        Awaiting Approval
      </Badge>
    );
  }

  if (status === "rejected") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-red-50 text-red-700 border-red-200 flex items-center gap-1.5 ${className}`}
      >
        Rejected
      </Badge>
    );
  }

  if (status === "draft") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-1.5 ${className}`}
      >
        Draft
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}