import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AgreementForm from "@/components/service-agreements/AgreementForm";
import type { ServiceAgreement, ServiceAgreementItem } from "@shared/schema";

export default function EditServiceAgreement() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [agreementData, setAgreementData] = useState<Partial<ServiceAgreement>>({});
  const [items, setItems] = useState<ServiceAgreementItem[]>([]);
  const [isAccepted, setIsAccepted] = useState(false);

  const { data: agreement, isLoading } = useQuery({
    queryKey: ["/api/compliance/service-agreements", id],
    queryFn: async () => {
      return await apiRequest("GET", `/api/compliance/service-agreements/${id}`);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (agreement) {
      setAgreementData(agreement);
      setItems(agreement.items || []);
      setIsAccepted(agreement.status === "active");
    }
  }, [agreement]);

  const updateMutation = useMutation({
    mutationFn: async (data: { agreement: Partial<ServiceAgreement>; items: ServiceAgreementItem[] }) => {
      // Update the agreement
      const updatedAgreement = await apiRequest('PUT', `/api/compliance/service-agreements/${id}`, data.agreement);
      
      // Update items - for simplicity, we'll delete all and recreate
      // In production, you'd want more sophisticated item management
      const currentItems = agreement?.items || [];
      
      // Delete removed items (only delete real database items, not temporary ones)
      for (const item of currentItems) {
        if (item.id && !item.id.startsWith('temp_') && !data.items.find(newItem => newItem.id === item.id)) {
          await apiRequest('DELETE', `/api/compliance/service-agreements/${id}/items/${item.id}`);
        }
      }
      
      // Add or update items
      for (const item of data.items) {
        // Check if this is a temporary item (starts with "temp_") or a real database item
        if (item.id && !item.id.startsWith('temp_')) {
          // Update existing item
          await apiRequest('PUT', `/api/compliance/service-agreements/${id}/items/${item.id}`, item);
        } else {
          // Create new item (either no ID or temporary ID)
          const itemData = { ...item };
          delete itemData.id; // Remove temporary ID
          await apiRequest('POST', `/api/compliance/service-agreements/${id}/items`, itemData);
        }
      }
      
      return updatedAgreement;
    },
    onSuccess: () => {
      toast({
        title: "Agreement Updated",
        description: "Service agreement has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/service-agreements", id] });
      
      // Redirect back to agreements list
      setLocation("/compliance/service-agreements");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update service agreement.",
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

    updateMutation.mutate({
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

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/compliance/service-agreements/${id}/pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-agreement-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Export Successful",
        description: "Service agreement PDF has been downloaded.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading agreement...</div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Agreement not found
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          The requested service agreement could not be found.
        </p>
        <Button 
          className="mt-4"
          onClick={() => setLocation("/compliance/service-agreements")}
        >
          Back to Agreements
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              Edit Service Agreement
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Agreement #{agreement.agreementNumber || `SA-${agreement.id}`}
            </p>
          </div>
        </div>
        <Button onClick={handleExportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Agreement Details</CardTitle>
          <CardDescription>
            Update agreement information and line items
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
            mode="edit"
            agreementId={id}
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
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={updateMutation.isPending || !isAccepted}
            >
              {updateMutation.isPending ? "Updating..." : "Update Agreement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}