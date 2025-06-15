import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Calendar, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ObservationCard from "../../../hourly-observations/components/ObservationCard";
import ObservationRow from "../../../hourly-observations/components/ObservationRow";
import ObservationFormModal from "../../../hourly-observations/components/ObservationFormModal";

interface ObservationsTabProps {
  clientId: number;
  clientName: string;
}

type ViewMode = "card" | "list";
type FilterType = "all" | "behaviour" | "adl" | "health" | "social" | "communication";

export default function ObservationsTab({ clientId, clientName }: ObservationsTabProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<FilterType>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Fetch observations for this specific client
  const { data: observations = [], isLoading } = useQuery({
    queryKey: ["/api/observations", clientId],
    queryFn: () => fetch(`/api/observations?clientId=${clientId}`).then(res => res.json()),
    refetchInterval: 30000,
  });

  // Filter observations based on search and filters
  const filteredObservations = useMemo(() => {
    let filtered = observations.filter((obs: any) => obs.clientId === clientId);

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((obs: any) => 
        obs.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.observationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (obs.subtype && obs.subtype.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((obs: any) => 
        obs.observationType.toLowerCase() === selectedType
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter((obs: any) => 
            new Date(obs.timestamp) >= filterDate
          );
          break;
      }
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [observations, clientId, searchTerm, selectedType, dateFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalObservations = filteredObservations.length;
    const typeBreakdown = filteredObservations.reduce((acc: any, obs: any) => {
      acc[obs.observationType] = (acc[obs.observationType] || 0) + 1;
      return acc;
    }, {});

    const behaviourObservations = filteredObservations.filter((obs: any) => 
      obs.observationType.toLowerCase() === "behaviour"
    );
    
    const avgIntensity = behaviourObservations.length > 0 
      ? behaviourObservations.reduce((sum: number, obs: any) => sum + (obs.intensity || 0), 0) / behaviourObservations.length
      : 0;

    return {
      total: totalObservations,
      typeBreakdown,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      behaviourCount: behaviourObservations.length
    };
  }, [filteredObservations]);

  const canCreateObservation = user?.role === "Admin" || user?.role === "Coordinator" || user?.role === "SupportWorker";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Observations</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Behaviour Events</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.behaviourCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Intensity</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.avgIntensity > 0 ? `${stats.avgIntensity}/5` : "—"}
                </p>
              </div>
              <div className="text-2xl">⭐</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Most Common</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {Object.keys(stats.typeBreakdown).length > 0 
                    ? Object.entries(stats.typeBreakdown).sort(([,a]: any, [,b]: any) => b - a)[0][0]
                    : "—"
                  }
                </p>
              </div>
              <div className="text-2xl">📊</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Top Row - Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search observations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {canCreateObservation && (
            <Button
              onClick={() => setIsFormModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Observation
            </Button>
          )}
        </div>

        {/* Second Row - Filters and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>

            <Select value={selectedType} onValueChange={(value: FilterType) => setSelectedType(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="behaviour">Behaviour</SelectItem>
                <SelectItem value="adl">ADL</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="communication">Communication</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Past Week</SelectItem>
                <SelectItem value="month">Past Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="flex items-center gap-2"
            >
              Cards
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="flex items-center gap-2"
            >
              List
            </Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {filteredObservations.length} observation{filteredObservations.length !== 1 ? 's' : ''} for {clientName}
          </Badge>
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear search
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredObservations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-gray-400 mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No observations found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || selectedType !== "all" || dateFilter !== "all"
                ? "Try adjusting your filters or search terms."
                : `No observations have been recorded for ${clientName} yet.`
              }
            </p>
            {canCreateObservation && (
              <Button
                onClick={() => setIsFormModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Observation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredObservations.map((observation: any) => (
            <ObservationCard
              key={observation.id}
              observation={observation}
              clientName={clientName}
              canEdit={canCreateObservation}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Observations for {clientName}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredObservations.map((observation: any, index: number) => (
                <ObservationRow
                  key={observation.id}
                  observation={observation}
                  clientName={clientName}
                  isLast={index === filteredObservations.length - 1}
                  canEdit={canCreateObservation}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ObservationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        clientId={clientId}
      />
    </div>
  );
}