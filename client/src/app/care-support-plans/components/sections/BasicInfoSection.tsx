import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, User } from "lucide-react";

interface BasicInfoSectionProps {
  data: any;
  onChange: (data: any) => void;
  clients: any[];
}

export function BasicInfoSection({ data, onChange, clients }: BasicInfoSectionProps) {
  const [formData, setFormData] = useState({
    planTitle: data.planTitle || "",
    clientId: data.clientId || null,
    status: data.status || "draft",
    planType: data.planType || "comprehensive",
    planDuration: data.planDuration || "12",
    reviewDate: data.reviewDate || "",
    primarySupporter: data.primarySupporter || "",
    emergencyContact: data.emergencyContact || "",
    ndisNumber: data.ndisNumber || "",
    planStartDate: data.planStartDate || "",
    planEndDate: data.planEndDate || "",
    ...data
  });

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Plan Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={formData.clientId?.toString() || ""} onValueChange={(value) => handleInputChange("clientId", parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planTitle">Plan Title *</Label>
              <Input
                id="planTitle"
                value={formData.planTitle}
                onChange={(e) => handleInputChange("planTitle", e.target.value)}
                placeholder="e.g., Comprehensive Care Support Plan 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planType">Plan Type</Label>
              <Select value={formData.planType} onValueChange={(value) => handleInputChange("planType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprehensive">Comprehensive Plan</SelectItem>
                  <SelectItem value="interim">Interim Plan</SelectItem>
                  <SelectItem value="review">Review Plan</SelectItem>
                  <SelectItem value="specialized">Specialized Support Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planStartDate">Plan Start Date</Label>
              <Input
                id="planStartDate"
                type="date"
                value={formData.planStartDate}
                onChange={(e) => handleInputChange("planStartDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planEndDate">Plan End Date</Label>
              <Input
                id="planEndDate"
                type="date"
                value={formData.planEndDate}
                onChange={(e) => handleInputChange("planEndDate", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planDuration">Plan Duration (months)</Label>
              <Select value={formData.planDuration} onValueChange={(value) => handleInputChange("planDuration", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="18">18 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reviewDate">Next Review Date</Label>
              <Input
                id="reviewDate"
                type="date"
                value={formData.reviewDate}
                onChange={(e) => handleInputChange("reviewDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ndisNumber">NDIS Number</Label>
                <Input
                  id="ndisNumber"
                  value={formData.ndisNumber}
                  onChange={(e) => handleInputChange("ndisNumber", e.target.value)}
                  placeholder="NDIS participant number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primarySupporter">Primary Support Coordinator</Label>
                <Input
                  id="primarySupporter"
                  value={formData.primarySupporter}
                  onChange={(e) => handleInputChange("primarySupporter", e.target.value)}
                  placeholder="Name and contact details"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyContact">Emergency Contact Information</Label>
                <Textarea
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => handleInputChange("emergencyContact", e.target.value)}
                  placeholder="Emergency contact name, relationship, phone numbers, and any special instructions"
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Client:</strong> {selectedClient.fullName}<br />
                <strong>Date of Birth:</strong> {selectedClient.dateOfBirth ? new Date(selectedClient.dateOfBirth).toLocaleDateString() : "Not specified"}<br />
                <strong>Address:</strong> {selectedClient.address || "Not specified"}<br />
                <strong>Diagnosis:</strong> {selectedClient.diagnosis || "Not specified"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}