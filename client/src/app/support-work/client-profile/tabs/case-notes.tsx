import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  FileText, 
  AlertTriangle, 
  Pill,
  ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CaseNote } from "@shared/schema";
import CreateCaseNoteModal from "@/app/case-notes/components/CreateCaseNoteModal";
import CaseNoteCard from "@/app/case-notes/components/CaseNoteCard";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

// Permission checking helper
function hasPermission(user: any, resource: string, action: string): boolean {
  if (!user) return false;
  
  // Console managers and admins have full access
  if (user.role === "ConsoleManager" || user.role === "Admin") return true;
  
  // Team leaders can view all case notes in their tenant
  if (user.role === "TeamLeader" || user.role === "Coordinator") return true;
  
  // Support workers can only view case notes for their assigned clients
  if (user.role === "SupportWorker" && resource === "caseNotes" && action === "view") {
    return true; // Will be filtered by clientId in the query
  }
  
  return false;
}

export default function CaseNotesTab({ clientId, companyId }: CaseNotesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check permissions
  const canViewCaseNotes = hasPermission(user, "caseNotes", "view");

  // Fetch case notes for this specific client
  const { data: allCaseNotes = [], isLoading } = useQuery({
    queryKey: ["/api/case-notes", { clientId }],
    queryFn: () => fetch(`/api/case-notes?clientId=${clientId}`).then(res => res.json()),
    enabled: !!user && !!clientId && canViewCaseNotes,
  });

  // Fetch client data
  const { data: client } = useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  // Case notes are already filtered by clientId from the API
  const clientCaseNotes = useMemo(() => {
    if (!Array.isArray(allCaseNotes)) return [];
    return allCaseNotes;
  }, [allCaseNotes]);

  // Create case note mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/case-notes", {
        ...data,
        clientId: parseInt(clientId),
        userId: user?.id,
        tenantId: user?.tenantId
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      toast({
        title: "Case note submitted successfully",
        description: `Case note saved for ${client?.firstName || 'client'}. Great work documenting their care.`,
      });
      setIsModalOpen(false);
    },
    onError: () => {
      toast({
        title: "Unable to save case note",
        description: "Please check your connection and try again. Your work is important to us.",
        variant: "destructive",
      });
    },
  });

  // Filter case notes based on criteria
  const filteredNotes = useMemo(() => {
    let notes = [...clientCaseNotes];

    // Filter by type/tab
    if (selectedTab === "incidents") {
      notes = notes.filter(note => note.caseNoteTags?.incident?.occurred);
    } else if (selectedTab === "medication") {
      notes = notes.filter(note => note.caseNoteTags?.medication);
    } else if (selectedType !== "all") {
      notes = notes.filter(note => note.type === selectedType);
    }

    // Search in title and content
    if (searchTerm) {
      notes = notes.filter(note => 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange?.from || dateRange?.to) {
      notes = notes.filter(note => {
        const noteDate = new Date(note.createdAt);
        if (dateRange.from && noteDate < dateRange.from) return false;
        if (dateRange.to && noteDate > dateRange.to) return false;
        return true;
      });
    }

    return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [clientCaseNotes, selectedTab, selectedType, searchTerm, dateRange]);

  // Calculate stats for tab badges
  const stats = useMemo(() => {
    return {
      total: clientCaseNotes.length,
      withIncidents: clientCaseNotes.filter(note => note.caseNoteTags?.incident?.occurred).length,
      withMedication: clientCaseNotes.filter(note => note.caseNoteTags?.medication).length,
    };
  }, [clientCaseNotes]);

  if (!canViewCaseNotes) {
    return (
      <div className="p-8 text-center">
        <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-600">
          You don't have permission to view case notes.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading case notes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Case Notes</h2>
          <p className="text-sm text-muted-foreground">
            {client ? `Case notes for ${(client as any).firstName} ${(client as any).lastName}` : "Case notes for this client"}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Note
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">{stats.withIncidents}</p>
                <p className="text-xs text-muted-foreground">With Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">{stats.withMedication}</p>
                <p className="text-xs text-muted-foreground">With Medication</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search case notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
            <SelectItem value="medication">Medication</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-48">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Date Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all">All Notes ({stats.total})</TabsTrigger>
          <TabsTrigger value="incidents">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Incidents ({stats.withIncidents})
          </TabsTrigger>
          <TabsTrigger value="medication">
            <Pill className="w-4 h-4 mr-1" />
            Medication ({stats.withMedication})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredNotes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No case notes found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || dateRange ? "Try adjusting your filters." : "No case notes recorded for this client yet."}
                </p>
                {!searchTerm && !dateRange && (
                  <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Case Note
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <CaseNoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {filteredNotes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No incident notes found</h3>
                <p className="text-gray-600">No case notes with incidents recorded for this client.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <CaseNoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="medication" className="space-y-4">
          {filteredNotes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No medication notes found</h3>
                <p className="text-gray-600">No case notes with medication records for this client.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <CaseNoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Case Note Modal */}
      <CreateCaseNoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (data) => {
          return new Promise<void>((resolve, reject) => {
            createMutation.mutate(data, {
              onSuccess: () => resolve(),
              onError: (error) => reject(error)
            });
          });
        }}
        clientId={parseInt(clientId)}
      />
    </div>
  );
}