import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, X, User } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ShiftStatusTag from "./ShiftStatusTag";

export default function PendingRequestsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Filter shifts with status "requested" for current user
  const pendingShifts = useMemo(() => {
    if (!user) return [];
    console.log("[PENDING SHIFTS] User ID:", user.id);
    const filtered = shifts.filter(shift => 
      shift.userId === user.id && shift.status === "requested"
    );
    console.log("[PENDING SHIFTS] Found pending shifts:", filtered.length);
    return filtered;
  }, [shifts, user]);

  // Mutation for canceling shift requests
  const cancelRequestMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest("PATCH", `/api/shifts/${shiftId}`, {
        userId: null,
        status: "unassigned"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Request Canceled",
        description: "Your shift request has been canceled.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel shift request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMM d");
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "Unknown Client";
    const client = clients.find((c: any) => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (pendingShifts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
          <Clock className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Pending Requests
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          You don't have any pending shift requests awaiting approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pending Shift Requests</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Shifts you've requested that are awaiting approval from administrators.
        </p>
      </div>

      <div className="grid gap-4">
        {pendingShifts.map((shift) => {
          const startTime = new Date(shift.startTime);
          const endTime = new Date(shift.endTime);
          
          return (
            <Card key={shift.id} className="hover:shadow-md transition-shadow border-l-4 border-l-yellow-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {shift.title || "Untitled Shift"}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <ShiftStatusTag status={shift.status || "unknown"} />
                      <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800">
                        Awaiting Approval
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelRequestMutation.mutate(shift.id)}
                    disabled={cancelRequestMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel Request
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateLabel(startTime)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <User className="h-4 w-4" />
                    <span>{getClientName(shift.clientId)}</span>
                  </div>
                </div>

                {shift.location && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    <span>{shift.location}</span>
                  </div>
                )}

                {shift.description && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{shift.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}