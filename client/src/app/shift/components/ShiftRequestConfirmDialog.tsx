import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, User, MapPin } from "lucide-react";
import { format } from "date-fns";
import { type Shift } from "@shared/schema";

interface ShiftRequestConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shift: Shift | null;
  clientName: string;
  isLoading?: boolean;
}

export default function ShiftRequestConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  shift,
  clientName,
  isLoading = false
}: ShiftRequestConfirmDialogProps) {
  if (!shift) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Request Shift Assignment
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>Are you sure you want to request this shift to be allocated to you?</p>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
              <div className="font-medium text-gray-900 dark:text-white">
                {shift.title}
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(shift.startTime), "EEEE, MMMM d, yyyy")}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(shift.startTime), "h:mm a")} - {
                      shift.endTime ? 
                      format(new Date(shift.endTime), "h:mm a") : 
                      "TBD"
                    }
                  </span>
                </div>
                
                {shift.clientId && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{clientName}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Once submitted, this request will be sent to administrators for approval.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Requesting..." : "Yes, Request Shift"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}