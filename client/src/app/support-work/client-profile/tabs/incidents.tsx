import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface IncidentsTabProps {
  clientId: string;
  companyId: string;
}

export default function IncidentsTab({ clientId, companyId }: IncidentsTabProps) {
  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch incident reports for this client
  const { data: incidents = [], isLoading, error } = useQuery({
    queryKey: ["/api/incident-reports", { clientId }],
    queryFn: () => fetch(`/api/incident-reports?clientId=${clientId}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch incidents');
      return res.json();
    }),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading incidents...</p>
        </CardContent>
      </Card>
    );
  }

  if (incidents.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No incidents found</h3>
          <p className="text-gray-600">
            No incident reports for this client yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium mb-4">Incident Reports ({incidents.length})</h3>
          <div className="space-y-4">
            {incidents.map((incident: any) => (
              <div key={incident.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{incident.title}</h4>
                    <p className="text-sm text-gray-600">
                      {new Date(incident.incidentDate).toLocaleDateString()} at {new Date(incident.incidentDate).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      incident.severity === 'high' ? 'bg-red-100 text-red-800' :
                      incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {incident.severity} severity
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      incident.status === 'closed' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-2">{incident.description}</p>
                {incident.immediateActions && (
                  <div className="text-sm">
                    <span className="font-medium">Immediate Actions: </span>
                    <span className="text-gray-700">{incident.immediateActions}</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  Reported by: {incident.reportedBy || 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}