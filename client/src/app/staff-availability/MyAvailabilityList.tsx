import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Clock, Edit, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StaffAvailability {
  id: number;
  availabilityId: string;
  userId: number;
  availability: Record<string, string[]>;
  patternName?: string;
  isQuickPattern: boolean;
  overrideByManager: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MyAvailabilityList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAvailability, setSelectedAvailability] = useState<StaffAvailability | null>(null);

  // Fetch user's own availability submissions
  const { data: myAvailabilities = [], isLoading, error } = useQuery<StaffAvailability[]>({
    queryKey: ["/api/staff-availability/mine"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability/mine");
      if (!response.ok) throw new Error("Failed to fetch your availability submissions");
      return response.json();
    },
  });

  // Delete availability mutation
  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/staff-availability/${id}`);
      if (!response.ok) throw new Error("Failed to delete availability");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Availability Deleted",
        description: "Your availability submission has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-availability/mine"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatAvailabilityDays = (availability: Record<string, string[]>) => {
    const days = Object.keys(availability).filter(day => availability[day].length > 0);
    if (days.length === 0) return "No availability set";
    if (days.length <= 3) {
      return days.map(day => `${day.slice(0, 3)}: ${availability[day].join(", ")}`).join(" | ");
    }
    return `${days.length} days available`;
  };

  const getStatusBadge = (availability: StaffAvailability) => {
    if (!availability.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (availability.overrideByManager) {
      return <Badge variant="default" className="bg-green-600">Approved</Badge>;
    }
    return <Badge variant="outline">Pending Review</Badge>;
  };

  const handleDelete = async (id: number) => {
    deleteAvailabilityMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading your availability submissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Error Loading Availability</h3>
            <p className="text-gray-600 mt-2">Failed to load your availability submissions. Please try refreshing the page.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Availability Submissions</h2>
          <p className="text-gray-600 mt-1">View and manage your availability submissions</p>
        </div>
      </div>

      {myAvailabilities.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">No Availability Submitted</h3>
              <p className="text-gray-600 mt-2">You haven't submitted any availability yet. Create your first availability submission to get started.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {myAvailabilities.map((availability) => (
            <Card key={availability.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-medium text-gray-900">
                        {availability.patternName || `Availability ${availability.id}`}
                      </h3>
                      {getStatusBadge(availability)}
                      {availability.isQuickPattern && (
                        <Badge variant="outline">Quick Pattern</Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-600">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Created: {format(new Date(availability.createdAt), "MMM dd, yyyy")}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Updated: {format(new Date(availability.updatedAt), "MMM dd, yyyy HH:mm")}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <strong>Availability:</strong> {formatAvailabilityDays(availability.availability)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAvailability(availability)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Availability Details</DialogTitle>
                        </DialogHeader>
                        {selectedAvailability && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Submission ID</label>
                                <p className="text-sm">{selectedAvailability.availabilityId}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">Status</label>
                                <div className="mt-1">{getStatusBadge(selectedAvailability)}</div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-700">Weekly Availability</label>
                              <div className="mt-2 grid grid-cols-7 gap-2">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                  const dayAvailability = selectedAvailability.availability[day] || [];
                                  return (
                                    <div key={day} className={`p-3 rounded-lg border text-center ${
                                      dayAvailability.length > 0 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-gray-50 border-gray-200'
                                    }`}>
                                      <div className="font-medium text-xs">{day.slice(0, 3)}</div>
                                      <div className="text-xs mt-1">
                                        {dayAvailability.length > 0 
                                          ? dayAvailability.join(", ") 
                                          : "Not available"
                                        }
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <label className="font-medium text-gray-700">Created</label>
                                <p>{format(new Date(selectedAvailability.createdAt), "MMM dd, yyyy HH:mm")}</p>
                              </div>
                              <div>
                                <label className="font-medium text-gray-700">Last Updated</label>
                                <p>{format(new Date(selectedAvailability.updatedAt), "MMM dd, yyyy HH:mm")}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deleteAvailabilityMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Availability</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this availability submission? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(availability.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}