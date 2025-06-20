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
      color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700",
      borderColor: "border-l-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      textColor: "text-blue-700 dark:text-blue-300",
      icon: <CheckCircle className="h-3 w-3" />,
      label: "Complete",
      description: "Case note submitted"
    };
  }

  if (!shift.endTime) {
    // Future shift - not yet due
    return {
      status: "not-due",
      color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
      borderColor: "border-l-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
      textColor: "text-gray-600 dark:text-gray-400",
      icon: <Calendar className="h-3 w-3" />,
      label: "Not Due",
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
      color: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
      borderColor: "border-l-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
      textColor: "text-gray-600 dark:text-gray-400",
      icon: <Calendar className="h-3 w-3" />,
      label: "Not Due",
      description: "Shift in progress"
    };
  }

  if (isToday(shiftEndTime) && hoursAfterShift <= 12) {
    // Due today (within 12 hours of shift end)
    return {
      status: "due-today",
      color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700",
      borderColor: "border-l-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      textColor: "text-yellow-700 dark:text-yellow-300",
      icon: <Clock className="h-3 w-3" />,
      label: "Due Today",
      description: "Case note due within 12 hours"
    };
  }

  if (hoursAfterShift <= 12) {
    // Due soon (within 12 hours after shift)
    return {
      status: "due-soon",
      color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700",
      borderColor: "border-l-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      textColor: "text-orange-700 dark:text-orange-300",
      icon: <Clock className="h-3 w-3" />,
      label: "Due Soon",
      description: "Case note due soon"
    };
  }

  // Overdue (more than 12 hours after shift)
  return {
    status: "overdue",
    color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700",
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    textColor: "text-red-700 dark:text-red-300",
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "Overdue",
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
      className={`${status.color} flex items-center gap-1 text-xs ${className}`}
      title={status.description}
    >
      {status.icon}
      {status.label}
    </Badge>
  );
}

export function CaseNoteStatusBanner({ 
  shift, 
  caseNoteSubmitted = false 
}: CaseNoteStatusBadgeProps) {
  const status = getCaseNoteStatus(shift, caseNoteSubmitted);

  return (
    <div className={`absolute left-0 top-0 bottom-0 w-1 ${status.borderColor.replace('border-l-', 'bg-')}`} />
  );
}