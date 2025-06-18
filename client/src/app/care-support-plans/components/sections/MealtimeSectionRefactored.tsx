import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, CheckCircle2, Utensils, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

const RISK_TYPES = [
  { id: 'choking', name: 'Choking', icon: '🚫', description: 'Risk of airway obstruction during eating' },
  { id: 'aspiration', name: 'Aspiration', icon: '💨', description: 'Risk of food/fluid entering airways' },
  { id: 'swallowing', name: 'Swallowing Difficulties', icon: '🔄', description: 'Dysphagia and swallowing challenges' },
  { id: 'allergies', name: 'Food Allergies', icon: '⚠️', description: 'Allergic reactions to specific foods' },
  { id: 'medications', name: 'Medication Interactions', icon: '💊', description: 'Food-drug interactions' },
  { id: 'behavioral', name: 'Behavioral Concerns', icon: '🧠', description: 'Mealtime behavioral challenges' },
  { id: 'cultural', name: 'Cultural/Religious', icon: '🕊️', description: 'Cultural and religious dietary requirements' },
  { id: 'texture', name: 'Texture Intolerance', icon: '🥄', description: 'Difficulty with specific food textures' }
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-800' }
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

  const [selectedRisk, setSelectedRisk] = useState<string>('choking');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string>('');
  
  // Individual risk data state
  const [riskData, setRiskData] = useState<{[key: string]: any}>({
    choking: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    aspiration: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    swallowing: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    allergies: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    medications: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    behavioral: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    cultural: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' },
    texture: { preventionStrategy: '', responseStrategy: '', equipmentNeeded: '', staffTraining: '', severity: 'medium' }
  });

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

  // Handle individual risk data changes
  const handleRiskDataChange = (riskType: string, field: string, value: string) => {
    setRiskData(prev => ({
      ...prev,
      [riskType]: {
        ...prev[riskType],
        [field]: value
      }
    }));
  };

  // Generate AI content for specific risk and field
  const generateRiskContent = async (riskType: string, targetField: string) => {
    if (!mealtimeData.userInput?.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter mealtime assessment information first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratingField(`${riskType}-${targetField}`);

    try {
      const riskInfo = RISK_TYPES.find(r => r.id === riskType);
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "mealtime",
        userInput: `${mealtimeData.userInput}\n\nFocus on ${riskInfo?.name}: ${riskInfo?.description}`,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: planData?.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField: `${riskType}_${targetField}`,
        riskType: riskInfo?.name,
        fieldType: targetField
      });

      const responseData = await response.json();
      const generatedText = responseData.generatedContent || "";

      // Update the generated content in mealtimeData for preview
      handleInputChange('generatedContent', generatedText);

      toast({
        title: "AI Content Generated",
        description: `Content generated for ${riskInfo?.name} ${targetField}`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingField('');
    }
  };

  // Add generated content to specific field
  const addContentToField = (riskType: string, field: string) => {
    if (mealtimeData.generatedContent) {
      handleRiskDataChange(riskType, field, mealtimeData.generatedContent);
      handleInputChange('generatedContent', '');
      toast({
        title: "Content Applied",
        description: `AI content added to ${RISK_TYPES.find(r => r.id === riskType)?.name} ${field}`,
      });
    }
  };

  // Generate global mealtime content
  const handleGenerateGlobalContent = async (targetField: string) => {
    if (!mealtimeData.userInput?.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter mealtime assessment information first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratingField(targetField);

    try {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "mealtime",
        userInput: mealtimeData.userInput,
        clientName: planData?.clientData?.fullName || "Client",
        clientDiagnosis: planData?.clientData?.primaryDiagnosis || "Not specified",
        maxWords: 200,
        targetField: `global_${targetField}`,
        fieldType: targetField
      });

      const responseData = await response.json();
      const generatedText = responseData.generatedContent || "";

      // Update the generated content in mealtimeData for preview
      handleInputChange('generatedContent', generatedText);

      toast({
        title: "AI Content Generated",
        description: `Global content generated for ${targetField}`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingField('');
    }
  };

  const getSeverityBadge = (severity: string) => {
    const level = SEVERITY_LEVELS.find(s => s.value === severity);
    return (
      <Badge className={level?.color || 'bg-gray-100 text-gray-800'}>
        {level?.label || severity}
      </Badge>
    );
  };

  const renderRiskBuilder = (riskType: typeof RISK_TYPES[0]) => {
    const data = riskData[riskType.id];
    
    return (
      <Card key={riskType.id} className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{riskType.icon}</span>
            {riskType.name} Management
          </CardTitle>
          <CardDescription>{riskType.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Prevention Strategy</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateRiskContent(riskType.id, 'preventionStrategy')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === `${riskType.id}-preventionStrategy` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="How to prevent this risk..."
                value={data.preventionStrategy || ""}
                onChange={(e) => handleRiskDataChange(riskType.id, 'preventionStrategy', e.target.value)}
                rows={4}
                className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Response Strategy</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateRiskContent(riskType.id, 'responseStrategy')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === `${riskType.id}-responseStrategy` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="What to do if this risk occurs..."
                value={data.responseStrategy || ""}
                onChange={(e) => handleRiskDataChange(riskType.id, 'responseStrategy', e.target.value)}
                rows={4}
                className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Equipment Needed</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateRiskContent(riskType.id, 'equipmentNeeded')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === `${riskType.id}-equipmentNeeded` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Specialized equipment required..."
                value={data.equipmentNeeded || ""}
                onChange={(e) => handleRiskDataChange(riskType.id, 'equipmentNeeded', e.target.value)}
                rows={3}
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Staff Training</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateRiskContent(riskType.id, 'staffTraining')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === `${riskType.id}-staffTraining` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Specific training staff need..."
                value={data.staffTraining || ""}
                onChange={(e) => handleRiskDataChange(riskType.id, 'staffTraining', e.target.value)}
                rows={3}
                className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Severity Level:</Label>
            <Select 
              value={data.severity || 'medium'} 
              onValueChange={(value) => handleRiskDataChange(riskType.id, 'severity', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map(level => (
                  <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getSeverityBadge(data.severity || 'medium')}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Client Mealtime Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-blue-600" />
            Client Mealtime Assessment
          </CardTitle>
          <CardDescription>
            Provide comprehensive mealtime assessment information for AI-powered content generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Mealtime Assessment Information
            </Label>
            <Textarea
              placeholder="Describe client's mealtime needs, abilities, challenges, current dietary requirements, swallowing assessment results, behavioral patterns during meals, cultural preferences, and any existing risk factors..."
              value={mealtimeData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {mealtimeData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => addContentToField(selectedRisk, 'preventionStrategy')}
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 bg-green-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Prevention
                  </Button>
                  <Button 
                    onClick={() => addContentToField(selectedRisk, 'responseStrategy')}
                    size="sm"
                    variant="outline"
                    className="text-yellow-700 border-yellow-200 bg-yellow-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Response
                  </Button>
                  <Button 
                    onClick={() => addContentToField(selectedRisk, 'equipmentNeeded')}
                    size="sm"
                    variant="outline"
                    className="text-blue-700 border-blue-200 bg-blue-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Equipment
                  </Button>
                  <Button 
                    onClick={() => addContentToField(selectedRisk, 'staffTraining')}
                    size="sm"
                    variant="outline"
                    className="text-purple-700 border-purple-200 bg-purple-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Training
                  </Button>
                </div>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {mealtimeData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Risk Builders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Individual Risk Management
          </CardTitle>
          <CardDescription>
            Build comprehensive management strategies for each mealtime risk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedRisk} onValueChange={setSelectedRisk}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6">
              {RISK_TYPES.map((risk) => (
                <TabsTrigger key={risk.id} value={risk.id} className="text-xs">
                  <span className="mr-1">{risk.icon}</span>
                  {risk.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {RISK_TYPES.map((risk) => (
              <TabsContent key={risk.id} value={risk.id}>
                {renderRiskBuilder(risk)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Review Centre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            AI Review Centre
          </CardTitle>
          <CardDescription>
            Comprehensive AI analysis and content generation for all mealtime management areas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => handleGenerateGlobalContent('comprehensiveRiskAnalysis')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating && generatingField === 'comprehensiveRiskAnalysis' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Comprehensive Risk Analysis
            </Button>
            <Button
              onClick={() => handleGenerateGlobalContent('mealtimeProtocols')}
              disabled={isGenerating || !mealtimeData.userInput?.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isGenerating && generatingField === 'mealtimeProtocols' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Mealtime Protocols Review
            </Button>
          </div>

          {mealtimeData.generatedContent && (
            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-purple-900 dark:text-purple-100">AI Generated Review Content:</h4>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      handleInputChange("dietaryRequirements", mealtimeData.generatedContent || "");
                      handleInputChange('generatedContent', '');
                      toast({
                        title: "Content Applied",
                        description: "AI content added to Dietary Requirements",
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 bg-green-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Dietary
                  </Button>
                  <Button 
                    onClick={() => {
                      handleInputChange("emergencyProcedures", mealtimeData.generatedContent || "");
                      handleInputChange('generatedContent', '');
                      toast({
                        title: "Content Applied",
                        description: "AI content added to Emergency Procedures",
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className="text-red-700 border-red-200 bg-red-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Emergency
                  </Button>
                  <Button 
                    onClick={() => {
                      handleInputChange("staffGuidance", mealtimeData.generatedContent || "");
                      handleInputChange('generatedContent', '');
                      toast({
                        title: "Content Applied",
                        description: "AI content added to Staff Guidance",
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className="text-blue-700 border-blue-200 bg-blue-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Add to Staff Guidance
                  </Button>
                </div>
              </div>
              <div className="text-sm text-purple-800 dark:text-purple-200 whitespace-pre-wrap">
                {mealtimeData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Mealtime Management Centre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            Global Mealtime Management Centre
          </CardTitle>
          <CardDescription>
            AI-powered global planning tools for comprehensive mealtime support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Dietary Requirements</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('dietaryRequirements')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'dietaryRequirements' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Special dietary needs, allergies, cultural restrictions..."
                value={mealtimeData.dietaryRequirements || ""}
                onChange={(e) => handleInputChange("dietaryRequirements", e.target.value)}
                rows={6}
                className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Emergency Procedures</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('emergencyProcedures')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'emergencyProcedures' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Emergency response protocols for mealtime incidents..."
                value={mealtimeData.emergencyProcedures || ""}
                onChange={(e) => handleInputChange("emergencyProcedures", e.target.value)}
                rows={6}
                className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Staff Guidance</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateGlobalContent('staffGuidance')}
                  disabled={isGenerating || !mealtimeData.userInput?.trim()}
                >
                  {isGenerating && generatingField === 'staffGuidance' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Comprehensive staff instructions for mealtime support..."
                value={mealtimeData.staffGuidance || ""}
                onChange={(e) => handleInputChange("staffGuidance", e.target.value)}
                rows={6}
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}