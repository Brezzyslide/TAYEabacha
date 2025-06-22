import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Download, Search, Filter, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { ShiftCancellation } from "@shared/schema";

export default function CancelledShiftsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: cancellations = [], isLoading } = useQuery<ShiftCancellation[]>({
    queryKey: ["/api/shifts/cancelled"],
    refetchInterval: 30000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["/api/staff"],
  });

  // Filter cancellations based on search and filters
  const filteredCancellations = cancellations.filter(cancellation => {
    const matchesSearch = 
      cancellation.cancelledByUserName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.shiftTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.clientName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStaff = selectedStaff === "all" || 
      cancellation.cancelledByUserId === parseInt(selectedStaff);

    const matchesDate = dateFilter === "all" || (() => {
      const cancellationDate = new Date(cancellation.createdAt);
      const now = new Date();
      
      switch (dateFilter) {
        case "today":
          return cancellationDate.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return cancellationDate >= weekAgo;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return cancellationDate >= monthAgo;
        default:
          return true;
      }
    })();

    return matchesSearch && matchesStaff && matchesDate;
  });

  // Calculate analytics for current filtered data
  const analytics = {
    total: filteredCancellations.length,
    autoApproved: filteredCancellations.filter(c => c.hoursNotice >= 24).length,
    adminApproved: filteredCancellations.filter(c => c.hoursNotice < 24).length,
    averageNotice: filteredCancellations.length > 0 
      ? Math.round(filteredCancellations.reduce((sum, c) => sum + c.hoursNotice, 0) / filteredCancellations.length)
      : 0,
    thisWeek: filteredCancellations.filter(c => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(c.createdAt) >= weekAgo;
    }).length,
    mostFrequentReason: (() => {
      const reasons = filteredCancellations.map(c => c.cancellationReason).filter(Boolean);
      const reasonCounts = reasons.reduce((acc, reason) => {
        acc[reason!] = (acc[reason!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return Object.keys(reasonCounts).length > 0 
        ? Object.entries(reasonCounts).sort(([,a], [,b]) => (b as number) - (a as number))[0][0]
        : 'N/A';
    })()
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStaff !== "all") params.append("staffId", selectedStaff);
      
      const url = `/api/shifts/cancelled/export?${params.toString()}`;
      window.open(url, '_blank');
      
      toast({
        title: "Export Started",
        description: "Your cancelled shifts report is being downloaded",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export cancelled shifts data",
        variant: "destructive",
      });
    }
  };

  const getCancellationTypeColor = (type: string) => {
    switch (type) {
      case "immediate":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "requested":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getHoursNoticeColor = (hours: number) => {
    if (hours >= 24) return "text-green-600 dark:text-green-400";
    if (hours >= 12) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Staff Cancelled Shifts
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            View and export cancelled shift records ({filteredCancellations.length} total)
          </p>
        </div>
        
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total}</div>
            <p className="text-xs text-muted-foreground">
              {selectedStaff === "all" ? "Organization-wide" : "Staff member"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Auto-Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.autoApproved}</div>
            <p className="text-xs text-muted-foreground">
              24+ hours notice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Admin Reviewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{analytics.adminApproved}</div>
            <p className="text-xs text-muted-foreground">
              &lt;24 hours notice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageNotice}h</div>
            <p className="text-xs text-muted-foreground">
              {analytics.thisWeek} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by staff, shift, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {(staff as any[]).map((member: any) => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Period</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellations List */}
      {filteredCancellations.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-gray-500 dark:text-gray-400">
              No cancelled shifts found matching your criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCancellations.map((cancellation) => (
            <Card key={cancellation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold">
                      {cancellation.shiftTitle || "Untitled Shift"}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{cancellation.cancelledByUserName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Cancelled {format(new Date(cancellation.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getCancellationTypeColor(cancellation.cancellationType)}>
                      {cancellation.cancellationType === "immediate" ? "Immediate" : "Admin Approved"}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`${getHoursNoticeColor(cancellation.hoursNotice)} border-current`}
                    >
                      {cancellation.hoursNotice}h notice
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Shift Details</p>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(cancellation.shiftStartTime), "MMM d, h:mm a")} - 
                        {cancellation.shiftEndTime ? format(new Date(cancellation.shiftEndTime), "h:mm a") : "TBD"}
                      </span>
                    </div>
                    {cancellation.clientName && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="h-4 w-4" />
                        <span>{cancellation.clientName}</span>
                      </div>
                    )}
                  </div>
                  
                  {cancellation.cancellationReason && (
                    <div className="space-y-1 md:col-span-2 lg:col-span-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Reason</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {cancellation.cancellationReason}
                      </p>
                    </div>
                  )}
                  
                  {cancellation.approvedByUserName && (
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Approved By</p>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="h-4 w-4" />
                        <span>{cancellation.approvedByUserName}</span>
                      </div>
                      {cancellation.approvedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {format(new Date(cancellation.approvedAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}