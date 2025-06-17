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

interface CommunicationSectionCompleteProps {
  data: any;
  updateData: (section: string, data: any) => void;
  selectedClient?: any;
  planData?: any;
}

interface CommunicationData {
  userInput: string;
  generatedContent: string;
  receptiveStrategies: string;
  expressiveStrategies: string;
  augmentativeTools: string;
  environmentalSupports: string;
  socialInteraction: string;
  staffApproaches: string;
  communicationGoals: string;
  assistiveTechnology: string;
  primaryMethods: string[];
  comprehensionLevel: string;
  expressionAbilities: string;
  preferredFormats: string[];
  challenges: string[];
  strengths: string[];
}

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

export function CommunicationSectionComplete({ data, updateData, selectedClient, planData }: CommunicationSectionCompleteProps) {
  const { toast } = useToast();
  const communicationData: CommunicationData = data?.communicationData || {
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

  // Function to refresh GPT limit after content application
  const refreshGPTLimit = () => {
    console.log("GPT limit refreshed for next communication generation");
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    const updatedData = {
      ...communicationData,
      [field]: value
    };
    updateData('communicationData', updatedData);
  };

  const toggleArrayItem = (field: string, item: string) => {
    const currentArray = communicationData[field as keyof CommunicationData] as string[] || [];
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    handleInputChange(field, updatedArray);
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!communicationData.userInput?.trim()) {
        throw new Error("Please enter communication assessment information first.");
      }

      setIsGenerating(true);
      const userInput = communicationData.userInput;

      // Gather existing content and selections for context
      const existingContent = {
        receptiveStrategies: communicationData.receptiveStrategies || "",
        expressiveStrategies: communicationData.expressiveStrategies || "",
        augmentativeTools: communicationData.augmentativeTools || "",
        environmentalSupports: communicationData.environmentalSupports || "",
        socialInteraction: communicationData.socialInteraction || "",
        staffApproaches: communicationData.staffApproaches || "",
        communicationGoals: communicationData.communicationGoals || "",
        assistiveTechnology: communicationData.assistiveTechnology || ""
      };

      // Include selected preferences for context
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

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "communication",
        userInput: `${userInput}${contextString}`,
        clientName: selectedClient?.fullName || planData?.clientData?.fullName || "Client",
        clientDiagnosis: selectedClient?.primaryDiagnosis || planData?.clientData?.primaryDiagnosis || "Not specified",
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
        handleInputChange('generatedContent', generatedText);
        toast({
          title: "Content Generated",
          description: "Review the AI-generated content and choose which field to populate.",
        });
      } else {
        // Update the specific targeted field directly
        handleInputChange(targetField, generatedText);
        
        // Clear the preview content after applying to specific field
        handleInputChange('generatedContent', '');
        
        // Refresh GPT limit after each content application
        refreshGPTLimit();
        
        const fieldLabels: { [key: string]: string } = {
          receptiveStrategies: "Receptive Strategies",
          expressiveStrategies: "Expressive Strategies",
          augmentativeTools: "Augmentative Tools",
          environmentalSupports: "Environmental Supports",
          socialInteraction: "Social Interaction",
          staffApproaches: "Staff Approaches",
          communicationGoals: "Communication Goals",
          assistiveTechnology: "Assistive Technology"
        };
        
        toast({
          title: "AI Content Generated",
          description: `${fieldLabels[targetField] || targetField} has been populated with targeted content (200 words).`,
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

    generateContentMutation.mutate({ targetField: 'preview' });
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

    generateContentMutation.mutate({ targetField });
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

          {/* Primary AI Generation Button */}
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

          {/* Targeted "Add to [Section]" Buttons */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Refine Specific Areas</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              After initial generation, use these buttons to add targeted content to specific communication areas.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('receptiveStrategies')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Receptive
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('expressiveStrategies')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Expressive
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('augmentativeTools')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to AAC Tools
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('socialInteraction')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Social
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('staffApproaches')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Staff Approaches
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleGenerateTargetedContent('assistiveTechnology')}
                disabled={isGenerating || !communicationData.userInput?.trim()}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Add to Technology
              </Button>
            </div>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Generating targeted communication content with context awareness...</span>
            </div>
          )}

          {communicationData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("receptiveStrategies", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Receptive Strategies field. GPT limit refreshed.",
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
                {communicationData.generatedContent}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button 
                  onClick={() => {
                    handleInputChange("receptiveStrategies", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied",
                      description: "Added to Receptive Strategies field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Receptive
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("expressiveStrategies", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Expressive Strategies field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Expressive
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("augmentativeTools", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to AAC Tools field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to AAC Tools
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("socialInteraction", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Social Interaction field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Social
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("staffApproaches", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Staff Approaches field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Staff Approaches
                </Button>
                <Button 
                  onClick={() => {
                    handleInputChange("assistiveTechnology", communicationData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    refreshGPTLimit();
                    toast({
                      title: "Content Applied", 
                      description: "Added to Assistive Technology field. GPT limit refreshed.",
                    });
                  }}
                  variant="outline" 
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Add to Technology
                </Button>
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

      {/* Communication Strategies */}
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
            <CardTitle className="text-lg">Augmentative & Alternative Communication</CardTitle>
            <CardDescription>AAC tools and alternative communication methods</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document AAC devices, picture systems, sign language, and alternative communication tools..."
              value={communicationData.augmentativeTools || ""}
              onChange={(e) => handleInputChange("augmentativeTools", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environmental Supports</CardTitle>
            <CardDescription>Environmental modifications for communication</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document environmental supports, visual aids, acoustic considerations, and setting modifications..."
              value={communicationData.environmentalSupports || ""}
              onChange={(e) => handleInputChange("environmentalSupports", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Social Communication</CardTitle>
            <CardDescription>Social interaction and communication skills</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document social communication skills, interaction strategies, and peer communication approaches..."
              value={communicationData.socialInteraction || ""}
              onChange={(e) => handleInputChange("socialInteraction", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staff Communication Approaches</CardTitle>
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
      </div>

      {/* Additional Communication Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Communication Goals</CardTitle>
            <CardDescription>Specific communication development objectives</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document communication goals, skill development targets, and progress objectives..."
              value={communicationData.communicationGoals || ""}
              onChange={(e) => handleInputChange("communicationGoals", e.target.value)}
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