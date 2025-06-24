import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Users, Calendar, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

interface CreateBillingButtonProps {
  className?: string;
}

export default function CreateBillingButton({ className }: CreateBillingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createBillingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/billing/create-cycle", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/billing-overview"] });
      toast({
        title: "Success",
        description: "New billing cycle created successfully",
      });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create billing cycle",
        variant: "destructive",
      });
    },
  });

  return (
    <PermissionGuard requiredPermissions={["Admin", "ConsoleManager"]}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className={`flex items-center gap-2 ${className}`}>
            <Plus className="h-4 w-4" />
            Create Billing
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Create New Billing Cycle
            </DialogTitle>
            <DialogDescription>
              Generate a new billing cycle for all active staff members in your organization.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Billing Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Billing Period:</span>
                  <Badge variant="outline">28 Days</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Start Date:</span>
                  <span className="text-sm font-medium">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">End Date:</span>
                  <span className="text-sm font-medium">
                    {new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Billing Information</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    All active staff members will be billed according to their role:
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• Support Worker: $25/month</li>
                    <li>• Team Leader: $35/month</li>
                    <li>• Coordinator: $45/month</li>
                    <li>• Admin: $60/month</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createBillingMutation.mutate()}
                disabled={createBillingMutation.isPending}
              >
                {createBillingMutation.isPending ? "Creating..." : "Create Billing Cycle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
}