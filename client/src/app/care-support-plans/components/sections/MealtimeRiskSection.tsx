import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Utensils, AlertTriangle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MealtimeRiskSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function MealtimeRiskSection({ data, onChange, selectedClient, planData }: MealtimeRiskSectionProps) {
  const [formData, setFormData] = useState({
    riskAssessment: data.riskAssessment || "",
    dietaryRequirements: data.dietaryRequirements || "",
    swallowingAssessment: data.swallowingAssessment || "",
    supportStrategies: data.supportStrategies || "",
    emergencyProcedures: data.emergencyProcedures || "",
    equipmentNeeds: data.equipmentNeeds || "",
    riskFactors: data.riskFactors || [],
    generatedContent: data.generatedContent || "",
    mealtimeInput: data.mealtimeInput || "",
    ...data
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const riskFactorOptions = [
    "Dysphagia (swallowing difficulties)",
    "Aspiration risk",
    "Choking risk",
    "Modified texture requirements",
    "Thickened fluids required",
    "Positioning requirements",
    "Feeding assistance needed",
    "Behavioral issues during meals",
    "Food allergies/intolerances",
    "Medication interactions with food",
    "Cognitive impairment affecting eating",
    "Physical disability affecting self-feeding",
    "Oral health issues",
    "Weight management concerns"
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

  const handleRiskFactorToggle = (factor: string, checked: boolean) => {
    setFormData((prev: any) => ({
      ...prev,
      riskFactors: checked 
        ? [...prev.riskFactors, factor]
        : prev.riskFactors.filter((f: string) => f !== factor)
    }));
  };

  const generateContentMutation = useMutation({
    mutationFn: (userInput: string) => apiRequest("POST", "/api/care-support-plans/generate-ai", {
      section: "mealtime",
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
        title: "Mealtime Risk Plan Generated",
        description: "AI has created comprehensive mealtime safety strategies.",
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
    const selectedRisks = formData.riskFactors.join(", ");
    const inputContent = `Risk factors: ${selectedRisks}. Additional details: ${formData.mealtimeInput}`;
    
    if (formData.riskFactors.length === 0 && !formData.mealtimeInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please select risk factors or provide additional details first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(inputContent);
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated mealtime risk plan has been copied to clipboard.",
      });
    }
  };

  const getRiskLevel = () => {
    const highRiskFactors = [
      "Dysphagia (swallowing difficulties)",
      "Aspiration risk", 
      "Choking risk",
      "Thickened fluids required"
    ];
    const hasHighRisk = formData.riskFactors.some((factor: string) => 
      highRiskFactors.includes(factor)
    );
    
    if (hasHighRisk) return { level: "High", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
    if (formData.riskFactors.length > 0) return { level: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" };
    return { level: "Low", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
  };

  const riskLevel = getRiskLevel();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Mealtime Risk Management Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Risk Factors (select all that apply)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {riskFactorOptions.map((factor) => (
                <div key={factor} className="flex items-center space-x-2">
                  <Checkbox
                    id={factor}
                    checked={formData.riskFactors.includes(factor)}
                    onCheckedChange={(checked) => handleRiskFactorToggle(factor, checked as boolean)}
                  />
                  <Label htmlFor={factor} className="text-sm font-normal">
                    {factor}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mealtimeInput">Additional Mealtime Details</Label>
            <Textarea
              id="mealtimeInput"
              value={formData.mealtimeInput}
              onChange={(e) => handleInputChange("mealtimeInput", e.target.value)}
              placeholder="Describe specific mealtime challenges, current strategies, or additional risk factors not listed above"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <Badge className={riskLevel.color}>
              {riskLevel.level} Risk Level
            </Badge>
            <span className="text-sm text-muted-foreground">
              Based on selected risk factors
            </span>
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || (formData.riskFactors.length === 0 && !formData.mealtimeInput.trim())}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Risk Management Plan...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Mealtime Risk Management Plan
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated Risk Management Plan:</h4>
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
            <Utensils className="h-5 w-5" />
            Dietary Requirements & Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dietaryRequirements">Dietary Requirements & Restrictions</Label>
            <Textarea
              id="dietaryRequirements"
              value={formData.dietaryRequirements}
              onChange={(e) => handleInputChange("dietaryRequirements", e.target.value)}
              placeholder="Special diets, allergies, cultural/religious dietary requirements, texture modifications, etc."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="swallowingAssessment">Swallowing Assessment & Recommendations</Label>
            <Textarea
              id="swallowingAssessment"
              value={formData.swallowingAssessment}
              onChange={(e) => handleInputChange("swallowingAssessment", e.target.value)}
              placeholder="Speech pathologist recommendations, IDDSI levels, texture modifications, fluid consistency requirements"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="riskAssessment">Comprehensive Risk Assessment</Label>
            <Textarea
              id="riskAssessment"
              value={formData.riskAssessment}
              onChange={(e) => handleInputChange("riskAssessment", e.target.value)}
              placeholder="Detailed assessment of mealtime risks, triggers, and contributing factors"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Safety Strategies & Emergency Procedures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportStrategies">Mealtime Support Strategies</Label>
            <Textarea
              id="supportStrategies"
              value={formData.supportStrategies}
              onChange={(e) => handleInputChange("supportStrategies", e.target.value)}
              placeholder="Specific strategies for safe mealtime support, positioning, supervision level, cueing techniques"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipmentNeeds">Equipment & Environmental Modifications</Label>
            <Textarea
              id="equipmentNeeds"
              value={formData.equipmentNeeds}
              onChange={(e) => handleInputChange("equipmentNeeds", e.target.value)}
              placeholder="Adaptive equipment, seating requirements, environmental modifications for safe eating"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyProcedures">Emergency Procedures</Label>
            <Textarea
              id="emergencyProcedures"
              value={formData.emergencyProcedures}
              onChange={(e) => handleInputChange("emergencyProcedures", e.target.value)}
              placeholder="Step-by-step procedures for choking, aspiration, or other mealtime emergencies"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Mealtime Safety:</strong> Comprehensive risk management ensures {selectedClient.fullName}'s 
            safety and dignity during meals. Regular review with speech pathologists and healthcare professionals 
            is essential for maintaining current and appropriate support strategies.
          </p>
        </div>
      )}
    </div>
  );
}