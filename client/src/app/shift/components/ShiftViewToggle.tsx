import { Button } from "@/components/ui/button";
import { Calendar, List } from "lucide-react";

interface ShiftViewToggleProps {
  viewMode: "calendar" | "list";
  onViewChange: (mode: "calendar" | "list") => void;
}

export default function ShiftViewToggle({ viewMode, onViewChange }: ShiftViewToggleProps) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("list")}
        className="flex items-center gap-2"
      >
        <List className="h-4 w-4" />
        List
      </Button>
      <Button
        variant={viewMode === "calendar" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("calendar")}
        className="flex items-center gap-2"
      >
        <Calendar className="h-4 w-4" />
        Calendar
      </Button>
    </div>
  );
}