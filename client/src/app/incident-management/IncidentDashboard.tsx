import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, AlertTriangle, Clock, CheckCircle, Eye, Edit, Trash2, Download } from "lucide-react";

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
    types: string[];
    isNDISReportable: boolean;
    intensityRating: number;
    description: string;
    status: string;
    createdAt: string;
  };
  closure?: {
    closureDate: string;
    severity: string;
    hazard: string;
    reviewType: string;
  };
  client: {
    id: number;
    firstName: string;
    lastName: string;
    clientId: string;
  };
  staff: {
    id: number;
    username: string;
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

  // Permission check: Only Admin and Coordinator can close incidents
  const canCloseIncident = () => {
    if (!user?.role) return false;
    const userRole = user.role.toLowerCase();
    return userRole === "admin" || userRole === "coordinator" || userRole === "consolemanager";
  };

  const { data: incidents = [], isLoading, error } = useQuery({
    queryKey: ["/api/incident-reports"],
    queryFn: async () => {
      const res = await fetch("/api/incident-reports", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error('Failed to fetch incidents');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
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

  const filteredIncidents = (incidents || []).filter((incident: IncidentReport) => {
    const matchesSearch = 
      incident.report.incidentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.report.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || incident.report.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === "all" || incident.report.types.some(type => type.toLowerCase().includes(typeFilter.toLowerCase()));
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "open" && incident.report.status === "Open") ||
      (activeTab === "closed" && incident.report.status === "Closed") ||
      (activeTab === "ndis" && incident.report.isNDISReportable);

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
    open: incidents.filter((i: IncidentReport) => i.report.status === "Open").length,
    closed: incidents.filter((i: IncidentReport) => i.report.status === "Closed").length,
    ndis: incidents.filter((i: IncidentReport) => i.report.isNDISReportable).length,
    highIntensity: incidents.filter((i: IncidentReport) => i.report.intensityRating >= 8).length,
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Management</h1>
          <p className="text-muted-foreground">Comprehensive incident reporting and closure tracking</p>
        </div>
        <div className="flex items-center gap-3">
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
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredIncidents.map((incident: IncidentReport) => (
                <Card key={incident.report.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{incident.report.incidentId}</h3>
                          {getStatusBadge(incident.report.status)}
                          {incident.report.isNDISReportable && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              NDIS Reportable
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Client: {incident.client.firstName} {incident.client.lastName} ({incident.client.clientId})</span>
                          <span>Staff: {incident.staff.username}</span>
                          <span>Location: {incident.report.location}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Date: {format(new Date(incident.report.dateTime), "MMM dd, yyyy 'at' HH:mm")}</span>
                          <span>Created: {format(new Date(incident.report.createdAt), "MMM dd, yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewIncident(incident)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleExportIndividualPDF(incident.report.incidentId)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                          title="Export to PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {incident.report.status === "Open" && canCloseIncident() && (
                          <Button variant="outline" size="sm" onClick={() => handleCloseIncident(incident)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDeleteIncident(incident.report.incidentId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Types:</span>
                          <div className="flex gap-1">
                            {incident.report.types.map((type, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Intensity:</span>
                          {getIntensityBadge(incident.report.intensityRating)}
                        </div>
                        {incident.closure && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Severity:</span>
                            {getSeverityBadge(incident.closure.severity)}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {incident.report.description}
                      </p>
                      {incident.closure && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Closed on {format(new Date(incident.closure.closureDate), "MMM dd, yyyy")} • 
                          Review Type: {incident.closure.reviewType} • 
                          Hazard: {incident.closure.hazard}
                        </div>
                      )}
                    </div>
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