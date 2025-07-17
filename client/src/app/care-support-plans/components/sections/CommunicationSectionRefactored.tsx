import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, CheckCircle2, MessageSquare, Mic, Eye, Hand } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

const COMMUNICATION_METHODS = [
  'Verbal speech', 'Sign language', 'Picture cards', 'Communication device', 
  'Writing', 'Gestures', 'Body language', 'Apps/Technology', 'Symbols', 'Makaton'
];

const PREFERRED_FORMATS = [
  'Visual aids', 'Audio instructions', 'Written text', 'Demonstrations',
  'Simple language', 'Repeated instructions', 'Pictures/symbols', 'Videos'
];

const COMPREHENSION_LEVELS = [
  'Complex conversations', 'Simple conversations', 'Basic instructions',
  'Key words only', 'Non-verbal cues', 'Visual supports needed'
];

const COMMUNICATION_CHALLENGES = [
  'Speech clarity', 'Understanding complex language', 'Social communication',
  'Initiating conversation', 'Following instructions', 'Expressing needs',
  'Reading comprehension', 'Writing skills', 'Technology barriers'
];

const COMMUNICATION_STRENGTHS = [
  'Good listening skills', 'Clear speech', 'Uses gestures well',
  'Understands visual cues', 'Technology savvy', 'Expressive',
  'Good vocabulary', 'Follows instructions well', 'Social engagement'
];

