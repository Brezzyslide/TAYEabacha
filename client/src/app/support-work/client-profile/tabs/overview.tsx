import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { User, Phone, MapPin, AlertTriangle, Heart } from "lucide-react";
import { format } from "date-fns";

interface OverviewTabProps {
  clientId: string;
  companyId: string;
}

function hasPermission(user: any, resource: string, action: string): boolean {
  if (!user) return false;
  
  // Console managers and admins have full access
  if (user.role === "ConsoleManager" || user.role === "Admin") return true;
  
  // Team leaders and coordinators can view client details
  if (user.role === "TeamLeader" || user.role === "Coordinator") return true;
  
  // Support workers can view basic client info for assigned clients
  if (user.role === "SupportWorker" && resource === "clients" && action === "view") {
    return true; // Will be filtered by clientId in the query
  }
  
  return false;
}

export default function OverviewTab({ clientId, companyId }: OverviewTabProps) {
  const { user } = useAuth();
  
  // Check permissions
  const canViewClient = hasPermission(user, "clients", "view");
  
  // Fetch client data
  const { data: client, isLoading } = useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!user && !!clientId && canViewClient,
  });

  if (!canViewClient) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">You don't have permission to view client details.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Client not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-lg font-medium">{client.firstName} {client.lastName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">NDIS Number</label>
              <p className="text-lg font-medium">{client.ndisNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <p className="text-lg font-medium">
                {client.dateOfBirth ? format(new Date(client.dateOfBirth), "dd MMM yyyy") : "Not provided"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Client ID</label>
              <p className="text-lg font-medium">{client.clientId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <p className="text-lg font-medium">{client.phoneNumber || "Not provided"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg font-medium">{client.email || "Not provided"}</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            <div className="flex items-start gap-2 mt-1">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-lg font-medium">{client.address || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
              <p className="text-lg font-medium">{client.emergencyContactName || "Not provided"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contact Phone</label>
              <p className="text-lg font-medium">{client.emergencyContactPhone || "Not provided"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Relationship</label>
              <p className="text-lg font-medium">{client.emergencyContactRelationship || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Primary Disability</label>
              <p className="text-lg font-medium">{client.primaryDisability || "Not provided"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Support Needs</label>
              <p className="text-lg font-medium">{client.supportNeeds || "Not provided"}</p>
            </div>
          </div>
          
          {client.allergies && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Allergies & Alerts</label>
              <div className="mt-2">
                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                  <AlertTriangle className="w-3 h-3" />
                  {client.allergies}
                </Badge>
              </div>
            </div>
          )}
          
          {client.medicalNotes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Medical Notes</label>
              <p className="text-sm text-muted-foreground mt-1">{client.medicalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NDIS Information */}
      {client.ndisNumber && (
        <Card>
          <CardHeader>
            <CardTitle>NDIS Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">NDIS Number</label>
                <p className="text-lg font-medium">{client.ndisNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Plan Status</label>
                <Badge variant="outline" className="mt-1">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}