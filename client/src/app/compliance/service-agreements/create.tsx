import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AgreementForm from "@/components/service-agreements/AgreementForm";
import type { ServiceAgreement, ServiceAgreementItem } from "@shared/schema";

export default function CreateServiceAgreement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [agreementData, setAgreementData] = useState<Partial<ServiceAgreement>>({
    clientId: 0,
    startDate: "",
    endDate: "",
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
      const agreement = await apiRequest('POST', '/api/compliance/service-agreements', data.agreement);
      
      // Then add items if any
      if (data.items.length > 0) {
        await Promise.all(
          data.items.map(item => 
            apiRequest('POST', `/api/compliance/service-agreements/${agreement.id}/items`, item)
          )
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
      setLocation(`/compliance/service-agreements/edit/${agreement.id}`);
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