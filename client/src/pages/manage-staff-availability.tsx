import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Calendar, Users, Clock, Eye, Edit2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface StaffAvailability {
  id: number;
  availabilityId: string;
  userId: number;
  userFullName: string;
  username: string;
  availability: Record<string, string[]>;
  patternName?: string;
  isQuickPattern: boolean;
  overrideByManager: boolean;
  isActive: boolean;
  isApproved?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ManageStaffAvailabilityPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState<StaffAvailability | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: availabilities = [], isLoading } = useQuery<StaffAvailability[]>({
    queryKey: ["/api/staff-availability/admin"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability/admin");
      if (!response.ok) throw new Error("Failed to fetch staff availability");
      return response.json();
    },
  });

  const approveAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isApproved }: { id: number; isApproved: boolean }) => {
      await apiRequest("PUT", `/api/staff-availability/${id}/approval`, { isApproved });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Availability status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-availability/admin"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update availability status",
        variant: "destructive",
      });
    },
  });

  const filteredAvailabilities = availabilities.filter(availability =>
    availability.userFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    availability.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAvailabilityDays = (availability: Record<string, string[]>) => {
    return Object.entries(availability)
      .map(([day, shifts]) => `${day}: ${shifts.join(", ")}`)
      .join(" | ");
  };

  const getStatusBadge = (availability: StaffAvailability) => {
    if (availability.isApproved === true) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
    } else if (availability.isApproved === false) {
      return <Badge variant="destructive">Rejected</Badge>;
    } else {
      return <Badge variant="secondary">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Staff Availability</h1>
          <p className="text-gray-600 mt-1">Review and approve staff availability submissions</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                <p className="text-3xl font-bold text-gray-900">{availabilities.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-orange-600">
                  {availabilities.filter(a => a.isApproved === undefined || a.isApproved === null).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600">
                  {availabilities.filter(a => a.isApproved === true).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600">
                  {availabilities.filter(a => a.isApproved === false).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">Staff Availability Submissions</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading availability submissions...</div>
          ) : filteredAvailabilities.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAvailabilities.map((availability) => (
                    <TableRow key={availability.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{availability.userFullName || availability.username}</div>
                          <div className="text-sm text-gray-500">{availability.username}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm">
                          {formatAvailabilityDays(availability.availability)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {availability.isQuickPattern ? (
                          <Badge variant="outline">{availability.patternName || "Quick Pattern"}</Badge>
                        ) : (
                          <span className="text-sm text-gray-500">Custom</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(availability)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(availability.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAvailability(availability)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  Availability Details - {availability.userFullName || availability.username}
                                </DialogTitle>
                              </DialogHeader>
                              {selectedAvailability && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(selectedAvailability.availability).map(([day, shifts]) => (
                                      <div key={day} className="p-3 border rounded-lg">
                                        <h4 className="font-medium text-gray-900">{day}</h4>
                                        <div className="mt-2 space-y-1">
                                          {shifts.map((shift, index) => (
                                            <Badge key={index} variant="outline" className="mr-1">
                                              {shift}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-end space-x-2 pt-4 border-t">
                                    <Button
                                      variant="outline"
                                      onClick={() => 
                                        approveAvailabilityMutation.mutate({ 
                                          id: selectedAvailability.id, 
                                          isApproved: false 
                                        })
                                      }
                                      disabled={approveAvailabilityMutation.isPending}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </Button>
                                    <Button
                                      onClick={() => 
                                        approveAvailabilityMutation.mutate({ 
                                          id: selectedAvailability.id, 
                                          isApproved: true 
                                        })
                                      }
                                      disabled={approveAvailabilityMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No availability submissions found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}