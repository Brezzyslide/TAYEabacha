import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Heart, Clock } from "lucide-react";

interface SupportDeliverySectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function SupportDeliverySection({ data, onChange, selectedClient, planData }: SupportDeliverySectionProps) {
  const [formData, setFormData] = useState({
    supportPhilosophy: data.supportPhilosophy || "",
    supportApproach: data.supportApproach || "",
    workerAttributes: data.workerAttributes || [],
    supportSettings: data.supportSettings || "",
    culturalConsiderations: data.culturalConsiderations || "",
    familyInvolvement: data.familyInvolvement || "",
    reviewProcesses: data.reviewProcesses || "",
    qualityMeasures: data.qualityMeasures || "",
    ...data
  });

  const workerAttributeOptions = [
    "Patient and calm demeanor",
    "Experience with disability support",
    "Strong communication skills",
    "Cultural awareness",
    "Flexibility and adaptability",
    "Physical fitness requirements",
    "Specific training certifications",
    "Language skills",
    "Gender preference",
    "Age preference",
    "Experience with specific conditions"
  ];

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAttributeToggle = (attribute: string, checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      workerAttributes: checked 
        ? [...prev.workerAttributes, attribute]
        : prev.workerAttributes.filter((a: string) => a !== attribute)
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Support Philosophy & Approach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportPhilosophy">Support Philosophy</Label>
            <Textarea
              id="supportPhilosophy"
              value={formData.supportPhilosophy}
              onChange={(e) => handleInputChange("supportPhilosophy", e.target.value)}
              placeholder="The overall philosophy and values that should guide support delivery for this client"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportApproach">Support Approach & Methods</Label>
            <Textarea
              id="supportApproach"
              value={formData.supportApproach}
              onChange={(e) => handleInputChange("supportApproach", e.target.value)}
              placeholder="Specific approaches, methodologies, or frameworks to be used in support delivery"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Support Worker Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Preferred Worker Attributes (select all that apply)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workerAttributeOptions.map((attribute) => (
                <div key={attribute} className="flex items-center space-x-2">
                  <Checkbox
                    id={attribute}
                    checked={formData.workerAttributes.includes(attribute)}
                    onCheckedChange={(checked) => handleAttributeToggle(attribute, checked as boolean)}
                  />
                  <Label htmlFor={attribute} className="text-sm font-normal">
                    {attribute}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Service Delivery Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportSettings">Support Settings & Locations</Label>
            <Textarea
              id="supportSettings"
              value={formData.supportSettings}
              onChange={(e) => handleInputChange("supportSettings", e.target.value)}
              placeholder="Where support is provided (home, community, day programs, etc.) and any location-specific considerations"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="culturalConsiderations">Cultural & Religious Considerations</Label>
            <Textarea
              id="culturalConsiderations"
              value={formData.culturalConsiderations}
              onChange={(e) => handleInputChange("culturalConsiderations", e.target.value)}
              placeholder="Cultural, religious, or spiritual considerations that must be respected in support delivery"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="familyInvolvement">Family & Carer Involvement</Label>
            <Textarea
              id="familyInvolvement"
              value={formData.familyInvolvement}
              onChange={(e) => handleInputChange("familyInvolvement", e.target.value)}
              placeholder="How family members, carers, or significant others are involved in support planning and delivery"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality & Review Processes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reviewProcesses">Review & Monitoring Processes</Label>
            <Textarea
              id="reviewProcesses"
              value={formData.reviewProcesses}
              onChange={(e) => handleInputChange("reviewProcesses", e.target.value)}
              placeholder="How the support plan will be reviewed, monitored, and updated over time"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualityMeasures">Quality Indicators & Success Measures</Label>
            <Textarea
              id="qualityMeasures"
              value={formData.qualityMeasures}
              onChange={(e) => handleInputChange("qualityMeasures", e.target.value)}
              placeholder="How the quality and effectiveness of support will be measured and evaluated"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-pink-50 dark:bg-pink-950 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
          <p className="text-sm text-pink-800 dark:text-pink-200">
            <strong>Support Delivery:</strong> Person-centered support delivery ensures {selectedClient.fullName} receives 
            appropriate, respectful, and effective support that promotes their goals and quality of life.
          </p>
        </div>
      )}
    </div>
  );
}