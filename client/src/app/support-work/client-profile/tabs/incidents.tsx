import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutGrid, List, Download, AlertTriangle, CalendarIcon, Search, Filter, Clock, User } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";

interface IncidentsTabProps {
  clientId: string;
  companyId: string;
}

export default function IncidentsTab({ clientId, companyId }: IncidentsTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/incidents`, companyId],
    queryFn: () => Promise.resolve({
      incidents: [
        {
          id: 1,
          title: "Minor Fall in Bathroom",
          description: "Client slipped on wet floor in bathroom at approximately 2:30 PM. No visible injuries sustained. Client was able to get up independently and walked normally afterward. Bathroom floor was mopped and dried immediately.",
          severity: "low",
          status: "resolved",
          reportedBy: "Sarah Brown",
          reportedAt: "2024-06-11T14:30:00Z",
          resolvedAt: "2024-06-11T15:00:00Z",
          location: "Bathroom",
          category: "Fall",
          followUpRequired: false,
          followUpCompleted: true,
          witnesses: ["Tom Wilson"],
          immediateActions: [
            "Checked client for injuries",
            "Assisted client to sitting area",
            "Dried bathroom floor",
            "Documented incident"
          ],
          preventiveMeasures: [
            "Installed non-slip mats",
            "Added grab rails",
            "Enhanced lighting"
          ]
        },
        {
          id: 2,
          title: "Medication Refusal Episode",
          description: "Client refused to take evening Metformin medication, expressing concerns about stomach upset. Support worker provided reassurance and education about taking medication with food. Client agreed to take medication after eating dinner.",
          severity: "medium",
          status: "resolved",
          reportedBy: "Jane Smith",
          reportedAt: "2024-06-10T19:45:00Z",
          resolvedAt: "2024-06-10T20:30:00Z",
          location: "Living Room",
          category: "Medication",
          followUpRequired: true,
          followUpCompleted: true,
          witnesses: [],
          immediateActions: [
            "Listened to client concerns",
            "Provided medication education",
            "Offered to take with food",
            "Documented refusal and resolution"
          ],
          preventiveMeasures: [
            "Review medication timing with GP",
            "Provide written medication information",
            "Schedule medication administration with meals"
          ]
        },
        {
          id: 3,
          title: "Anxiety Episode During Shopping",
          description: "Client experienced significant anxiety while in crowded shopping center. Symptoms included rapid breathing, sweating, and expressed desire to leave immediately. Support worker guided client to quiet area and used calming techniques.",
          severity: "medium",
          status: "monitoring",
          reportedBy: "Mike Johnson",
          reportedAt: "2024-06-09T15:20:00Z",
          resolvedAt: null,
          location: "Shopping Center",
          category: "Behavioral",
          followUpRequired: true,
          followUpCompleted: false,
          witnesses: [],
          immediateActions: [
            "Moved to quiet area",
            "Applied breathing techniques",
            "Provided reassurance",
            "Shortened shopping trip"
          ],
          preventiveMeasures: [
            "Schedule shopping during off-peak hours",
            "Prepare coping strategies card",
            "Consider gradual exposure therapy"
          ]
        },
        {
          id: 4,
          title: "Equipment Malfunction - Shower Chair",
          description: "Shower chair leg adjustment mechanism failed during morning routine. Chair became unstable but client was not using it at the time. Equipment was immediately removed from service and replacement ordered.",
          severity: "high",
          status: "resolved",
          reportedBy: "Tom Wilson",
          reportedAt: "2024-06-08T08:15:00Z",
          resolvedAt: "2024-06-08T10:00:00Z",
          location: "Bathroom",
          category: "Equipment",
          followUpRequired: true,
          followUpCompleted: true,
          witnesses: [],
          immediateActions: [
            "Removed equipment from service",
            "Checked client safety",
            "Arranged temporary alternative",
            "Contacted equipment supplier"
          ],
          preventiveMeasures: [
            "Implement weekly equipment checks",
            "Create equipment inspection log",
            "Train staff on equipment safety"
          ]
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

  const data = incidentsData!;

  const filteredIncidents = data.incidents.filter(incident => {
    const matchesSearch = searchTerm === "" || 
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    
    const matchesDateRange = !dateRange.from || !dateRange.to || 
      isWithinInterval(parseISO(incident.reportedAt), { 
        start: dateRange.from, 
        end: dateRange.to 
      });
    
    return matchesSearch && matchesSeverity && matchesDateRange;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-500";
      case "medium": return "bg-orange-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "outline";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const IncidentCard = ({ incident }: { incident: any }) => (
    <Card className={`${incident.severity === "high" ? "border-red-200 bg-red-50" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getSeverityColor(incident.severity)}`} />
              {incident.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <User className="w-3 h-3" />
              <span>{incident.reportedBy}</span>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{format(new Date(incident.reportedAt), "MMM dd, yyyy 'at' HH:mm")}</span>
              <span>•</span>
              <span>{incident.location}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={getSeverityBadge(incident.severity) as any}>
              {incident.severity.toUpperCase()}
            </Badge>
            <Badge variant={incident.status === "resolved" ? "default" : "secondary"}>
              {incident.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{incident.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="font-medium text-sm mb-2">Immediate Actions Taken</h5>
            <ul className="text-sm space-y-1">
              {incident.immediateActions.map((action: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-sm mb-2">Preventive Measures</h5>
            <ul className="text-sm space-y-1">
              {incident.preventiveMeasures.map((measure: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  {measure}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm">
            <span>Category: <Badge variant="outline">{incident.category}</Badge></span>
            {incident.witnesses.length > 0 && (
              <span>Witnesses: {incident.witnesses.join(", ")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {incident.followUpRequired && (
              <Badge variant={incident.followUpCompleted ? "default" : "destructive"}>
                Follow-up {incident.followUpCompleted ? "Complete" : "Required"}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const IncidentListItem = ({ incident }: { incident: any }) => (
    <div className={`border rounded-lg p-4 ${incident.severity === "high" ? "border-red-200 bg-red-50" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getSeverityColor(incident.severity)}`} />
          <h4 className="font-medium">{incident.title}</h4>
        </div>
        <div className="flex gap-1">
          <Badge variant={getSeverityBadge(incident.severity) as any} className="text-xs">
            {incident.severity.toUpperCase()}
          </Badge>
          <Badge variant={incident.status === "resolved" ? "default" : "secondary"} className="text-xs">
            {incident.status}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{incident.description}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {incident.reportedBy} • {format(new Date(incident.reportedAt), "MMM dd, yyyy HH:mm")} • {incident.location}
        </span>
        <Badge variant="outline" className="text-xs">{incident.category}</Badge>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-48">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-36">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                onSelect={(range) => setDateRange(range || {})}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
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
          
          <Button onClick={() => console.log("Exporting incidents to PDF...")}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Results Count and Stats */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredIncidents.length} of {data.incidents.length} incidents
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            {data.incidents.filter(i => i.severity === "high").length} High
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            {data.incidents.filter(i => i.severity === "medium").length} Medium
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            {data.incidents.filter(i => i.severity === "low").length} Low
          </span>
        </div>
      </div>

      {/* Incidents Display */}
      <div className={viewMode === "card" ? "grid gap-4" : "space-y-3"}>
        {filteredIncidents.map((incident) => 
          viewMode === "card" ? (
            <IncidentCard key={incident.id} incident={incident} />
          ) : (
            <IncidentListItem key={incident.id} incident={incident} />
          )
        )}
      </div>

      {filteredIncidents.length === 0 && (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No incidents found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}