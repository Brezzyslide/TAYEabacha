import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, AlertTriangle, Clock, CheckCircle, Eye, Edit, Trash2, Download } from "lucide-react";

import { CreateIncidentModal } from "../../../incident-management/components/CreateIncidentModal";
import { ViewIncidentModal } from "../../../incident-management/components/ViewIncidentModal";
import { CloseIncidentModal } from "../../../incident-management/components/CloseIncidentModal";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface IncidentsTabProps {
  clientId: string;
  companyId: string;
}

interface IncidentReport {
  id: number;
  incidentId: string;
  dateTime: string;
  description: string;
  clientId: number;
  staffId: number;
  types: string[];
  status: string;
  clientFirstName: string;
  clientLastName: string;
  staffUsername: string;
  staffFullName: string;
  intensityRating: number;
  location: string;
  triggers: Array<{ label: string; notes?: string }>;
  staffResponses: Array<{ label: string; notes?: string }>;
  witnessName?: string;
  witnessPhone?: string;
  isNDISReportable: boolean;
  externalRef?: string;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
  // Closure fields (optional)
  closureId?: number;
  closedBy?: number;
  closureDate?: string;
  controlReview?: boolean;
  improvements?: string;
  implemented?: boolean;
  controlLevel?: string;
  wasLTI?: string;
  hazard?: string;
  severity?: string;
  externalNotice?: boolean;
  closureNDISReportable?: boolean;
  ndisReference?: string;
  participantContext?: string;
  supportPlanAvailable?: string;
  reviewType?: string;
  outcome?: string;
}

export default function IncidentsTab({ clientId, companyId }: IncidentsTabProps) {
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

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  const { data: incidents = [], isLoading, error } = useQuery({
    queryKey: ["/api/incident-reports", { clientId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/incident-reports?clientId=${clientId}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!clientId,
  });

  const deleteIncidentMutation = useMutation({
    mutationFn: (incidentId: string) => 
      apiRequest("DELETE", `/api/incident-reports/${incidentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incident-reports", { clientId }] });
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

  // Filter incidents based on search and filters
  const filteredIncidents = incidents.filter((incident: IncidentReport) => {
    const reporterName = incident.staffFullName || incident.staffUsername || '';
    const matchesSearch = !searchTerm || 
      incident.incidentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reporterName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || 
      incident.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesType = typeFilter === "all" || 
      incident.types.some(type => type.toLowerCase() === typeFilter.toLowerCase());

    const matchesTab = activeTab === "all" ||
      (activeTab === "open" && incident.status === "Open") ||
      (activeTab === "closed" && incident.status === "Closed");

    return matchesSearch && matchesStatus && matchesType && matchesTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge variant="destructive" className="flex items-center gap-1"><Clock className="h-3 w-3" />Open</Badge>;
      case "Closed":
        return <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" />Closed</Badge>;
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
        body: JSON.stringify({ 
          incidentIds: filteredIncidents.map(i => i.incidentId),
          clientId: clientId  // Include client filter
        })
      });
      
      if (!response.ok) throw new Error('Failed to export PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-${clientId}-incident-reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Client incident reports have been exported to PDF"
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
        body: JSON.stringify({ 
          incidentIds: filteredIncidents.map(i => i.incidentId),
          clientId: clientId  // Include client filter
        })
      });
      
      if (!response.ok) throw new Error('Failed to export Excel');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `client-${clientId}-incident-reports-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Client incident reports have been exported to Excel"
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
    open: incidents.filter((i: IncidentReport) => i.status === "Open").length,
    closed: incidents.filter((i: IncidentReport) => i.status === "Closed").length,
    ndis: 0, // Simplified - no NDIS field in current data structure
    highIntensity: 0, // Simplified - no intensity field in current data structure
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incidents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Client Incident Reports</h2>
          <p className="text-muted-foreground text-sm">Incident reports specific to this client</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button 
            size="sm"
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{incidentStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{incidentStats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{incidentStats.closed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NDIS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{incidentStats.ndis}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Intensity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">{incidentStats.highIntensity}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents by ID, location, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({incidentStats.total})</TabsTrigger>
          <TabsTrigger value="open">Open ({incidentStats.open})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({incidentStats.closed})</TabsTrigger>
          <TabsTrigger value="ndis">NDIS ({incidentStats.ndis})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredIncidents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-48">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No incidents found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                      ? "Try adjusting your filters or search terms"
                      : "No incident reports for this client yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredIncidents.map((incident: IncidentReport) => (
                <Card key={incident.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold">{incident.incidentId}</h3>
                          {getStatusBadge(incident.status)}
                          {/* Simplified - NDIS and intensity features removed for now */}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>Staff: {incident.reporterName}</span>
                          {/* Location field not available in current data structure */}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteIncident(incident.incidentId)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
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
      {showCreateModal && (
        <CreateIncidentModal
          open={showCreateModal}
          onOpenChange={(open) => setShowCreateModal(open)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/incident-reports", { clientId }] });
          }}
          defaultClientId={parseInt(clientId)}
        />
      )}

      {showViewModal && selectedIncident && (
        <ViewIncidentModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          incident={selectedIncident}
        />
      )}

      {showCloseModal && selectedIncident && (
        <CloseIncidentModal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          incident={selectedIncident}
          onSuccess={() => {
            setShowCloseModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/incident-reports", { clientId }] });
          }}
        />
      )}
    </div>
  );
}