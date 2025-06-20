import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Calendar, Clock, User, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CancellationRequest } from "@shared/schema";

export default function CancellationRequestsTab() {
  const [selectedRequest, setSelectedRequest] = useState<CancellationRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "deny">("approve");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<CancellationRequest[]>({
    queryKey: ["/api/cancellation-requests"],
    refetchInterval: 30000,
  });

  const reviewRequestMutation = useMutation({
    mutationFn: async ({ requestId, action, reviewNotes }: { 
      requestId: number; 
      action: "approve" | "deny"; 
      reviewNotes: string; 
    }) => {
      return apiRequest("POST", `/api/cancellation-requests/${requestId}/review`, { 
        action, 
        reviewNotes 
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cancellation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/cancelled"] });
      
      toast({
        title: `Request ${reviewAction === "approve" ? "Approved" : "Denied"}`,
        description: `Cancellation request has been ${reviewAction === "approve" ? "approved" : "denied"} successfully`,
      });
      
      handleCloseReviewModal();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review cancellation request",
        variant: "destructive",
      });
    },
  });

  const handleReviewRequest = (request: CancellationRequest, action: "approve" | "deny") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setIsReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
    setSelectedRequest(null);
    setReviewNotes("");
  };

  const handleSubmitReview = () => {
    if (!selectedRequest) return;

    reviewRequestMutation.mutate({
      requestId: selectedRequest.id,
      action: reviewAction,
      reviewNotes: reviewNotes.trim(),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "denied":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getUrgencyColor = (hours: number) => {
    if (hours < 6) return "text-red-600 dark:text-red-400";
    if (hours < 12) return "text-amber-600 dark:text-amber-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const pendingRequests = requests.filter(req => req.status === "pending");
  const reviewedRequests = requests.filter(req => req.status !== "pending");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Cancellation Requests
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve urgent shift cancellation requests ({pendingRequests.length} pending)
        </p>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Pending Approval ({pendingRequests.length})
          </h3>
          
          {pendingRequests.map((request) => (
            <Card key={request.id} className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold">
                      {request.shiftTitle || "Untitled Shift"}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{request.requestedByUserName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Requested {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`${getUrgencyColor(request.hoursNotice)} border-current`}
                    >
                      {request.hoursNotice}h notice
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Shift Details</p>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(request.shiftStartTime), "MMM d, h:mm a")} - 
                        {request.shiftEndTime ? format(new Date(request.shiftEndTime), "h:mm a") : "TBD"}
                      </span>
                    </div>
                    {request.clientName && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="h-4 w-4" />
                        <span>{request.clientName}</span>
                      </div>
                    )}
                  </div>
                  
                  {request.requestReason && (
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Reason</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {request.requestReason}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="default"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleReviewRequest(request, "approve")}
                    disabled={reviewRequestMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex items-center gap-2"
                    onClick={() => handleReviewRequest(request, "deny")}
                    disabled={reviewRequestMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    Deny
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Pending Requests */}
      {pendingRequests.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                No pending cancellation requests
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Reviews */}
      {reviewedRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Reviews ({reviewedRequests.length})
          </h3>
          
          <div className="space-y-3">
            {reviewedRequests.slice(0, 5).map((request) => (
              <Card key={request.id} className="bg-gray-50 dark:bg-gray-800">
                <CardContent className="py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{request.shiftTitle}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          by {request.requestedByUserName}
                        </span>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      {request.reviewNotes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Note: {request.reviewNotes}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      {request.reviewedAt && format(new Date(request.reviewedAt), "MMM d, h:mm a")}
                      {request.reviewedByUserName && ` by ${request.reviewedByUserName}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approve" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {reviewAction === "approve" ? "Approve" : "Deny"} Cancellation Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve" 
                ? "This will cancel the shift and make it available for reassignment."
                : "This will keep the shift assigned to the staff member."
              }
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">{selectedRequest.shiftTitle}</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>Staff: {selectedRequest.requestedByUserName}</div>
                  <div>
                    Shift: {format(new Date(selectedRequest.shiftStartTime), "MMM d, h:mm a")}
                    {selectedRequest.shiftEndTime && ` - ${format(new Date(selectedRequest.shiftEndTime), "h:mm a")}`}
                  </div>
                  <div>Notice: {selectedRequest.hoursNotice} hours</div>
                  {selectedRequest.requestReason && (
                    <div className="mt-2 p-2 bg-white dark:bg-slate-700 rounded">
                      <strong>Reason:</strong> {selectedRequest.requestReason}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add any notes about your decision..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseReviewModal} disabled={reviewRequestMutation.isPending}>
              Cancel
            </Button>
            <Button 
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={handleSubmitReview}
              disabled={reviewRequestMutation.isPending}
              className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {reviewRequestMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </div>
              ) : (
                `${reviewAction === "approve" ? "Approve" : "Deny"} Request`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}