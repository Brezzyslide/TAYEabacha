import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, AlertTriangle, Clock, CheckCircle, Eye, Edit, Trash2, Download, RefreshCw } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { RefreshHandler } from "@/components/RefreshHandler";

import { CreateIncidentModal } from "./components/CreateIncidentModal";
import { ViewIncidentModal } from "./components/ViewIncidentModal";
import { CloseIncidentModal } from "./components/CloseIncidentModal";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface IncidentReport {
  report: {
    id: number;
    incidentId: string;
    dateTime: string;
    location: string;
    witnessName?: string;
    witnessPhone?: string;
    types: string[];
    isNDISReportable: boolean;
    triggers: Array<{ label: string; notes?: string }>;
    intensityRating: number;
    staffResponses: Array<{ label: string; notes?: string }>;
    description: string;
    externalRef?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  closure?: {
    id: number;
    closureDate: string;
    controlReview: boolean;
    improvements?: string;
    implemented: boolean;
    controlLevel: string;
    wasLTI: string;
    hazard: string;
    severity: string;
    externalNotice: boolean;
    participantContext: string;
    supportPlanAvailable: string;
    reviewType: string;
    outcome?: string;
    attachments: any[];
    createdAt: string;
  };
  client: {
    id: number;
    firstName: string;
    lastName: string;
    clientId: string;
  };
  staff: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export default function IncidentDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Auto-refresh for real-time updates with production-optimized intervals
  const { manualRefresh } = useAutoRefresh({
    queryKeys: ["/api/incident-reports", "/api/notifications"],
    interval: 30000, // 30 seconds for faster updates in production
    enabled: true
  });

  // Setup realtime updates via WebSocket
  useRealtimeUpdates({
    enabled: true,
    onUpdate: (data) => {
      if (data.type.includes('incident')) {
        toast({
          title: "Real-time Update",
          description: "Incident data has been updated",
        });
      }
    }
  });

  // Permission check: Only TeamLeader, Coordinator, and Admin can close/delete incidents
  const canCloseIncident = () => {
    if (!user?.role) return false;
    const userRole = user.role.toLowerCase();
    return userRole === "admin" || userRole === "coordinator" || userRole === "teamleader" || userRole === "consolemanager";
  };

  const { data: incidents = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/incident-reports"],
    queryFn: async () => {
      console.log("[INCIDENT DASHBOARD] Fetching incident reports...");
      try {
        const response = await apiRequest("GET", "/api/incident-reports");
        console.log("[INCIDENT DASHBOARD] Response status:", response.status);
        console.log("[INCIDENT DASHBOARD] Response headers:", Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          console.error("[INCIDENT DASHBOARD] Response not OK:", response.statusText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("[INCIDENT DASHBOARD] Raw response data:", data);
        console.log("[INCIDENT DASHBOARD] Data type:", typeof data);
        console.log("[INCIDENT DASHBOARD] Is array:", Array.isArray(data));
        console.log("[INCIDENT DASHBOARD] Data length:", data?.length || 0);
        
        if (Array.isArray(data)) {
          console.log("[INCIDENT DASHBOARD] Returning", data.length, "incidents");
          return data;
        } else {
          console.warn("[INCIDENT DASHBOARD] Data is not an array, returning empty array");
          return [];
        }
      } catch (error) {
        console.error("[INCIDENT DASHBOARD] Fetch error:", error);
        throw error;
      }
    },
    staleTime: 0, // Always fetch fresh data in production
    gcTime: 1000 * 60 * 5, // 5 minutes garbage collection time
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch on component mount
  });

  const deleteIncidentMutation = useMutation({
    mutationFn: (incidentId: string) => 
      apiRequest("DELETE", `/api/incident-reports/${incidentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
      toast({
        title: "Success",
        description: "Incident report deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete incident report",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading incidents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-600">
          Error loading incidents. Please try again.
        </div>
      </div>
    );
  }

  const filteredIncidents = (incidents || []).filter((incident: any) => {
    const matchesSearch = searchTerm === '' || 
      incident.incidentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${incident.clientFirstName} ${incident.clientLastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    
    const matchesType = typeFilter === 'all' || incident.types.some((type: string) => 
      type.toLowerCase().includes(typeFilter.toLowerCase())
    );
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "open" && incident.status === "Open") ||
      (activeTab === "closed" && incident.status === "Closed") ||
      (activeTab === "ndis" && incident.isNDISReportable === true);

    return matchesSearch && matchesStatus && matchesType && matchesTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Open</Badge>;
      case "Closed":
        return <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getIntensityBadge = (rating: number) => {
    if (rating >= 8) return <Badge variant="destructive">High ({rating})</Badge>;
    if (rating >= 5) return <Badge variant="destructive" className="bg-orange-500">Medium ({rating})</Badge>;
    return <Badge variant="secondary">Low ({rating})</Badge>;
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;
    switch (severity) {
      case "Critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "High":
        return <Badge variant="destructive" className="bg-orange-600">High</Badge>;
      case "Medium":
        return <Badge variant="secondary" className="bg-yellow-500">Medium</Badge>;
      case "Low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const handleDeleteIncident = (incidentId: string) => {
    if (confirm("Are you sure you want to delete this incident report? This action cannot be undone.")) {
      deleteIncidentMutation.mutate(incidentId);
    }
  };

  const handleViewIncident = (incident: IncidentReport) => {
    setSelectedIncident(incident);
    setShowViewModal(true);
  };

  const handleCloseIncident = (incident: IncidentReport) => {
    setSelectedIncident(incident);
    setShowCloseModal(true);
  };

  // Export functions
  const handleExportPDF = async () => {
    try {
      const response = await fetch("/api/incident-reports/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentIds: filteredIncidents.map(i => i.report.incidentId) })
      });
      
      if (!response.ok) throw new Error('Failed to export PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident-reports-export-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Incident reports have been exported to PDF"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export incident reports to PDF",
        variant: "destructive"
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch("/api/incident-reports/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentIds: filteredIncidents.map(i => i.report.incidentId) })
      });
      
      if (!response.ok) throw new Error('Failed to export Excel');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident-reports-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Incident reports have been exported to Excel"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export incident reports to Excel",
        variant: "destructive"
      });
    }
  };

  const handleExportIndividualPDF = async (incidentId: string) => {
    try {
      const response = await fetch(`/api/incident-reports/${incidentId}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `incident-report-${incidentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Generated",
        description: `Incident report ${incidentId} exported successfully`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not generate PDF",
        variant: "destructive"
      });
    }
  };

  const incidentStats = {
    total: incidents.length,
    open: incidents.filter((i: any) => i.status === "Open").length,
    closed: incidents.filter((i: any) => i.status === "Closed").length,
    ndis: incidents.filter((i: any) => i.isNDISReportable === true).length,
    highIntensity: incidents.filter((i: any) => (i.intensityRating || 0) >= 8).length,
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading incidents...</div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("[INCIDENT DASHBOARD] Query error:", error);
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-700">Failed to load incident reports. This could be an environment-specific issue.</p>
            <p className="text-sm text-red-600 font-mono">{String(error)}</p>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <RefreshHandler />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Management</h1>
          <p className="text-muted-foreground">Comprehensive incident reporting and closure tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={manualRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Incident Report
          </Button>
        </div>
      </div>

      {/* Debug Information for Production Issues */}
      {incidents.length === 0 && !isLoading && !error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-yellow-700">No incidents found. This could indicate:</p>
            <ul className="text-sm text-yellow-600 list-disc list-inside space-y-1">
              <li>No incidents have been created yet</li>
              <li>Data fetch successful but returned empty array</li>
              <li>Environment-specific filtering issue (AWS vs Replit)</li>
              <li>Database connectivity or tenant isolation issue</li>
              <li>Cache invalidation problem in production</li>
            </ul>
            <div className="text-xs text-yellow-600 mt-2 p-2 bg-yellow-100 rounded">
              <strong>Environment:</strong> {window.location.hostname.includes('replit') ? 'Replit Development' : 'AWS Production'}
              <br />
              <strong>User Agent:</strong> {navigator.userAgent.slice(0, 50)}...
            </div>
            <div className="mt-4">
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidentStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{incidentStats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{incidentStats.closed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NDIS Reportable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{incidentStats.ndis}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Intensity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{incidentStats.highIntensity}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents by ID, client, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="physical">Physical</SelectItem>
            <SelectItem value="verbal">Verbal</SelectItem>
            <SelectItem value="property">Property</SelectItem>
            <SelectItem value="self-harm">Self-harm</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
            <SelectItem value="environmental">Environmental</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Incidents ({incidentStats.total})</TabsTrigger>
          <TabsTrigger value="open">Open ({incidentStats.open})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({incidentStats.closed})</TabsTrigger>
          <TabsTrigger value="ndis">NDIS Reportable ({incidentStats.ndis})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredIncidents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No incidents found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                      ? "Try adjusting your filters or search terms"
                      : "Get started by creating your first incident report"}
                  </p>
                  <small className="text-xs text-muted-foreground mt-2 block">
                    Total incidents: {incidents.length} | Filtered: {filteredIncidents.length}
                  </small>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredIncidents.map((incident: any) => (
                <Card key={incident.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold">{incident.incidentId}</h3>
                          {getStatusBadge(incident.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>Client: {incident.clientFirstName} {incident.clientLastName}</span>
                          <span>Staff: {incident.staffFullName}</span>
                          <span>Date: {format(new Date(incident.dateTime), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Types: {incident.types.join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportIndividualPDF(incident.incidentId)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewIncident(incident)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {incident.status === "Open" && canCloseIncident() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCloseIncident(incident)}
                            className="flex items-center gap-1 text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Close
                          </Button>
                        )}
                        {canCloseIncident() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteIncident(incident.incidentId)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{incident.description}</p>
                    {incident.closure && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Closed on {format(new Date(incident.closure.closureDate), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <div><strong>Hazard:</strong> {incident.closure.hazard}</div>
                          <div><strong>Review Type:</strong> {incident.closure.reviewType}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateIncidentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          setShowCreateModal(false);
          queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
        }}
      />

      {selectedIncident && (
        <>
          <ViewIncidentModal
            open={showViewModal}
            onOpenChange={setShowViewModal}
            incident={selectedIncident}
          />

          <CloseIncidentModal
            open={showCloseModal}
            onOpenChange={setShowCloseModal}
            incident={selectedIncident}
            onSuccess={() => {
              setShowCloseModal(false);
              setSelectedIncident(null);
              queryClient.invalidateQueries({ queryKey: ["/api/incident-reports"] });
            }}
          />
        </>
      )}
    </div>
  );
}