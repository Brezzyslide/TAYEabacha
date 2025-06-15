import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Download, FileText, Grid3X3, List, Filter, Home, Eye, Star, Clock, User, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

type ViewMode = "card" | "list";
type FilterType = "all" | "behaviour" | "adl" | "health" | "social" | "communication";

// Observation form schema with conditional validation
const observationSchema = z.object({
  clientId: z.number({ required_error: "Please select a client" }),
  observationType: z.enum(["behaviour", "adl", "health", "social", "communication"], {
    required_error: "Please select an observation type"
  }),
  subtype: z.string().optional(),
  notes: z.string().min(10, "Notes must be at least 10 characters long"),
  intensity: z.number().min(1).max(5).optional(),
  timestamp: z.date({ required_error: "Please select a date and time" })
}).refine((data) => {
  // Make subtype required for behaviour observations
  if (data.observationType === "behaviour" && (!data.subtype || data.subtype.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Subtype is required for behaviour observations",
  path: ["subtype"]
}).refine((data) => {
  // Make intensity required for behaviour observations
  if (data.observationType === "behaviour" && !data.intensity) {
    return false;
  }
  return true;
}, {
  message: "Intensity rating is required for behaviour observations",
  path: ["intensity"]
});

// Behaviour subtypes for psychology-related observations
const behaviourSubtypes = [
  "Positive Behaviour",
  "Verbal Aggression", 
  "Physical Aggression",
  "Self-Injury",
  "Property Damage",
  "Withdrawal/Isolation",
  "Anxiety/Distress",
  "Repetitive Behaviour",
  "Non-Compliance",
  "Appropriate Social Interaction"
];

type ObservationFormData = z.infer<typeof observationSchema>;

// Observation display components
const ObservationCard = ({ observation, clientName }: { observation: any; clientName: string }) => (
  <Card className="mb-4">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Eye className="w-5 h-5" />
        {observation.observationType || 'Observation'}
        {observation.intensity && (
          <Badge variant="secondary">Intensity: {observation.intensity}/5</Badge>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-600 mb-2">{observation.notes || 'No notes available'}</p>
      {observation.subtype && (
        <p className="text-sm text-blue-600 mb-2">Subtype: {observation.subtype}</p>
      )}
      <div className="flex gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>{observation.timestamp ? new Date(observation.timestamp).toLocaleString() : 'No date'}</span>
        <span>•</span>
        <User className="w-4 h-4" />
        <span>{clientName}</span>
      </div>
    </CardContent>
  </Card>
);

const ObservationRow = ({ observation, clientName, isLast }: { observation: any; clientName: string; isLast: boolean }) => (
  <div className={`flex items-center justify-between p-4 ${!isLast ? 'border-b' : ''}`}>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium">{observation.observationType || 'Observation'}</h3>
        {observation.intensity && (
          <Badge variant="secondary" className="text-xs">
            {observation.intensity}/5
          </Badge>
        )}
      </div>
      <p className="text-gray-600 text-sm mb-1">{observation.notes || 'No notes'}</p>
      <p className="text-xs text-gray-500">Client: {clientName}</p>
      {observation.subtype && (
        <p className="text-xs text-blue-600">Subtype: {observation.subtype}</p>
      )}
    </div>
    <div className="text-sm text-gray-500 text-right">
      <p>{observation.timestamp ? new Date(observation.timestamp).toLocaleDateString() : 'No date'}</p>
      <p className="text-xs">{observation.timestamp ? new Date(observation.timestamp).toLocaleTimeString() : ''}</p>
    </div>
  </div>
);

const ObservationFormModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<ObservationFormData>({
    resolver: zodResolver(observationSchema),
    defaultValues: {
      timestamp: new Date(),
      notes: "",
      observationType: "behaviour",
      subtype: "",
      clientId: undefined,
      intensity: undefined
    }
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ObservationFormData) => {
      // Clean the data to match server expectations
      const cleanData = {
        clientId: data.clientId,
        observationType: data.observationType,
        subtype: data.subtype || null,
        notes: data.notes,
        intensity: data.intensity || null,
        timestamp: data.timestamp.toISOString(),
      };
      
      console.log("Sending observation data:", cleanData);
      
      const response = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server response error:", errorData);
        throw new Error(errorData.message || "Failed to create observation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations"] });
      toast({
        title: "Success",
        description: "Observation created successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create observation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ObservationFormData) => {
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Observation</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Client Selection */}
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(clients as any[]).map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.fullName} ({client.ndisNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observation Type */}
              <FormField
                control={form.control}
                name="observationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observation Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="behaviour">Behaviour</SelectItem>
                        <SelectItem value="adl">Activities of Daily Living</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Subtype */}
              <FormField
                control={form.control}
                name="subtype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtype (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., verbal aggression, mobility assistance" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Intensity (for behaviour observations) */}
              {form.watch("observationType") === "behaviour" && (
                <FormField
                  control={form.control}
                  name="intensity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intensity (1-5)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select intensity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 - Very Low</SelectItem>
                          <SelectItem value="2">2 - Low</SelectItem>
                          <SelectItem value="3">3 - Moderate</SelectItem>
                          <SelectItem value="4">4 - High</SelectItem>
                          <SelectItem value="5">5 - Very High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Timestamp */}
            <FormField
              control={form.control}
              name="timestamp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value?.toISOString().slice(0, 16)}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observation Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the observation in detail..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-gray-500">
                    Minimum 10 characters required. Be specific and objective.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? "Creating..." : "Create Observation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
    let filtered = [...(observations as any[])];

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