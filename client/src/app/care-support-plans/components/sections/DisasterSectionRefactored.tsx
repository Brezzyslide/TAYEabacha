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
import { Plus, Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle, Shield, MapPin, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCarePlan } from "../../contexts/CarePlanContext";

interface DisasterScenario {
  id: string;
  type: string;
  riskLevel: 'low' | 'medium' | 'high';
  preparation: string;
  evacuation: string;
  postEvent: string;
  specificNeeds: string;
  emergencyContacts: string;
}

const DISASTER_TYPES = [
  'Bushfire', 'Flood', 'Severe Storm', 'Earthquake', 'Cyclone/Hurricane',
  'Heatwave', 'Power Outage', 'Medical Emergency', 'Building Emergency',
  'Transport Disruption', 'Technology Failure', 'Staff Shortage'
];

const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-800' }
];

export function DisasterSectionRefactored() {
  const { planData, dispatch } = useCarePlan();
  const { toast } = useToast();
  
  const disasterData = planData?.disasterData || {
    userInput: '',
    generatedContent: '',
    scenarios: [],
    generalPreparedness: '',
    emergencyContacts: '',
    evacuationProcedures: '',
    communicationPlan: '',
    specialEquipment: '',
    medicationManagement: '',
    shelterArrangements: '',
    postDisasterSupport: ''
  };

  const [newScenario, setNewScenario] = useState<DisasterScenario>({
    id: '',
    type: '',
    riskLevel: 'medium',
    preparation: '',
    evacuation: '',
    postEvent: '',
    specificNeeds: '',
    emergencyContacts: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        [field]: value
      }
    });
  };

  const handleScenarioChange = (field: string, value: string) => {
    setNewScenario(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addScenario = () => {
    if (!newScenario.type || !newScenario.preparation) {
      toast({
        title: "Missing Information",
        description: "Please enter disaster type and preparation details before adding.",
        variant: "destructive",
      });
      return;
    }

    const scenario: DisasterScenario = {
      ...newScenario,
      id: Date.now().toString()
    };

    const updatedScenarios = [...disasterData.scenarios, scenario];
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        scenarios: updatedScenarios
      }
    });
    
    setNewScenario({
      id: '',
      type: '',
      riskLevel: 'medium',
      preparation: '',
      evacuation: '',
      postEvent: '',
      specificNeeds: '',
      emergencyContacts: ''
    });

    toast({
      title: "Disaster Scenario Added",
      description: `${newScenario.type} scenario has been added to the plan`,
    });
  };

  const removeScenario = (scenarioId: string) => {
    const updatedScenarios = disasterData.scenarios.filter((s: any) => s.id !== scenarioId);
    
    dispatch({
      type: 'UPDATE_SECTION',
      section: 'disasterData',
      data: {
        ...disasterData,
        scenarios: updatedScenarios
      }
    });

    toast({
      title: "Disaster Scenario Removed",
      description: "Scenario has been deleted from the plan.",
    });
  };

  // AI Content Generation Mutation
  const generateContentMutation = useMutation({
    mutationFn: async ({ targetField }: { targetField: string }) => {
      if (!disasterData.userInput?.trim()) {
        throw new Error("Please enter disaster management information first.");
      }

      setIsGenerating(true);
      const userInput = disasterData.userInput;

      const existingContent = {
        generalPreparedness: disasterData.generalPreparedness || "",
        emergencyContacts: disasterData.emergencyContacts || "",
        evacuationProcedures: disasterData.evacuationProcedures || "",
        communicationPlan: disasterData.communicationPlan || "",
        specialEquipment: disasterData.specialEquipment || "",
        medicationManagement: disasterData.medicationManagement || "",
        shelterArrangements: disasterData.shelterArrangements || "",
        postDisasterSupport: disasterData.postDisasterSupport || ""
      };

      const scenarioContext = disasterData.scenarios.length > 0 
        ? `Current disaster scenarios: ${disasterData.scenarios.map((s: any) => `${s.type} (${s.riskLevel} risk)`).join('; ')}`
        : "No specific disaster scenarios documented yet";

      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "disaster",
        userInput: `${userInput}\n\n${scenarioContext}`,
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
          generalPreparedness: "General Preparedness",
          emergencyContacts: "Emergency Contacts",
          evacuationProcedures: "Evacuation Procedures",
          communicationPlan: "Communication Plan",
          specialEquipment: "Special Equipment",
          medicationManagement: "Medication Management",
          shelterArrangements: "Shelter Arrangements",
          postDisasterSupport: "Post-Disaster Support"
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

  const getRiskBadge = (riskLevel: string) => {
    const option = RISK_LEVELS.find(r => r.value === riskLevel);
    return <Badge className={option?.color}>{option?.label}</Badge>;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Disaster Management Assessment Input
          </CardTitle>
          <CardDescription>
            Describe the client's disaster management needs, risk factors, and emergency requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="disasterInput">Disaster Management Information</Label>
            <Textarea
              id="disasterInput"
              placeholder="Enter details about the client's disaster risks, mobility needs, medical requirements, communication abilities, etc..."
              value={disasterData.userInput || ""}
              onChange={(e) => handleInputChange("userInput", e.target.value)}
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateInitialContent}
            disabled={isGenerating || !disasterData.userInput?.trim()}
            className="w-full mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Disaster Management Content...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Disaster Management Content
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('generalPreparedness')}
              disabled={isGenerating || !disasterData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Preparedness
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('evacuationProcedures')}
              disabled={isGenerating || !disasterData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Evacuation
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('communicationPlan')}
              disabled={isGenerating || !disasterData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Communication
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateTargetedContent('medicationManagement')}
              disabled={isGenerating || !disasterData.userInput?.trim()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Add to Medication
            </Button>
          </div>

          {disasterData.generatedContent && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">AI Generated Content:</h4>
                <Button 
                  onClick={() => {
                    handleInputChange("generalPreparedness", disasterData.generatedContent || "");
                    handleInputChange('generatedContent', '');
                    toast({
                      title: "Content Applied",
                      description: "AI-generated content has been added to General Preparedness field.",
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
                {disasterData.generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disaster Scenario Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Disaster Scenario Builder
          </CardTitle>
          <CardDescription>
            Create specific plans for different disaster types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disaster Type</Label>
              <Select value={newScenario.type} onValueChange={(value) => handleScenarioChange('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select disaster type" />
                </SelectTrigger>
                <SelectContent>
                  {DISASTER_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Risk Level</Label>
              <Select value={newScenario.riskLevel} onValueChange={(value) => handleScenarioChange('riskLevel', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Preparation Phase
              </Label>
              <Textarea
                placeholder="What to do BEFORE the disaster occurs (preparation steps)..."
                value={newScenario.preparation}
                onChange={(e) => handleScenarioChange('preparation', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                Evacuation Procedures
              </Label>
              <Textarea
                placeholder="What to do DURING evacuation (evacuation steps)..."
                value={newScenario.evacuation}
                onChange={(e) => handleScenarioChange('evacuation', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-600" />
                Post-Event Actions
              </Label>
              <Textarea
                placeholder="What to do AFTER the disaster (recovery and support)..."
                value={newScenario.postEvent}
                onChange={(e) => handleScenarioChange('postEvent', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Specific Client Needs</Label>
              <Textarea
                placeholder="Client-specific considerations for this disaster type..."
                value={newScenario.specificNeeds}
                onChange={(e) => handleScenarioChange('specificNeeds', e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Emergency Contacts</Label>
              <Input
                placeholder="Key contacts for this disaster scenario"
                value={newScenario.emergencyContacts}
                onChange={(e) => handleScenarioChange('emergencyContacts', e.target.value)}
              />
            </div>
          </div>

          <Button onClick={addScenario} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Disaster Scenario
          </Button>

          {disasterData.scenarios.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disaster Type</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Preparation</TableHead>
                    <TableHead>Evacuation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disasterData.scenarios.map((scenario: any) => (
                    <TableRow key={scenario.id}>
                      <TableCell>
                        <div className="font-medium">{scenario.type}</div>
                      </TableCell>
                      <TableCell>{getRiskBadge(scenario.riskLevel)}</TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {scenario.preparation}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {scenario.evacuation}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeScenario(scenario.id)}
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

      {/* Disaster Management Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General Preparedness</CardTitle>
            <CardDescription>Overall disaster preparedness strategies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document general disaster preparedness, supplies, and readiness measures..."
              value={disasterData.generalPreparedness || ""}
              onChange={(e) => handleInputChange("generalPreparedness", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Emergency Contacts</CardTitle>
            <CardDescription>Key contacts and communication details</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document emergency contacts, phone numbers, and communication protocols..."
              value={disasterData.emergencyContacts || ""}
              onChange={(e) => handleInputChange("emergencyContacts", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evacuation Procedures</CardTitle>
            <CardDescription>General evacuation planning and procedures</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document evacuation routes, procedures, and mobility considerations..."
              value={disasterData.evacuationProcedures || ""}
              onChange={(e) => handleInputChange("evacuationProcedures", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Communication Plan</CardTitle>
            <CardDescription>Emergency communication strategies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document communication plans, backup methods, and contact procedures..."
              value={disasterData.communicationPlan || ""}
              onChange={(e) => handleInputChange("communicationPlan", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Special Equipment</CardTitle>
            <CardDescription>Essential equipment and supplies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document special equipment, mobility aids, and essential supplies needed..."
              value={disasterData.specialEquipment || ""}
              onChange={(e) => handleInputChange("specialEquipment", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Medication Management</CardTitle>
            <CardDescription>Emergency medication planning</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document medication supplies, storage, and emergency access procedures..."
              value={disasterData.medicationManagement || ""}
              onChange={(e) => handleInputChange("medicationManagement", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Additional Support Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shelter Arrangements</CardTitle>
            <CardDescription>Emergency accommodation planning</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document shelter arrangements, accommodation needs, and accessibility requirements..."
              value={disasterData.shelterArrangements || ""}
              onChange={(e) => handleInputChange("shelterArrangements", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Post-Disaster Support</CardTitle>
            <CardDescription>Recovery and ongoing support planning</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Document post-disaster support needs, recovery planning, and ongoing care requirements..."
              value={disasterData.postDisasterSupport || ""}
              onChange={(e) => handleInputChange("postDisasterSupport", e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}