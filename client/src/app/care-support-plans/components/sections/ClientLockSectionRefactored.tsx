import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, User, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { useCarePlan } from "../../contexts/CarePlanContext";

export function ClientLockSectionRefactored() {
  const { planData, updateBasicInfo, updateField } = useCarePlan();
  
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === parseInt(clientId));
    
    // Update client ID and data
    updateBasicInfo('clientId', parseInt(clientId));
    updateBasicInfo('clientData', selectedClient);
    
    // Auto-generate plan title if not already set
    if (!planData.planTitle && selectedClient) {
      const newTitle = `Care Support Plan - ${selectedClient.fullName}`;
      updateBasicInfo('planTitle', newTitle);
    }
  };

  const handleTitleChange = (value: string) => {
    updateBasicInfo('planTitle', value);
  };

  const selectedClient = planData.clientData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Client Selection
          </CardTitle>
          <CardDescription>
            Select the client for this care support plan. Once selected, the client cannot be changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientSelect">Select Client</Label>
            <Select
              value={planData.clientId?.toString() || ""}
              onValueChange={handleClientSelect}
              disabled={!!selectedClient}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{client.fullName}</span>
                      {client.primaryDiagnosis && (
                        <Badge variant="secondary" className="text-xs">
                          {client.primaryDiagnosis}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClient && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  Client Locked
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Name:</strong> {selectedClient.fullName}</p>
                  <p><strong>Client ID:</strong> {selectedClient.clientId}</p>
                  {selectedClient.dateOfBirth && (
                    <p><strong>Date of Birth:</strong> {format(new Date(selectedClient.dateOfBirth), 'dd/MM/yyyy')}</p>
                  )}
                </div>
                <div>
                  {selectedClient.primaryDiagnosis && (
                    <p><strong>Primary Diagnosis:</strong> {selectedClient.primaryDiagnosis}</p>
                  )}
                  {selectedClient.ndisNumber && (
                    <p><strong>NDIS Number:</strong> {selectedClient.ndisNumber}</p>
                  )}
                  {selectedClient.supportCoordinator && (
                    <p><strong>Support Coordinator:</strong> {selectedClient.supportCoordinator}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Plan Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planTitle">Plan Title</Label>
            <Input
              id="planTitle"
              value={planData.planTitle || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter a descriptive title for this care support plan"
              disabled={!selectedClient}
            />
          </div>

          <div className="space-y-2">
            <Label>Plan Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {planData.status || 'Draft'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Plan will be saved as draft until completed
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClient && (
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-800 dark:text-blue-200">
              Getting Started
            </span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Select a client to begin creating their care support plan. The plan will be automatically saved as you work.
          </p>
        </div>
      )}
    </div>
  );
}