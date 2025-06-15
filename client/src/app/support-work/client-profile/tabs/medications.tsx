import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "lucide-react";

interface MedicationsTabProps {
  clientId: string;
  companyId: string;
}

export default function MedicationsTab({ clientId, companyId }: MedicationsTabProps) {
  // Fetch medication plans for this client
  const { data: medicationPlans = [], isLoading } = useQuery({
    queryKey: ["/api/medication-plans", { clientId }],
    queryFn: () => fetch(`/api/medication-plans?clientId=${clientId}`).then(res => res.json()),
  });

  // Fetch medication records for this client
  const { data: medicationRecords = [] } = useQuery({
    queryKey: ["/api/medication-records", { clientId }],
    queryFn: () => fetch(`/api/medication-records?clientId=${clientId}`).then(res => res.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading medications...</p>
        </CardContent>
      </Card>
    );
  }

  if (medicationPlans.length === 0 && medicationRecords.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No medications found</h3>
          <p className="text-gray-600">
            No medication plans or administration records for this client yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {medicationPlans.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Medication Plans ({medicationPlans.length})</h3>
            <div className="space-y-3">
              {medicationPlans.map((plan: any) => (
                <div key={plan.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{plan.medicationName}</h4>
                      <p className="text-sm text-gray-600">{plan.dosage} - {plan.frequency}</p>
                      <p className="text-sm text-gray-500">Route: {plan.route}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      plan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {medicationRecords.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Recent Administration Records ({medicationRecords.length})</h3>
            <div className="space-y-3">
              {medicationRecords.slice(0, 10).map((record: any) => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{record.medicationName || 'Unknown Medication'}</p>
                      <p className="text-sm text-gray-600">
                        Scheduled: {new Date(record.scheduledTime).toLocaleString()}
                      </p>
                      {record.actualTime && (
                        <p className="text-sm text-gray-600">
                          Administered: {new Date(record.actualTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      record.result === 'administered' ? 'bg-green-100 text-green-800' :
                      record.result === 'refused' ? 'bg-red-100 text-red-800' :
                      record.result === 'missed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {record.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}