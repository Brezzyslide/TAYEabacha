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
    const overdueShifts = shifts.filter((shift: any) => {
      const startTime = new Date(shift.startTime);
      return !shift.actualStartTime && isAfter(now, startTime);
    });

    if (overdueShifts.length > 0) {
      insights.push({
        id: 'overdue-shifts',
        type: 'error',
        title: 'Overdue Shifts',
        description: `${overdueShifts.length} shift${overdueShifts.length > 1 ? 's are' : ' is'} overdue to start`,
        count: overdueShifts.length,
        icon: 'Clock',
        actionUrl: '/shift',
        actionLabel: 'View Shifts'
      });
    }

    // 2. Open incidents older than 48 hours
    const oldIncidents = incidents.filter((incident: any) => {
      const createdTime = new Date(incident.createdAt);
      const hoursSince = (now.getTime() - createdTime.getTime()) / (1000 * 60 * 60);
      return incident.status === 'open' && hoursSince > 48;
    });

    if (oldIncidents.length > 0) {
      insights.push({
        id: 'old-incidents',
        type: 'warning',
        title: 'Unresolved Incidents',
        description: `${oldIncidents.length} incident${oldIncidents.length > 1 ? 's have' : ' has'} been open for over 48 hours`,
        count: oldIncidents.length,
        icon: 'AlertTriangle',
        actionUrl: '/incident-management',
        actionLabel: 'Review Incidents'
      });
    }

    // 3. Medication plans with no record today
    const todayRecords = medicationRecords.filter((record: any) => {
      const recordDate = startOfDay(new Date(record.administeredAt));
      return recordDate.getTime() === today.getTime();
    });

    const plansWithoutRecords = medicationPlans.filter((plan: any) => {
      return plan.isActive && !todayRecords.some((record: any) => record.planId === plan.id);
    });

    if (plansWithoutRecords.length > 0) {
      insights.push({
        id: 'missing-med-records',
        type: 'warning',
        title: 'Missing Medication Records',
        description: `${plansWithoutRecords.length} client${plansWithoutRecords.length > 1 ? 's have' : ' has'} no medication logged today`,
        count: plansWithoutRecords.length,
        icon: 'Pill',
        actionUrl: '/medications',
        actionLabel: 'View Medications'
      });
    }

    // 4. Clients with no case notes in 7 days
    const sevenDaysAgo = subDays(now, 7);
    const recentNotes = caseNotes.filter((note: any) => {
      const noteDate = new Date(note.createdAt);
      return isAfter(noteDate, sevenDaysAgo);
    });

    const clientsWithoutRecentNotes = clients.filter((client: any) => {
      return !recentNotes.some((note: any) => note.clientId === client.id);
    });

    if (clientsWithoutRecentNotes.length > 0) {
      insights.push({
        id: 'missing-case-notes',
        type: 'info',
        title: 'Missing Case Notes',
        description: `${clientsWithoutRecentNotes.length} client${clientsWithoutRecentNotes.length > 1 ? 's have' : ' has'} no case notes this week`,
        count: clientsWithoutRecentNotes.length,
        icon: 'FileText',
        actionUrl: '/case-notes',
        actionLabel: 'Add Case Notes'
      });
    }

    // 5. Staff nearing allocation cap (≥90%)
    const staffNearingCap = hourAllocations.filter((allocation: any) => {
      const usagePercent = (allocation.hoursUsed / allocation.maxHours) * 100;
      return usagePercent >= 90;
    });

    if (staffNearingCap.length > 0) {
      insights.push({
        id: 'allocation-cap',
        type: 'warning',
        title: 'Allocation Cap Warning',
        description: `${staffNearingCap.length} staff member${staffNearingCap.length > 1 ? 's are' : ' is'} nearing hour allocation cap`,
        count: staffNearingCap.length,
        icon: 'Users',
        actionUrl: '/staff-hour-allocations',
        actionLabel: 'Manage Allocations'
      });
    }

    return insights;
  };

  return {
    insights: generateInsights(),
    isLoading: false,
  };
}