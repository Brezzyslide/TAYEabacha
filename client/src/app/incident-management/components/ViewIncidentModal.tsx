import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Clock, User, MapPin, Phone, FileText, Target, Zap, Users, CheckCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface IncidentReport {
  report: {
    id: number;
    incidentId: string;
    dateTime: string;
    location: string;
    witnessName?: string;
    witnessPhone?: string;
    types: string[];
    isNDISReportable: boolean;
    triggers: Array<{ label: string; notes?: string }>;
    intensityRating: number;
    staffResponses: Array<{ label: string; notes?: string }>;
    description: string;
    externalRef?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  closure?: {
    id: number;
    closureDate: string;
    controlReview: boolean;
    improvements?: string;
    implemented: boolean;
    controlLevel: string;
    wasLTI: string;
    hazard: string;
    severity: string;
    externalNotice: boolean;
    participantContext: string;
    supportPlanAvailable: string;
    reviewType: string;
    outcome?: string;
    attachments: any[];
    createdAt: string;
  };
  client: {
    id: number;
    firstName: string;
    lastName: string;
    clientId: string;
  };
  staff: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

interface ViewIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentReport;
}

export function ViewIncidentModal({ open, onOpenChange, incident }: ViewIncidentModalProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Open</Badge>;
      case "Closed":
        return <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getIntensityBadge = (rating: number) => {
    if (rating >= 8) return <Badge variant="destructive">High ({rating}/10)</Badge>;
    if (rating >= 5) return <Badge variant="destructive" className="bg-orange-500">Medium ({rating}/10)</Badge>;
    return <Badge variant="secondary">Low ({rating}/10)</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "High":
        return <Badge variant="destructive" className="bg-orange-600">High</Badge>;
      case "Medium":
        return <Badge variant="secondary" className="bg-yellow-500">Medium</Badge>;
      case "Low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getControlLevelColor = (level: string) => {
    switch (level) {
      case "Elimination": return "bg-green-100 text-green-800 border-green-200";
      case "Engineering": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Behavioural": return "bg-purple-100 text-purple-800 border-purple-200";
      case "Admin": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "PPE": return "bg-orange-100 text-orange-800 border-orange-200";
      case "None": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Incident Report: {incident.report.incidentId}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(incident.report.status)}
              {incident.report.isNDISReportable && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  NDIS Reportable
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Client
                  </div>
                  <p className="font-medium">{incident.client.firstName} {incident.client.lastName}</p>
                  <p className="text-sm text-muted-foreground">ID: {incident.client.clientId}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Reporting Staff
                  </div>
                  <p className="font-medium">{incident.staff.firstName} {incident.staff.lastName}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Date & Time
                  </div>
                  <p className="font-medium">{format(new Date(incident.report.dateTime), "PPP 'at' p")}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Location
                  </div>
                  <p className="font-medium">{incident.report.location}</p>
                </div>

                {incident.report.witnessName && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Witness
                    </div>
                    <p className="font-medium">{incident.report.witnessName}</p>
                    {incident.report.witnessPhone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {incident.report.witnessPhone}
                      </div>
                    )}
                  </div>
                )}

                {incident.report.externalRef && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ExternalLink className="h-4 w-4" />
                      External Reference
                    </div>
                    <p className="font-medium">{incident.report.externalRef}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Incident Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incident Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Incident Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {incident.report.types.map((type, index) => (
                      <Badge key={index} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Intensity Rating</h4>
                  {getIntensityBadge(incident.report.intensityRating)}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{incident.report.description}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Triggers */}
          {incident.report.triggers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Triggers/Contributing Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incident.report.triggers.map((trigger, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">{trigger.label}</Badge>
                        {trigger.notes && (
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">{trigger.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staff Responses */}
          {incident.report.staffResponses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Staff Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incident.report.staffResponses.map((response, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">{response.label}</Badge>
                        {response.notes && (
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">{response.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closure Information */}
          {incident.closure && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Closure Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Closure Date</p>
                    <p className="font-medium">{format(new Date(incident.closure.closureDate), "PPP")}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Severity Level</p>
                    {getSeverityBadge(incident.closure.severity)}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Hazard Type</p>
                    <Badge variant="outline">{incident.closure.hazard}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Control Level</p>
                    <Badge variant="outline" className={getControlLevelColor(incident.closure.controlLevel)}>
                      {incident.closure.controlLevel}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Review Type</p>
                    <Badge variant="outline">{incident.closure.reviewType}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Lost Time Injury</p>
                    <Badge variant={incident.closure.wasLTI === "yes" ? "destructive" : "secondary"}>
                      {incident.closure.wasLTI.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">External Notice</p>
                    <Badge variant={incident.closure.externalNotice ? "destructive" : "secondary"}>
                      {incident.closure.externalNotice ? "Yes" : "No"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Participant Context</p>
                    <Badge variant="outline">{incident.closure.participantContext.toUpperCase()}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Support Plan Available</p>
                    <Badge variant="outline">{incident.closure.supportPlanAvailable.toUpperCase()}</Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Control Review</p>
                    <Badge variant={incident.closure.controlReview ? "default" : "secondary"}>
                      {incident.closure.controlReview ? "Yes" : "No"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Improvements Implemented</p>
                    <Badge variant={incident.closure.implemented ? "default" : "secondary"}>
                      {incident.closure.implemented ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>

                {incident.closure.improvements && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Improvements/Actions</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="whitespace-pre-wrap">{incident.closure.improvements}</p>
                    </div>
                  </div>
                )}

                {incident.closure.outcome && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Outcome</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="whitespace-pre-wrap">{incident.closure.outcome}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="font-medium">Incident Occurred</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(incident.report.dateTime), "PPP 'at' p")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pb-2 border-b">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="font-medium">Report Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(incident.report.createdAt), "PPP 'at' p")}
                    </p>
                  </div>
                </div>

                {incident.report.updatedAt !== incident.report.createdAt && (
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="font-medium">Report Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(incident.report.updatedAt), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}

                {incident.closure && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="font-medium">Incident Closed</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(incident.closure.closureDate), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}