import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, Download, FileText, Search, Filter, Pill, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface CaseNotesTabProps {
  clientId: string;
  companyId: string;
}

export default function CaseNotesTab({ clientId, companyId }: CaseNotesTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: caseNotesData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/case-notes`, companyId],
    queryFn: () => Promise.resolve({
      notes: [
        {
          id: 1,
          title: "Weekly Progress Review",
          content: "Client has shown significant improvement in daily living skills this week. Successfully prepared breakfast independently for 3 consecutive days. Medication adherence remains consistent at 98%. Noted some anxiety around community outings which we will address in next session.",
          author: "Jane Smith",
          authorRole: "Support Worker",
          dateCreated: "2024-06-13T10:30:00Z",
          lastUpdated: "2024-06-13T10:30:00Z",
          tags: ["progress", "daily-living", "medication", "anxiety"],
          category: "Progress Note",
          linkedItems: [
            { type: "medication", id: 1, name: "Fluoxetine 20mg" },
            { type: "incident", id: 2, name: "Anxiety episode during shopping trip" }
          ],
          priority: "normal"
        },
        {
          id: 2,
          title: "Medication Administration Record",
          content: "All morning medications administered as prescribed. Client took Fluoxetine 20mg and Metformin 500mg without issues. Client reported feeling more energetic today. No side effects observed.",
          author: "Tom Wilson",
          authorRole: "Support Worker",
          dateCreated: "2024-06-12T09:00:00Z",
          lastUpdated: "2024-06-12T09:00:00Z",
          tags: ["medication", "administration", "energy", "compliance"],
          category: "Medication Note",
          linkedItems: [
            { type: "medication", id: 1, name: "Fluoxetine 20mg" },
            { type: "medication", id: 2, name: "Metformin 500mg" }
          ],
          priority: "normal"
        },
        {
          id: 3,
          title: "Incident Report Follow-up",
          content: "Following yesterday's minor fall incident, client appears to be moving normally with no signs of discomfort. Checked for any bruising or swelling - none observed. Client states they feel fine and wants to continue with regular activities. Will monitor closely over next 24 hours.",
          author: "Sarah Brown",
          authorRole: "Support Coordinator",
          dateCreated: "2024-06-11T16:45:00Z",
          lastUpdated: "2024-06-11T16:45:00Z",
          tags: ["incident", "follow-up", "monitoring", "fall"],
          category: "Incident Follow-up",
          linkedItems: [
            { type: "incident", id: 1, name: "Minor fall in bathroom" }
          ],
          priority: "high"
        },
        {
          id: 4,
          title: "Community Access Session",
          content: "Accompanied client to local shopping center for weekly grocery shopping. Client demonstrated improved confidence in selecting items and interacting with store staff. Used visual shopping list effectively. Session lasted 45 minutes. Client expressed enjoyment and asked about next outing.",
          author: "Mike Johnson",
          authorRole: "Support Worker",
          dateCreated: "2024-06-10T14:20:00Z",
          lastUpdated: "2024-06-10T14:20:00Z",
          tags: ["community-access", "shopping", "confidence", "social-skills"],
          category: "Activity Note",
          linkedItems: [],
          priority: "normal"
        },
        {
          id: 5,
          title: "Care Plan Review Meeting",
          content: "Attended quarterly care plan review with client, family, and multidisciplinary team. Progress towards goals discussed: Daily living skills - 65% complete, Community access - 45% complete. Updated intervention strategies agreed upon. Next review scheduled for September 2024.",
          author: "Dr. Sarah Williams",
          authorRole: "Care Coordinator",
          dateCreated: "2024-06-08T11:00:00Z",
          lastUpdated: "2024-06-08T11:00:00Z",
          tags: ["care-plan", "review", "goals", "team-meeting"],
          category: "Care Plan Note",
          linkedItems: [],
          priority: "normal"
        }
      ]
    })
  });

  if (isLoading) {
    return <div className="space-y-4">
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
    </div>;
  }

  const data = caseNotesData!;

  const filteredNotes = data.notes.filter(note => {
    const matchesSearch = searchTerm === "" || 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === "all" || note.category.toLowerCase().includes(filterType.toLowerCase());
    
    return matchesSearch && matchesFilter;
  });

  const renderLinkedItems = (linkedItems: any[]) => {
    return linkedItems.map((item, index) => (
      <Badge key={index} variant="outline" className="mr-1 mb-1">
        {item.type === "medication" ? (
          <Pill className="w-3 h-3 mr-1" />
        ) : (
          <AlertTriangle className="w-3 h-3 mr-1" />
        )}
        {item.name}
      </Badge>
    ));
  };

  const NoteCard = ({ note }: { note: any }) => (
    <Card className={`${note.priority === "high" ? "border-orange-200 bg-orange-50" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{note.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{note.author} ({note.authorRole})</span>
              <span>•</span>
              <span>{format(new Date(note.dateCreated), "MMM dd, yyyy 'at' HH:mm")}</span>
              <span>•</span>
              <Badge variant="secondary">{note.category}</Badge>
              {note.priority === "high" && (
                <Badge variant="destructive">High Priority</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">{note.content}</p>
        
        {note.tags.length > 0 && (
          <div className="mb-3">
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

        {note.linkedItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Linked Items:</p>
            <div className="flex flex-wrap gap-1">
              {renderLinkedItems(note.linkedItems)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const NoteListItem = ({ note }: { note: any }) => (
    <div className={`border rounded-lg p-4 ${note.priority === "high" ? "border-orange-200 bg-orange-50" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium">{note.title}</h4>
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">{note.category}</Badge>
          {note.priority === "high" && (
            <Badge variant="destructive" className="text-xs">High</Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{note.content}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {note.author} • {format(new Date(note.dateCreated), "MMM dd, yyyy HH:mm")}
        </span>
        {note.linkedItems.length > 0 && (
          <div className="flex gap-1">
            {renderLinkedItems(note.linkedItems)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Notes</SelectItem>
              <SelectItem value="progress">Progress Notes</SelectItem>
              <SelectItem value="medication">Medication Notes</SelectItem>
              <SelectItem value="incident">Incident Notes</SelectItem>
              <SelectItem value="activity">Activity Notes</SelectItem>
              <SelectItem value="care">Care Plan Notes</SelectItem>
            </SelectContent>
          </Select>
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
          
          <Button onClick={() => console.log("Exporting case notes to PDF...")}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          
          <Button variant="outline" onClick={() => console.log("Exporting case notes to Excel...")}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredNotes.length} of {data.notes.length} case notes
      </div>

      {/* Notes Display */}
      <div className={viewMode === "card" ? "grid gap-4" : "space-y-3"}>
        {filteredNotes.map((note) => 
          viewMode === "card" ? (
            <NoteCard key={note.id} note={note} />
          ) : (
            <NoteListItem key={note.id} note={note} />
          )
        )}
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No case notes found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}