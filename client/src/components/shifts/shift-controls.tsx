import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, MapPin, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface ShiftControlsProps {
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  onStartShift: () => void;
  startShiftMutation: UseMutationResult<any, Error, any>;
  building: string;
  setBuilding: (value: string) => void;
  floor: string;
  setFloor: (value: string) => void;
}

export default function ShiftControls({
  location,
  onStartShift,
  startShiftMutation,
  building,
  setBuilding,
  floor,
  setFloor
}: ShiftControlsProps) {
  const [selectedClient, setSelectedClient] = useState("");
  const [shiftType, setShiftType] = useState("");
  const [previousStaff, setPreviousStaff] = useState("");
  const [clientAssessment, setClientAssessment] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");

  // Fetch clients for selection
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const isFormValid = selectedClient && shiftType && clientAssessment && location;

  const handleStartShift = () => {
    if (isFormValid) {
      onStartShift();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>Start New Shift - Compliance Documentation</span>
        </CardTitle>
        <CardDescription>
          Complete all required fields for NDIS compliance and audit trail documentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label htmlFor="client" className="flex items-center space-x-2">
            <span>Client Assignment *</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Select the client you'll be supporting" />
            </SelectTrigger>
            <SelectContent>
              {clients?.map((client: any) => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name} - {client.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Shift Type */}
        <div className="space-y-2">
          <Label htmlFor="shiftType" className="flex items-center space-x-2">
            <span>Shift Type *</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </Label>
          <Select value={shiftType} onValueChange={setShiftType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type of shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="emergency">Emergency Cover</SelectItem>
              <SelectItem value="additional">Additional Support</SelectItem>
              <SelectItem value="replacement">Staff Replacement</SelectItem>
              <SelectItem value="overtime">Overtime Shift</SelectItem>
              <SelectItem value="unplanned">Unplanned Client Need</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Location Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="building">Building/Property</Label>
            <Input
              id="building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g., Residential Care Unit A"
            />
          </div>
          <div>
            <Label htmlFor="floor">Floor/Unit</Label>
            <Input
              id="floor"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g., Unit 12, Floor 2"
            />
          </div>
        </div>

        {/* Previous Staff Handover */}
        <div className="space-y-2">
          <Label htmlFor="previousStaff">Receiving Handover From Previous Staff</Label>
          <Select value={previousStaff} onValueChange={setPreviousStaff}>
            <SelectTrigger>
              <SelectValue placeholder="Select previous staff member (if applicable)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No handover - First shift of day</SelectItem>
              <SelectItem value="staff1">Sarah Wilson</SelectItem>
              <SelectItem value="staff2">Michael Davis</SelectItem>
              <SelectItem value="staff3">Emma Thompson</SelectItem>
              <SelectItem value="staff4">Lisa Chen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Initial Client Assessment */}
        <div className="space-y-2">
          <Label htmlFor="clientState" className="flex items-center space-x-2">
            <span>Initial Client Assessment *</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </Label>
          <Textarea
            value={clientAssessment}
            onChange={(e) => setClientAssessment(e.target.value)}
            placeholder="Describe the client's current condition, mood, and any immediate needs or concerns.

Example: 'Client awake and alert, ready for morning routine. Requires assistance with mobility today. Mood appears positive, no immediate concerns noted.'"
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-gray-500">
            Required for compliance: Document client's physical and emotional state upon arrival
          </p>
        </div>

        {/* Handover Notes from Previous Shift */}
        <div className="space-y-2">
          <Label htmlFor="handoverNotes">Notes from Previous Shift</Label>
          <Textarea
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Any important information passed on from the previous shift staff member..."
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Location Verification Status */}
        {location ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Location Verified for Compliance</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              GPS accuracy: {Math.round(location.accuracy)}m • Ready for audit trail
            </p>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Location Verification Required</span>
            </div>
            <p className="text-sm text-amber-600 mt-1">
              GPS verification is mandatory for NDIS compliance and audit trail
            </p>
          </div>
        )}

        {/* Start Shift Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleStartShift}
            disabled={!isFormValid || startShiftMutation.isPending}
            size="lg"
            className="w-full"
          >
            {startShiftMutation.isPending ? (
              <>
                <Shield className="mr-2 h-4 w-4 animate-spin" />
                Creating Compliance Record...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Start Shift with Full Documentation
              </>
            )}
          </Button>
          
          {!isFormValid && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700">
                  <strong>Required fields missing:</strong> Complete client selection, shift type, client assessment, and location verification
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Information */}
        <div className="pt-4 border-t bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">What This Creates:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Permanent audit trail with GPS verification</li>
            <li>• NDIS-compliant service delivery record</li>
            <li>• Legal protection through documented evidence</li>
            <li>• Client safety through verified staff presence</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
