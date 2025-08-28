import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Calendar as CalendarIcon, X, LayoutGrid, List } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Client } from "@shared/schema";

interface CaseNoteFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedClient: string;
  onClientChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;
  totalCount: number;
  filteredCount: number;
}

export default function CaseNoteFilterBar({
  searchTerm,
  onSearchChange,
  selectedClient,
  onClientChange,
  selectedType,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount
}: CaseNoteFilterBarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { user } = useAuth();

  // Fetch clients based on user permissions
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    select: (data: Client[]) => {
      if (user?.role === "SupportWorker") {
        // Support workers only see assigned clients
        return data.filter(client => client.tenantId === user.tenantId);
      } else if (user?.role === "TeamLeader" || user?.role === "Admin") {
        // Team leaders and admins see all clients in their company
        return data.filter(client => client.tenantId === user.tenantId);
      } else if (user?.role === "ConsoleManager") {
        // Console managers see all clients
        return data;
      }
      return data;
    }
  });

  const clearFilters = () => {
    onSearchChange("");
    onClientChange("all");
    onTypeChange("all");
    onDateRangeChange(undefined);
  };

  const hasActiveFilters = searchTerm || selectedClient !== "all" || selectedType !== "all" || dateRange;

  const formatDateRange = () => {
    if (!dateRange?.from) return "Select date range";
    if (!dateRange.to) return format(dateRange.from, "MMM d, yyyy");
    return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
  };

  return (
    <div className="space-y-4">
      {/* Search and main filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by client, staff, or content..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Client filter */}
          <Select value={selectedClient} onValueChange={onClientChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={selectedType} onValueChange={onTypeChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="incident">Incident</SelectItem>
              <SelectItem value="medication">Medication</SelectItem>
            </SelectContent>
          </Select>

          {/* Date range picker */}
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-60 justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
              />
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDateRangeChange(undefined);
                    setIsDatePickerOpen(false);
                  }}
                  className="w-full"
                >
                  Clear dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("list")}
              className="rounded-r-none"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("card")}
              className="rounded-l-none"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active filters and results summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Results summary */}
          <span className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalCount} case notes
          </span>

          {/* Active filter badges */}
          {searchTerm && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{searchTerm}"
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => onSearchChange("")}
              />
            </Badge>
          )}

          {selectedClient !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Client: {clients.find(c => c.id.toString() === selectedClient)?.fullName || selectedClient}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => onClientChange("all")}
              />
            </Badge>
          )}

          {selectedType !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Type: {selectedType}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => onTypeChange("all")}
              />
            </Badge>
          )}

          {dateRange && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Date: {formatDateRange()}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => onDateRangeChange(undefined)}
              />
            </Badge>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              <Filter className="w-3 h-3 mr-1" />
              Clear all filters
            </Button>
          )}
        </div>

        {/* Quick filter buttons */}
        <div className="flex gap-2">
          <Button
            variant={selectedType === "urgent" ? "default" : "outline"}
            size="sm"
            onClick={() => onTypeChange(selectedType === "urgent" ? "all" : "urgent")}
            className="text-xs"
          >
            Urgent Only
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(today.getDate() - 7);
              onDateRangeChange({ from: sevenDaysAgo, to: today });
            }}
            className="text-xs"
          >
            Last 7 Days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(today.getDate() - 30);
              onDateRangeChange({ from: thirtyDaysAgo, to: today });
            }}
            className="text-xs"
          >
            Last 30 Days
          </Button>
        </div>
      </div>
    </div>
  );
}