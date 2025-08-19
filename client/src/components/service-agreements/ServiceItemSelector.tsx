import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Sun, Moon, Bed, Calendar, Gift } from "lucide-react";

interface ServiceItemSelectorProps {
  onAddItem: (item: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SERVICE_TYPES = [
  {
    id: "day",
    name: "Standard Day Rate",
    description: "Weekday standard hours (6am-6pm)",
    icon: Sun,
    color: "bg-yellow-100 text-yellow-800",
    fields: ["hoursDay", "unitDay"]
  },
  {
    id: "evening",
    name: "Evening Rate",
    description: "Weekday evening hours (6pm-10pm)",
    icon: Clock,
    color: "bg-blue-100 text-blue-800",
    fields: ["hoursEvening", "unitEvening"]
  },
  {
    id: "activeNight",
    name: "Active Night",
    description: "Active night shift (10pm-6am)",
    icon: Moon,
    color: "bg-purple-100 text-purple-800",
    fields: ["hoursActiveNight", "unitActiveNight"]
  },
  {
    id: "sleepover",
    name: "Sleepover",
    description: "Sleepover shift (10pm-6am)",
    icon: Bed,
    color: "bg-indigo-100 text-indigo-800",
    fields: ["hoursSleepover", "unitSleepover"]
  },
  {
    id: "saturday",
    name: "Saturday Rate",
    description: "Saturday premium rate",
    icon: Calendar,
    color: "bg-green-100 text-green-800",
    fields: ["hoursSaturday", "unitSaturday"]
  },
  {
    id: "sunday",
    name: "Sunday Rate",
    description: "Sunday premium rate",
    icon: Calendar,
    color: "bg-red-100 text-red-800",
    fields: ["hoursSunday", "unitSunday"]
  },
  {
    id: "publicHoliday",
    name: "Public Holiday",
    description: "Public holiday premium rate",
    icon: Gift,
    color: "bg-orange-100 text-orange-800",
    fields: ["hoursPublicHoliday", "unitPublicHoliday"]
  }
];

export default function ServiceItemSelector({ onAddItem, isOpen, onClose }: ServiceItemSelectorProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [formData, setFormData] = useState({
    ndisCode: "",
    supportDescription: "",
    weeks: 52,
    hours: 0,
    unitRate: 0,
    ratioOfSupport: "1:1",
    notes: ""
  });

  const selectedServiceType = SERVICE_TYPES.find(type => type.id === selectedType);

  const handleSubmit = () => {
    if (!selectedServiceType) return;

    // Create the service item with only the selected service type populated
    const serviceItem = {
      ndisCode: formData.ndisCode,
      supportDescription: formData.supportDescription,
      weeks: formData.weeks,
      ratioOfSupport: formData.ratioOfSupport,
      notes: formData.notes,
      
      // Initialize all hour fields to 0
      hoursDay: 0,
      hoursEvening: 0,
      hoursActiveNight: 0,
      hoursSleepover: 0,
      hoursSaturday: 0,
      hoursSunday: 0,
      hoursPublicHoliday: 0,
      
      // Initialize all unit rate fields to 0
      unitDay: 0,
      unitEvening: 0,
      unitActiveNight: 0,
      unitSleepover: 0,
      unitSaturday: 0,
      unitSunday: 0,
      unitPublicHoliday: 0,
    };

    // Set the specific fields for the selected service type
    const hoursField = selectedServiceType.fields[0];
    const unitField = selectedServiceType.fields[1];
    (serviceItem as any)[hoursField] = formData.hours;
    (serviceItem as any)[unitField] = formData.unitRate;

    onAddItem(serviceItem);
    
    // Reset form
    setSelectedType("");
    setFormData({
      ndisCode: "",
      supportDescription: "",
      weeks: 52,
      hours: 0,
      unitRate: 0,
      ratioOfSupport: "1:1",
      notes: ""
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service Item</DialogTitle>
          <DialogDescription>
            Select a service type and enter the specific details for that service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Type Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block">Select Service Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {SERVICE_TYPES.map((serviceType) => {
                const Icon = serviceType.icon;
                return (
                  <Card
                    key={serviceType.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedType === serviceType.id 
                        ? "ring-2 ring-blue-500 shadow-md" 
                        : "hover:ring-1 hover:ring-gray-300"
                    }`}
                    onClick={() => setSelectedType(serviceType.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-md ${serviceType.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{serviceType.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{serviceType.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Service Details Form */}
          {selectedType && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {selectedServiceType && (
                    <>
                      <selectedServiceType.icon className="h-5 w-5" />
                      <span>{selectedServiceType.name}</span>
                      <Badge className={selectedServiceType.color}>
                        {selectedServiceType.name}
                      </Badge>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ndisCode">NDIS Code *</Label>
                    <Input
                      id="ndisCode"
                      value={formData.ndisCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, ndisCode: e.target.value }))}
                      placeholder="e.g., 01_001_0107_1_1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="weeks">Duration (Weeks) *</Label>
                    <Input
                      id="weeks"
                      type="number"
                      value={formData.weeks}
                      onChange={(e) => setFormData(prev => ({ ...prev, weeks: parseInt(e.target.value) || 0 }))}
                      min="1"
                      max="52"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="supportDescription">Support Description *</Label>
                  <Textarea
                    id="supportDescription"
                    value={formData.supportDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, supportDescription: e.target.value }))}
                    placeholder="Describe the support service being provided..."
                    rows={3}
                    required
                  />
                </div>

                {/* Service-Specific Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="hours">Weekly Hours *</Label>
                    <Input
                      id="hours"
                      type="number"
                      value={formData.hours}
                      onChange={(e) => setFormData(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
                      min="0"
                      step="0.5"
                      placeholder="e.g., 20"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="unitRate">Unit Rate ($) *</Label>
                    <Input
                      id="unitRate"
                      type="number"
                      value={formData.unitRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, unitRate: parseFloat(e.target.value) || 0 }))}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 65.50"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ratioOfSupport">Ratio of Support</Label>
                    <Select
                      value={formData.ratioOfSupport}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, ratioOfSupport: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">1:1</SelectItem>
                        <SelectItem value="1:2">1:2</SelectItem>
                        <SelectItem value="1:3">1:3</SelectItem>
                        <SelectItem value="1:4">1:4</SelectItem>
                        <SelectItem value="2:1">2:1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes or comments..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedType || !formData.ndisCode || !formData.supportDescription}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Service Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}