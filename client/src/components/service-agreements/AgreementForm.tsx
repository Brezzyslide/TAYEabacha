import { useQuery } from "@tanstack/react-query";
import { useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, User, Phone, Mail, Calculator, FileText, PenTool } from "lucide-react";
import ItemsGrid from "./ItemsGridSimple";
import TotalsBar from "./TotalsBar";
import SignPanel from "./SignPanelFixed";
import TermsViewer from "./TermsViewer";
import type { ServiceAgreement, ServiceAgreementItem } from "@shared/schema";

interface AgreementFormProps {
  agreementData: Partial<ServiceAgreement>;
  onAgreementChange: (data: Partial<ServiceAgreement>) => void;
  items: ServiceAgreementItem[];
  onItemsChange: (items: ServiceAgreementItem[]) => void;
  isAccepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  mode: "create" | "edit";
}

export default function AgreementForm({
  agreementData,
  onAgreementChange,
  items,
  onItemsChange,
  isAccepted,
  onAcceptedChange,
  mode,
}: AgreementFormProps) {
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: tenant } = useQuery({
    queryKey: ["/api/tenant"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Fetch default terms template for tenant
  const { data: defaultTerms } = useQuery({
    queryKey: ["/api/compliance/terms-templates/default"],
    enabled: mode === "create",
  });

  const handleFieldChange = useCallback((field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      onAgreementChange({
        ...agreementData,
        [parent]: {
          ...(agreementData[parent as keyof ServiceAgreement] as any),
          [child]: value,
        },
      });
    } else {
      onAgreementChange({
        ...agreementData,
        [field]: value,
      });
    }
  }, [agreementData, onAgreementChange]);

  const selectedClient = useMemo(() => 
    Array.isArray(clients) ? clients.find((c: any) => c.id === agreementData.clientId) : null,
    [clients, agreementData.clientId]
  );

  const getClientDisplayName = useCallback(() => {
    if (!selectedClient) return null;
    return selectedClient.fullName || 
           (selectedClient.firstName && selectedClient.lastName 
             ? `${selectedClient.firstName} ${selectedClient.lastName}` 
             : 'Unknown Client');
  }, [selectedClient]);

  const handleSignature = useCallback((type: 'client' | 'provider', signature: any) => {
    const signatureField = type === 'client' ? 'clientSignature' : 'providerSignature';
    handleFieldChange(signatureField, signature);
  }, [handleFieldChange]);

  // Auto-populate agreement fields when client or tenant data changes
  useEffect(() => {
    if (mode === "create" && selectedClient && selectedClient.ndisNumber) {
      const currentBillingDetails = agreementData.billingDetails || {};
      // Only update if the participant number is different to avoid re-renders
      if ((currentBillingDetails as any)?.participantNumber !== selectedClient.ndisNumber) {
        const updatedBillingDetails = {
          ...currentBillingDetails,
          participantNumber: selectedClient.ndisNumber || "",
          planNumber: (currentBillingDetails as any)?.planNumber || "", // Ensure planNumber exists
        };
        
        onAgreementChange({
          ...agreementData,
          billingDetails: updatedBillingDetails,
        });
      }
    }
  }, [selectedClient?.ndisNumber, mode]);

  // Auto-load default terms template
  useEffect(() => {
    if (mode === "create" && defaultTerms && (defaultTerms as any)?.content && !agreementData.customTerms) {
      onAgreementChange({
        ...agreementData,
        customTerms: (defaultTerms as any).content,
      });
    }
  }, [(defaultTerms as any)?.content, mode]);

  return (
    <div className="space-y-6">
      {/* Client Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Participant Selection
          </CardTitle>
          <CardDescription>
            Select the NDIS participant for this service agreement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientId" className="text-red-600">Client *</Label>
              <Select 
                value={agreementData.clientId?.toString() || ""} 
                onValueChange={(value) => handleFieldChange('clientId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(clients) && clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.fullName || 
                       (client.firstName && client.lastName 
                         ? `${client.firstName} ${client.lastName}` 
                         : 'Unknown Client')} - {client.ndisNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!agreementData.clientId && (
                <p className="text-sm text-red-600 mt-1">Client is required</p>
              )}
            </div>

            {/* Auto-loaded Client Information */}
            {mode === "create" && selectedClient && (
              <div className="grid gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Participant Details (Auto-loaded)
                  </Label>
                  <Badge variant="secondary" className="text-xs">Read-only</Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Full Name</Label>
                    <div className="text-sm font-medium">
                      {selectedClient.fullName || 
                       (selectedClient.firstName && selectedClient.lastName 
                         ? `${selectedClient.firstName} ${selectedClient.lastName}` 
                         : 'Name not available')}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">NDIS Number</Label>
                    <div className="text-sm font-medium">{selectedClient.ndisNumber}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Address</Label>
                    <div className="text-sm font-medium">{selectedClient.address || "Not specified"}</div>
                  </div>
                  <div className="space-y-2">
                    {selectedClient.emergencyContactName && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="text-sm font-medium">{selectedClient.emergencyContactName}</span>
                      </div>
                    )}
                    {selectedClient.emergencyContactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span className="text-sm">{selectedClient.emergencyContactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agreement Period */}
      <Card>
        <CardHeader>
          <CardTitle>Agreement Period</CardTitle>
          <CardDescription>Service dates and duration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-red-600">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={agreementData.startDate ? new Date(agreementData.startDate).toISOString().split('T')[0] : ""}
                onChange={(e) => handleFieldChange("startDate", e.target.value)}
                placeholder="dd/mm/yyyy"
              />
              {!agreementData.startDate && (
                <p className="text-sm text-red-600 mt-1">Start date is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="endDate" className="text-red-600">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={agreementData.endDate ? new Date(agreementData.endDate).toISOString().split('T')[0] : ""}
                onChange={(e) => handleFieldChange("endDate", e.target.value)}
                placeholder="dd/mm/yyyy"
              />
              {!agreementData.endDate && (
                <p className="text-sm text-red-600 mt-1">End date is required</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Nominee Details */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Nominee Information</CardTitle>
          <CardDescription>Authorized representative details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="planNomineeName">Plan Nominee Name</Label>
              <Input
                id="planNomineeName"
                value={agreementData.planNomineeName || ""}
                onChange={(e) => handleFieldChange("planNomineeName", e.target.value)}
                placeholder="Enter nominee name"
              />
            </div>
            <div>
              <Label htmlFor="planNomineeContact">Plan Nominee Contact</Label>
              <Input
                id="planNomineeContact"
                value={agreementData.planNomineeContact || ""}
                onChange={(e) => handleFieldChange("planNomineeContact", e.target.value)}
                placeholder="Email or phone"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Billing Details
          </CardTitle>
          <CardDescription>NDIS plan and billing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ndisParticipantNumber" className="text-red-600">NDIS Participant Number *</Label>
              <Input
                id="ndisParticipantNumber"
                value={(agreementData.billingDetails as any)?.participantNumber || ""}
                onChange={(e) => handleFieldChange("billingDetails.participantNumber", e.target.value)}
                placeholder="Enter participant number"
                className={!(agreementData.billingDetails as any)?.participantNumber ? "border-red-300" : ""}
              />
              {!(agreementData.billingDetails as any)?.participantNumber && (
                <p className="text-sm text-red-600 mt-1">Participant number is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="planNumber" className="text-red-600">Plan Number *</Label>
              <Input
                id="planNumber"
                value={(agreementData.billingDetails as any)?.planNumber || ""}
                onChange={(e) => handleFieldChange("billingDetails.planNumber", e.target.value)}
                placeholder="Enter plan number"
                className={!(agreementData.billingDetails as any)?.planNumber ? "border-red-300" : ""}
              />
              {!(agreementData.billingDetails as any)?.planNumber && (
                <p className="text-sm text-red-600 mt-1">Plan number is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="planManager">Plan Manager</Label>
              <Input
                id="planManager"
                value={(agreementData.billingDetails as any)?.planManager || ""}
                onChange={(e) => handleFieldChange("billingDetails.planManager", e.target.value)}
                placeholder="Enter plan manager name"
              />
            </div>
            <div>
              <Label htmlFor="planManagerContact">Plan Manager Contact</Label>
              <Input
                id="planManagerContact"
                value={(agreementData.billingDetails as any)?.planManagerContact || ""}
                onChange={(e) => handleFieldChange("billingDetails.planManagerContact", e.target.value)}
                placeholder="Email or phone"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Items & Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Service Items & Pricing</CardTitle>
          <CardDescription>NDIS support categories and hourly rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemsGrid items={items} onItemsChange={onItemsChange} />
        </CardContent>
      </Card>

      {/* Totals & Calculations */}
      <TotalsBar items={items} />

      {/* Custom Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Terms & Conditions
          </CardTitle>
          <CardDescription>Additional terms specific to this agreement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="customTerms">Enter any custom terms specific to this agreement...</Label>
            <Textarea
              id="customTerms"
              rows={8}
              value={agreementData.customTerms || ""}
              onChange={(e) => handleFieldChange("customTerms", e.target.value)}
              placeholder="Enter any custom terms specific to this agreement..."
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Standard Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Standard Terms & Conditions</CardTitle>
          <CardDescription>Default terms that apply to all agreements</CardDescription>
        </CardHeader>
        <CardContent>
          <TermsViewer 
            customTerms={agreementData.customTerms || ""}
            onCustomTermsChange={(terms) => handleFieldChange("customTerms", terms)}
            isAccepted={isAccepted}
            onAcceptedChange={onAcceptedChange}
          />
        </CardContent>
      </Card>

      {/* Digital Signatures */}
      <SignPanel
        clientName={getClientDisplayName()}
        onSignature={handleSignature}
        signatures={{
          clientSignature: agreementData.clientSignature || undefined,
          providerSignature: agreementData.providerSignature || undefined,
        }}
      />


    </div>
  );
}