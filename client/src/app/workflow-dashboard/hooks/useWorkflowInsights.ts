import { useQuery } from "@tanstack/react-query";
import { format, isAfter, subDays, subHours, startOfDay } from "date-fns";

interface InsightData {
  medicationsDueToday: number;
  overdueObservations: number;
  staffCoverageGaps: number;
  pendingIncidents: number;
  caseNotesDue: number;
  budgetUtilization: number;
}

export function useWorkflowInsights() {
  // Fetch all necessary data
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({ queryKey: ['/api/shifts'] });
  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({ queryKey: ['/api/incident-reports'] });
  const { data: medicationRecords = [], isLoading: medRecordsLoading } = useQuery({ queryKey: ['/api/medication-records'] });
  const { data: medicationPlans = [], isLoading: medPlansLoading } = useQuery({ queryKey: ['/api/medication-plans'] });
  const { data: caseNotes = [], isLoading: caseNotesLoading } = useQuery({ queryKey: ['/api/case-notes'] });
  const { data: hourAllocations = [], isLoading: allocationsLoading } = useQuery({ queryKey: ['/api/hour-allocations'] });
  const { data: clients = [], isLoading: clientsLoading } = useQuery({ queryKey: ['/api/clients'] });

  const isLoading = shiftsLoading || incidentsLoading || medRecordsLoading || medPlansLoading || caseNotesLoading || allocationsLoading || clientsLoading;

  const generateInsights = (): InsightData => {
    const now = new Date();
    const today = startOfDay(now);

    // 1. Unstarted shifts past start time
    const overdueShifts = (shifts as any[]).filter((shift: any) => {
      const startTime = new Date(shift.startTime);
      return isAfter(now, startTime) && !shift.status;
    });

    // 2. Pending incidents
    const pendingIncidents = (incidents as any[]).filter((incident: any) => {
      return !incident.closure;
    });

    // 3. Medications due today
    const medicationsDue = (medicationRecords as any[]).filter((record: any) => {
      const recordDate = new Date(record.createdAt);
      return format(recordDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    }).length;

    const totalMedications = (medicationPlans as any[]).length;
    const medicationsPending = totalMedications - medicationsDue;

    // 4. Case notes requiring updates
    const clientsNeedingUpdates = (clients as any[]).filter((client: any) => {
      const lastNote = (caseNotes as any[])
        .filter((note: any) => note.clientId === client.id)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (!lastNote) return true;
      
      const daysSinceLastNote = Math.floor((now.getTime() - new Date(lastNote.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastNote >= 7;
    });

    // 5. Budget utilization
    const totalAllocatedHours = (hourAllocations as any[]).reduce((sum: number, allocation: any) => {
      return sum + (allocation.allocatedHours || 0);
    }, 0);

    const totalUsedHours = (hourAllocations as any[]).reduce((sum: number, allocation: any) => {
      return sum + (allocation.usedHours || 0);
    }, 0);

    const budgetUtilization = totalAllocatedHours > 0 ? (totalUsedHours / totalAllocatedHours) * 100 : 0;

    return {
      medicationsDueToday: medicationsPending,
      overdueObservations: overdueShifts.length,
      staffCoverageGaps: overdueShifts.length,
      pendingIncidents: pendingIncidents.length,
      caseNotesDue: clientsNeedingUpdates.length,
      budgetUtilization: Math.round(budgetUtilization),
    };
  };

  return {
    insights: generateInsights(),
    isLoading,
  };
}