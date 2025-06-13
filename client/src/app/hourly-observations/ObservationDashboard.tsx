import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Download, FileText, Grid3X3, List, Filter, Home, Eye, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

type ViewMode = "card" | "list";
type FilterType = "all" | "behaviour" | "adl" | "health" | "social" | "communication";

// Simple inline components
const ObservationCard = ({ observation }: { observation: any }) => (
  <Card className="mb-4">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Eye className="w-5 h-5" />
        {observation.type || 'Observation'}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-600 mb-2">{observation.description || 'No description available'}</p>
      <div className="flex gap-2 text-sm text-gray-500">
        <span>{observation.createdAt ? new Date(observation.createdAt).toLocaleDateString() : 'No date'}</span>
        <span>•</span>
        <span>{observation.client || 'Unknown client'}</span>
      </div>
    </CardContent>
  </Card>
);

const ObservationRow = ({ observation }: { observation: any }) => (
  <div className="flex items-center justify-between p-4 border-b">
    <div>
      <h3 className="font-medium">{observation.type || 'Observation'}</h3>
      <p className="text-gray-600 text-sm">{observation.description || 'No description'}</p>
    </div>
    <div className="text-sm text-gray-500">
      {observation.createdAt ? new Date(observation.createdAt).toLocaleDateString() : 'No date'}
    </div>
  </div>
);

const ObservationFormModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Add Observation</h2>
        <p className="text-gray-600 mb-4">Observation form coming soon...</p>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};

export default function ObservationDashboard() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Fetch observations
  const { data: observations = [], isLoading } = useQuery({
    queryKey: ["/api/observations"],
    refetchInterval: 30000,
  });

  // Fetch clients for filter dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter observations based on search and filters
  const filteredObservations = useMemo(() => {
    let filtered = observations;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((obs: any) => {
        const client = (clients as any[]).find(c => c.id === obs.clientId);
        const clientName = client?.fullName || "";
        const ndisNumber = client?.ndisNumber || "";
        
        return (
          clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ndisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          obs.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
          obs.observationType.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Client filter
    if (selectedClient !== "all") {
      filtered = filtered.filter((obs: any) => obs.clientId === parseInt(selectedClient));
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((obs: any) => 
        obs.observationType.toLowerCase() === selectedType
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
      }
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [observations, clients, searchTerm, selectedClient, selectedType, dateFilter]);

  const getClientName = (clientId: number) => {
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown Client";
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log("Export PDF");
  };

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    console.log("Export Excel");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Hourly Observations</span>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hourly Observations</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Track and manage client observations and behavioral data
              </p>
            </div>

            {/* Controls */}
            <div className="mb-6 space-y-4">
              {/* Top Row - Search and Actions */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by client name, NDIS number, or keywords..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button
                    onClick={() => setIsFormModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Observation
                  </Button>
                </div>
              </div>

              {/* Second Row - Filters and View Toggle */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
                  </div>

                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {(clients as any[]).map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedType} onValueChange={(value: FilterType) => setSelectedType(value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="behaviour">Behaviour</SelectItem>
                      <SelectItem value="adl">ADL</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="communication">Communication</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="All Dates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Past Week</SelectItem>
                      <SelectItem value="month">Past Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    className="flex items-center gap-2"
                  >
                    <Grid3X3 className="h-4 w-4" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    List
                  </Button>
                </div>
              </div>

              {/* Results Summary */}
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  {filteredObservations.length} observation{filteredObservations.length !== 1 ? 's' : ''} found
                </Badge>
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            {filteredObservations.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="text-gray-400 mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No observations found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchTerm || selectedClient !== "all" || selectedType !== "all" || dateFilter !== "all"
                      ? "Try adjusting your filters or search terms."
                      : "Get started by creating your first observation."
                    }
                  </p>
                  <Button
                    onClick={() => setIsFormModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Observation
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === "card" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredObservations.map((observation: any) => (
                  <ObservationCard
                    key={observation.id}
                    observation={observation}
                    clientName={getClientName(observation.clientId)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Observations List</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {filteredObservations.map((observation: any, index: number) => (
                      <ObservationRow
                        key={observation.id}
                        observation={observation}
                        clientName={getClientName(observation.clientId)}
                        isLast={index === filteredObservations.length - 1}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <ObservationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
      />
    </div>
  );
}