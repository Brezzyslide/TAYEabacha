import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function Export() {
  const [exportingType, setExportingType] = useState<string | null>(null);
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async (type: string) => {
      setExportingType(type);
      
      let endpoint = "";
      let filename = "";
      
      switch (type) {
        case "clients":
          endpoint = "/api/export/clients";
          filename = "clients.csv";
          break;
        default:
          throw new Error("Unsupported export type");
      }
      
      const response = await fetch(endpoint, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { type, filename };
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: `${data.filename} has been downloaded`,
      });
      setExportingType(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
      setExportingType(null);
    },
  });

  const exportOptions = [
    {
      id: "clients",
      title: "Client Data",
      description: "Export all client information including contact details, care levels, and emergency contacts",
      icon: Users,
      available: true,
      fields: [
        "ID", "Full Name", "Date of Birth", "Phone", "Email", "Care Level", "Emergency Contact", "Created Date"
      ]
    },
    {
      id: "shifts",
      title: "Shift Records",
      description: "Export staff shift logging data with location verification details",
      icon: Calendar,
      available: false,
      fields: [
        "Staff Name", "Start Time", "End Time", "Duration", "Location", "Building", "Floor", "GPS Coordinates"
      ]
    },
    {
      id: "forms",
      title: "Form Submissions",
      description: "Export all form submission data and responses",
      icon: FileText,
      available: false,
      fields: [
        "Form Template", "Client", "Submitted By", "Submission Date", "Status", "Form Data"
      ]
    },
    {
      id: "activity",
      title: "Activity Logs",
      description: "Export system activity and audit trail data",
      icon: Download,
      available: false,
      fields: [
        "User", "Action", "Resource Type", "Resource ID", "Description", "Timestamp", "Metadata"
      ]
    },
  ];

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Data Export</h1>
              <p className="text-gray-600 mt-1">Download your data in CSV format for external analysis and reporting</p>
            </div>

            {/* Export Options */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {exportOptions.map((option) => {
                const IconComponent = option.icon;
                const isExporting = exportingType === option.id;
                
                return (
                  <Card key={option.id} className={`${!option.available ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            option.available 
                              ? 'bg-primary/10 text-primary' 
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{option.title}</CardTitle>
                            {!option.available && (
                              <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => exportMutation.mutate(option.id)}
                          disabled={!option.available || isExporting}
                          size="sm"
                        >
                          {isExporting ? (
                            <>
                              <Download className="h-4 w-4 mr-2 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Export CSV
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">{option.description}</p>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Included Fields:</p>
                        <div className="flex flex-wrap gap-1">
                          {option.fields.map((field, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Export Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>Export Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Privacy</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Exported data contains sensitive information</li>
                      <li>• Ensure secure handling and storage</li>
                      <li>• Follow your organization's data policies</li>
                      <li>• Delete exports when no longer needed</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">File Format</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• CSV format compatible with Excel and Google Sheets</li>
                      <li>• UTF-8 encoding for special characters</li>
                      <li>• Headers included in first row</li>
                      <li>• Dates in ISO format (YYYY-MM-DD)</li>
                    </ul>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Badge variant="outline">✓ Tenant-specific data only</Badge>
                    <Badge variant="outline">✓ Activity logged for compliance</Badge>
                    <Badge variant="outline">✓ Real-time data snapshot</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Exports */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Exports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Download className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent exports to display.</p>
                  <p className="text-sm">Export activity will appear here once you start downloading data.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
