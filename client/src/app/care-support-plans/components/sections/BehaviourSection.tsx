import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Shield, Plus, X, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BehaviourStrategy {
  id: string;
  type: "proactive" | "reactive" | "protective";
  trigger: string;
  strategy: string;
  notes: string;
}

interface BehaviourSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function BehaviourSection({ data, onChange, selectedClient, planData }: BehaviourSectionProps) {
  const [formData, setFormData] = useState({
    behaviourSummary: data.behaviourSummary || "",
    positiveStrategies: data.positiveStrategies || "",
    communicationFunctions: data.communicationFunctions || "",
    environmentalFactors: data.environmentalFactors || "",
    behaviourStrategies: data.behaviourStrategies || [],
    generatedContent: data.generatedContent || "",
    behaviourInput: data.behaviourInput || "",
    ...data
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const generateContentMutation = useMutation({
    mutationFn: (userInput: string) => apiRequest("POST", "/api/care-support-plans/generate-ai", {
      section: "behaviour",
      userInput,
      clientName: selectedClient?.fullName || "Client",
      clientDiagnosis: selectedClient?.diagnosis || "Not specified",
      maxWords: 400
    }),
    onSuccess: (response: any) => {
      setFormData((prev: any) => ({
        ...prev,
        generatedContent: response.generatedContent
      }));
      toast({
        title: "PBS Strategies Generated",
        description: "AI has created evidence-based behaviour support strategies.",
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
    if (!formData.behaviourInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe behaviours or triggers first.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate(formData.behaviourInput);
  };

  const addStrategy = (type: "proactive" | "reactive" | "protective") => {
    const newStrategy: BehaviourStrategy = {
      id: Date.now().toString(),
      type,
      trigger: "",
      strategy: "",
      notes: ""
    };

    setFormData((prev: any) => ({
      ...prev,
      behaviourStrategies: [...prev.behaviourStrategies, newStrategy]
    }));
  };

  const updateStrategy = (strategyId: string, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      behaviourStrategies: prev.behaviourStrategies.map((strategy: BehaviourStrategy) => 
        strategy.id === strategyId ? { ...strategy, [field]: value } : strategy
      )
    }));
  };

  const removeStrategy = (strategyId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      behaviourStrategies: prev.behaviourStrategies.filter((strategy: BehaviourStrategy) => strategy.id !== strategyId)
    }));
  };

  const handleCopyContent = () => {
    if (formData.generatedContent) {
      navigator.clipboard.writeText(formData.generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Generated behaviour strategies have been copied to clipboard.",
      });
    }
  };

  const getStrategyTypeColor = (type: string) => {
    const colors = {
      "proactive": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "reactive": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "protective": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const strategyTypes = [
    { type: "proactive", label: "Proactive", description: "Prevention strategies" },
    { type: "reactive", label: "Reactive", description: "Response strategies" },
    { type: "protective", label: "Protective", description: "Safety strategies" }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI PBS Strategy Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="behaviourInput">Behaviour Description & Triggers</Label>
            <Textarea
              id="behaviourInput"
              value={formData.behaviourInput}
              onChange={(e) => handleInputChange("behaviourInput", e.target.value)}
              placeholder="Describe specific behaviours of concern, their triggers, functions, and current strategies. Include frequency, intensity, and environmental factors."
              rows={4}
            />
          </div>

          <Button 
            onClick={handleGenerateContent}
            disabled={generateContentMutation.isPending || !formData.behaviourInput.trim()}
            className="w-full"
          >
            {generateContentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating PBS Strategies...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Behaviour Support Plan
              </>
            )}
          </Button>

          {formData.generatedContent && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">AI Generated PBS Strategies:</h4>
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
            <Shield className="h-5 w-5" />
            Positive Behaviour Support Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="behaviourSummary">Behaviour Summary</Label>
            <Textarea
              id="behaviourSummary"
              value={formData.behaviourSummary}
              onChange={(e) => handleInputChange("behaviourSummary", e.target.value)}
              placeholder="Overall summary of behaviours, their impact, and support needs"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="communicationFunctions">Communication Functions of Behaviour</Label>
            <Textarea
              id="communicationFunctions"
              value={formData.communicationFunctions}
              onChange={(e) => handleInputChange("communicationFunctions", e.target.value)}
              placeholder="What is the client trying to communicate through their behaviour? (e.g., seeking attention, avoiding tasks, expressing needs)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="positiveStrategies">Positive Reinforcement Strategies</Label>
            <Textarea
              id="positiveStrategies"
              value={formData.positiveStrategies}
              onChange={(e) => handleInputChange("positiveStrategies", e.target.value)}
              placeholder="Strategies to reinforce positive behaviours and promote skill development"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="environmentalFactors">Environmental Factors & Modifications</Label>
            <Textarea
              id="environmentalFactors"
              value={formData.environmentalFactors}
              onChange={(e) => handleInputChange("environmentalFactors", e.target.value)}
              placeholder="Environmental changes, sensory considerations, or structural modifications that support positive behaviour"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Behaviour Support Strategies ({formData.behaviourStrategies.length})
            </CardTitle>
            <div className="flex gap-2">
              {strategyTypes.map(({ type, label }) => (
                <Button
                  key={type}
                  onClick={() => addStrategy(type as "proactive" | "reactive" | "protective")}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {formData.behaviourStrategies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No behaviour strategies added yet. Click above to add proactive, reactive, or protective strategies.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.behaviourStrategies.map((strategy: BehaviourStrategy) => (
                <Card key={strategy.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={getStrategyTypeColor(strategy.type)}>
                        {strategy.type} strategy
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeStrategy(strategy.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Trigger or Situation</Label>
                      <Input
                        value={strategy.trigger}
                        onChange={(e) => updateStrategy(strategy.id, "trigger", e.target.value)}
                        placeholder="When does this strategy apply? What triggers it?"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Strategy Description</Label>
                      <Textarea
                        value={strategy.strategy}
                        onChange={(e) => updateStrategy(strategy.id, "strategy", e.target.value)}
                        placeholder="Detailed description of the strategy and how to implement it"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea
                        value={strategy.notes}
                        onChange={(e) => updateStrategy(strategy.id, "notes", e.target.value)}
                        placeholder="Important considerations, precautions, or tips for success"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            <strong>Positive Behaviour Support (PBS):</strong> Evidence-based approach focusing on understanding the function 
            of behaviour and teaching alternative skills for {selectedClient.fullName}. All strategies should be dignified, 
            person-centered, and promote quality of life.
          </p>
        </div>
      )}
    </div>
  );
}