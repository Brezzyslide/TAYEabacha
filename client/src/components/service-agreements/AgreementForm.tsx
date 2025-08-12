import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { Building2, User, Phone, Mail, MapPin } from "lucide-react";
import ItemsGrid from "./ItemsGrid";
import TotalsBar from "./TotalsBar";
import SignPanel from "./SignPanel";
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
  const { data: clients } = useQuery({
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

  // Fetch selected client details
  const { data: selectedClientDetails } = useQuery({
    queryKey: ["/api/clients", agreementData.clientId],
    enabled: !!agreementData.clientId && mode === "create",
  });

  // Fetch default terms template for tenant
  const { data: defaultTerms } = useQuery({
    queryKey: ["/api/compliance/terms-templates/default"],
    enabled: mode === "create",
  });

  const handleFieldChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      onAgreementChange({
        ...agreementData,
        [parent]: {
          ...agreementData[parent as keyof ServiceAgreement],
          [child]: value,
        },
      });
    } else {
      onAgreementChange({
        ...agreementData,
        [field]: value,
      });
    }
  };

  const selectedClient = (clients || []).find((c: any) => c.id === agreementData.clientId);

  // Auto-populate agreement fields when client or tenant data changes
  useEffect(() => {
    if (mode === "create" && selectedClientDetails && company && !agreementData.providerName) {
      // Auto-populate tenant/provider information
      onAgreementChange({
        ...agreementData,
        providerName: company.name || "",
        providerAddress: company.businessAddress || "",
        providerContact: company.primaryContactName || "",
        providerPhone: company.primaryContactPhone || "",
        providerEmail: company.primaryContactEmail || "",
        providerAbn: company.registrationNumber || "",
        // Auto-populate client information
        clientName: selectedClientDetails.fullName || `${selectedClientDetails.firstName} ${selectedClientDetails.lastName}`,
        clientAddress: selectedClientDetails.address || "",
        clientNdisNumber: selectedClientDetails.ndisNumber || "",
        clientEmergencyContact: selectedClientDetails.emergencyContactName || "",
        clientEmergencyPhone: selectedClientDetails.emergencyContactPhone || "",
      });
    }
  }, [selectedClientDetails, company, mode, agreementData.providerName]);

  // Auto-load default terms template
  useEffect(() => {
    if (mode === "create" && defaultTerms && !agreementData.customTerms) {
      onAgreementChange({
        ...agreementData,
        customTerms: defaultTerms.content || "",
      });
    }
  }, [defaultTerms, mode, agreementData.customTerms]);

  return (
    <div className="space-y-8">
      {/* Section A: Tenant + Client */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Service Provider & Participant Details
          </CardTitle>
          <CardDescription>
            Service provider information and participant details for this agreement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-loaded Tenant Information */}
          {mode === "create" && company && (
            <div className="grid gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-slate-600" />
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Service Provider (Auto-loaded)
                </Label>
                <Badge variant="secondary" className="text-xs">Read-only</Badge>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Business Name</Label>
                  <div className="text-sm font-medium">{company.name}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">ABN</Label>
                  <div className="text-sm font-medium">{company.registrationNumber}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Business Address</Label>
                  <div className="text-sm font-medium whitespace-pre-line">{company.businessAddress}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-slate-400" />
                    <span className="text-sm font-medium">{company.primaryContactName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-slate-400" />
                    <span className="text-sm">{company.primaryContactPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-slate-400" />
                    <span className="text-sm">{company.primaryContactEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Auto-loaded Client Information */}
          {mode === "create" && selectedClientDetails && (
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
                  <div className="text-sm font-medium">{selectedClientDetails.fullName || `${selectedClientDetails.firstName} ${selectedClientDetails.lastName}`}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">NDIS Number</Label>
                  <div className="text-sm font-medium">{selectedClientDetails.ndisNumber}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Address</Label>
                  <div className="text-sm font-medium">{selectedClientDetails.address || "Not specified"}</div>
                </div>
                <div className="space-y-2">
                  {selectedClientDetails.emergencyContactName && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-slate-400" />
                      <span className="text-sm font-medium">{selectedClientDetails.emergencyContactName}</span>
                    </div>
                  )}
                  {selectedClientDetails.emergencyContactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span className="text-sm">{selectedClientDetails.emergencyContactPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Client Selection */}
          <div>
            <Label htmlFor="clientId">Participant *</Label>
            <Select 
              value={agreementData.clientId?.toString() || ""} 
              onValueChange={(value) => handleFieldChange('clientId', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a participant" />
              </SelectTrigger>
              <SelectContent>
                {(clients || []).map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.firstName} {client.lastName} - {client.ndisNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Agreement Details */}
      <Card>
        <CardHeader>
          <CardTitle>Agreement Details</CardTitle>
          <CardDescription>Service period and agreement identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agreementNumber">Agreement Number</Label>
              <Input
                id="agreementNumber"
                value={agreementData.agreementNumber || ""}
                onChange={(e) => handleFieldChange("agreementNumber", e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={agreementData.startDate || ""}
                onChange={(e) => handleFieldChange("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={agreementData.endDate || ""}
                onChange={(e) => handleFieldChange("endDate", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Plan Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 dark:text-slate-100">Plan Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planNumber">Plan Number</Label>
                <Input
                  id="planNumber"
                  value={agreementData.plan?.planNumber || ""}
                  onChange={(e) => handleFieldChange("plan.planNumber", e.target.value)}
                  placeholder="Enter NDIS plan number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planManager">Plan Manager</Label>
                <Input
                  id="planManager"
                  value={agreementData.plan?.planManager || ""}
                  onChange={(e) => handleFieldChange("plan.planManager", e.target.value)}
                  placeholder="Plan manager name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planManagerContact">Plan Manager Contact</Label>
              <Input
                id="planManagerContact"
                value={agreementData.plan?.planManagerContact || ""}
                onChange={(e) => handleFieldChange("plan.planManagerContact", e.target.value)}
                placeholder="Plan manager contact details"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section C: Service Items */}
      <Card>
        <CardHeader>
          <CardTitle>Service Items</CardTitle>
          <CardDescription>NDIS support categories and hourly rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemsGrid items={items} onItemsChange={onItemsChange} />
        </CardContent>
      </Card>

      {/* Section D: Totals */}
      <TotalsBar items={items} />

      {/* Section E: Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions</CardTitle>
          <CardDescription>Standard and custom terms for this agreement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TermsViewer />
          
          <div className="space-y-2">
            <Label htmlFor="customTerms">Additional Terms</Label>
            <Textarea
              id="customTerms"
              rows={6}
              value={agreementData.customTerms || ""}
              onChange={(e) => handleFieldChange("customTerms", e.target.value)}
              placeholder="Add any additional terms specific to this agreement..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section F: Digital Signatures */}
      <SignPanel 
        isAccepted={isAccepted}
        onAcceptedChange={onAcceptedChange}
        agreementData={agreementData}
      />
    </div>
  );
}