import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Search, 
  Filter, 
  CalendarIcon, 
  Plus,
  AlertTriangle,
  Pill
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import CaseNoteCard from "@/app/case-notes/components/CaseNoteCard";
import CreateCaseNoteModal from "@/app/case-notes/components/CreateCaseNoteModal";
import type { DateRange } from "react-day-picker";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

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

  // Fetch all case notes and filter by client
  const { data: allCaseNotes = [], isLoading } = useQuery({
    queryKey: ["/api/case-notes"],
    enabled: !!user && !!clientId && canViewCaseNotes,
  });

  // Fetch client data
  const { data: client } = useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  // Filter case notes for this specific client
  const clientCaseNotes = useMemo(() => {
    if (!Array.isArray(allCaseNotes)) return [];
    return allCaseNotes.filter(note => note.clientId === parseInt(clientId));
  }, [allCaseNotes, clientId]);

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
        title: "Case Note Created",
        description: "Your case note has been saved successfully.",
      });
      setIsModalOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create case note. Please try again.",
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
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">You don't have permission to view case notes.</p>
        </CardContent>
      </Card>
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
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total Notes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.withIncidents}</div>
              <p className="text-sm text-muted-foreground">With Incidents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.withMedication}</div>
              <p className="text-sm text-muted-foreground">With Medication</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="progress">Progress Update</SelectItem>
                <SelectItem value="behavior">Behavior Note</SelectItem>
                <SelectItem value="medical">Medical Note</SelectItem>
                <SelectItem value="general">General Note</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Notes Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents ({stats.withIncidents})
          </TabsTrigger>
          <TabsTrigger value="medication">
            Medication ({stats.withMedication})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
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