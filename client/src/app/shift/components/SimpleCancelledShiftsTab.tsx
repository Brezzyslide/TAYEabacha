import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Search, Calendar, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Mock data for demonstration - replace with real API later
const mockCancellations = [
  {
    id: 1,
    shiftTitle: "Morning Support - Oliver",
    clientName: "Oliver Thompson",
    cancelledByUserName: "Joe Bloke",
    createdAt: "2025-06-23T00:49:38Z",
    shiftStartTime: "2025-07-03T23:00:00Z",
    hoursNotice: 262,
    cancellationType: "immediate",
    cancellationReason: "Personal reasons",
    approvalType: "Auto-Approved"
  },
  {
    id: 2,
    shiftTitle: "Evening Care - Sarah",
    clientName: "Sarah Johnson",
    cancelledByUserName: "Joe Bloke", 
    createdAt: "2025-06-23T00:49:33Z",
    shiftStartTime: "2025-07-04T23:00:00Z",
    hoursNotice: 286,
    cancellationType: "immediate",
    cancellationReason: "Personal reasons",
    approvalType: "Auto-Approved"
  },
  {
    id: 3,
    shiftTitle: "Weekend Support",
    clientName: "Michael Chen",
    cancelledByUserName: "Sarah Mitchell",
    createdAt: "2025-06-22T10:30:00Z",
    shiftStartTime: "2025-06-25T08:00:00Z",
    hoursNotice: 18,
    cancellationType: "urgent",
    cancellationReason: "Family emergency",
    approvalType: "Admin Review"
  }
];

export default function SimpleCancelledShiftsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedApprovalType, setSelectedApprovalType] = useState("all");

  // Filter data
  const filteredCancellations = mockCancellations.filter(cancellation => {
    const matchesSearch = 
      cancellation.shiftTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.cancelledByUserName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStaff = selectedStaff === "all" || cancellation.cancelledByUserName === selectedStaff;
    const matchesApproval = selectedApprovalType === "all" || cancellation.approvalType === selectedApprovalType;
    
    return matchesSearch && matchesStaff && matchesApproval;
  });

  // Analytics
  const analytics = {
    total: filteredCancellations.length,
    autoApproved: filteredCancellations.filter(c => c.approvalType === "Auto-Approved").length,
    adminReview: filteredCancellations.filter(c => c.approvalType === "Admin Review").length,
    averageNotice: Math.round(filteredCancellations.reduce((sum, c) => sum + c.hoursNotice, 0) / filteredCancellations.length || 0)
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ["Date", "Staff", "Shift", "Client", "Hours Notice", "Approval Type", "Reason"];
    const csvContent = [
      headers.join(','),
      ...filteredCancellations.map(c => [
        new Date(c.createdAt).toLocaleDateString(),
        c.cancelledByUserName,
        c.shiftTitle,
        c.clientName,
        c.hoursNotice,
        c.approvalType,
        c.cancellationReason
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cancellation-records-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cancellation Records
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Complete cancellation history with filtering and analytics ({filteredCancellations.length} records)
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
              <AlertCircle className="h-4 w-4" />
              Total Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total}</div>
            <p className="text-xs text-muted-foreground">Total records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Auto-Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.autoApproved}</div>
            <p className="text-xs text-muted-foreground">24+ hours notice</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Admin Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{analytics.adminReview}</div>
            <p className="text-xs text-muted-foreground">&lt;24 hours notice</p>
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
            <p className="text-xs text-muted-foreground">Average hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search shifts, clients, or staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            <SelectItem value="Joe Bloke">Joe Bloke</SelectItem>
            <SelectItem value="Sarah Mitchell">Sarah Mitchell</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedApprovalType} onValueChange={setSelectedApprovalType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Auto-Approved">Auto-Approved</SelectItem>
            <SelectItem value="Admin Review">Admin Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {filteredCancellations.map((cancellation) => (
          <Card key={cancellation.id} className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{cancellation.shiftTitle}</h3>
                    <Badge variant={cancellation.approvalType === "Auto-Approved" ? "default" : "secondary"}>
                      {cancellation.approvalType}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Client: {cancellation.clientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Cancelled by: {cancellation.cancelledByUserName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Date: {new Date(cancellation.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className={cancellation.hoursNotice >= 24 ? "text-green-600" : "text-red-600"}>
                        {cancellation.hoursNotice}h notice
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <span className="text-sm font-medium">Reason: </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {cancellation.cancellationReason}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCancellations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No cancellation records found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search filters to see more results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}