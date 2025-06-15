import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, User, Eye } from "lucide-react";

interface ObservationsTabProps {
  clientId: string;
  companyId: string;
}

export default function ObservationsTab({ clientId, companyId }: ObservationsTabProps) {
  // Handle missing clientId
  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client ID Missing</h3>
          <p className="text-gray-600">Client ID is missing from URL.</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch hourly observations for this client
  const { data: observations = [], isLoading, error } = useQuery({
    queryKey: ["/api/hourly-observations", { clientId }],
    queryFn: () => fetch(`/api/hourly-observations?clientId=${clientId}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch observations');
      return res.json();
    }),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading observations...</p>
        </CardContent>
      </Card>
    );
  }

  if (observations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No observations recorded</h3>
          <p className="text-gray-600">
            No hourly observation records for this client yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium mb-4">Hourly Observations ({observations.length})</h3>
          <div className="space-y-4">
            {observations.map((observation: any) => (
              <div key={observation.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {new Date(observation.observationTime).toLocaleString()}
                      </span>
                    </div>
                    {observation.observedBy && (
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          Observed by: {observation.observedBy}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                    Observation
                  </span>
                </div>

                {observation.mood && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Mood: </span>
                    <span className={`px-2 py-1 rounded text-xs ml-1 ${
                      observation.mood === 'happy' ? 'bg-green-100 text-green-800' :
                      observation.mood === 'sad' ? 'bg-red-100 text-red-800' :
                      observation.mood === 'anxious' ? 'bg-yellow-100 text-yellow-800' :
                      observation.mood === 'calm' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {observation.mood}
                    </span>
                  </div>
                )}

                {observation.behavior && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Behavior: </span>
                    <span className="text-sm text-gray-600">{observation.behavior}</span>
                  </div>
                )}

                {observation.activities && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-700">Activities: </span>
                    <span className="text-sm text-gray-600">{observation.activities}</span>
                  </div>
                )}

                {observation.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-sm font-medium text-gray-700">Notes: </span>
                    <p className="text-sm text-gray-600 mt-1">{observation.notes}</p>
                  </div>
                )}

                {observation.concernsRaised && (
                  <div className="mt-3 pt-3 border-t bg-yellow-50 p-3 rounded">
                    <span className="text-sm font-medium text-yellow-800">Concerns Raised: </span>
                    <p className="text-sm text-yellow-700 mt-1">{observation.concernsRaised}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}