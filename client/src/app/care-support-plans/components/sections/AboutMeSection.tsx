import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, User, Heart, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AboutMeSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
  clients: any[];
}

// Helper function to extract specific sections from generated content
const extractSection = (text: string, keyword: string): string => {
  const lines = text.split('\n');
  const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
  
  for (let i = 0; i < lines.length; i++) {
    if (keywordRegex.test(lines[i])) {
      // Found keyword, extract surrounding content
      const extractedLines = [];
      let j = i;
      while (j < lines.length && j < i + 3) {
        if (lines[j].trim()) extractedLines.push(lines[j].trim());
        j++;
      }
      return extractedLines.join(' ').replace(/^\W+/, '');
    }
  }
  return "";
};

export function AboutMeSection({ data, updateData, clients }: AboutMeSectionProps) {
  const aboutMeData = data.aboutMeData || {};
  const selectedClient = data.clientData;
  
  const [formData, setFormData] = useState(() => ({
    personalHistory: aboutMeData.personalHistory || "",
    interests: aboutMeData.interests || "",
    preferences: aboutMeData.preferences || "",
    strengths: aboutMeData.strengths || "",
    challenges: aboutMeData.challenges || "",
    familyBackground: aboutMeData.familyBackground || "",
    culturalConsiderations: aboutMeData.culturalConsiderations || "",
    generatedContent: aboutMeData.generatedContent || "",
    bulletPoints: aboutMeData.bulletPoints || "",
    userInput: aboutMeData.userInput || ""
  }));

  // Update form data when section data changes (when loading existing plan)
  useEffect(() => {
    setFormData({
      personalHistory: aboutMeData.personalHistory || "",
      interests: aboutMeData.interests || "",
      preferences: aboutMeData.preferences || "",
      strengths: aboutMeData.strengths || "",
      challenges: aboutMeData.challenges || "",
      familyBackground: aboutMeData.familyBackground || "",
      culturalConsiderations: aboutMeData.culturalConsiderations || "",
      generatedContent: aboutMeData.generatedContent || "",
      bulletPoints: aboutMeData.bulletPoints || "",
      userInput: aboutMeData.userInput || ""
    });
  }, [data.aboutMeData]);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Only update if there are actual changes to avoid overwriting existing data
    const hasChanges = Object.keys(formData).some(key => 
      formData[key as keyof typeof formData] !== aboutMeData[key]
    );
    
    if (hasChanges) {
      updateData('aboutMeData', formData);
    }
  }, [formData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateContentMutation = useMutation({
    mutationFn: async (userInput: string) => {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "aboutMe",
        userInput,
        clientName: selectedClient?.fullName || "Client",
        clientDiagnosis: selectedClient?.primaryDiagnosis || "Not specified",
        maxWords: 300,
        previousSections: data
      });
      return await response.json();
    },
    onSuccess: (responseData) => {
      const generatedText = responseData.generatedContent || "";
      
      // Parse the generated content and populate relevant fields
      setFormData(prev => ({
        ...prev,
        generatedContent: generatedText,
        personalHistory: generatedText, // Main content goes to personal history
        interests: prev.interests || "",
        preferences: prev.preferences || "",
        strengths: prev.strengths || "",
        challenges: prev.challenges || ""
      }));
      toast({
        title: "AI Content Generated",
        description: "Professional About Me section has been created and populated in the Personal History field.",
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
    if (!formData.bulletPoints.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some bullet points about the client first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(formData.bulletPoints);
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated content has been copied to clipboard.",
      });
    }
  };

  const handleUseContent = () => {
    if (formData.generatedContent) {
      setFormData(prev => ({
        ...prev,
        personalHistory: prev.personalHistory + (prev.personalHistory ? "\n\n" : "") + formData.generatedContent,
        generatedContent: ""
      }));
      toast({
        title: "Content Added",
        description: "AI-generated content has been added to the personal history section.",
      });
    }
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
            <Label htmlFor="bulletPoints">Key Points About the Client</Label>
            <Textarea
              id="bulletPoints"
              value={formData.bulletPoints}
              onChange={(e) => handleInputChange("bulletPoints", e.target.value)}
              placeholder="Enter bullet points about the client's background, interests, personality, family, etc. The AI will expand these into a professional About Me section."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !formData.bulletPoints.trim()}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate About Me Section
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated Content:</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {formData.generatedContent}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyContent}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button size="sm" onClick={handleUseContent}>
                  Use This Content
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personalHistory">Personal History & Background</Label>
            <Textarea
              id="personalHistory"
              value={formData.personalHistory}
              onChange={(e) => handleInputChange("personalHistory", e.target.value)}
              placeholder="Describe the client's personal history, life experiences, and background that are relevant to their care and support needs."
              rows={5}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interests">Interests & Hobbies</Label>
              <Textarea
                id="interests"
                value={formData.interests}
                onChange={(e) => handleInputChange("interests", e.target.value)}
                placeholder="What does the client enjoy doing? What are their hobbies and interests?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Preferences & Likes</Label>
              <Textarea
                id="preferences"
                value={formData.preferences}
                onChange={(e) => handleInputChange("preferences", e.target.value)}
                placeholder="What are the client's preferences for food, activities, environment, etc.?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="strengths">Strengths & Abilities</Label>
              <Textarea
                id="strengths"
                value={formData.strengths}
                onChange={(e) => handleInputChange("strengths", e.target.value)}
                placeholder="What are the client's strengths, skills, and abilities?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="challenges">Challenges & Support Needs</Label>
              <Textarea
                id="challenges"
                value={formData.challenges}
                onChange={(e) => handleInputChange("challenges", e.target.value)}
                placeholder="What challenges does the client face? What support do they need?"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Family & Cultural Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyBackground">Family Background & Relationships</Label>
            <Textarea
              id="familyBackground"
              value={formData.familyBackground}
              onChange={(e) => handleInputChange("familyBackground", e.target.value)}
              placeholder="Describe the client's family structure, relationships, and important people in their life."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="culturalConsiderations">Cultural & Religious Considerations</Label>
            <Textarea
              id="culturalConsiderations"
              value={formData.culturalConsiderations}
              onChange={(e) => handleInputChange("culturalConsiderations", e.target.value)}
              placeholder="Any cultural, religious, or spiritual considerations that are important for the client's care and support."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Tip:</strong> Use the AI generator to create a professional About Me section based on key points, 
            then review and customize the content to ensure accuracy and completeness for {selectedClient?.fullName || 'the client'}.
          </p>
        </div>
      )}
    </div>
  );
}