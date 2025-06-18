import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, Utensils, AlertCircle, Heart, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface RiskParameter {
  id: string;
  risk: string;
  severity: 'low' | 'medium' | 'high';
  preventionStrategy: string;
  responseStrategy: string;
  monitoringRequired: boolean;
  equipmentNeeded: string;
  staffTraining: string;
}

const RISK_TYPES = [
  'Choking', 'Aspiration', 'Swallowing difficulties', 'Food allergies', 'Medication interactions',
  'Behavioural concerns', 'Cultural/religious restrictions', 'Texture intolerance', 
  'Nutritional deficiency', 'Dehydration', 'Weight management', 'Blood sugar management'
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-800' }
];

const TEXTURE_MODIFICATIONS = [
  'Regular texture', 'Soft diet', 'Minced and moist', 'Smooth pureed', 'Liquidised',
  'Thickened fluids - Level 1', 'Thickened fluids - Level 2', 'Thickened fluids - Level 3'
];

const ASSISTANCE_LEVELS = [
  'Independent', 'Supervision only', 'Setup assistance', 'Partial physical assistance',
  'Total assistance', 'Feeding required', 'Specialised positioning'
];

export function MealtimeSectionRefactored() {
  const { planData, dispatch } = useCarePlan();
  const { toast } = useToast();
  
  const mealtimeData = planData?.mealtimeData || {
    userInput: '',
    generatedContent: '',
    riskParameters: [],
    dietaryRequirements: '',
    textureModifications: '',
    assistanceLevel: '',
    mealtimeEnvironment: '',
    socialAspects: '',
    nutritionalConsiderations: '',
    emergencyProcedures: '',
    staffGuidance: '',
    monitoringRequirements: '',
    equipmentNeeds: ''
  };

  const [newRisk, setNewRisk] = useState<RiskParameter>({
    id: '',
    risk: '',
    severity: 'medium',
    preventionStrategy: '',
    responseStrategy: '',
    monitoringRequired: false,
    equipmentNeeded: '',
    staffTraining: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'mealtimeData',
      data: {
        ...mealtimeData,
        [field]: value
      }
    });
  };

  const handleRiskChange = (field: string, value: string | boolean) => {
    setNewRisk(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addRisk = () => {
    if (!newRisk.risk || !newRisk.preventionStrategy) {
      toast({
        title: "Missing Information",
        description: "Please enter risk type and prevention strategy before adding.",
        variant: "destructive",
      });
      return;
    }

    const risk: RiskParameter = {
      ...newRisk,
      id: Date.now().toString()
    };

    const updatedRisks = [...mealtimeData.riskParameters, risk];
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'mealtimeData',
      data: {
        ...mealtimeData,
        riskParameters: updatedRisks
      }
    });
    
    setNewRisk({
      id: '',
      risk: '',
      severity: 'medium',
      preventionStrategy: '',
      responseStrategy: '',
      monitoringRequired: false,
      equipmentNeeded: '',
      staffTraining: ''
    });

    toast({
      title: "Risk Parameter Added",
      description: `${newRisk.risk} risk management has been added`,
    });
  };

  const removeRisk = (riskId: string) => {
    const updatedRisks = mealtimeData.riskParameters.filter((r: any) => r.id !== riskId);
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'mealtimeData',
      data: {
        ...mealtimeData,
        riskParameters: updatedRisks
      }
    });

    toast({
      title: "Risk Parameter Removed",
      description: "Risk parameter has been deleted from the plan.",
    });
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!mealtimeData.userInput?.trim()) {
        throw new Error("Please enter mealtime assessment information first.");
      }

      setIsGenerating(true);
      const userInput = mealtimeData.userInput;

      const existingContent = {
        dietaryRequirements: mealtimeData.dietaryRequirements || "",
        textureModifications: mealtimeData.textureModifications || "",
        assistanceLevel: mealtimeData.assistanceLevel || "",
        mealtimeEnvironment: mealtimeData.mealtimeEnvironment || "",
        socialAspects: mealtimeData.socialAspects || "",
        nutritionalConsiderations: mealtimeData.nutritionalConsiderations || "",
        emergencyProcedures: mealtimeData.emergencyProcedures || "",
        staffGuidance: mealtimeData.staffGuidance || "",
        monitoringRequirements: mealtimeData.monitoringRequirements || "",
        equipmentNeeds: mealtimeData.equipmentNeeds || ""
      };

      const riskContext = mealtimeData.riskParameters.length > 0 
        ? `Current risk parameters: ${mealtimeData.riskParameters.map((r: any) => `${r.risk} (${r.severity} severity)`).join('; ')}`
        : "No specific mealtime risks documented yet";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "mealtime",
        userInput: `${userInput}\n\n${riskContext}`,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: planData?.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField,
        existingContent
      });
      return await response.json();
    },
    onSuccess: (responseData, { targetField }) => {
      const generatedText = responseData.generatedContent || "";
      
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
          dietaryRequirements: "Dietary Requirements",
          textureModifications: "Texture Modifications",
          assistanceLevel: "Assistance Level",
          mealtimeEnvironment: "Mealtime Environment",
          socialAspects: "Social Aspects",
          nutritionalConsiderations: "Nutritional Considerations",
          emergencyProcedures: "Emergency Procedures",
          staffGuidance: "Staff Guidance",
          monitoringRequirements: "Monitoring Requirements",
          equipmentNeeds: "Equipment Needs"
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
    generateContentMutation.mutate({ targetField: 'preview' });
  };

  const handleGenerateTargetedContent = (targetField: string) => {
    generateContentMutation.mutate({ targetField });
  };

  const getSeverityBadge = (severity: string) => {
    const option = SEVERITY_LEVELS.find(s => s.value === severity);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Mealtime Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's mealtime needs, risks, dietary requirements, and support strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mealtimeInput">Mealtime Assessment Information</Label>
            <Textarea
              id="mealtimeInput"
              placeholder="Enter details about the client's dietary needs, swallowing risks, assistance requirements, cultural considerations, etc..."
              value={mealtimeData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !mealtimeData.userInput?.trim()}
            className="w-full mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Mealtime Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Mealtime Content
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('dietaryRequirements')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Dietary Needs
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('textureModifications')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Texture Mods
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('assistanceLevel')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Assistance
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('emergencyProcedures')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Emergency
            </Button>
          </div>

          {mealtimeData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("dietaryRequirements", mealtimeData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to Dietary Requirements field.",
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
                {mealtimeData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Parameter Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Mealtime Risk Management
          </CardTitle>
          <CardDescription>
            Identify and manage specific mealtime risks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Risk Type</Label>
              <Select value={newRisk.risk} onValueChange={(value) => handleRiskChange('risk', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select risk type" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_TYPES.map(risk => (
                    <SelectItem key={risk} value={risk}>{risk}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity Level</Label>
              <Select value={newRisk.severity} onValueChange={(value) => handleRiskChange('severity', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_LEVELS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Prevention Strategy</Label>
              <Textarea
                placeholder="How to prevent this risk from occurring..."
                value={newRisk.preventionStrategy}
                onChange={(e) => handleRiskChange('preventionStrategy', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Response Strategy</Label>
              <Textarea
                placeholder="What to do if this risk occurs..."
                value={newRisk.responseStrategy}
                onChange={(e) => handleRiskChange('responseStrategy', e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Equipment Needed</Label>
                <Input
                  placeholder="Specialized equipment required"
                  value={newRisk.equipmentNeeded}
                  onChange={(e) => handleRiskChange('equipmentNeeded', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Staff Training Required</Label>
                <Input
                  placeholder="Specific training staff need"
                  value={newRisk.staffTraining}
                  onChange={(e) => handleRiskChange('staffTraining', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="monitoring"
                checked={newRisk.monitoringRequired}
                onChange={(e) => handleRiskChange('monitoringRequired', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <Label htmlFor="monitoring">Continuous monitoring required</Label>
            </div>
          </div>

          <Button onClick={addRisk} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Risk Parameter
          </Button>

          {mealtimeData.riskParameters.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Prevention</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Monitoring</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mealtimeData.riskParameters.map((risk: any) => (
                    <TableRow key={risk.id}>
                      <TableCell>
                        <div className="font-medium">{risk.risk}</div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(risk.severity)}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {risk.preventionStrategy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {risk.responseStrategy}
                        </div>
                      </TableCell>
                      <TableCell>
                        {risk.monitoringRequired ? (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Required</Badge>
                        ) : (
                          <Badge variant="outline">Not Required</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRisk(risk.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mealtime Support Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-green-600" />
              Dietary Requirements
            </CardTitle>
            <CardDescription>Special dietary needs and restrictions</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document dietary requirements, allergies, cultural/religious restrictions, preferences..."
              value={mealtimeData.dietaryRequirements || ""}
              onChange={(e) => handleInputChange("dietaryRequirements", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Texture Modifications</CardTitle>
            <CardDescription>Food and fluid texture requirements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Select 
                value={mealtimeData.textureModifications} 
                onValueChange={(value) => handleInputChange('textureModifications', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select texture level" />
                </SelectTrigger>
                <SelectContent>
                  {TEXTURE_MODIFICATIONS.map(texture => (
                    <SelectItem key={texture} value={texture}>{texture}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Additional texture modification details and specific instructions..."
                value={mealtimeData.textureModifications || ""}
                onChange={(e) => handleInputChange("textureModifications", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assistance Level</CardTitle>
            <CardDescription>Required support during meals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Select 
                value={mealtimeData.assistanceLevel} 
                onValueChange={(value) => handleInputChange('assistanceLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assistance level" />
                </SelectTrigger>
                <SelectContent>
                  {ASSISTANCE_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Additional assistance details and specific support strategies..."
                value={mealtimeData.assistanceLevel || ""}
                onChange={(e) => handleInputChange("assistanceLevel", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mealtime Environment</CardTitle>
            <CardDescription>Environmental considerations and setup</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document environmental needs, seating arrangements, noise levels, social setting..."
              value={mealtimeData.mealtimeEnvironment || ""}
              onChange={(e) => handleInputChange("mealtimeEnvironment", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              Social Aspects
            </CardTitle>
            <CardDescription>Social interaction and mealtime experience</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document social preferences, interaction needs, family involvement, cultural practices..."
              value={mealtimeData.socialAspects || ""}
              onChange={(e) => handleInputChange("socialAspects", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nutritional Considerations</CardTitle>
            <CardDescription>Nutritional goals and monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document nutritional goals, weight management, supplementation, hydration needs..."
              value={mealtimeData.nutritionalConsiderations || ""}
              onChange={(e) => handleInputChange("nutritionalConsiderations", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Additional Support Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Emergency Procedures</CardTitle>
            <CardDescription>Emergency response protocols</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document emergency procedures for choking, aspiration, allergic reactions, etc..."
              value={mealtimeData.emergencyProcedures || ""}
              onChange={(e) => handleInputChange("emergencyProcedures", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staff Guidance</CardTitle>
            <CardDescription>Instructions for support workers</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document specific staff guidance for mealtime support and safety protocols..."
              value={mealtimeData.staffGuidance || ""}
              onChange={(e) => handleInputChange("staffGuidance", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Monitoring Requirements
            </CardTitle>
            <CardDescription>Ongoing monitoring and assessment needs</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document monitoring requirements, frequency, indicators to watch for..."
              value={mealtimeData.monitoringRequirements || ""}
              onChange={(e) => handleInputChange("monitoringRequirements", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipment Needs</CardTitle>
            <CardDescription>Specialized equipment and adaptive tools</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document specialized utensils, plates, cups, positioning equipment, etc..."
              value={mealtimeData.equipmentNeeds || ""}
              onChange={(e) => handleInputChange("equipmentNeeds", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}