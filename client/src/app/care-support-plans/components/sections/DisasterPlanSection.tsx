import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DisasterPlanSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function DisasterPlanSection({ data, onChange, selectedClient, planData }: DisasterPlanSectionProps) {
  const [formData, setFormData] = useState({
    emergencyContacts: data.emergencyContacts || "",
    evacuationPlan: data.evacuationPlan || "",
    emergencyKit: data.emergencyKit || "",
    communicationPlan: data.communicationPlan || "",
    specialNeeds: data.specialNeeds || "",
    postDisasterCare: data.postDisasterCare || "",
    disasterType: data.disasterType || "general",
    generatedContent: data.generatedContent || "",
    disasterInput: data.disasterInput || "",
    ...data
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const disasterTypes = [
    { value: "general", label: "General Emergency" },
    { value: "fire", label: "Fire Emergency" },
    { value: "flood", label: "Flood/Water Emergency" },
    { value: "storm", label: "Severe Weather/Storm" },
    { value: "earthquake", label: "Earthquake" },
    { value: "medical", label: "Medical Emergency" },
    { value: "evacuation", label: "Evacuation" },
    { value: "power", label: "Power Outage" }
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

  const generateContentMutation = useMutation({
    mutationFn: (userInput: string) => apiRequest("POST", "/api/care-support-plans/generate-ai", {
      section: "disaster",
      userInput,
      clientName: selectedClient?.fullName || "Client",
      clientDiagnosis: selectedClient?.diagnosis || "Not specified",
      maxWords: 350
    }),
    onSuccess: (response: any) => {
      setFormData((prev: any) => ({
        ...prev,
        generatedContent: response.generatedContent
      }));
      toast({
        title: "Disaster Plan Generated",
        description: "AI has created comprehensive disaster management procedures.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContent = () => {
    if (!formData.disasterInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the disaster scenario first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(formData.disasterInput);
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated disaster plan has been copied to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Disaster Plan Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="disasterType">Disaster Scenario</Label>
              <Select value={formData.disasterType} onValueChange={(value) => handleInputChange("disasterType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {disasterTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disasterInput">Specific Considerations</Label>
              <Textarea
                id="disasterInput"
                value={formData.disasterInput}
                onChange={(e) => handleInputChange("disasterInput", e.target.value)}
                placeholder="Describe specific needs, risks, or considerations for this disaster scenario"
                rows={3}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !formData.disasterInput.trim()}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Disaster Plan...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Disaster Management Plan
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated Disaster Plan:</h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {formData.generatedContent}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyContent}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Plan"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Emergency Contacts & Communication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emergencyContacts">Emergency Contact Information</Label>
            <Textarea
              id="emergencyContacts"
              value={formData.emergencyContacts}
              onChange={(e) => handleInputChange("emergencyContacts", e.target.value)}
              placeholder="List all emergency contacts including family, medical professionals, support coordinators, and local emergency services"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="communicationPlan">Communication Plan</Label>
            <Textarea
              id="communicationPlan"
              value={formData.communicationPlan}
              onChange={(e) => handleInputChange("communicationPlan", e.target.value)}
              placeholder="How to communicate with the client during emergencies, including alternative communication methods"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evacuation & Safety Procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evacuationPlan">Evacuation Plan</Label>
            <Textarea
              id="evacuationPlan"
              value={formData.evacuationPlan}
              onChange={(e) => handleInputChange("evacuationPlan", e.target.value)}
              placeholder="Step-by-step evacuation procedures, including exit routes, meeting points, and transportation arrangements"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyKit">Emergency Kit & Supplies</Label>
            <Textarea
              id="emergencyKit"
              value={formData.emergencyKit}
              onChange={(e) => handleInputChange("emergencyKit", e.target.value)}
              placeholder="Essential items and supplies to have ready, including medications, medical equipment, and personal items"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Special Needs & Post-Disaster Care</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="specialNeeds">Special Needs & Considerations</Label>
            <Textarea
              id="specialNeeds"
              value={formData.specialNeeds}
              onChange={(e) => handleInputChange("specialNeeds", e.target.value)}
              placeholder="Specific needs related to the client's disability, medical conditions, or support requirements during emergencies"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postDisasterCare">Post-Disaster Care & Recovery</Label>
            <Textarea
              id="postDisasterCare"
              value={formData.postDisasterCare}
              onChange={(e) => handleInputChange("postDisasterCare", e.target.value)}
              placeholder="Support and care arrangements following a disaster, including temporary accommodation and ongoing support needs"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Emergency Preparedness:</strong> A comprehensive disaster management plan ensures {selectedClient.fullName}'s 
            safety and continuity of support during emergencies. Review and update this plan regularly.
          </p>
        </div>
      )}
    </div>
  );
}