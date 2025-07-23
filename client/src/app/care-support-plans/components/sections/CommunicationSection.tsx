import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, MessageCircle, Copy, Check, CheckCircle2, X, Laptop, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CommunicationSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function CommunicationSection({ data, onChange, selectedClient, planData }: CommunicationSectionProps) {
  const [formData, setFormData] = useState(() => ({
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
  }));

  // Update form data when section data changes (when loading existing plan)
  useEffect(() => {
    setFormData({
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
  }, [data]);
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
    // Only update if there are actual changes to avoid overwriting existing data
    const hasChanges = Object.keys(formData).some(key => 
      formData[key as keyof typeof formData] !== data.communicationData?.[key]
    );
    
    if (hasChanges && onChange && typeof onChange === 'function') {
      onChange(formData);
    }
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

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    console.log("GPT limit refreshed for next communication generation");
  };

  const generateTargetedContentMutation = useMutation({
    mutationFn: async ({ userInput, targetField }: { userInput: string; targetField: string }) => {
      // Build existing content context for smart AI awareness
      const existingContent = {
        expressive: data.expressive || "",
        receptive: data.receptive || "",
        supportStrategies: data.supportStrategies || "",
        generalStrategies: data.generatedContent || ""
      };

      // Include progress from other sections
      const progressContext = {
        aboutMe: planData.aboutMeData?.personalHistory || planData.aboutMeData?.generatedContent || "",
        goals: planData.goalsData?.ndisGoals || planData.goalsData?.generatedContent || "",
        adl: planData.adlData?.userInput || planData.adlData?.generatedContent || "",
        behaviour: planData.behaviourData?.proactiveStrategies || ""
      };

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "communication",
        userInput,
        clientName: selectedClient?.fullName || "Client",
        clientDiagnosis: selectedClient?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField,
        existingContent: { ...existingContent, ...progressContext }
      });
      return await response.json();
    },
    onSuccess: (responseData) => {
      const generatedText = responseData.generatedContent || "";
      
      // Store generated content for targeted application
      handleInputChange('generatedContent', generatedText);
      
      toast({
        title: "AI Communication Content Generated",
        description: "200-word focused communication content generated for targeted application.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate communication content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContent = () => {
    if (!data.communicationInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the client's communication needs first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(data.communicationInput);
  };

  // Add field-specific generation functionality
  const generateTargetedContentMutation = useMutation({
    mutationFn: async (targetField: string) => {
      const payload = {
        section: "communication",
        userInput: data.communicationInput || "",
        targetField: targetField,
        planId: planData?.id,
        clientName: selectedClient?.fullName || selectedClient?.firstName + " " + selectedClient?.lastName,
        clientDiagnosis: selectedClient?.primaryDiagnosis,
        maxWords: 200,
        existingContent: {
          expressiveStrategies: formData.expressiveCommunication || "",
          receptiveStrategies: formData.receptiveCommunication || "",
          staffApproaches: formData.supportStrategies || "",
          assistiveTechnology: formData.assistiveTechnology || ""
        }
      };

      console.log(`[COMMUNICATION DEBUG] Enhanced payload:`, payload);
      console.log(`[COMMUNICATION DEBUG] planData:`, planData);
      console.log(`[COMMUNICATION DEBUG] About to send request to backend with planId:`, planData?.id);

      return await apiRequest("POST", "/api/care-support-plans/generate-ai", payload);
    },
    onSuccess: (response) => {
      console.log("[COMMUNICATION DEBUG] Field-specific generation successful:", response);
      
      // Store in generatedContent for preview
      handleInputChange("generatedContent", response.content);
      
      toast({
        title: "Content Generated",
        description: "Field-specific communication content generated successfully. Review and apply to desired field.",
      });
    },
    onError: (error) => {
      console.error("[COMMUNICATION DEBUG] Field-specific generation failed:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate field-specific content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateTargetedContent = (targetField: string) => {
    if (!data.communicationInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the client's communication needs first.",
        variant: "destructive",
      });
      return;
    }

    generateTargetedContentMutation.mutate(targetField);
  };

  const handleCopyContent = () => {
    if (data.generatedContent) {
      navigator.clipboard.writeText(data.generatedContent);
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
              value={data.communicationInput || ""}
              onChange={(e) => handleInputChange("communicationInput", e.target.value)}
              placeholder="Describe the client's communication abilities, challenges, preferences, and any specific needs for both expressing themselves and understanding others."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !data.communicationInput?.trim()}
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

          {data.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated Communication Strategies:</h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {data.generatedContent}
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
              <Button
                onClick={() => handleGenerateTargetedContent('expressiveStrategies')}
                disabled={generateTargetedContentMutation.isPending || !data.communicationInput?.trim()}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {generateTargetedContentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Add to Expressive Communication
                  </>
                )}
              </Button>
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
              <Button
                onClick={() => handleGenerateTargetedContent('receptiveStrategies')}
                disabled={generateTargetedContentMutation.isPending || !data.communicationInput?.trim()}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {generateTargetedContentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Add to Receptive Communication
                  </>
                )}
              </Button>
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
            <Button
              onClick={() => handleGenerateTargetedContent('assistiveTechnology')}
              disabled={generateTargetedContentMutation.isPending || !data.communicationInput?.trim()}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {generateTargetedContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add to Assistive Technology
                </>
              )}
            </Button>
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
            <Button
              onClick={() => handleGenerateTargetedContent('staffApproaches')}
              disabled={generateTargetedContentMutation.isPending || !data.communicationInput?.trim()}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {generateTargetedContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add to Support Strategies
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI-Powered Communication Generation */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold">AI-Powered Communication Generation</h4>
            <p className="text-sm text-muted-foreground">
              Generate personalized communication strategies based on client needs
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI Communication Content Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="communicationUserInput">Communication Needs & Challenges</Label>
              <Textarea
                id="communicationUserInput"
                value={formData.communicationInput || ""}
                onChange={(e) => handleInputChange("communicationInput", e.target.value)}
                placeholder="Describe the client's communication abilities, challenges, preferences, and specific needs for both understanding and expressing themselves..."
                rows={4}
              />
            </div>

            <Button 
              onClick={handleGenerateContent}
              disabled={generateContentMutation.isPending || !formData.communicationInput?.trim()}
              className="w-full"
            >
              {generateContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Communication Content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Communication Content
                </>
              )}
            </Button>

            {data.generatedContent && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">✨ AI Generated Communication Content</h4>
                  <Button 
                    onClick={() => {
                      handleInputChange("generatedContent", "");
                      toast({
                        title: "Content Dismissed",
                        description: "AI-generated content cleared.",
                      });
                    }}
                    variant="ghost" 
                    size="sm"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded border border-blue-100 dark:border-blue-700">
                  {data.generatedContent}
                </div>
                
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100">Apply this content to specific fields:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button 
                      onClick={() => {
                        handleInputChange("expressiveCommunication", data.generatedContent || "");
                        toast({
                          title: "Content Applied",
                          description: "Added to Expressive Communication field.",
                        });
                      }}
                      variant="outline" 
                      size="sm"
                      className="text-blue-700 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Add to Expressive Communication
                    </Button>
                    <Button 
                      onClick={() => {
                        handleInputChange("receptiveCommunication", data.generatedContent || "");
                        toast({
                          title: "Content Applied", 
                          description: "Added to Receptive Communication field.",
                        });
                      }}
                      variant="outline" 
                      size="sm"
                      className="text-blue-700 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Add to Receptive Communication
                    </Button>
                    <Button 
                      onClick={() => {
                        handleInputChange("assistiveTechnology", data.generatedContent || "");
                        toast({
                          title: "Content Applied", 
                          description: "Added to Assistive Technology field.",
                        });
                      }}
                      variant="outline" 
                      size="sm"
                      className="text-blue-700 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      <Laptop className="h-4 w-4 mr-2" />
                      Add to Assistive Technology
                    </Button>
                    <Button 
                      onClick={() => {
                        handleInputChange("supportStrategies", data.generatedContent || "");
                        toast({
                          title: "Content Applied", 
                          description: "Added to Support Strategies field.",
                        });
                      }}
                      variant="outline" 
                      size="sm"
                      className="text-blue-700 border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Add to Support Strategies
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-center mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    📝 Review and apply AI-generated content to appropriate Communication fields
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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