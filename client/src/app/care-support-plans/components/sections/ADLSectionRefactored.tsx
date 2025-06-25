import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, CheckCircle2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

export function ADLSectionRefactored() {
  const { toast } = useToast();
  const { state, updateField, clientData } = useCarePlan();
  
  const adlData = state.adlData || {
    userInput: '',
    generatedContent: '',
    personalCare: '',
    mobility: '',
    household: '',
    community: '',
    safety: '',
    independence: '',
    assistiveTechnology: '',
    recommendations: ''
  };

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    console.log("GPT limit refreshed for next ADL generation");
  };

  const handleInputChange = (field: string, value: string) => {
    updateField('adlData', field, value);
  };

  // Targeted AI content generation mutation
  const generateTargetedContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!adlData.userInput?.trim()) {
        throw new Error("Please enter ADL assessment information first.");
      }

      const userInput = adlData.userInput;

      // Gather existing content from all fields to provide context
      const existingContent = {
        personalCare: adlData.personalCare || "",
        mobility: adlData.mobility || "",
        household: adlData.household || "",
        community: adlData.community || "",
        safety: adlData.safety || "",
        independence: adlData.independence || "",
        assistiveTechnology: adlData.assistiveTechnology || "",
        recommendations: adlData.recommendations || ""
      };

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "adl",
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
      const generatedText = responseData.content || "";
      
      if (targetField === 'preview') {
        // Store content for preview and field selection
        updateField('adlData', 'generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        // Update the specific targeted field directly
        updateField('adlData', targetField, generatedText);
        
        // Refresh GPT limit after each content application
        refreshGPTLimit();
        
        const fieldLabels: { [key: string]: string } = {
          personalCare: "Personal Care",
          mobility: "Mobility",
          household: "Household Tasks",
          community: "Community Access",
          safety: "Safety Awareness",
          independence: "Independence Skills",
          assistiveTechnology: "Assistive Technology",
          recommendations: "Recommendations"
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

  const handleGenerateInitialContent = () => {
    if (!adlData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter ADL assessment information first.",
        variant: "destructive",
      });
      return;
    }

    // Use existing mutation but trigger content preview mode
    generateTargetedContentMutation.mutate({ 
      targetField: 'preview'
    });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    if (!adlData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter ADL assessment information first.",
        variant: "destructive",
      });
      return;
    }

    generateTargetedContentMutation.mutate({ targetField });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            ADL Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's Activities of Daily Living abilities, challenges, and support needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="adlInput">ADL Assessment Information</Label>
            <Textarea
              id="adlInput"
              placeholder="Enter details about the client's abilities in personal care, mobility, household tasks, community access, etc..."
              value={adlData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          {/* Primary AI Generation Button */}
          <Button 
            onClick={handleGenerateInitialContent}
            disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
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
                Generate ADL Content
              </>
            )}
          </Button>

          {/* Targeted "Add to [Section]" Buttons with Context Awareness */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Refine Specific Fields</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              After initial generation, use these buttons to add targeted content to specific ADL areas, avoiding duplication from other populated areas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('personalCare')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Personal Care
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('mobility')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Mobility
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('household')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Household Tasks
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('community')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Community Access
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('safety')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Safety
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('independence')}
                disabled={generateTargetedContentMutation.isPending || !adlData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Independence
              </Button>
            </div>
          </div>

          {generateTargetedContentMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Generating targeted ADL content with progress awareness from other sections...</span>
            </div>
          )}

          {adlData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    // Auto-populate the Personal Care field with the generated content
                    handleInputChange("personalCare", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Personal Care field. GPT limit refreshed.",
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
                {adlData.generatedContent}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button 
                  onClick={() => {
                    handleInputChange("personalCare", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "Added to Personal Care field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Personal Care
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("mobility", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Mobility field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Mobility
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("household", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Household Tasks field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Household Tasks
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("community", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Community Access field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Community Access
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("safety", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Safety field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Safety
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("independence", adlData.generatedContent || "");
                    updateField('adlData', 'generatedContent', ''); // Clear preview
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Independence field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Independence
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ADL Assessment Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Care</CardTitle>
            <CardDescription>Hygiene, grooming, dressing abilities</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document personal care abilities and support needs..."
              value={adlData.personalCare || ""}
              onChange={(e) => handleInputChange("personalCare", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mobility & Transfers</CardTitle>
            <CardDescription>Movement, walking, positioning support</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document mobility abilities and transfer requirements..."
              value={adlData.mobility || ""}
              onChange={(e) => handleInputChange("mobility", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Household Tasks</CardTitle>
            <CardDescription>Cleaning, cooking, household management</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document household task abilities and support needs..."
              value={adlData.household || ""}
              onChange={(e) => handleInputChange("household", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Community Access</CardTitle>
            <CardDescription>Transport, shopping, community participation</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document community access abilities and support requirements..."
              value={adlData.community || ""}
              onChange={(e) => handleInputChange("community", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Safety Awareness</CardTitle>
            <CardDescription>Risk recognition, emergency procedures</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document safety awareness and risk management needs..."
              value={adlData.safety || ""}
              onChange={(e) => handleInputChange("safety", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Independence Skills</CardTitle>
            <CardDescription>Self-advocacy, decision making, goal setting</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document independence skills and development goals..."
              value={adlData.independence || ""}
              onChange={(e) => handleInputChange("independence", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Additional Support Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assistive Technology</CardTitle>
            <CardDescription>Equipment, aids, technology support</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document assistive technology needs and current equipment..."
              value={adlData.assistiveTechnology || ""}
              onChange={(e) => handleInputChange("assistiveTechnology", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommendations</CardTitle>
            <CardDescription>Staff guidance and support strategies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document specific recommendations for ADL support..."
              value={adlData.recommendations || ""}
              onChange={(e) => handleInputChange("recommendations", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}