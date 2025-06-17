import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, User, Heart, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

export function AboutMeSectionRefactored() {
  const { planData, updateField } = useCarePlan();
  const { aboutMeData, clientData } = planData;
  const { toast } = useToast();

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    // Reset any usage counters or refresh tokens
    // This can be expanded to track actual API usage limits
    console.log("GPT limit refreshed for next generation");
  };

  const generateTargetedContentMutation = useMutation({
    mutationFn: async ({ userInput, targetField }: { userInput: string; targetField: string }) => {
      // Build existing content context for smart AI awareness
      const existingContent = {
        personalHistory: aboutMeData.personalHistory || "",
        interests: aboutMeData.interests || "",
        preferences: aboutMeData.preferences || "",
        strengths: aboutMeData.strengths || "",
        challenges: aboutMeData.challenges || "",
        familyBackground: aboutMeData.familyBackground || "",
        culturalConsiderations: aboutMeData.culturalConsiderations || ""
      };

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "aboutMe",
        userInput,
        clientName: clientData?.fullName || "Client",
        clientDiagnosis: clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField,
        existingContent
      });
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.generatedContent || "";
      
      if (targetField === 'preview') {
        // Store content for preview and field selection
        updateField('aboutMeData', 'generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        // Update the specific targeted field directly
        updateField('aboutMeData', targetField, generatedText);
        
        // Refresh GPT limit after each content application
        refreshGPTLimit();
        
        const fieldLabels: { [key: string]: string } = {
          personalHistory: "Personal History",
          interests: "Interests",
          preferences: "Preferences",
          strengths: "Strengths",
          challenges: "Challenges",
          familyBackground: "Family Background",
          culturalConsiderations: "Cultural Considerations"
        };
        
        toast({
          title: "AI Content Generated",
          description: `${fieldLabels[targetField] || targetField} has been populated with targeted content (200 words).`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    updateField('aboutMeData', field, value);
  };

  const handleGenerateInitialContent = () => {
    if (!aboutMeData.bulletPoints?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter key information about the client first.",
        variant: "destructive",
      });
      return;
    }

    // Use existing mutation but trigger content preview mode
    generateTargetedContentMutation.mutate({ 
      targetField: 'preview',
      userInput: aboutMeData.bulletPoints 
    });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    if (!aboutMeData.bulletPoints?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some bullet points about the client first.",
        variant: "destructive",
      });
      return;
    }

    generateTargetedContentMutation.mutate({ 
      userInput: aboutMeData.bulletPoints, 
      targetField 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Content Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulletPoints">Key Information About Client</Label>
            <Textarea
              id="bulletPoints"
              value={aboutMeData.bulletPoints || ""}
              onChange={(e) => handleInputChange("bulletPoints", e.target.value)}
              placeholder="Enter key points about the client (interests, background, preferences, etc.). The AI will expand this into a professional About Me section."
              rows={4}
            />
          </div>

          {/* Primary AI Generation Button */}
          <Button 
            onClick={handleGenerateInitialContent}
            disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
            className="w-full mb-4"
          >
            {generateTargetedContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Initial Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate About Me Content
              </>
            )}
          </Button>

          {/* Targeted "Add to [Section]" Buttons with Context Awareness */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Refine Specific Fields</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              After initial generation, use these buttons to add targeted content to specific fields, avoiding duplication from other populated areas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('personalHistory')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Personal History
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('interests')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Interests
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('preferences')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Preferences
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('strengths')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Strengths
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('challenges')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Challenges
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('familyBackground')}
                disabled={generateTargetedContentMutation.isPending || !aboutMeData.bulletPoints?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Family Background
              </Button>
            </div>
          </div>

          {generateTargetedContentMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Generating targeted content with progress awareness from other sections...</span>
            </div>
          )}

          {aboutMeData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    // Auto-populate the Personal History field with the generated content
                    handleInputChange("personalHistory", aboutMeData.generatedContent || "");
                    updateField('aboutMeData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Personal History & Background field. GPT limit refreshed.",
                    });
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Use This Content
                </Button>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap mb-3">
                {aboutMeData.generatedContent}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button 
                  onClick={() => {
                    handleInputChange("personalHistory", aboutMeData.generatedContent || "");
                    updateField('aboutMeData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "Added to Personal History field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Personal History
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("interests", aboutMeData.generatedContent || "");
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Interests field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Interests
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("preferences", aboutMeData.generatedContent || "");
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Preferences field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Preferences
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("culturalBackground", aboutMeData.generatedContent || "");
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Cultural Background field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Cultural Background
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("communicationStyle", aboutMeData.generatedContent || "");
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Communication Style field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Communication
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("socialPreferences", aboutMeData.generatedContent || "");
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Social Preferences field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Social Preferences
                </Button>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Content limited to 200 words for focused sections
                </div>
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="personalHistory">Personal History & Background</Label>
                <Textarea
                  id="personalHistory"
                  value={aboutMeData.personalHistory || ""}
                  onChange={(e) => handleInputChange("personalHistory", e.target.value)}
                  placeholder="Describe the client's personal history, background, and life experiences..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Interests & Hobbies</Label>
                <Textarea
                  id="interests"
                  value={aboutMeData.interests || ""}
                  onChange={(e) => handleInputChange("interests", e.target.value)}
                  placeholder="What activities, hobbies, or interests does the client enjoy?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferences">Preferences & Choices</Label>
                <Textarea
                  id="preferences"
                  value={aboutMeData.preferences || ""}
                  onChange={(e) => handleInputChange("preferences", e.target.value)}
                  placeholder="Client's preferences for daily activities, support styles, environments..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="strengths">Strengths & Abilities</Label>
                <Textarea
                  id="strengths"
                  value={aboutMeData.strengths || ""}
                  onChange={(e) => handleInputChange("strengths", e.target.value)}
                  placeholder="What are the client's key strengths, skills, and abilities?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="challenges">Challenges & Support Needs</Label>
                <Textarea
                  id="challenges"
                  value={aboutMeData.challenges || ""}
                  onChange={(e) => handleInputChange("challenges", e.target.value)}
                  placeholder="Areas where the client may need additional support or face challenges..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="familyBackground">Family & Support Network</Label>
                <Textarea
                  id="familyBackground"
                  value={aboutMeData.familyBackground || ""}
                  onChange={(e) => handleInputChange("familyBackground", e.target.value)}
                  placeholder="Information about family members, carers, and support networks..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="culturalConsiderations">Cultural & Religious Considerations</Label>
            <Textarea
              id="culturalConsiderations"
              value={aboutMeData.culturalConsiderations || ""}
              onChange={(e) => handleInputChange("culturalConsiderations", e.target.value)}
              placeholder="Any cultural, religious, or spiritual considerations important to the client..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {clientData && (
        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-800 dark:text-green-200">
            <strong>Note:</strong> This section helps support workers understand {clientData.fullName} as a person beyond their support needs. 
            Include information that will help build rapport and provide person-centered support.
          </p>
        </div>
      )}
    </div>
  );
}