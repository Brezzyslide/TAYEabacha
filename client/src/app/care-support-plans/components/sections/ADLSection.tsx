import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, AlertCircle, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ADLSectionProps {
  data: any;
  updateData: (section: string, data: any) => void;
}

export function ADLSection({ data, updateData }: ADLSectionProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const adlData = data.adlData || { userInput: '', generatedContent: '', aiAttempts: 0 };

  const handleUserInputChange = (value: string) => {
    updateData('adlData', {
      ...adlData,
      userInput: value,
    });
  };

  const handleGeneratedContentChange = (value: string) => {
    updateData('adlData', {
      ...adlData,
      generatedContent: value,
    });
  };

  const handleExpandViaAI = async () => {
    if (adlData.aiAttempts >= 2) {
      toast({
        title: "AI Generation Limit Reached",
        description: "Maximum 2 AI generation attempts allowed per section.",
        variant: "destructive",
      });
      return;
    }

    if (!adlData.userInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter information about the client's ADL abilities before generating.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/care-support-plans/generate-ai", {
        section: "adl",
        userInput: adlData.userInput,
        clientDiagnosis: data.clientData?.primaryDiagnosis || null,
        clientName: data.clientData?.fullName || null,
        maxWords: 300,
      });

      const generatedContent = typeof response === 'object' && response !== null 
        ? (response as any).generatedContent || (response as any).content
        : String(response);
      
      updateData('adlData', {
        ...adlData,
        generatedContent: generatedContent,
        aiAttempts: adlData.aiAttempts + 1,
      });

      toast({
        title: "ADL Content Generated",
        description: "AI has expanded your input into a comprehensive ADL assessment.",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate ADL content.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSection = () => {
    toast({
      title: "Section Saved",
      description: "ADL Assessment section has been saved.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Section Instructions</h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Document the client's abilities in Activities of Daily Living (ADL). Include information about their 
          independence levels, support needs, and any specific considerations for personal care, mobility, and daily tasks.
        </p>
      </div>

      {/* User Input */}
      <div>
        <Label htmlFor="adlInput">Client's ADL Abilities *</Label>
        <Textarea
          id="adlInput"
          value={adlData.userInput}
          onChange={(e) => handleUserInputChange(e.target.value)}
          placeholder="Describe the client's abilities in:&#10;• Personal hygiene and grooming&#10;• Mobility and transfers&#10;• Eating and nutrition&#10;• Toileting and continence&#10;• Dressing and clothing choices&#10;• Communication and social skills&#10;• Any support requirements or adaptations needed"
          rows={8}
          className="mt-1"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Enter detailed information about the client's current abilities and support needs
        </p>
      </div>

      {/* AI Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            AI-Enhanced ADL Assessment
          </CardTitle>
          <CardDescription>
            Expand your input into a comprehensive 300-word ADL assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={adlData.aiAttempts >= 2 ? "destructive" : "secondary"}>
                {adlData.aiAttempts}/2 AI Attempts Used
              </Badge>
              {data.clientData?.primaryDiagnosis && (
                <Badge variant="outline">
                  Using: {data.clientData.primaryDiagnosis}
                </Badge>
              )}
            </div>
            <Button
              onClick={handleExpandViaAI}
              disabled={isGenerating || adlData.aiAttempts >= 2 || !adlData.userInput.trim()}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Expanding..." : "Expand via AI"}
            </Button>
          </div>

          {adlData.aiAttempts >= 2 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Maximum AI generation attempts reached. You can still edit the content manually.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="generatedContent">Enhanced ADL Assessment (Editable)</Label>
            <Textarea
              id="generatedContent"
              value={adlData.generatedContent}
              onChange={(e) => handleGeneratedContentChange(e.target.value)}
              placeholder="AI-enhanced ADL assessment will appear here and can be edited..."
              rows={12}
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Edit the enhanced assessment as needed before saving
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ADL Categories Reference */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">ADL Assessment Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium mb-2">Basic ADL</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Personal hygiene</li>
                <li>• Bathing/showering</li>
                <li>• Dressing</li>
                <li>• Eating/feeding</li>
                <li>• Mobility/transfers</li>
                <li>• Toileting</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">Instrumental ADL</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Meal preparation</li>
                <li>• Housekeeping</li>
                <li>• Transportation</li>
                <li>• Medication management</li>
                <li>• Communication</li>
                <li>• Financial management</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSection} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Section
        </Button>
      </div>
    </div>
  );
}