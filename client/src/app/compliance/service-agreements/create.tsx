import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";
import AgreementForm from "@/components/service-agreements/AgreementForm";
import type { ServiceAgreement, ServiceAgreementItem } from "@shared/schema";

export default function CreateServiceAgreement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to create service agreements
  if (user && !hasPermission(user, "CREATE_SERVICE_AGREEMENT")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can create service agreements.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {user.role || "Unknown"}
        </Badge>
      </div>
    );
  }
  
  const [agreementData, setAgreementData] = useState<Partial<ServiceAgreement>>({
    clientId: 0,
    startDate: new Date(),
    endDate: new Date(),
    planNomineeName: "",
    planNomineeContact: "",
    billingDetails: {
      participantNumber: "",
      planNumber: "",
      planManager: "",
      planManagerContact: "",
    },
    customTerms: "",
    status: "draft",
  });
  
  const [items, setItems] = useState<ServiceAgreementItem[]>([]);
  const [isAccepted, setIsAccepted] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: { agreement: Partial<ServiceAgreement>; items: ServiceAgreementItem[] }) => {
      // First create the agreement
      const response = await apiRequest('POST', '/api/compliance/service-agreements', data.agreement);
      const agreement = response as ServiceAgreement;
      
      // Then add items if any
      if (data.items.length > 0) {
        await Promise.all(
          data.items.map(item => {
            // Transform frontend field names to backend expected names
            const transformedItem = {
              ndisCode: item.ndisCode,
              supportDescription: item.supportDescription,
              weeks: parseInt(item.weeks?.toString()) || 0,
              // Convert frontend field names to backend expected names
              hoursDay: parseFloat(item.hoursDay?.toString()) || 0,
              hoursEvening: parseFloat(item.hoursWeekdayEvening?.toString()) || 0, // hoursWeekdayEvening -> hoursEvening
              hoursActiveNight: parseFloat(item.hoursActiveNight?.toString()) || 0,
              hoursSleepover: parseFloat(item.hoursSleepover?.toString()) || 0,
              hoursSaturday: parseFloat(item.hoursSaturday?.toString()) || 0,
              hoursSunday: parseFloat(item.hoursSunday?.toString()) || 0,
              hoursPublicHoliday: parseFloat(item.hoursPublicHoliday?.toString()) || 0,
              // Unit rates
              unitDay: parseFloat(item.unitDay?.toString()) || 0,
              unitEvening: parseFloat(item.unitWeekdayEvening?.toString()) || 0, // unitWeekdayEvening -> unitEvening
              unitActiveNight: parseFloat(item.unitActiveNight?.toString()) || 0,
              unitSleepover: parseFloat(item.unitSleepover?.toString()) || 0,
              unitSaturday: parseFloat(item.unitSaturday?.toString()) || 0,
              unitSunday: parseFloat(item.unitSunday?.toString()) || 0,
              unitPublicHoliday: parseFloat(item.unitPublicHoliday?.toString()) || 0,
              notes: item.notes || "",
            };
            
            return apiRequest('POST', `/api/compliance/service-agreements/${agreement.id}/items`, transformedItem);
          })
        );
      }
      
      return agreement;
    },
    onSuccess: (agreement) => {
      toast({
        title: "Agreement Created",
        description: "Service agreement has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
      setLocation(`/compliance/service-agreements`);
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create service agreement.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!agreementData.clientId || !agreementData.startDate || !agreementData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      agreement: agreementData,
      items: items,
    });
  };

  const handleSaveAsDraft = () => {
    setAgreementData(prev => ({ ...prev, status: "draft" }));
    handleSave();
  };

  const handleFinalize = () => {
    if (!isAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions to finalize the agreement.",
        variant: "destructive",
      });
      return;
    }
    
    setAgreementData(prev => ({ ...prev, status: "active" }));
    handleSave();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation("/compliance/service-agreements")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agreements
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Create Service Agreement
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Set up a new NDIS service agreement with detailed line items
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New NDIS Service Agreement</CardTitle>
          <CardDescription>
            Complete all sections to create a comprehensive service agreement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgreementForm
            agreementData={agreementData}
            onAgreementChange={setAgreementData}
            items={items}
            onItemsChange={setItems}
            isAccepted={isAccepted}
            onAcceptedChange={setIsAccepted}
            mode="create"
          />
          
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setLocation("/compliance/service-agreements")}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={createMutation.isPending || !isAccepted}
            >
              {createMutation.isPending ? "Creating..." : "Create Agreement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}