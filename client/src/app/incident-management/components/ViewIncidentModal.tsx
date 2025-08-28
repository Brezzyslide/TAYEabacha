import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Clock, User, MapPin, Phone, FileText, Target, Zap, Users, CheckCircle, ExternalLink, Download } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Safe date formatting helper
const formatSafeDate = (dateString: string | null | undefined, formatStr: string = "PPP 'at' p"): string => {
  if (!dateString) return "Invalid date";
  
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return "Invalid date";
    return format(date, formatStr);
  } catch (error) {
    console.warn("Date formatting error:", error, "for date:", dateString);
    return "Invalid date";
  }
};

interface IncidentReport {
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
  clientName?: string;
  reporterName?: string;
  closure?: {
    id: number;
    closureDate: string;
    findings: string;
    rootCause?: string;
    recommendations: string;
    outcomes: string[];
    controls: string[];
    externalReporting: any[];
    externalReference?: string;
    followUpDate?: string;
    status: string;
    createdAt: string;
  };
}

interface ViewIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentReport;
}

export function ViewIncidentModal({ open, onOpenChange, incident }: ViewIncidentModalProps) {
  const { toast } = useToast();

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/incident-reports/${incident.incidentId}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `incident-report-${incident.incidentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Generated",
        description: "Incident report exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not generate PDF",
        variant: "destructive",
      });
    }
  };

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Incident Report: {incident.incidentId}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(incident.status)}
              {incident.isNDISReportable && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  NDIS Reportable
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
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
                  <p className="font-medium">{incident.clientName || "Unknown client"}</p>
                  <p className="text-sm text-muted-foreground">ID: Unknown</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Reporting Staff
                  </div>
                  <p className="font-medium">{incident.reporterName || "Unknown staff"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Date & Time
                  </div>
                  <p className="font-medium">{formatSafeDate(incident.dateTime)}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Location
                  </div>
                  <p className="font-medium">{incident.location}</p>
                </div>

                {incident.witnessName && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Witness
                    </div>
                    <p className="font-medium">{incident.witnessName}</p>
                    {incident.witnessPhone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {incident.witnessPhone}
                      </div>
                    )}
                  </div>
                )}

                {incident.externalRef && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ExternalLink className="h-4 w-4" />
                      External Reference
                    </div>
                    <p className="font-medium">{incident.externalRef}</p>
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
                    {incident.types.map((type, index) => (
                      <Badge key={index} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Intensity Rating</h4>
                  {getIntensityBadge(incident.intensityRating)}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{incident.description}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Triggers */}
          {incident.triggers && incident.triggers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Triggers/Contributing Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incident.triggers.map((trigger, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="space-y-2">
                        <Badge variant="outline">{trigger.label}</Badge>
                        {trigger.notes && (
                          <div className="bg-muted/30 p-2 rounded text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Notes:</p>
                            <p className="whitespace-pre-wrap">{trigger.notes}</p>
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
          {incident.staffResponses && incident.staffResponses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Staff Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incident.staffResponses.map((response, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="space-y-2">
                        <Badge variant="outline">{response.label}</Badge>
                        {response.notes && (
                          <div className="bg-muted/30 p-2 rounded text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Notes:</p>
                            <p className="whitespace-pre-wrap">{response.notes}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Closure Date</p>
                    <p className="font-medium">{formatSafeDate(incident.closure.closureDate)}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="outline">{incident.closure.status}</Badge>
                  </div>

                  {incident.closure.followUpDate && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Follow-up Date</p>
                      <p className="font-medium">{formatSafeDate(incident.closure.followUpDate, "PPP")}</p>
                    </div>
                  )}

                  {incident.closure.externalReference && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">External Reference</p>
                      <Badge variant="outline">{incident.closure.externalReference}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Findings */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-lg">Investigation Findings</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="whitespace-pre-wrap">{incident.closure.findings}</p>
                    </div>
                  </div>

                  {/* Root Cause */}
                  {incident.closure.rootCause && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-lg">Root Cause Analysis</h4>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="whitespace-pre-wrap">{incident.closure.rootCause}</p>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-lg">Recommendations</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="whitespace-pre-wrap">{incident.closure.recommendations}</p>
                    </div>
                  </div>

                  {/* Outcome Actions */}
                  {incident.closure.outcomes && incident.closure.outcomes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-lg">Outcome Actions</h4>
                      <div className="flex flex-wrap gap-2">
                        {incident.closure.outcomes.map((outcome, index) => (
                          <Badge key={index} variant="default">{outcome}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Controls Achieved */}
                  {incident.closure.controls && incident.closure.controls.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-lg">Controls Achieved</h4>
                      <div className="flex flex-wrap gap-2">
                        {incident.closure.controls.map((control, index) => (
                          <Badge key={index} variant="secondary">{control}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External Reporting */}
                  {incident.closure.externalReporting && incident.closure.externalReporting.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-lg">External Reporting</h4>
                      <div className="space-y-2">
                        {incident.closure.externalReporting.map((report: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="mt-0.5">{report.agency || 'External Agency'}</Badge>
                              {report.details && (
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground">{report.details}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                      {formatSafeDate(incident.dateTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pb-2 border-b">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="font-medium">Report Created</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSafeDate(incident.createdAt)}
                    </p>
                  </div>
                </div>

                {incident.updatedAt !== incident.createdAt && (
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="font-medium">Report Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSafeDate(incident.updatedAt)}
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
                        {formatSafeDate(incident.closure.closureDate)}
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