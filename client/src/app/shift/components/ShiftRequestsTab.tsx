import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type Shift } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ShiftStatusTag from "./ShiftStatusTag";

export default function ShiftRequestsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
    refetchInterval: 30000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Filter for pending shift requests (shifts with status "requested")
  const pendingRequests = useMemo(() => {
    return shifts.filter(shift => (shift as any).status === "requested");
  }, [shifts]);

  const acceptMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest("POST", `/api/shifts/${shiftId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Request Approved",
        description: "The shift has been successfully assigned to staff member.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign shift. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest("POST", `/api/shifts/${shiftId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Request Rejected",
        description: "The shift request has been rejected and returned to available shifts.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject shift request.",
        variant: "destructive",
      });
    },
  });

  const getStaffName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const staff = (users as any[]).find(u => u.id === userId);
    return staff?.username || "Unknown staff";
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client assigned";
    const client = (clients as any[]).find(c => c.id === clientId);
    return client?.fullName || "Unknown client";
  };

  const handleAccept = (shift: Shift) => {
    acceptMutation.mutate(shift.id);
  };

  const handleReject = (shift: Shift) => {
    rejectMutation.mutate(shift.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Shift Requests</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''} awaiting approval
          </p>
        </div>
      </div>

      {pendingRequests.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No pending requests
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              All shift requests have been processed. Great work!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pendingRequests.map(shift => (
            <Card key={shift.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">{shift.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <User className="h-4 w-4" />
                      Requested by: {getStaffName(shift.userId)}
                    </div>
                  </div>
                  <ShiftStatusTag status={shift.status || "requested"} />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{format(new Date(shift.startTime), "MMM d, yyyy")}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>{format(new Date(shift.startTime), "h:mm a")} - {shift.endTime ? format(new Date(shift.endTime), "h:mm a") : "TBD"}</span>
                  </div>

                  {shift.clientId && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>Client: {getClientName(shift.clientId)}</span>
                    </div>
                  )}
                </div>

                {shift.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {shift.description}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleAccept(shift)}
                    disabled={acceptMutation.isPending}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {acceptMutation.isPending ? "Accepting..." : "Accept"}
                  </Button>
                  
                  <Button
                    onClick={() => handleReject(shift)}
                    disabled={rejectMutation.isPending}
                    size="sm"
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}