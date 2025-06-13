import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, Mail, MapPin, User, Hash, Heart, AlertTriangle } from "lucide-react";
import { Client } from "@shared/schema";

interface ClientQuickViewModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (client: Client) => void;
}

export function ClientQuickViewModal({ client, isOpen, onClose, onEdit }: ClientQuickViewModalProps) {
  if (!client) return null;

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Not provided";
    const d = new Date(date);
    return d.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getCareLevel = (level: string | null) => {
    switch (level) {
      case "independent":
        return <Badge variant="secondary">Independent Living</Badge>;
      case "assisted":
        return <Badge variant="default">Assisted Living</Badge>;
      case "memory_care":
        return <Badge variant="destructive">Memory Care</Badge>;
      default:
        return <Badge variant="outline">Not Specified</Badge>;
    }
  };

  const calculateAge = (dateOfBirth: Date | string | null) => {
    if (!dateOfBirth) return "Unknown";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return `${age} years old`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-xl font-semibold">{client.fullName}</span>
            <div className={`w-3 h-3 rounded-full ${client.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Hash className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">NDIS Number</p>
                  <p className="text-sm text-gray-900">{client.ndisNumber || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Date of Birth</p>
                  <p className="text-sm text-gray-900">
                    {formatDate(client.dateOfBirth)} 
                    <span className="text-gray-600 ml-2">({calculateAge(client.dateOfBirth)})</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Care Level</p>
                  <div className="mt-1">{getCareLevel(client.careLevel)}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {client.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Phone</p>
                    <p className="text-sm text-gray-900">{client.phone}</p>
                  </div>
                </div>
              )}

              {client.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <p className="text-sm text-gray-900">{client.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <Badge variant={client.isActive ? "default" : "secondary"}>
                    {client.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          {client.address && (
            <>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-medium text-gray-700">Address</h4>
                </div>
                <p className="text-sm text-gray-900 ml-6">{client.address}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Emergency Contact */}
          {client.emergencyContact && (
            <>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-medium text-gray-700">Emergency Contact</h4>
                </div>
                <div className="ml-6 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-900 whitespace-pre-line">
                    {client.emergencyContact}
                  </p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Medical Information */}
          {client.medicalInfo && (
            <>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <h4 className="text-sm font-medium text-gray-700">Medical Information</h4>
                </div>
                <div className="ml-6 p-3 bg-red-50 rounded-md border border-red-200">
                  <p className="text-sm text-gray-900 whitespace-pre-line">
                    {client.medicalInfo}
                  </p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
            {client.createdAt && (
              <div>
                <span className="font-medium">Created:</span> {formatDate(client.createdAt)}
              </div>
            )}
            {client.updatedAt && (
              <div>
                <span className="font-medium">Last Updated:</span> {formatDate(client.updatedAt)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button onClick={() => onEdit(client)}>
                Edit Client
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}