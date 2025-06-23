import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Search, Calendar, Clock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SimpleCancelledShiftsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedApprovalType, setSelectedApprovalType] = useState('all');

  // Fetch real cancellation data
  const { data: cancellationData = [], isLoading } = useQuery({
    queryKey: ["/api/cancellation-requests"],
    select: (data: any[]) => {
      // Transform cancellation requests to match our display format
      return data
        .filter(request => request.status !== 'pending') // Only show completed reviews
        .map(request => ({
          id: request.id,
          shiftTitle: request.shiftTitle || "Untitled Shift",
          clientName: request.clientName || "Unknown Client",
          cancelledByUserName: request.requestedByUserName,
          createdAt: request.reviewedAt || request.createdAt,
          shiftStartTime: request.shiftStartTime,
          hoursNotice: request.hoursNotice,
          cancellationType: request.hoursNotice >= 24 ? "advance" : "urgent",
          cancellationReason: request.requestReason || "No reason provided",
          approvalType: request.hoursNotice >= 24 ? "Auto-Approved" : "Admin Review",
          status: request.status
        }));
    }
  });

  // Filter data
  const filteredCancellations = cancellationData.filter((cancellation: any) => {
    const matchesSearch = 
      cancellation.shiftTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cancellation.cancelledByUserName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStaff = selectedStaff === "all" || 
      cancellation.cancelledByUserName === selectedStaff;

    const matchesApprovalType = selectedApprovalType === "all" || 
      cancellation.approvalType === selectedApprovalType;

    return matchesSearch && matchesStaff && matchesApprovalType;
  });

  // Analytics
  const analytics = {
    total: filteredCancellations.length,
    autoApproved: filteredCancellations.filter(c => c.approvalType === "Auto-Approved").length,
    adminReview: filteredCancellations.filter(c => c.approvalType === "Admin Review").length,
    averageNotice: Math.round(filteredCancellations.reduce((sum, c) => sum + c.hoursNotice, 0) / filteredCancellations.length || 0)
  };

  const handleExportCSV = () => {
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

  const handleExportExcel = () => {
    // Create Excel workbook data
    const workbookData = [
      ["Cancellation Records Export", "", "", "", "", "", ""],
      ["Generated:", new Date().toLocaleString(), "", "", "", "", ""],
      ["", "", "", "", "", "", ""],
      ["Date", "Staff Member", "Shift Title", "Client Name", "Hours Notice", "Approval Type", "Cancellation Reason"],
      ...filteredCancellations.map(c => [
        new Date(c.createdAt).toLocaleDateString(),
        c.cancelledByUserName,
        c.shiftTitle,
        c.clientName,
        c.hoursNotice,
        c.approvalType,
        c.cancellationReason
      ])
    ];

    // Convert to CSV format (Excel can read CSV)
    const csvContent = workbookData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cancellation-records-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
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
        
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleExportExcel} className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cancelled</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Auto-Approved</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.autoApproved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <User className="h-6 w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin Review</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.adminReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Notice</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.averageNotice}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by shift, client, or staff member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Filter by staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {Array.from(new Set(cancellationData.map(c => c.cancelledByUserName))).map(staff => (
              <SelectItem key={staff} value={staff}>{staff}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedApprovalType} onValueChange={setSelectedApprovalType}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder="Filter by approval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Auto-Approved">Auto-Approved</SelectItem>
            <SelectItem value="Admin Review">Admin Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Counter */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredCancellations.length} of {cancellationData.length} cancellation records
      </div>

      {/* Cancellation Records */}
      {filteredCancellations.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                {cancellationData.length === 0 ? "No cancellation records found" : "No records match your filters"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCancellations.map((cancellation: any) => (
            <Card key={cancellation.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {cancellation.shiftTitle}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Client: {cancellation.clientName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={cancellation.approvalType === "Auto-Approved" ? "default" : "secondary"}>
                          {cancellation.approvalType}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={cancellation.hoursNotice >= 24 ? "text-green-600" : "text-red-600"}
                        >
                          {cancellation.hoursNotice}h notice
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                        <span>Shift: {new Date(cancellation.shiftStartTime).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {cancellation.cancellationReason && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Reason:</p>
                        <div className="max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
                          <p className="text-gray-600 dark:text-gray-400 pr-2">
                            {cancellation.cancellationReason}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}