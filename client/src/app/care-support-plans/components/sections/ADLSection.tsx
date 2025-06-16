import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Home, User, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ADLArea {
  id: string;
  category: string;
  supportLevel: string;
  description: string;
  strategies: string;
  equipment: string;
}

interface ADLSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function ADLSection({ data, onChange, selectedClient, planData }: ADLSectionProps) {
  const [formData, setFormData] = useState({
    overallSummary: data.overallSummary || "",
    adlAreas: data.adlAreas || [],
    generatedContent: data.generatedContent || "",
    adlInput: data.adlInput || "",
    ...data
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const adlCategories = [
    "Personal Care & Hygiene",
    "Dressing & Grooming",
    "Eating & Nutrition",
    "Mobility & Transfers",
    "Toileting & Continence",
    "Medication Management",
    "Home Management",
    "Shopping & Errands",
    "Financial Management",
    "Communication",
    "Transportation",
    "Safety & Risk Management"
  ];

  useEffect(() => {
    // Initialize ADL areas if empty
    if (formData.adlAreas.length === 0) {
      const initialAreas = adlCategories.map((category, index) => ({
        id: `adl-${index}`,
        category,
        supportLevel: "independent",
        description: "",
        strategies: "",
        equipment: ""
      }));
      setFormData(prev => ({
        ...prev,
        adlAreas: initialAreas
      }));
    }
  }, []);

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateADLArea = (areaId: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      adlAreas: prev.adlAreas.map((area: ADLArea) => 
        area.id === areaId ? { ...area, [field]: value } : area
      )
    }));
  };

  const generateContentMutation = useMutation({
    mutationFn: (userInput: string) => apiRequest("POST", "/api/care-support-plans/generate-ai", {
      section: "adl",
      userInput,
      clientName: selectedClient?.fullName || "Client",
      clientDiagnosis: selectedClient?.diagnosis || "Not specified",
      maxWords: 400
    }),
    onSuccess: (response) => {
      setFormData(prev => ({
        ...prev,
        generatedContent: response.generatedContent
      }));
      toast({
        title: "ADL Support Strategies Generated",
        description: "AI has created comprehensive ADL support strategies based on your input.",
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
    if (!formData.adlInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the client's ADL needs first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(formData.adlInput);
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated ADL strategies have been copied to clipboard.",
      });
    }
  };

  const getSupportLevelColor = (level: string) => {
    const colors = {
      "independent": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "minimal": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "moderate": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "substantial": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "high": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    return colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI ADL Support Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adlInput">ADL Assessment Notes</Label>
            <Textarea
              id="adlInput"
              value={formData.adlInput}
              onChange={(e) => handleInputChange("adlInput", e.target.value)}
              placeholder="Describe the client's current abilities, challenges, and support needs across different activities of daily living. Include any equipment used or strategies that work well."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !formData.adlInput.trim()}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating ADL Strategies...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate ADL Support Strategies
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated ADL Strategies:</h4>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Overall ADL Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="overallSummary">Overall Assessment Summary</Label>
            <Textarea
              id="overallSummary"
              value={formData.overallSummary}
              onChange={(e) => handleInputChange("overallSummary", e.target.value)}
              placeholder="Provide an overall summary of the client's ADL abilities, progress, and support requirements."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            ADL Assessment by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {formData.adlAreas.map((area: ADLArea) => (
              <Card key={area.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{area.category}</h4>
                    <Badge className={getSupportLevelColor(area.supportLevel)}>
                      {area.supportLevel} support
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Support Level Required</Label>
                    <Select 
                      value={area.supportLevel} 
                      onValueChange={(value) => updateADLArea(area.id, "supportLevel", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="independent">Independent</SelectItem>
                        <SelectItem value="minimal">Minimal Support</SelectItem>
                        <SelectItem value="moderate">Moderate Support</SelectItem>
                        <SelectItem value="substantial">Substantial Support</SelectItem>
                        <SelectItem value="high">High Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Current Abilities & Challenges</Label>
                    <Textarea
                      value={area.description}
                      onChange={(e) => updateADLArea(area.id, "description", e.target.value)}
                      placeholder={`Describe the client's current abilities and challenges with ${area.category.toLowerCase()}`}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Support Strategies</Label>
                    <Textarea
                      value={area.strategies}
                      onChange={(e) => updateADLArea(area.id, "strategies", e.target.value)}
                      placeholder="Specific strategies, techniques, or approaches used to support this area"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Equipment & Aids</Label>
                    <Textarea
                      value={area.equipment}
                      onChange={(e) => updateADLArea(area.id, "equipment", e.target.value)}
                      placeholder="Any equipment, aids, or modifications used for this area"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            <strong>ADL Assessment:</strong> Activities of Daily Living assessment helps identify specific support needs 
            and strategies to promote {selectedClient.fullName}'s independence and quality of life. Use the AI generator 
            to create comprehensive support strategies based on assessment findings.
          </p>
        </div>
      )}
    </div>
  );
}