export function CommunicationSectionRefactored() {
  const { planData, updateField, state, clientData, selectedClient } = useCarePlan();
  const { toast } = useToast();
  
  const communicationData = planData?.communicationData || {
    userInput: '',
    generatedContent: '',
    receptiveStrategies: '',
    expressiveStrategies: '',
    augmentativeTools: '',
    environmentalSupports: '',
    socialInteraction: '',
    staffApproaches: '',
    communicationGoals: '',
    assistiveTechnology: '',
    primaryMethods: [],
    comprehensionLevel: '',
    expressionAbilities: '',
    preferredFormats: [],
    challenges: [],
    strengths: []
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    updateField('communicationData', field, value);
  };

  const toggleArrayItem = (field: string, item: string) => {
    const currentArray = communicationData[field as keyof typeof communicationData] as string[] || [];
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    
    updateField('communicationData', field, updatedArray);
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField, userInput }: { targetField: string; userInput: string }) => {
      setIsGenerating(true);

      const existingContent = {
        receptiveStrategies: communicationData.receptiveStrategies || "",
        expressiveStrategies: communicationData.expressiveStrategies || "",
        staffApproaches: communicationData.staffApproaches || "",
        assistiveTechnology: communicationData.assistiveTechnology || ""
      };

      const contextInfo = [];
      if (communicationData.primaryMethods.length > 0) {
        contextInfo.push(`Primary methods: ${communicationData.primaryMethods.join(', ')}`);
      }
      if (communicationData.comprehensionLevel) {
        contextInfo.push(`Comprehension level: ${communicationData.comprehensionLevel}`);
      }
      if (communicationData.challenges.length > 0) {
        contextInfo.push(`Challenges: ${communicationData.challenges.join(', ')}`);
      }
      if (communicationData.strengths.length > 0) {
        contextInfo.push(`Strengths: ${communicationData.strengths.join(', ')}`);
      }

      const contextString = contextInfo.length > 0 ? `\n\nContext: ${contextInfo.join('; ')}` : '';

      // Enhanced payload structure like Goals section
      const payload = {
        section: "communication",
        userInput: `${userInput}${contextString}`,
        targetField,
        planId: planData?.id || state?.id,
        clientName:
          selectedClient?.fullName || planData?.clientName || clientData?.fullName || "Client",
        clientDiagnosis:
          planData?.aboutMeData?.diagnosis ||
          selectedClient?.primaryDiagnosis ||
          clientData?.primaryDiagnosis ||
          "Not specified",
        maxWords: 200,
        existingContent
      };
      
      console.log("[COMMUNICATION DEBUG] Enhanced payload:", payload);
      console.log("[COMMUNICATION DEBUG] planData:", planData);
      console.log("[COMMUNICATION DEBUG] About to send request to backend with planId:", payload.planId);
      
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", payload);
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.content || "";
      
      if (targetField === 'preview') {
        handleInputChange('generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        handleInputChange(targetField, generatedText);
        handleInputChange('generatedContent', '');
        
        const fieldLabels: { [key: string]: string } = {
          receptiveStrategies: "Receptive Communication",
          expressiveStrategies: "Expressive Communication",
          staffApproaches: "Staff Instructions & Approaches",
          assistiveTechnology: "Assistive Technology"
        };
        
        toast({
          title: "AI Content Generated",
          description: `${fieldLabels[targetField] || targetField} has been populated with targeted content.`,
        });
      }
      setIsGenerating(false);
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateInitialContent = () => {
    if (!communicationData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter communication assessment information first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({ 
      targetField: 'preview',
      userInput: communicationData.userInput 
    });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    if (!communicationData.userInput?.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter communication assessment information first.",
        variant: "destructive",
      });
      return;
    }


    generateContentMutation.mutate({ 
      targetField,
      userInput: communicationData.userInput 
    });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Communication Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's communication abilities, challenges, and support needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="communicationInput">Communication Assessment Information</Label>
            <Textarea
              id="communicationInput"
              placeholder="Enter details about the client's communication abilities, preferred methods, challenges, assistive technology needs, etc..."
              value={communicationData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !communicationData.userInput?.trim()}
            className="w-full mb-4"
          >
            {isGenerating ? (
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

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('receptiveStrategies')}
              disabled={isGenerating || !communicationData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Receptive
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('expressiveStrategies')}
              disabled={isGenerating || !communicationData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Expressive
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('staffApproaches')}
              disabled={isGenerating || !communicationData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Staff Instructions
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('assistiveTechnology')}
              disabled={isGenerating || !communicationData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Assistive Tech
            </Button>
          </div>

          {communicationData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("receptiveStrategies", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Receptive Communication field.",
                    });
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Use This Content
                </Button>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {communicationData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communication Assessment Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Communication Profile
          </CardTitle>
          <CardDescription>
            Complete assessment of communication abilities and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Primary Communication Methods</Label>
              <div className="grid grid-cols-2 gap-2">
                {COMMUNICATION_METHODS.map(method => (
                  <Button
                    key={method}
                    variant={communicationData.primaryMethods.includes(method) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem('primaryMethods', method)}
                    className="justify-start text-left"
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comprehension Level</Label>
              <Select 
                value={communicationData.comprehensionLevel} 
                onValueChange={(value) => handleInputChange('comprehensionLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select comprehension level" />
                </SelectTrigger>
                <SelectContent>
                  {COMPREHENSION_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Communication Challenges</Label>
              <div className="grid grid-cols-1 gap-2">
                {COMMUNICATION_CHALLENGES.map(challenge => (
                  <Button
                    key={challenge}
                    variant={communicationData.challenges.includes(challenge) ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem('challenges', challenge)}
                    className="justify-start text-left"
                  >
                    {challenge}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Communication Strengths</Label>
              <div className="grid grid-cols-1 gap-2">
                {COMMUNICATION_STRENGTHS.map(strength => (
                  <Button
                    key={strength}
                    variant={communicationData.strengths.includes(strength) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayItem('strengths', strength)}
                    className="justify-start text-left bg-green-100 hover:bg-green-200 text-green-800"
                  >
                    {strength}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preferred Communication Formats</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PREFERRED_FORMATS.map(format => (
                <Button
                  key={format}
                  variant={communicationData.preferredFormats.includes(format) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleArrayItem('preferredFormats', format)}
                  className="justify-start text-left"
                >
                  {format}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expressionAbilities">Expression Abilities</Label>
            <Textarea
              id="expressionAbilities"
              placeholder="Describe how the client expresses themselves, their communication style, and expression abilities..."
              value={communicationData.expressionAbilities || ""}
              onChange={(e) => handleInputChange("expressionAbilities", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Communication Strategies - Only Approved AI Target Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Receptive Communication
            </CardTitle>
            <CardDescription>How client receives and understands information</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document receptive communication strategies, comprehension support, and information processing approaches..."
              value={communicationData.receptiveStrategies || ""}
              onChange={(e) => handleInputChange("receptiveStrategies", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-green-600" />
              Expressive Communication
            </CardTitle>
            <CardDescription>How client communicates their needs and thoughts</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document expressive communication strategies, output methods, and expression support techniques..."
              value={communicationData.expressiveStrategies || ""}
              onChange={(e) => handleInputChange("expressiveStrategies", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staff Instructions & Approaches</CardTitle>
            <CardDescription>How staff should communicate with client</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document specific staff communication approaches, language level, timing, and interaction strategies..."
              value={communicationData.staffApproaches || ""}
              onChange={(e) => handleInputChange("staffApproaches", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hand className="h-5 w-5 text-purple-600" />
              Assistive Technology
            </CardTitle>
            <CardDescription>Technology supports and devices</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document assistive technology, communication apps, devices, and technical supports..."
              value={communicationData.assistiveTechnology || ""}
              onChange={(e) => handleInputChange("assistiveTechnology", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}