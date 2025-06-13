import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ShiftStatusTagProps {
  status: string;
  className?: string;
}

export default function ShiftStatusTag({ status, className }: ShiftStatusTagProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "unassigned":
        return {
          label: "Unassigned",
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        };
      case "assigned":
        return {
          label: "Assigned",
          variant: "outline" as const,
          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
        };
      case "in-progress":
        return {
          label: "In Progress",
          variant: "default" as const,
          className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
        };
      case "completed":
        return {
          label: "Completed",
          variant: "secondary" as const,
          className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
        };
      case "cancelled":
        return {
          label: "Cancelled",
          variant: "destructive" as const,
          className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
        };
      default:
        return {
          label: status,
          variant: "secondary" as const,
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}