import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, User, Eye, ZoomIn } from "lucide-react";
import { useState } from "react";

interface ObservationsTabProps {
  clientId: string;
  companyId: string;
}

export default function ObservationsTab({ clientId, companyId }: ObservationsTabProps) {
  const [selectedObservation, setSelectedObservation] = useState<any>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

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

  const handleQuickView = (observation: any) => {
    setSelectedObservation(observation);
    setIsQuickViewOpen(true);
  };

  // Fetch hourly observations for this client
  const { data: observations = [], isLoading, error } = useQuery({
    queryKey: ["/api/observations", { clientId }],
    queryFn: () => fetch(`/api/observations?clientId=${clientId}`).then(res => {
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
                        {new Date(observation.timestamp).toLocaleString()}
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
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickView(observation)}
                      className="h-8 px-2"
                    >
                      <ZoomIn className="h-3 w-3 mr-1" />
                      Quick View
                    </Button>
                    <span className={`px-2 py-1 rounded text-xs ${
                      observation.observationType === 'behaviour' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {observation.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
                    </span>
                  </div>
                </div>

                {/* ADL Observation Display */}
                {observation.observationType === 'adl' && (
                  <>
                    {observation.subtype && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">Activity: </span>
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 ml-1">
                          {observation.subtype}
                        </span>
                      </div>
                    )}
                    {observation.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-sm font-medium text-gray-700">Notes: </span>
                        <p className="text-sm text-gray-600 mt-1">{observation.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Behaviour Observation Display (Star Chart) */}
                {observation.observationType === 'behaviour' && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">Star Chart Assessment:</div>
                    
                    {observation.settings && (
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-700">Settings:</span>
                          <div className="flex items-center space-x-1">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={`text-sm ${
                                star <= (observation.settingsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                              }`}>★</span>
                            ))}
                            <span className="text-xs text-gray-500 ml-1">({observation.settingsRating}/5)</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{observation.settings}</p>
                      </div>
                    )}

                    {observation.time && (
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-700">Time:</span>
                          <div className="flex items-center space-x-1">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={`text-sm ${
                                star <= (observation.timeRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                              }`}>★</span>
                            ))}
                            <span className="text-xs text-gray-500 ml-1">({observation.timeRating}/5)</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{observation.time}</p>
                      </div>
                    )}

                    {observation.antecedents && (
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-700">Antecedents:</span>
                          <div className="flex items-center space-x-1">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={`text-sm ${
                                star <= (observation.antecedentsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                              }`}>★</span>
                            ))}
                            <span className="text-xs text-gray-500 ml-1">({observation.antecedentsRating}/5)</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{observation.antecedents}</p>
                      </div>
                    )}

                    {observation.response && (
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-700">Response:</span>
                          <div className="flex items-center space-x-1">
                            {[1,2,3,4,5].map(star => (
                              <span key={star} className={`text-sm ${
                                star <= (observation.responseRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                              }`}>★</span>
                            ))}
                            <span className="text-xs text-gray-500 ml-1">({observation.responseRating}/5)</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{observation.response}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick View Modal */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Observation Details - {selectedObservation?.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedObservation && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Date & Time:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(selectedObservation.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Type:</span>
                  <p className="text-sm text-gray-900 mt-1">
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedObservation.observationType === 'behaviour' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedObservation.observationType === 'behaviour' ? 'Behaviour' : 'ADL'}
                    </span>
                  </p>
                </div>
              </div>

              {/* ADL Observation Details */}
              {selectedObservation.observationType === 'adl' && (
                <div className="space-y-4">
                  {selectedObservation.subtype && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Activity Type:</span>
                      <p className="text-sm text-gray-900 mt-1 p-3 bg-green-50 rounded">
                        {selectedObservation.subtype}
                      </p>
                    </div>
                  )}
                  {selectedObservation.notes && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Notes:</span>
                      <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">
                        {selectedObservation.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Behaviour Observation Details (Star Chart) */}
              {selectedObservation.observationType === 'behaviour' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Star Chart Assessment</h4>
                  
                  {selectedObservation.settings && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Settings</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.settingsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.settingsRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.settings}</p>
                    </div>
                  )}

                  {selectedObservation.time && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Time</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.timeRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.timeRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.time}</p>
                    </div>
                  )}

                  {selectedObservation.antecedents && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Antecedents</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.antecedentsRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.antecedentsRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.antecedents}</p>
                    </div>
                  )}

                  {selectedObservation.response && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-gray-700">Response</span>
                        <div className="flex items-center space-x-1">
                          {[1,2,3,4,5].map(star => (
                            <span key={star} className={`text-lg ${
                              star <= (selectedObservation.responseRating || 0) ? 'text-yellow-500' : 'text-gray-300'
                            }`}>★</span>
                          ))}
                          <span className="text-sm text-gray-500 ml-2">({selectedObservation.responseRating}/5)</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedObservation.response}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}