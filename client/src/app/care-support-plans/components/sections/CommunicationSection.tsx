import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, MessageCircle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CommunicationSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function CommunicationSection({ data, onChange, selectedClient, planData }: CommunicationSectionProps) {
  const [formData, setFormData] = useState({
    expressiveCommunication: data.expressiveCommunication || "",
    receptiveCommunication: data.receptiveCommunication || "",
    communicationMethods: data.communicationMethods || [],
    assistiveTechnology: data.assistiveTechnology || "",
    languagePreferences: data.languagePreferences || "",
    communicationGoals: data.communicationGoals || "",
    supportStrategies: data.supportStrategies || "",
    generatedContent: data.generatedContent || "",
    communicationInput: data.communicationInput || "",
    ...data
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const communicationMethods = [
    "Verbal speech",
    "Sign language",
    "Picture cards/symbols",
    "Communication board",
    "Tablet/device apps",
    "Gestures/body language",
    "Written communication",
    "Voice output device",
    "Eye gaze system",
    "Switch-activated device"
  ];

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMethodToggle = (method: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      communicationMethods: checked 
        ? [...prev.communicationMethods, method]
        : prev.communicationMethods.filter((m: string) => m !== method)
    }));
  };

  const generateContentMutation = useMutation({
    mutationFn: (userInput: string) => apiRequest("POST", "/api/care-support-plans/generate-ai", {
      section: "communication",
      userInput,
      clientName: selectedClient?.fullName || "Client",
      clientDiagnosis: selectedClient?.diagnosis || "Not specified",
      maxWords: 350
    }),
    onSuccess: (response) => {
      setFormData(prev => ({
        ...prev,
        generatedContent: (response as any).generatedContent
      }));
      toast({
        title: "Communication Strategies Generated",
        description: "AI has created comprehensive communication support strategies.",
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
    if (!formData.communicationInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the client's communication needs first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(formData.communicationInput);
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated communication strategies have been copied to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Communication Strategy Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="communicationInput">Communication Assessment Notes</Label>
            <Textarea
              id="communicationInput"
              value={formData.communicationInput}
              onChange={(e) => handleInputChange("communicationInput", e.target.value)}
              placeholder="Describe the client's communication abilities, challenges, preferences, and any specific needs for both expressing themselves and understanding others."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !formData.communicationInput.trim()}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Communication Strategies...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Communication Support Plan
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated Communication Strategies:</h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {formData.generatedContent}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyContent}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Strategies"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Expressive Communication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expressiveCommunication">How the client expresses themselves</Label>
              <Textarea
                id="expressiveCommunication"
                value={formData.expressiveCommunication}
                onChange={(e) => handleInputChange("expressiveCommunication", e.target.value)}
                placeholder="Describe how the client communicates their wants, needs, feelings, and thoughts"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Receptive Communication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receptiveCommunication">How the client understands communication</Label>
              <Textarea
                id="receptiveCommunication"
                value={formData.receptiveCommunication}
                onChange={(e) => handleInputChange("receptiveCommunication", e.target.value)}
                placeholder="Describe how the client processes and understands information from others"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Communication Methods & Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Communication Methods (select all that apply)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {communicationMethods.map((method) => (
                <div key={method} className="flex items-center space-x-2">
                  <Checkbox
                    id={method}
                    checked={formData.communicationMethods.includes(method)}
                    onCheckedChange={(checked) => handleMethodToggle(method, checked as boolean)}
                  />
                  <Label htmlFor={method} className="text-sm font-normal">
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistiveTechnology">Assistive Technology & Equipment</Label>
            <Textarea
              id="assistiveTechnology"
              value={formData.assistiveTechnology}
              onChange={(e) => handleInputChange("assistiveTechnology", e.target.value)}
              placeholder="Describe any communication devices, apps, or assistive technology used"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="languagePreferences">Language & Cultural Preferences</Label>
            <Textarea
              id="languagePreferences"
              value={formData.languagePreferences}
              onChange={(e) => handleInputChange("languagePreferences", e.target.value)}
              placeholder="Preferred languages, cultural communication styles, or specific considerations"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Communication Goals & Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="communicationGoals">Communication Goals</Label>
            <Textarea
              id="communicationGoals"
              value={formData.communicationGoals}
              onChange={(e) => handleInputChange("communicationGoals", e.target.value)}
              placeholder="Specific goals for improving or maintaining communication skills"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportStrategies">Support Strategies</Label>
            <Textarea
              id="supportStrategies"
              value={formData.supportStrategies}
              onChange={(e) => handleInputChange("supportStrategies", e.target.value)}
              placeholder="Specific strategies staff should use to support communication with this client"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <p className="text-sm text-indigo-800 dark:text-indigo-200">
            <strong>Communication Planning:</strong> Effective communication strategies are essential for {selectedClient.fullName}'s 
            participation and engagement. Use the AI generator to develop comprehensive approaches for both expressive 
            and receptive communication support.
          </p>
        </div>
      )}
    </div>
  );
}