import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, FileText, AlertTriangle, Pill } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CaseNote, Client } from "@shared/schema";
import CaseNoteFilterBar from "./components/CaseNoteFilterBar";
import CaseNoteCard from "./components/CaseNoteCard";
import CreateCaseNoteModal from "./components/CreateCaseNoteModal";

export default function CaseNoteDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CaseNote | undefined>();
  const [selectedTab, setSelectedTab] = useState("all");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all case notes
  const { data: caseNotes = [], isLoading, error } = useQuery({
    queryKey: ["/api/case-notes"],
    retry: 1,
  });

  // Fetch all clients for filtering
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    retry: 1,
  });

  // Create case note mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/case-notes", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          userId: user?.id,
          tenantId: user?.tenantId
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-notes"] });
      toast({
        title: "Case Note Created",
        description: "Your case note has been created successfully.",
      });
      setIsModalOpen(false);
      setEditingNote(undefined);
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
      const response = await apiRequest(`/api/case-notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-notes"] });
      toast({
        title: "Case Note Updated",
        description: "Your case note has been updated successfully.",
      });
      setIsModalOpen(false);
      setEditingNote(undefined);
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
      const response = await apiRequest(`/api/case-notes/${id}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-notes"] });
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

  // Filter case notes based on all criteria
  const filteredNotes = useMemo(() => {
    let notes = [...(caseNotes as CaseNote[])];

    // Filter by client
    if (selectedClient !== "all") {
      const clientId = parseInt(selectedClient);
      notes = notes.filter(note => note.clientId === clientId);
    }

    // Filter by type/tab
    if (selectedTab === "incidents") {
      notes = notes.filter(note => note.type === "incident");
    } else if (selectedTab === "medication") {
      notes = notes.filter(note => note.type === "medication");
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
  }, [caseNotes, selectedClient, selectedTab, selectedType, searchTerm, dateRange]);

  // Get counts for tabs
  const allNotesCount = (caseNotes as CaseNote[]).length;
  const incidentNotesCount = (caseNotes as CaseNote[]).filter(n => n.type === "incident").length;
  const medicationNotesCount = (caseNotes as CaseNote[]).filter(n => n.type === "medication").length;

  // Handle form submission
  const handleSubmit = async (data: any) => {
    if (editingNote) {
      await updateMutation.mutateAsync({ id: editingNote.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  // Handle note deletion
  const handleDelete = async (noteId: number) => {
    if (confirm("Are you sure you want to delete this case note?")) {
      await deleteMutation.mutateAsync(noteId);
    }
  };

  // Handle note editing
  const handleEdit = (note: CaseNote) => {
    setEditingNote(note);
    setIsModalOpen(true);
  };

  // Handle note viewing (could open a detailed view modal)
  const handleView = (note: CaseNote) => {
    // For now, we'll just expand it in place
    console.log("Viewing note:", note);
  };

  // Export functions
  const handleExportAllPDF = async () => {
    try {
      const response = await fetch("/api/case-notes/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: filteredNotes.map(n => n.id) })
      });
      
      if (!response.ok) throw new Error('Failed to export PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-notes-export-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Case notes have been exported to PDF"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export case notes to PDF",
        variant: "destructive"
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch("/api/case-notes/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: filteredNotes.map(n => n.id) })
      });
      
      if (!response.ok) throw new Error('Failed to export Excel');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-notes-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Case notes have been exported to Excel"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export case notes to Excel",
        variant: "destructive"
      });
    }
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
        <p className="text-sm text-red-600 mt-2">
          Error: {(error as any)?.message || "Unknown error"}
        </p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Case Notes</h1>
          <p className="text-muted-foreground">Manage and review case notes across all clients</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Note
          </Button>
          <Button variant="outline" onClick={handleExportAllPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <CaseNoteFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedClient={selectedClient}
        onClientChange={setSelectedClient}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={allNotesCount}
        filteredCount={filteredNotes.length}
      />

      {/* Tabbed View */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            All Notes ({allNotesCount})
          </TabsTrigger>
          <TabsTrigger value="incidents" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Incidents ({incidentNotesCount})
          </TabsTrigger>
          <TabsTrigger value="medication" className="flex items-center gap-2">
            <Pill className="w-4 h-4" />
            Medication ({medicationNotesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No case notes found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedClient !== "all" || dateRange
                  ? "Try adjusting your filters or search criteria"
                  : "Get started by creating your first case note"
                }
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Case Note
              </Button>
            </div>
          ) : (
            <div className={viewMode === "card" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
              {filteredNotes.map((note) => (
                <CaseNoteCard
                  key={note.id}
                  note={note}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={handleView}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <CreateCaseNoteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNote(undefined);
        }}
        onSubmit={handleSubmit}
        clientId={editingNote?.clientId}
      />
    </div>
  );
}