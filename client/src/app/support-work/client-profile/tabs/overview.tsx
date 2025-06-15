import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Calendar, MapPin, Phone, Mail, AlertCircle } from "lucide-react";

interface OverviewTabProps {
  clientId?: string;
  companyId?: string;
}

export default function OverviewTab({ clientId, companyId }: OverviewTabProps) {
  // Fetch client details
  const { data: client, isLoading } = useQuery({
    queryKey: ["/api/clients", clientId],
    queryFn: () => fetch(`/api/clients/${clientId}`).then(res => res.json()),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading client overview...</p>
        </CardContent>
      </Card>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
          <p className="text-gray-600">Unable to load client information.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Basic Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Client ID</label>
              <p className="text-sm text-gray-900">{client.clientId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <p className="text-sm text-gray-900">{client.firstName} {client.lastName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date of Birth</label>
              <p className="text-sm text-gray-900">
                {client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString() : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">NDIS Number</label>
              <p className="text-sm text-gray-900">{client.ndisNumber || 'Not provided'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Phone className="h-5 w-5" />
            <span>Contact Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <p className="text-sm text-gray-900">{client.phone || 'Not provided'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <p className="text-sm text-gray-900">{client.email || 'Not provided'}</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Address</label>
              <p className="text-sm text-gray-900">{client.address || 'Not provided'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      {(client.emergencyContactName || client.emergencyContactPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Emergency Contact</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <p className="text-sm text-gray-900">{client.emergencyContactName || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <p className="text-sm text-gray-900">{client.emergencyContactPhone || 'Not provided'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Notes */}
      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}