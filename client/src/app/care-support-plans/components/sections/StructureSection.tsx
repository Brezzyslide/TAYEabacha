import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, Home } from "lucide-react";

interface StructureSectionProps {
  data: any;
  onChange: (data: any) => void;
  selectedClient: any;
  planData: any;
}

export function StructureSection({ data, onChange, selectedClient, planData }: StructureSectionProps) {
  const [formData, setFormData] = useState({
    dailyRoutine: data.dailyRoutine || "",
    weeklyStructure: data.weeklyStructure || "",
    supportSchedule: data.supportSchedule || "",
    flexibilityNeeds: data.flexibilityNeeds || "",
    transitionSupport: data.transitionSupport || "",
    ...data
  });

  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily Routine & Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dailyRoutine">Daily Routine</Label>
            <Textarea
              id="dailyRoutine"
              value={formData.dailyRoutine}
              onChange={(e) => handleInputChange("dailyRoutine", e.target.value)}
              placeholder="Describe the client's preferred daily routine, including wake-up, meals, activities, and bedtime"
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyStructure">Weekly Structure</Label>
            <Textarea
              id="weeklyStructure"
              value={formData.weeklyStructure}
              onChange={(e) => handleInputChange("weeklyStructure", e.target.value)}
              placeholder="Weekly schedule including regular activities, appointments, and community participation"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Support Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportSchedule">Support Worker Schedule</Label>
            <Textarea
              id="supportSchedule"
              value={formData.supportSchedule}
              onChange={(e) => handleInputChange("supportSchedule", e.target.value)}
              placeholder="When support workers are needed, shift patterns, and specific support requirements"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flexibilityNeeds">Flexibility & Adaptations</Label>
            <Textarea
              id="flexibilityNeeds"
              value={formData.flexibilityNeeds}
              onChange={(e) => handleInputChange("flexibilityNeeds", e.target.value)}
              placeholder="How the client responds to changes in routine and strategies for managing flexibility"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Transitions & Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="transitionSupport">Transition Support Strategies</Label>
            <Textarea
              id="transitionSupport"
              value={formData.transitionSupport}
              onChange={(e) => handleInputChange("transitionSupport", e.target.value)}
              placeholder="Strategies to support transitions between activities, locations, or changes in routine"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <div className="bg-teal-50 dark:bg-teal-950 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
          <p className="text-sm text-teal-800 dark:text-teal-200">
            <strong>Structure & Routine:</strong> Predictable routines and clear structure support {selectedClient.fullName}'s 
            wellbeing and independence. Document preferences and strategies for managing changes or transitions.
          </p>
        </div>
      )}
    </div>
  );
}