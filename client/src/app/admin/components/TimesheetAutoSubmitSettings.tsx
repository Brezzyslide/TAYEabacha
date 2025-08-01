import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AutoSubmitSettings {
  autoSubmitEnabled: boolean;
}

export function TimesheetAutoSubmitSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery<AutoSubmitSettings>({
    queryKey: ["/api/settings/timesheet/auto-submit"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (autoSubmitEnabled: boolean) => {
      return apiRequest("PUT", "/api/settings/timesheet/auto-submit", {
        autoSubmitEnabled,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/settings/timesheet/auto-submit"],
      });
      toast({
        title: "Settings Updated",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Settings",
        description: error.message || "An error occurred while updating settings",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (enabled: boolean) => {
    updateSettingsMutation.mutate(enabled);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Timesheet Auto-Submission
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Timesheet Auto-Submission Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Label htmlFor="auto-submit-toggle" className="text-base font-medium">
              Enable Auto-Submission
            </Label>
            <p className="text-sm text-gray-600">
              Automatically submit timesheets when all shifts in a pay period are completed
            </p>
          </div>
          <Switch
            id="auto-submit-toggle"
            checked={settings?.autoSubmitEnabled || false}
            onCheckedChange={handleToggle}
            disabled={updateSettingsMutation.isPending}
          />
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start gap-3">
            {settings?.autoSubmitEnabled ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            )}
            <div className="space-y-2">
              <h4 className="font-medium">
                {settings?.autoSubmitEnabled ? "Auto-Submission Enabled" : "Manual Submission Required"}
              </h4>
              <p className="text-sm text-gray-600">
                {settings?.autoSubmitEnabled ? (
                  <>
                    Timesheets will be automatically submitted for admin approval when all shifts 
                    in a pay period are completed. Staff will receive notifications when this happens.
                  </>
                ) : (
                  <>
                    Staff must manually submit their timesheets for admin approval. 
                    Completed shifts will create timesheet entries but remain in draft status.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="font-medium text-blue-900 mb-2">How Auto-Submission Works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• When a worker completes a shift, a timesheet entry is automatically created</li>
            <li>• The system checks if all shifts in that pay period are completed</li>
            <li>• If all shifts are done, the timesheet is automatically submitted for approval</li>
            <li>• Workers and admins receive notifications about the auto-submission</li>
            <li>• Admins can still approve, reject, or request changes as normal</li>
          </ul>
        </div>

        {updateSettingsMutation.isPending && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Updating settings...
          </div>
        )}
      </CardContent>
    </Card>
  );
}