import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LayoutGrid, List, Download, FileText, Search, Plus, MoreVertical, Eye, Edit, Archive, Clock, User, Building } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CaseNote, Client, Shift } from "@shared/schema";
import CaseNoteModal from "@/components/case-notes/CaseNoteModal";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

export default function CaseNotesTab({ clientId, companyId }: CaseNotesTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CaseNote | undefined>();
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch case notes data with client info and recent shifts
  const { data: caseNotesData, isLoading, error } = useQuery({
    queryKey: [`/api/clients/${clientId}/case-notes`, companyId],
    enabled: !!clientId && !!companyId && !!user,
    retry: false,
  });

  // Create case note mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/clients/${clientId}/case-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create case note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/case-notes`] });
      toast({
        title: "Case Note Created",
        description: "Your case note has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create case note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update case note mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/case-notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update case note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/case-notes`] });
      toast({
        title: "Case Note Updated",
        description: "Your case note has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update case note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete case note mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/case-notes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete case note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/case-notes`] });
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

  // Get the actual data with proper typing
  const caseNotes: CaseNote[] = (caseNotesData as any)?.caseNotes || [];
  const client: Client | undefined = (caseNotesData as any)?.client;
  const recentShifts: Shift[] = (caseNotesData as any)?.recentShifts || [];

  // Filter case notes based on search and tabs
  const filteredNotes = useMemo(() => {
    let notes = caseNotes;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      notes = notes.filter(note => 
        note.title.toLowerCase().includes(searchLower) ||
        note.content.toLowerCase().includes(searchLower) ||
        note.tags?.some(tag => tag.toLowerCase().includes(searchLower)) ||
        (client?.fullName?.toLowerCase().includes(searchLower)) ||
        (client?.ndisNumber?.toLowerCase().includes(searchLower))
      );
    }

    // Apply tab filter
    switch (selectedTab) {
      case "incidents":
        notes = notes.filter(note => note.type === "incident" || note.incidentData);
        break;
      case "medication":
        notes = notes.filter(note => note.type === "medication" || note.medicationData);
        break;
      case "all":
      default:
        break;
    }

    // Sort by creation date (newest first)
    return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [caseNotes, searchTerm, selectedTab, client]);

  // Handle form submission
  const handleSubmit = async (data: any) => {
    if (editingNote) {
      await updateMutation.mutateAsync({ id: editingNote.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setIsModalOpen(false);
    setEditingNote(undefined);
  };

  // Handle note deletion
  const handleDelete = async (noteId: number) => {
    if (confirm("Are you sure you want to delete this case note?")) {
      await deleteMutation.mutateAsync(noteId);
    }
  };

  // Toggle note expansion
  const toggleExpanded = (noteId: number) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  // Truncate content
  const truncateContent = (content: string, limit: number = 150) => {
    if (content.length <= limit) return content;
    return content.substring(0, limit) + "...";
  };

  // Get note type badge
  const getTypeBadge = (note: CaseNote) => {
    switch (note.type) {
      case "incident":
        return <Badge variant="destructive">Incident</Badge>;
      case "medication":
        return <Badge className="bg-blue-600">Medication</Badge>;
      default:
        return <Badge variant="secondary">Standard</Badge>;
    }
  };

  // Note card component
  const NoteCard = ({ note }: { note: CaseNote }) => {
    const isExpanded = expandedNotes.has(note.id);
    const displayContent = isExpanded ? note.content : truncateContent(note.content);
    const canEditNote = user?.role !== "SupportWorker" || user?.id === note.userId;

    return (
      <Card className={`${note.priority === "high" || note.priority === "urgent" ? "border-orange-200 bg-orange-50" : ""}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {note.title}
                {getTypeBadge(note)}
                {note.priority === "high" && <Badge variant="destructive" className="text-xs">High Priority</Badge>}
                {note.priority === "urgent" && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Staff Member</span>
                <span>•</span>
                <Clock className="w-4 h-4" />
                <span>{format(new Date(note.createdAt), "MMM dd, yyyy 'at' HH:mm")}</span>
                {client && (
                  <>
                    <span>•</span>
                    <Building className="w-4 h-4" />
                    <span>{client.fullName}</span>
                    {client.ndisNumber && <span>({client.ndisNumber})</span>}
                  </>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleExpanded(note.id)}>
                  <Eye className="w-4 h-4 mr-2" />
                  {isExpanded ? "Show Less" : "View Full"}
                </DropdownMenuItem>
                {canEditNote && (
                  <DropdownMenuItem onClick={() => { setEditingNote(note); setIsModalOpen(true); }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => {}}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </DropdownMenuItem>
                {canEditNote && (
                  <DropdownMenuItem 
                    onClick={() => handleDelete(note.id)}
                    className="text-red-600"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4 whitespace-pre-wrap">{displayContent}</p>
          
          {note.content.length > 150 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => toggleExpanded(note.id)}
              className="p-0 h-auto text-blue-600"
            >
              {isExpanded ? "Show Less" : "Show More"}
            </Button>
          )}

          {note.tags && note.tags.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Tags:</p>
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {note.linkedShiftId && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Linked Shift:</p>
              <Badge variant="outline" className="text-xs">
                Shift #{note.linkedShiftId}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Note list item component
  const NoteListItem = ({ note }: { note: CaseNote }) => {
    const isExpanded = expandedNotes.has(note.id);
    const displayContent = isExpanded ? note.content : truncateContent(note.content);
    const canEditNote = user?.role !== "SupportWorker" || user?.id === note.userId;

    return (
      <div className={`border rounded-lg p-4 ${note.priority === "high" || note.priority === "urgent" ? "border-orange-200 bg-orange-50" : ""}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-medium flex items-center gap-2">
              {note.title}
              {getTypeBadge(note)}
              {(note.priority === "high" || note.priority === "urgent") && (
                <Badge variant="destructive" className="text-xs">
                  {note.priority === "urgent" ? "Urgent" : "High"}
                </Badge>
              )}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>Staff Member • {format(new Date(note.createdAt), "MMM dd, yyyy HH:mm")}</span>
              {client && <span>• {client.fullName}</span>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleExpanded(note.id)}>
                <Eye className="w-4 h-4 mr-2" />
                {isExpanded ? "Show Less" : "View Full"}
              </DropdownMenuItem>
              {canEditNote && (
                <DropdownMenuItem onClick={() => { setEditingNote(note); setIsModalOpen(true); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => {}}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </DropdownMenuItem>
              {canEditNote && (
                <DropdownMenuItem 
                  onClick={() => handleDelete(note.id)}
                  className="text-red-600"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{displayContent}</p>
        
        {note.content.length > 150 && (
          <Button
            variant="link"
            size="sm"
            onClick={() => toggleExpanded(note.id)}
            className="p-0 h-auto text-blue-600 mb-2"
          >
            {isExpanded ? "Show Less" : "Show More"}
          </Button>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-wrap gap-1">
            {note.tags?.map((tag: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          {note.linkedShiftId && (
            <Badge variant="outline" className="text-xs">
              Shift #{note.linkedShiftId}
            </Badge>
          )}
        </div>
      </div>
    );
  };

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

  if (error) {
    console.error("Case Notes API Error:", error);
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load case notes.</p>
        <p className="text-sm text-red-600 mt-2">Error: {error.message || "Unknown error"}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by client, NDIS, staff, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-r-none"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="rounded-l-none"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Note
          </Button>
          
          <Button variant="outline" onClick={() => {}}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs for filtering */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all">All Notes</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="medication">Medication</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredNotes.length} case notes
            </div>
            
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No case notes found.</p>
                <Button onClick={() => setIsModalOpen(true)} className="mt-4">
                  Create First Case Note
                </Button>
              </div>
            ) : (
              <div className={viewMode === "card" ? "grid gap-4" : "space-y-3"}>
                {filteredNotes.map((note) => 
                  viewMode === "card" ? (
                    <NoteCard key={note.id} note={note} />
                  ) : (
                    <NoteListItem key={note.id} note={note} />
                  )
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="mt-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredNotes.filter(note => note.type === "incident" || note.incidentData).length} incident notes
            </div>
            
            {filteredNotes.filter(note => note.type === "incident" || note.incidentData).length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No incident case notes found.</p>
              </div>
            ) : (
              <div className={viewMode === "card" ? "grid gap-4" : "space-y-3"}>
                {filteredNotes.filter(note => note.type === "incident" || note.incidentData).map((note) => 
                  viewMode === "card" ? (
                    <NoteCard key={note.id} note={note} />
                  ) : (
                    <NoteListItem key={note.id} note={note} />
                  )
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="medication" className="mt-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredNotes.filter(note => note.type === "medication" || note.medicationData).length} medication notes
            </div>
            
            {filteredNotes.filter(note => note.type === "medication" || note.medicationData).length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No medication case notes found.</p>
              </div>
            ) : (
              <div className={viewMode === "card" ? "grid gap-4" : "space-y-3"}>
                {filteredNotes.filter(note => note.type === "medication" || note.medicationData).map((note) => 
                  viewMode === "card" ? (
                    <NoteCard key={note.id} note={note} />
                  ) : (
                    <NoteListItem key={note.id} note={note} />
                  )
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal for creating/editing case notes */}
      <CaseNoteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNote(undefined);
        }}
        onSubmit={handleSubmit}
        caseNote={editingNote}
        recentShifts={recentShifts}
        userRole={user?.role || ""}
      />
    </div>
  );
}