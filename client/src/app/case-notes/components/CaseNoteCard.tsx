import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Eye, 
  Edit, 
  Archive, 
  Download, 
  Clock, 
  User, 
  FileText,
  AlertTriangle,
  Pill,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { CaseNote, Client, User as UserType } from "@shared/schema";

interface CaseNoteCardProps {
  note: CaseNote;
  onEdit?: (note: CaseNote) => void;
  onDelete?: (noteId: number) => void;
  onView?: (note: CaseNote) => void;
  viewMode?: "card" | "list";
}

export default function CaseNoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onView, 
  viewMode = "card" 
}: CaseNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuth();

  // Fetch client data
  const { data: client } = useQuery({
    queryKey: [`/api/clients/${note.clientId}`],
    select: (data: Client) => data
  });

  // Fetch staff data
  const { data: staff } = useQuery({
    queryKey: [`/api/users/${note.userId}`],
    select: (data: UserType) => data
  });

  const canEdit = user?.role !== "SupportWorker" || user?.id === note.userId;
  const canDelete = ["TeamLeader", "Admin", "ConsoleManager"].includes(user?.role || "") || user?.id === note.userId;

  const truncateContent = (content: string, limit: number = 150) => {
    if (content.length <= limit) return content;
    return content.substring(0, limit) + "...";
  };

  const getTypeBadge = () => {
    switch (note.type) {
      case "incident":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Incident
        </Badge>;
      case "medication":
        return <Badge className="bg-blue-600 flex items-center gap-1">
          <Pill className="w-3 h-3" />
          Medication
        </Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          Standard
        </Badge>;
    }
  };

  const getPriorityBadge = () => {
    switch (note.priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-600">High</Badge>;
      default:
        return null;
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/case-notes/${note.id}/pdf`, {
        method: 'GET',
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-note-${note.id}-${format(new Date(note.createdAt), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const displayContent = isExpanded ? note.content : truncateContent(note.content);

  if (viewMode === "list") {
    return (
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-lg">{note.title}</h3>
                  {getTypeBadge()}
                  {getPriorityBadge()}
                  {note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0 && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {Array.isArray(note.attachments) ? note.attachments.length : 0}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView?.(note)}
                  className="h-8 w-8 p-0 hover:bg-blue-100"
                  title="View full case note"
                >
                  <Eye className="h-4 w-4 text-blue-600" />
                </Button>
              </div>

              {/* Client and staff info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{client?.fullName || 'Loading...'}</span>
                  {client?.ndisNumber && (
                    <span className="text-xs">({client.ndisNumber})</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>by {staff?.fullName || 'Loading...'}</span>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm leading-relaxed">{displayContent}</p>
              
              {note.content.length > 150 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-0 h-auto text-xs"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </Button>
              )}

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Incident/Medication details */}
              {note.incidentData && typeof note.incidentData === 'object' && (note.incidentData as any)?.refNumber && (
                <Badge variant="outline" className="text-xs">
                  Ref: {(note.incidentData as any).refNumber}
                </Badge>
              )}
              
              {note.medicationData && typeof note.medicationData === 'object' && (note.medicationData as any)?.status && (
                <Badge variant="outline" className="text-xs">
                  Medication: {(note.medicationData as any).status.replace('_', ' ')}
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                PDF
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView?.(note)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Full
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit?.(note)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem 
                      onClick={() => onDelete?.(note.id)}
                      className="text-red-600"
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Card view
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-lg">{note.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView?.(note)}
                className="h-8 w-8 p-0 hover:bg-blue-100"
                title="View full case note"
              >
                <Eye className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {getTypeBadge()}
              {getPriorityBadge()}
              {note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {Array.isArray(note.attachments) ? note.attachments.length : 0} files
                </Badge>
              )}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{client?.fullName || 'Loading...'}</span>
                {client?.ndisNumber && (
                  <span className="text-xs">({client.ndisNumber})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>by {staff?.fullName || 'Loading...'}</span>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                <Eye className="w-4 h-4 mr-2" />
                {isExpanded ? "Collapse" : "Expand"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onView?.(note)}>
                <Eye className="w-4 h-4 mr-2" />
                View Full
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit?.(note)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete?.(note.id)}
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
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">{displayContent}</p>
          
          {note.content.length > 150 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0 h-auto text-xs"
            >
              {isExpanded ? "Show less" : "Show more"}
            </Button>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Tags:</p>
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag: any, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {String(tag)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Additional info */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {note.incidentData && typeof note.incidentData === 'object' && (note.incidentData as any)?.refNumber && (
                <Badge variant="outline" className="text-xs">
                  Ref: {(note.incidentData as any).refNumber}
                </Badge>
              )}
              
              {note.medicationData && typeof note.medicationData === 'object' && (note.medicationData as any)?.status && (
                <Badge variant="outline" className="text-xs">
                  Medication: {(note.medicationData as any).status.replace('_', ' ')}
                </Badge>
              )}

              {note.linkedShiftId && (
                <Badge variant="outline" className="text-xs">
                  Linked to Shift #{note.linkedShiftId}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>

          {/* Attachments preview */}
          {note.attachments && Array.isArray(note.attachments) && note.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Attachments:</p>
              <div className="space-y-1">
                {note.attachments.slice(0, 3).map((attachment: any, index: number) => (
                  <div key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {attachment.name}
                  </div>
                ))}
                {Array.isArray(note.attachments) && note.attachments.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{note.attachments.length - 3} more files
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}