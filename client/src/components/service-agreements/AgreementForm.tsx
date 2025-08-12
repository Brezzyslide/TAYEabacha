import { useQuery } from "@tanstack/react-query";
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

  const selectedClient = clients?.find((c: any) => c.id === agreementData.clientId);

  return (
    <div className="space-y-8">
      {/* Section A: Tenant + Client */}
      <Card>
        <CardHeader>
          <CardTitle>Agreement Parties</CardTitle>
          <CardDescription>Service provider and client information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tenant Info (Read-only) */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Service Provider
              </Label>
              <p className="font-medium">{tenant?.companyName || "Loading..."}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {tenant?.address}, {tenant?.city} {tenant?.postcode}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Contact Details
              </Label>
              <p className="text-sm">{tenant?.contactEmail}</p>
              <p className="text-sm">{tenant?.contactPhone}</p>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="clientId">NDIS Participant *</Label>
            <Select
              value={agreementData.clientId?.toString() || ""}
              onValueChange={(value) => handleFieldChange("clientId", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.firstName} {client.lastName} - {client.clientId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClient && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Selected Participant
              </Label>
              <p className="font-medium">
                {selectedClient.firstName} {selectedClient.lastName}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Client ID: {selectedClient.clientId}
              </p>
              {selectedClient.address && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedClient.address}
                </p>
              )}
            </div>
          )}
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
        </CardContent>
      </Card>

      {/* Section C: Service Items */}
      <Card>
        <CardHeader>
          <CardTitle>Service Items</CardTitle>
          <CardDescription>NDIS support items and pricing details</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemsGrid items={items} onItemsChange={onItemsChange} />
        </CardContent>
      </Card>

      {/* Totals Bar */}
      <TotalsBar items={items} />

      {/* Section D: Billing Details */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & NDIS Details</CardTitle>
          <CardDescription>Participant and plan management information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="participantNumber">NDIS Participant Number</Label>
              <Input
                id="participantNumber"
                value={agreementData.billingDetails?.participantNumber || ""}
                onChange={(e) => handleFieldChange("billingDetails.participantNumber", e.target.value)}
                placeholder="Enter NDIS participant number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planNumber">Plan Number</Label>
              <Input
                id="planNumber"
                value={agreementData.billingDetails?.planNumber || ""}
                onChange={(e) => handleFieldChange("billingDetails.planNumber", e.target.value)}
                placeholder="Enter plan number"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planManager">Plan Manager</Label>
              <Input
                id="planManager"
                value={agreementData.billingDetails?.planManager || ""}
                onChange={(e) => handleFieldChange("billingDetails.planManager", e.target.value)}
                placeholder="Plan manager name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planManagerContact">Plan Manager Contact</Label>
              <Input
                id="planManagerContact"
                value={agreementData.billingDetails?.planManagerContact || ""}
                onChange={(e) => handleFieldChange("billingDetails.planManagerContact", e.target.value)}
                placeholder="Email or phone"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section E: Plan Nominee */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Nominee Details</CardTitle>
          <CardDescription>Authorized representative information (if applicable)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planNomineeName">Plan Nominee Name</Label>
              <Input
                id="planNomineeName"
                value={agreementData.planNomineeName || ""}
                onChange={(e) => handleFieldChange("planNomineeName", e.target.value)}
                placeholder="Full name of nominee"
              />
            </div>
            <div className="space-y-2">
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

      {/* Section F: Terms & Conditions */}
      <TermsViewer
        customTerms={agreementData.customTerms || ""}
        onCustomTermsChange={(terms) => handleFieldChange("customTerms", terms)}
        isAccepted={isAccepted}
        onAcceptedChange={onAcceptedChange}
      />

      {/* Signature Panel */}
      <SignPanel 
        agreement={agreementData}
        mode={mode}
      />
    </div>
  );
}