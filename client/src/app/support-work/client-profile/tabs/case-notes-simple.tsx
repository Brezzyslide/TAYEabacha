import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck, Eye, User, Clock, AlertTriangle, Pill, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import CaseNoteCard from "@/app/case-notes/components/CaseNoteCard";
import type { CaseNote } from "@shared/schema";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

// Permission checking helper
function hasPermission(user: any, resource: string, action: string): boolean {
  if (!user) return false;
  
  // Console managers and admins have full access
  if (user.role?.toLowerCase() === "consolemanager" || user.role?.toLowerCase() === "admin") return true;
  
  // Team leaders can view all case notes in their tenant
  if (user.role?.toLowerCase() === "teamleader" || user.role?.toLowerCase() === "coordinator") return true;
  
  // Support workers can only view case notes for their assigned clients
  if (user.role?.toLowerCase() === "supportworker" && resource === "caseNotes" && action === "view") {
    return true; // Will be filtered by clientId in the query
  }
  
  return false;
}

export default function CaseNotesTab({ clientId, companyId }: CaseNotesTabProps) {
  const { user } = useAuth();
  const [viewingNote, setViewingNote] = useState<CaseNote | undefined>();

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Check permissions
  const canViewCaseNotes = hasPermission(user, "caseNotes", "view");

  // Fetch all case notes and filter by client
  const { data: allCaseNotes = [], isLoading, error } = useQuery({
    queryKey: ["/api/case-notes"],
    enabled: !!user && !!clientId && canViewCaseNotes,
  });

  // Filter case notes for this specific client
  const clientCaseNotes = useMemo(() => {
    if (!Array.isArray(allCaseNotes)) return [];
    return allCaseNotes.filter((note: CaseNote) => note.clientId === parseInt(clientId))
      .sort((a: CaseNote, b: CaseNote) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allCaseNotes, clientId]);

  // Fetch client data for the modal
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  // Fetch staff data for the modal
  const { data: staffList } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!viewingNote,
  });

  if (!canViewCaseNotes) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ShieldCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">
            You don't have permission to view case notes.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading case notes...</p>
        </CardContent>
      </Card>
    );
  }

  if (clientCaseNotes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No case notes found</h3>
          <p className="text-gray-600">
            No case notes recorded for this client yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {clientCaseNotes.map((note: CaseNote) => (
        <CaseNoteCard
          key={note.id}
          note={note}
          viewMode="card"
          onView={() => setViewingNote(note)}
        />
      ))}
      
      {/* Case Note View Modal */}
      <Dialog open={!!viewingNote} onOpenChange={() => setViewingNote(undefined)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {viewingNote?.title || "Case Note Details"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingNote(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {viewingNote && (
            <div className="space-y-6">
              {/* Case Note Header */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold">{viewingNote.title}</h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>Client: {client?.fullName || 'Loading...'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{format(new Date(viewingNote.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {viewingNote.category === 'incident' && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Incident
                      </Badge>
                    )}
                    {viewingNote.category === 'medication' && (
                      <Badge className="bg-blue-600 flex items-center gap-1">
                        <Pill className="w-3 h-3" />
                        Medication
                      </Badge>
                    )}
                    {viewingNote.priority && (
                      <Badge variant={viewingNote.priority === 'urgent' ? 'destructive' : 'secondary'}>
                        {viewingNote.priority.charAt(0).toUpperCase() + viewingNote.priority.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Case Note Content */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-3">Case Note Content</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{viewingNote.content}</p>
                  </div>
                </div>

                {/* Additional Details */}
                {(viewingNote.incidentData || viewingNote.medicationData || viewingNote.tags?.length) && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium">Additional Details</h3>
                    
                    {/* Tags */}
                    {viewingNote.tags && viewingNote.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {viewingNote.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Incident Data */}
                    {viewingNote.incidentData && typeof viewingNote.incidentData === 'object' && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Incident Information</h4>
                        <div className="bg-red-50 p-3 rounded border border-red-200">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(viewingNote.incidentData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Medication Data */}
                    {viewingNote.medicationData && typeof viewingNote.medicationData === 'object' && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Medication Information</h4>
                        <div className="bg-blue-50 p-3 rounded border border-blue-200">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(viewingNote.medicationData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Created by information */}
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Created by: {staffList?.find((s: any) => s.id === viewingNote.userId)?.username || 'Loading...'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}