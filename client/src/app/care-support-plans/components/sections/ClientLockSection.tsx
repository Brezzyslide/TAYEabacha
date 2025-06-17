import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, User, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

interface ClientLockSectionProps {
  data: any;
  updateData?: (section: string, data: any) => void;
  onChange?: (data: any) => void;
  clients: any[];
  planData?: any;
}

export function ClientLockSection({ data, updateData, onChange, clients, planData }: ClientLockSectionProps) {
  const [planTitle, setPlanTitle] = useState(data.planTitle || planData?.planTitle || '');

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === parseInt(clientId));
    
    if (updateData) {
      updateData('clientId', parseInt(clientId));
      updateData('clientData', selectedClient);
      
      // Auto-generate plan title if not already set
      if (!planTitle && selectedClient) {
        const newTitle = `Care Support Plan - ${selectedClient.fullName}`;
        setPlanTitle(newTitle);
        updateData('planTitle', newTitle);
      }
    } else if (onChange) {
      const newTitle = !planTitle && selectedClient ? `Care Support Plan - ${selectedClient.fullName}` : planTitle;
      setPlanTitle(newTitle);
      
      // Update the wizard's main data instead of just section data
      onChange({
        clientId: parseInt(clientId),
        clientData: selectedClient,
        planTitle: newTitle
      });
    }
  };

  const handleTitleChange = (value: string) => {
    setPlanTitle(value);
    if (updateData) {
      updateData('planTitle', value);
    } else if (onChange) {
      onChange({
        ...data,
        planTitle: value
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan Title */}
      <div>
        <Label htmlFor="planTitle">Plan Title *</Label>
        <Input
          id="planTitle"
          value={planTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Enter care support plan title"
          className="mt-1"
        />
      </div>

      {/* Client Selection */}
      <div>
        <Label htmlFor="client">Select Client *</Label>
        <Select 
          value={data.clientId?.toString() || ""} 
          onValueChange={handleClientSelect}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choose a client to create plan for..." />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{client.fullName}</span>
                  {client.ndisNumber && (
                    <Badge variant="secondary" className="text-xs">
                      {client.ndisNumber}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Locked Client Information */}
      {data.clientData && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lock className="h-5 w-5" />
              Client Information (Locked)
            </CardTitle>
            <CardDescription>
              This information is locked and will be used throughout the care plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.clientData.fullName}</span>
                </div>
              </div>

              {data.clientData.ndisNumber && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">NDIS Number</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{data.clientData.ndisNumber}</span>
                  </div>
                </div>
              )}

              {data.clientData.dateOfBirth && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Date of Birth</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(data.clientData.dateOfBirth), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
              )}

              {data.clientData.primaryDiagnosis && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Primary Diagnosis</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className="font-medium">
                      {data.clientData.primaryDiagnosis}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {data.clientData.address && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="mt-1 text-sm">{data.clientData.address}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This client information will be automatically included in all AI-generated content 
                to ensure personalized and relevant care planning recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!data.clientData && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Select a Client</h3>
            <p className="text-muted-foreground max-w-md">
              Choose a client from the dropdown above to begin creating their personalized care support plan. 
              Once selected, their information will be locked and used throughout the planning process.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}