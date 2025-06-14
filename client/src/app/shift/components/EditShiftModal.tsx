import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Shift, Client, User } from "@shared/schema";

interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
}

export default function EditShiftModal({ isOpen, onClose, shift }: EditShiftModalProps) {
  const [title, setTitle] = useState(shift.title || "");
  const [clientId, setClientId] = useState(shift.clientId?.toString() || "");
  const [userId, setUserId] = useState(shift.userId?.toString() || "unassigned");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(shift.startTime));
  const [startTime, setStartTime] = useState(format(new Date(shift.startTime), "HH:mm"));
  const [endTime, setEndTime] = useState(
    shift.endTime ? format(new Date(shift.endTime), "HH:mm") : format(new Date(shift.startTime), "HH:mm")
  );
  const [description, setDescription] = useState(shift.description || "");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch users/staff
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: async () => {
      const [startHours, startMinutes] = startTime.split(':');
      const [endHours, endMinutes] = endTime.split(':');
      
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(parseInt(startHours), parseInt(startMinutes));
      
      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes));
      
      const updateData = {
        title,
        clientId: parseInt(clientId),
        userId: userId === "unassigned" ? null : parseInt(userId),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        description,
      };

      const response = await fetch(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update shift");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Updated",
        description: "The shift has been successfully updated.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update shift.",
        variant: "destructive",
      });
    },
  });

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shifts/${shift.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete shift");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({
        title: "Shift Deleted",
        description: "The shift has been successfully deleted.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete shift.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !clientId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    updateShiftMutation.mutate();
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this shift? This action cannot be undone.")) {
      deleteShiftMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Shift Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter shift title"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Client *</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.firstName} {client.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="text-sm font-medium">Shift Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Start Time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Staff Assignment */}
          <div>
            <label className="text-sm font-medium">Assigned Staff</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.fullName || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter shift description..."
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={updateShiftMutation.isPending}
            >
              {updateShiftMutation.isPending ? "Updating..." : "Update Shift"}
            </Button>
            
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteShiftMutation.isPending}
              className="sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteShiftMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}