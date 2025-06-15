import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, Plus, Clock, User, Calendar } from "lucide-react";
import { useState } from "react";
import RecordAdministrationModal from "@/app/medications/components/RecordAdministrationModal";

interface EnhancedMedicationsTabProps {
  clientId: string;
  companyId: string;
}

interface MedicationPlan {
  id: number;
  clientId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  timeOfDay?: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  instructions?: string;
  sideEffects: string[];
  status: string;
  createdBy: number;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
}

export default function EnhancedMedicationsTab({ clientId, companyId }: EnhancedMedicationsTabProps) {
  const [selectedPlan, setSelectedPlan] = useState<MedicationPlan | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  const { data: medicationPlans = [], isLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'medication-plans'],
    queryFn: () => fetch(`/api/clients/${clientId}/medication-plans`).then(res => res.json())
  });

  const handleRecordAdministration = (plan: MedicationPlan) => {
    setSelectedPlan(plan);
    setShowRecordModal(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (medicationPlans.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Medication Plans</h3>
          <p className="text-gray-600">No medication plans found for this client.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {medicationPlans.map((plan: MedicationPlan) => (
        <Card key={plan.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                {plan.medicationName}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                  {plan.status}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => handleRecordAdministration(plan)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Record
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-gray-700">Dosage</p>
                <p className="text-gray-900">{plan.dosage}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-700">Frequency</p>
                <p className="text-gray-900">{plan.frequency}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-700">Route</p>
                <p className="text-gray-900">{plan.route}</p>
              </div>
              {plan.timeOfDay && (
                <div className="space-y-1">
                  <p className="font-medium text-gray-700 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Time of Day
                  </p>
                  <p className="text-gray-900">{plan.timeOfDay}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-gray-700 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Prescribed By
                </p>
                <p className="text-gray-900">{plan.prescribedBy}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Duration
                </p>
                <p className="text-gray-900">
                  {new Date(plan.startDate).toLocaleDateString()}
                  {plan.endDate && ` - ${new Date(plan.endDate).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            {plan.instructions && (
              <div className="space-y-1">
                <p className="font-medium text-gray-700">Instructions</p>
                <p className="text-gray-900 text-sm bg-gray-50 p-3 rounded-md">
                  {plan.instructions}
                </p>
              </div>
            )}

            {plan.sideEffects && plan.sideEffects.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-gray-700">Side Effects</p>
                <div className="flex flex-wrap gap-1">
                  {plan.sideEffects.map((effect, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {effect}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {selectedPlan && (
        <RecordAdministrationModal
          isOpen={showRecordModal}
          onClose={() => {
            setShowRecordModal(false);
            setSelectedPlan(null);
          }}
          medicationPlan={selectedPlan}
        />
      )}
    </div>
  );
}