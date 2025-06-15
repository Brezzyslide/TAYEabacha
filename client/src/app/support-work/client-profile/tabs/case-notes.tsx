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
  Filter, 
  FileText, 
  AlertTriangle, 
  Pill, 
  Clock,
  User,
  CheckCircle,
  XCircle,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CaseNote } from "@shared/schema";
import CreateCaseNoteModal from "@/app/case-notes/components/CreateCaseNoteModal";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

interface CaseNoteWithTags extends CaseNote {
  caseNoteTags?: {
    incident?: {
      occurred: boolean;
      refNumber?: string;
      lodged?: boolean;
      confirmed?: boolean;
    };
    medication?: {
      status: "yes" | "none" | "refused";
      recordLogged?: boolean;
    };
  };
  spellCheckCount?: number;
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

  // Fetch case notes for this client
  const { data: caseNotesData, isLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "case-notes"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/case-notes`);
      if (!response.ok) throw new Error('Failed to fetch case notes');
      return response.json();
    },
  });

  const caseNotes = caseNotesData?.caseNotes || [];
  const client = caseNotesData?.client;
  const recentShifts = caseNotesData?.recentShifts || [];

  // Create case note mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/clients/${clientId}/case-notes`, "POST", {
        ...data,
        userId: user?.id,
        tenantId: user?.tenantId
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "case-notes"] });
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

  // Delete case note mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/case-notes/${id}`, "DELETE");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "case-notes"] });
      toast({
        title: "Case Note Deleted",
        description: "The case note has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete case note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter case notes based on criteria
  const filteredNotes = useMemo(() => {
    let notes = [...(caseNotes as CaseNoteWithTags[])];

    // Filter by type/tab
    if (selectedTab === "incidents") {
      notes = notes.filter(note => note.caseNoteTags?.incident?.occurred);
    } else if (selectedTab === "medication") {
      notes = notes.filter(note => note.caseNoteTags?.medication);
    } else if (selectedType !== "all") {
      notes = notes.filter(note => note.type === selectedType);
    }

    // Filter by search term
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      notes = notes.filter(note =>
        note.title.toLowerCase().includes(lowercaseSearch) ||
        note.content.toLowerCase().includes(lowercaseSearch) ||
        note.category.toLowerCase().includes(lowercaseSearch) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)))
      );
    }

    // Filter by date range
    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
      toDate.setHours(23, 59, 59, 999);
      
      notes = notes.filter(note => {
        const noteDate = new Date(note.createdAt);
        return noteDate >= fromDate && noteDate <= toDate;
      });
    }

    return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [caseNotes, selectedTab, selectedType, searchTerm, dateRange]);

  const getIncidentBadge = (incidentData: any) => {
    if (!incidentData?.occurred) {
      if (incidentData?.confirmed) {
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">No Incident</Badge>;
      }
      return null;
    }

    return (
      <div className="flex gap-1 flex-wrap">
        <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Incident
        </Badge>
        {incidentData.refNumber && (
          <Badge variant="outline" className="text-xs">
            {incidentData.refNumber}
          </Badge>
        )}
        {incidentData.lodged !== undefined && (
          <Badge variant={incidentData.lodged ? "default" : "secondary"} className="text-xs">
            {incidentData.lodged ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            {incidentData.lodged ? "Lodged" : "Not Lodged"}
          </Badge>
        )}
      </div>
    );
  };

  const getMedicationBadge = (medicationData: any) => {
    if (!medicationData) return null;

    const statusColors = {
      yes: "bg-green-50 text-green-700 border-green-200",
      none: "bg-gray-50 text-gray-700 border-gray-200",
      refused: "bg-orange-50 text-orange-700 border-orange-200"
    };

    const statusLabels = {
      yes: "Administered",
      none: "Not Required",
      refused: "Refused"
    };

    return (
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className={statusColors[medicationData.status as keyof typeof statusColors]}>
          <Pill className="w-3 h-3 mr-1" />
          {statusLabels[medicationData.status as keyof typeof statusLabels]}
        </Badge>
        {medicationData.status === "yes" && medicationData.recordLogged !== undefined && (
          <Badge variant={medicationData.recordLogged ? "default" : "secondary"} className="text-xs">
            {medicationData.recordLogged ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            {medicationData.recordLogged ? "Record Logged" : "Record Pending"}
          </Badge>
        )}
      </div>
    );
  };

  const getSpellCheckBadge = (count: number) => {
    if (count === 0) return null;
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        <Sparkles className="w-3 h-3 mr-1" />
        {count} spell check{count > 1 ? 's' : ''}
      </Badge>
    );
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = caseNotes.length;
    const withIncidents = caseNotes.filter((note: CaseNoteWithTags) => note.caseNoteTags?.incident?.occurred).length;
    const withMedication = caseNotes.filter((note: CaseNoteWithTags) => note.caseNoteTags?.medication).length;
    const thisWeek = caseNotes.filter((note: CaseNoteWithTags) => {
      const noteDate = new Date(note.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return noteDate >= weekAgo;
    }).length;

    return { total, withIncidents, withMedication, thisWeek };
  }, [caseNotes]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Case Notes</h3>
          <p className="text-sm text-muted-foreground">
            {client?.firstName} {client?.lastName} ({client?.clientId})
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Case Note
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.withIncidents}</p>
                <p className="text-sm text-gray-600">With Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Pill className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.withMedication}</p>
                <p className="text-sm text-gray-600">With Medication</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-sm text-gray-600">This Week</p>
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
          <TabsTrigger value="all">All Notes ({caseNotes.length})</TabsTrigger>
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
                  {searchTerm || dateRange ? "Try adjusting your filters." : "Get started by creating your first case note."}
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
            filteredNotes.map((note: CaseNoteWithTags) => (
              <Card key={note.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {note.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline">{note.category}</Badge>
                        {note.priority !== "normal" && (
                          <Badge variant={note.priority === "urgent" ? "destructive" : "secondary"}>
                            {note.priority}
                          </Badge>
                        )}
                        {getIncidentBadge(note.caseNoteTags?.incident)}
                        {getMedicationBadge(note.caseNoteTags?.medication)}
                        {getSpellCheckBadge(note.spellCheckCount || 0)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Staff #{note.userId}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                  
                  {note.linkedShiftId && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">Linked to Shift #{note.linkedShiftId}</span>
                      </div>
                    </div>
                  )}

                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                      {note.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {filteredNotes.filter(note => note.caseNoteTags?.incident?.occurred).map((note: CaseNoteWithTags) => (
            <Card key={note.id} className="border-red-200 hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      {note.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {getIncidentBadge(note.caseNoteTags?.incident)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="medication" className="space-y-4">
          {filteredNotes.filter(note => note.caseNoteTags?.medication).map((note: CaseNoteWithTags) => (
            <Card key={note.id} className="border-green-200 hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-green-600" />
                      {note.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {getMedicationBadge(note.caseNoteTags?.medication)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create Case Note Modal */}
      <CreateCaseNoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={createMutation.mutate}
        clientId={parseInt(clientId)}
      />
    </div>
  );
}