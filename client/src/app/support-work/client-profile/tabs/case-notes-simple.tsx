import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ShieldCheck } from "lucide-react";
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
        />
      ))}
    </div>
  );
}