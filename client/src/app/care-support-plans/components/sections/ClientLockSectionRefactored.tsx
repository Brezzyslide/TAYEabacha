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
    <div className="space-y-8">
      {/* Client Selection Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">Client Selection</h4>
            <p className="text-sm text-muted-foreground">
              Select the client for this care support plan. Once selected, the client cannot be changed.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="clientSelect" className="text-base font-medium">Select Client</Label>
          <Select
            value={planData.clientId?.toString() || ""}
            onValueChange={handleClientSelect}
            disabled={!!selectedClient}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Choose a client..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client: any) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{client.fullName}</span>
                      {client.primaryDiagnosis && (
                        <span className="text-xs text-muted-foreground">{client.primaryDiagnosis}</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClient && (
          <div className="bg-green-50 dark:bg-green-950 p-6 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h5 className="font-semibold text-green-800 dark:text-green-200">Client Locked</h5>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Client information is now secured for this plan
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">Name:</span>
                  <span className="text-sm text-green-700 dark:text-green-300">{selectedClient.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">Client ID:</span>
                  <span className="text-sm text-green-700 dark:text-green-300">{selectedClient.clientId}</span>
                </div>
                {selectedClient.dateOfBirth && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">Date of Birth:</span>
                    <span className="text-sm text-green-700 dark:text-green-300">
                      {format(new Date(selectedClient.dateOfBirth), 'dd/MM/yyyy')}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {selectedClient.primaryDiagnosis && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">Primary Diagnosis:</span>
                    <span className="text-sm text-green-700 dark:text-green-300">{selectedClient.primaryDiagnosis}</span>
                  </div>
                )}
                {selectedClient.ndisNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">NDIS Number:</span>
                    <span className="text-sm text-green-700 dark:text-green-300">{selectedClient.ndisNumber}</span>
                  </div>
                )}
                {selectedClient.supportCoordinator && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">Support Coordinator:</span>
                    <span className="text-sm text-green-700 dark:text-green-300">{selectedClient.supportCoordinator}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan Information Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">Plan Information</h4>
            <p className="text-sm text-muted-foreground">
              Configure the basic details for this care support plan
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="planTitle" className="text-base font-medium">Plan Title</Label>
            <Input
              id="planTitle"
              value={planData.planTitle || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter a descriptive title for this care support plan"
              disabled={!selectedClient}
              className="h-12"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Plan Status</Label>
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Badge variant="outline" className="px-3 py-1">
                {planData.status || 'Draft'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Plan will be saved as draft until completed
              </span>
            </div>
          </div>
        </div>
      </div>

      {!selectedClient && (
        <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h5 className="font-semibold text-blue-800 dark:text-blue-200">Getting Started</h5>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Select a client to begin creating their care support plan. The plan will be automatically saved as you work.
          </p>
        </div>
      )}
    </div>
  );
}