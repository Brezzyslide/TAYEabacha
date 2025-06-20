import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Clock } from "lucide-react";
import type { Shift } from "@shared/schema";

interface CancelShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
}

export function CancelShiftModal({ isOpen, onClose, shift }: CancelShiftModalProps) {
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cancelShiftMutation = useMutation({
    mutationFn: async ({ shiftId, reason }: { shiftId: number; reason: string }) => {
      return apiRequest("POST", `/api/shifts/${shiftId}/cancel`, { reason });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/my-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/calendar"] });
      
      if (data.type === "immediate") {
        toast({
          title: "Shift Cancelled",
          description: `Your shift has been cancelled successfully (${data.hoursNotice} hours notice)`,
        });
      } else {
        toast({
          title: "Cancellation Request Submitted",
          description: "Your cancellation request has been submitted for admin approval",
        });
      }
      
      onClose();
      setReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel shift",
        variant: "destructive",
      });
    },
  });

  const calculateHoursNotice = (shiftStartTime: string | Date) => {
    const now = new Date();
    const shiftStart = new Date(shiftStartTime);
    return Math.floor((shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60));
  };

  const handleCancel = () => {
    if (!shift) return;
    
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for cancelling this shift",
        variant: "destructive",
      });
      return;
    }

    cancelShiftMutation.mutate({ shiftId: shift.id, reason: reason.trim() });
  };

  const hoursNotice = shift ? calculateHoursNotice(shift.startTime) : 0;
  const isUrgentCancellation = hoursNotice < 24;

  if (!shift) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cancel Shift
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this shift?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shift Information */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">{shift.title}</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {new Date(shift.startTime).toLocaleDateString()} at{" "}
                {new Date(shift.startTime).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>

          {/* Notice Period Warning */}
          <div className={`p-4 rounded-lg border ${
            isUrgentCancellation 
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" 
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-1 rounded-full ${
                isUrgentCancellation ? "bg-amber-100 dark:bg-amber-900" : "bg-blue-100 dark:bg-blue-900"
              }`}>
                <Clock className={`h-4 w-4 ${
                  isUrgentCancellation ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                }`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${
                  isUrgentCancellation ? "text-amber-800 dark:text-amber-200" : "text-blue-800 dark:text-blue-200"
                }`}>
                  {isUrgentCancellation ? "Urgent Cancellation" : "Standard Cancellation"}
                </p>
                <p className={`text-sm ${
                  isUrgentCancellation ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"
                }`}>
                  {isUrgentCancellation 
                    ? `${hoursNotice} hours notice - Requires admin approval`
                    : `${hoursNotice} hours notice - Will be cancelled immediately`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Cancellation *</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for cancelling this shift..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={cancelShiftMutation.isPending}>
            Keep Shift
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={cancelShiftMutation.isPending || !reason.trim()}
          >
            {cancelShiftMutation.isPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isUrgentCancellation ? "Requesting..." : "Cancelling..."}
              </div>
            ) : (
              isUrgentCancellation ? "Request Cancellation" : "Cancel Shift"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}