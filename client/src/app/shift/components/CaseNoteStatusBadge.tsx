import { Badge } from "@/components/ui/badge";
import { FileText, Clock, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { differenceInHours, isToday, isFuture, isPast } from "date-fns";

interface CaseNoteStatusBadgeProps {
  shift: any;
  caseNoteSubmitted?: boolean;
  className?: string;
}

export interface CaseNoteStatus {
  status: "not-due" | "due-today" | "due-soon" | "overdue" | "completed";
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}

export function getCaseNoteStatus(shift: any, caseNoteSubmitted: boolean = false): CaseNoteStatus {
  // If case note is already submitted
  if (caseNoteSubmitted) {
    return {
      status: "completed",
      color: "bg-emerald-50/80 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 backdrop-blur-sm",
      borderColor: "shadow-[inset_3px_0_0_#10b981]",
      bgColor: "bg-emerald-50/30 dark:bg-emerald-950/20",
      textColor: "text-emerald-700 dark:text-emerald-300",
      icon: <CheckCircle className="h-3 w-3" />,
      label: "Notes Complete",
      description: "Case note submitted"
    };
  }

  if (!shift.endTime) {
    // Future shift - not yet due
    return {
      status: "not-due",
      color: "bg-slate-50/80 text-slate-600 border-slate-200/50 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700/50 backdrop-blur-sm",
      borderColor: "shadow-[inset_3px_0_0_#64748b]",
      bgColor: "bg-slate-50/30 dark:bg-slate-900/20",
      textColor: "text-slate-600 dark:text-slate-400",
      icon: <Calendar className="h-3 w-3" />,
      label: "Notes Pending",
      description: "Case note not yet required"
    };
  }

  const shiftEndTime = new Date(shift.endTime);
  const now = new Date();
  const hoursAfterShift = differenceInHours(now, shiftEndTime);

  // Case note is due after shift completion
  if (hoursAfterShift < 0) {
    // Shift hasn't ended yet
    return {
      status: "not-due",
      color: "bg-slate-50/80 text-slate-600 border-slate-200/50 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700/50 backdrop-blur-sm",
      borderColor: "shadow-[inset_3px_0_0_#64748b]",
      bgColor: "bg-slate-50/30 dark:bg-slate-900/20",
      textColor: "text-slate-600 dark:text-slate-400",
      icon: <Calendar className="h-3 w-3" />,
      label: "Notes Pending",
      description: "Shift in progress"
    };
  }

  if (isToday(shiftEndTime) && hoursAfterShift <= 12) {
    // Due today (within 12 hours of shift end)
    return {
      status: "due-today",
      color: "bg-amber-50/80 text-amber-700 border-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50 backdrop-blur-sm",
      borderColor: "shadow-[inset_3px_0_0_#f59e0b]",
      bgColor: "bg-amber-50/30 dark:bg-amber-950/20",
      textColor: "text-amber-700 dark:text-amber-300",
      icon: <Clock className="h-3 w-3" />,
      label: "Notes Due Today",
      description: "Case note due within 12 hours"
    };
  }

  if (hoursAfterShift <= 12) {
    // Due soon (within 12 hours after shift)
    return {
      status: "due-soon",
      color: "bg-orange-50/80 text-orange-700 border-orange-200/50 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50 backdrop-blur-sm",
      borderColor: "shadow-[inset_3px_0_0_#ea580c]",
      bgColor: "bg-orange-50/30 dark:bg-orange-950/20",
      textColor: "text-orange-700 dark:text-orange-300",
      icon: <Clock className="h-3 w-3" />,
      label: "Notes Due Soon",
      description: "Case note due soon"
    };
  }

  // Overdue (more than 12 hours after shift)
  return {
    status: "overdue",
    color: "bg-red-50/80 text-red-700 border-red-200/50 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50 backdrop-blur-sm",
    borderColor: "shadow-[inset_3px_0_0_#dc2626]",
    bgColor: "bg-red-50/30 dark:bg-red-950/20",
    textColor: "text-red-700 dark:text-red-300",
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "Notes Overdue",
    description: `Case note overdue by ${Math.floor(hoursAfterShift - 12)} hours`
  };
}

export default function CaseNoteStatusBadge({ 
  shift, 
  caseNoteSubmitted = false, 
  className = "" 
}: CaseNoteStatusBadgeProps) {
  const status = getCaseNoteStatus(shift, caseNoteSubmitted);

  return (
    <Badge 
      className={`${status.color} flex items-center gap-1 text-xs font-medium ${className}`}
      title={status.description}
    >
      {status.icon}
      {status.label}
    </Badge>
  );
}

// Subtle corner indicator that doesn't interfere with existing colors
export function CaseNoteCornerIndicator({ 
  shift, 
  caseNoteSubmitted = false 
}: CaseNoteStatusBadgeProps) {
  const status = getCaseNoteStatus(shift, caseNoteSubmitted);

  let indicatorColor = "";
  switch (status.status) {
    case "completed":
      indicatorColor = "bg-emerald-500";
      break;
    case "overdue":
      indicatorColor = "bg-red-500 animate-pulse";
      break;
    case "due-today":
      indicatorColor = "bg-amber-500";
      break;
    case "due-soon":
      indicatorColor = "bg-orange-500";
      break;
    default:
      indicatorColor = "bg-slate-400";
  }

  return (
    <div 
      className={`absolute top-2 right-2 w-3 h-3 rounded-full ${indicatorColor} shadow-sm z-10`}
      title={status.description}
    />
  );
}

// Subtle left border accent
export function CaseNoteStatusBorder({ 
  shift, 
  caseNoteSubmitted = false 
}: CaseNoteStatusBadgeProps) {
  const status = getCaseNoteStatus(shift, caseNoteSubmitted);

  let borderColor = "";
  switch (status.status) {
    case "completed":
      borderColor = "border-l-emerald-500";
      break;
    case "overdue":
      borderColor = "border-l-red-500";
      break;
    case "due-today":
      borderColor = "border-l-amber-500";
      break;
    case "due-soon":
      borderColor = "border-l-orange-500";
      break;
    default:
      borderColor = "border-l-slate-400";
  }

  return (
    <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderColor} border-l-4 rounded-l-lg`} />
  );
}