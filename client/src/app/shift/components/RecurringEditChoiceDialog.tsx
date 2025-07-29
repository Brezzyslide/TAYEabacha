import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarDays, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { type Shift } from "@shared/schema";

interface RecurringEditChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onEditSingle: () => void;
  onEditFuture: () => void;
  onEditSeries: () => void;
}

export default function RecurringEditChoiceDialog({
  isOpen,
  onClose,
  shift,
  onEditSingle,
  onEditFuture,
  onEditSeries
}: RecurringEditChoiceDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Edit Recurring Shift
          </DialogTitle>
          <DialogDescription>
            This shift is part of a recurring series. Choose how you'd like to edit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shift Info */}
          <Card className="bg-gray-50 dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="font-medium text-gray-900 dark:text-white">
                  {shift.title}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(shift.startTime), "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(shift.startTime), "h:mm a")} - {
                      shift.endTime ? 
                      format(new Date(shift.endTime), "h:mm a") : 
                      "TBD"
                    }
                  </span>
                </div>
                {shift.recurringPattern && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <RefreshCw className="h-4 w-4" />
                    <span className="capitalize">{shift.recurringPattern} pattern</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Choice Buttons */}
          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={onEditSingle}
              variant="outline"
              className="h-auto p-4 text-left justify-start"
            >
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <div className="font-medium">Edit This Shift Only</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Changes will only apply to this specific occurrence
                  </div>
                </div>
              </div>
            </Button>

            <Button
              onClick={onEditFuture}
              variant="outline"
              className="h-auto p-4 text-left justify-start"
            >
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Edit All Future Shifts</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Changes apply to this shift and all future occurrences, preserving past shifts
                  </div>
                </div>
              </div>
            </Button>

            <Button
              onClick={onEditSeries}
              variant="outline"
              className="h-auto p-4 text-left justify-start"
            >
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium">Edit Entire Series</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Changes will apply to all shifts in this recurring series (past, present, and future)
                  </div>
                </div>
              </div>
            </Button>
          </div>

          {/* Cancel Button */}
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}