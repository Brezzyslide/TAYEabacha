import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, CalendarIcon, Search, Download, Filter, User, Clock } from "lucide-react";
import { format, isWithinInterval, parseISO } from "date-fns";

interface ObservationsTabProps {
  clientId: string;
  companyId: string;
}

export default function ObservationsTab({ clientId, companyId }: ObservationsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: observationsData, isLoading } = useQuery({
    queryKey: [`/api/clients/${clientId}/observations`, companyId],
    queryFn: () => Promise.resolve({
      observations: [
        {
          id: 1,
          title: "Improved Social Interaction",
          description: "Client actively engaged in conversation with peers during group activity. Initiated discussion about favorite movies and showed genuine interest in others' responses. Maintained eye contact throughout conversation.",
          category: "Social Behavior",
          observedBy: "Jane Smith",
          observedAt: "2024-06-13T14:30:00Z",
          duration: "45 minutes",
          context: "Community center group activity",
          significance: "high",
          followUpRequired: false,
          tags: ["social-skills", "communication", "peer-interaction", "progress"],
          behaviorType: "positive",
          interventions: [],
          outcomes: [
            "Increased confidence in social settings",
            "Better peer relationships",
            "Improved communication skills"
          ]
        },
        {
          id: 2,
          title: "Medication Compliance Observation",
          description: "Client independently retrieved morning medications from pill organizer and took them with water as instructed. No prompting required. Client verbalized understanding of medication schedule.",
          category: "Health Management",
          observedBy: "Tom Wilson",
          observedAt: "2024-06-13T09:00:00Z",
          duration: "10 minutes",
          context: "Morning routine",
          significance: "medium",
          followUpRequired: false,
          tags: ["medication", "independence", "routine", "compliance"],
          behaviorType: "positive",
          interventions: [],
          outcomes: [
            "Demonstrated medication independence",
            "Showed understanding of routine",
            "No supervision required"
          ]
        },
        {
          id: 3,
          title: "Anxiety Response During Task",
          description: "Client showed signs of anxiety when asked to prepare lunch independently. Symptoms included fidgeting, rapid speech, and expressed concerns about 'doing it wrong'. Required reassurance and step-by-step guidance.",
          category: "Emotional Regulation",
          observedBy: "Sarah Brown",
          observedAt: "2024-06-12T12:15:00Z",
          duration: "30 minutes",
          context: "Kitchen skills training session",
          significance: "medium",
          followUpRequired: true,
          tags: ["anxiety", "task-performance", "independence", "support-needed"],
          behaviorType: "concerning",
          interventions: [
            "Provided verbal reassurance",
            "Broke task into smaller steps",
            "Offered physical assistance when needed"
          ],
          outcomes: [
            "Client completed task with support",
            "Anxiety decreased with guidance",
            "Expressed satisfaction with end result"
          ]
        },
        {
          id: 4,
          title: "Physical Mobility Assessment",
          description: "Client navigated stairs independently without assistance or handrails. Demonstrated good balance and coordination. No signs of fatigue or discomfort during 15-minute walking session around the block.",
          category: "Physical Health",
          observedBy: "Mike Johnson",
          observedAt: "2024-06-11T16:00:00Z",
          duration: "20 minutes",
          context: "Community walk",
          significance: "high",
          followUpRequired: false,
          tags: ["mobility", "independence", "physical-health", "endurance"],
          behaviorType: "positive",
          interventions: [],
          outcomes: [
            "Maintained physical independence",
            "No mobility concerns identified",
            "Good exercise tolerance"
          ]
        },
        {
          id: 5,
          title: "Communication During Stress",
          description: "When appointment was cancelled last minute, client expressed frustration appropriately using words rather than behavioral outbursts. Asked clarifying questions about rescheduling and accepted alternative arrangements.",
          category: "Communication",
          observedBy: "Jane Smith",
          observedAt: "2024-06-10T11:30:00Z",
          duration: "15 minutes",
          context: "Schedule change notification",
          significance: "high",
          followUpRequired: false,
          tags: ["communication", "stress-management", "flexibility", "coping-skills"],
          behaviorType: "positive",
          interventions: [],
          outcomes: [
            "Appropriate stress response",
            "Effective communication used",
            "Accepted change positively"
          ]
        },
        {
          id: 6,
          title: "Sleep Pattern Concerns",
          description: "Client reported difficulty falling asleep for the third consecutive night. Appeared tired during morning activities and required additional rest periods. Client mentioned racing thoughts and worry about upcoming medical appointment.",
          category: "Sleep & Rest",
          observedBy: "Sarah Brown",
          observedAt: "2024-06-09T08:00:00Z",
          duration: "Morning observation",
          context: "Morning routine and activities",
          significance: "medium",
          followUpRequired: true,
          tags: ["sleep", "fatigue", "anxiety", "health-concerns"],
          behaviorType: "concerning",
          interventions: [
            "Discussed sleep hygiene strategies",
            "Provided relaxation techniques",
            "Arranged earlier bedtime routine"
          ],
          outcomes: [
            "Client willing to try suggestions",
            "Acknowledged sleep importance",
            "Agreed to monitor sleep patterns"
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

  const data = observationsData!;

  const filteredObservations = data.observations.filter(observation => {
    const matchesSearch = searchTerm === "" || 
      observation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      observation.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      observation.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || observation.category.toLowerCase().includes(categoryFilter.toLowerCase());
    
    const matchesDateRange = !dateRange.from || !dateRange.to || 
      isWithinInterval(parseISO(observation.observedAt), { 
        start: dateRange.from, 
        end: dateRange.to 
      });
    
    return matchesSearch && matchesCategory && matchesDateRange;
  });

  const getBehaviorColor = (behaviorType: string) => {
    switch (behaviorType) {
      case "positive": return "border-green-200 bg-green-50";
      case "concerning": return "border-orange-200 bg-orange-50";
      case "neutral": return "border-gray-200 bg-gray-50";
      default: return "";
    }
  };

  const getBehaviorBadge = (behaviorType: string) => {
    switch (behaviorType) {
      case "positive": return "default";
      case "concerning": return "destructive";
      case "neutral": return "secondary";
      default: return "outline";
    }
  };

  const getSignificanceBadge = (significance: string) => {
    switch (significance) {
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search observations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="social">Social Behavior</SelectItem>
              <SelectItem value="health">Health Management</SelectItem>
              <SelectItem value="emotional">Emotional Regulation</SelectItem>
              <SelectItem value="physical">Physical Health</SelectItem>
              <SelectItem value="communication">Communication</SelectItem>
              <SelectItem value="sleep">Sleep & Rest</SelectItem>
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
          <Button onClick={() => console.log("Exporting observations to PDF...")}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => console.log("Exporting observations to Excel...")}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredObservations.length} of {data.observations.length} observations
      </div>

      {/* Observations List */}
      <div className="space-y-4">
        {filteredObservations.map((observation) => (
          <Card key={observation.id} className={getBehaviorColor(observation.behaviorType)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5" />
                    {observation.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{observation.observedBy}</span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(observation.observedAt), "MMM dd, yyyy 'at' HH:mm")}</span>
                    <span>•</span>
                    <span>{observation.duration}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant={getBehaviorBadge(observation.behaviorType) as any}>
                    {observation.behaviorType}
                  </Badge>
                  <Badge variant={getSignificanceBadge(observation.significance) as any}>
                    {observation.significance} significance
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm mb-2">{observation.description}</p>
                <div className="text-xs text-muted-foreground">
                  <strong>Context:</strong> {observation.context}
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Tags:</p>
                <div className="flex flex-wrap gap-1">
                  {observation.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Interventions (if any) */}
              {observation.interventions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Interventions Used:</p>
                  <ul className="text-sm space-y-1">
                    {observation.interventions.map((intervention: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        {intervention}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Outcomes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Observed Outcomes:</p>
                <ul className="text-sm space-y-1">
                  {observation.outcomes.map((outcome: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline">{observation.category}</Badge>
                  {observation.followUpRequired && (
                    <Badge variant="destructive">Follow-up Required</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredObservations.length === 0 && (
        <div className="text-center py-8">
          <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No observations found matching your criteria.</p>
        </div>
      )}

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Observation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.observations.length}</div>
              <p className="text-sm text-muted-foreground">Total Observations</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.observations.filter(o => o.behaviorType === "positive").length}
              </div>
              <p className="text-sm text-muted-foreground">Positive Behaviors</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {data.observations.filter(o => o.behaviorType === "concerning").length}
              </div>
              <p className="text-sm text-muted-foreground">Areas of Concern</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {data.observations.filter(o => o.followUpRequired).length}
              </div>
              <p className="text-sm text-muted-foreground">Follow-ups Needed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}