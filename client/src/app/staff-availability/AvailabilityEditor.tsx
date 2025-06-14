import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save, Calendar, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const availabilitySchema = z.object({
  availability: z.record(z.array(z.string())),
  patternName: z.string().optional(),
});

type AvailabilityForm = z.infer<typeof availabilitySchema>;

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday", 
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const SHIFT_TYPES = [
  { value: "AM", label: "AM", color: "bg-blue-100 text-blue-800" },
  { value: "PM", label: "PM", color: "bg-green-100 text-green-800" },
  { value: "Active Night", label: "Active Night", color: "bg-purple-100 text-purple-800" },
  { value: "Sleepover Night", label: "Sleepover Night", color: "bg-orange-100 text-orange-800" }
];

export default function AvailabilityEditor() {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [dayAvailability, setDayAvailability] = useState<Record<string, string[]>>({});
  const [saveAsPattern, setSaveAsPattern] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current user's availability
  const { data: currentAvailability } = useQuery({
    queryKey: ["/api/staff-availability/current"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability/current", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch availability");
      return response.json();
    },
  });

  // Fetch quick patterns
  const { data: quickPatterns = [] } = useQuery({
    queryKey: ["/api/staff-availability/patterns"],
    queryFn: async () => {
      const response = await fetch("/api/staff-availability/patterns", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch patterns");
      return response.json();
    },
  });

  const form = useForm<AvailabilityForm>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      availability: {},
      patternName: "",
    },
  });

  // Submit availability mutation
  const submitAvailabilityMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/staff-availability", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-availability"] });
      toast({
        title: "Availability Submitted",
        description: "Your availability has been sent to management for review.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit availability.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedDays([]);
    setDayAvailability({});
    setSaveAsPattern(false);
    form.reset();
  };

  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      setSelectedDays(prev => [...prev, day]);
    } else {
      setSelectedDays(prev => prev.filter(d => d !== day));
      setDayAvailability(prev => {
        const newAvailability = { ...prev };
        delete newAvailability[day];
        return newAvailability;
      });
    }
  };

  const handleShiftTypeChange = (day: string, shiftTypes: string[]) => {
    setDayAvailability(prev => ({
      ...prev,
      [day]: shiftTypes
    }));
  };

  const applyQuickPattern = (pattern: any) => {
    setSelectedDays(Object.keys(pattern.availability));
    setDayAvailability(pattern.availability);
    form.setValue("availability", pattern.availability);
  };

  const onSubmit = async (data: AvailabilityForm) => {
    const submissionData = {
      availability: dayAvailability,
      patternName: saveAsPattern ? data.patternName : undefined,
      isQuickPattern: saveAsPattern,
    };

    await submitAvailabilityMutation.mutateAsync(submissionData);
  };

  return (
    <div className="space-y-6">
      {/* Current Availability Status */}
      {currentAvailability && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Current Availability Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="text-center">
                  <div className="font-medium text-sm mb-2">{day.slice(0, 3)}</div>
                  <div className="space-y-1">
                    {currentAvailability.availability[day]?.map((shift: string) => (
                      <Badge 
                        key={shift} 
                        className={SHIFT_TYPES.find(s => s.value === shift)?.color}
                        variant="secondary"
                      >
                        {shift}
                      </Badge>
                    )) || <div className="text-xs text-gray-400">Not available</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Patterns */}
      {quickPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5" />
              <span>Quick Patterns</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickPatterns.map((pattern: any) => (
                <Button
                  key={pattern.id}
                  variant="outline"
                  className="h-auto p-3 flex flex-col items-start"
                  onClick={() => applyQuickPattern(pattern)}
                >
                  <div className="font-medium">{pattern.patternName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Object.keys(pattern.availability).length} days selected
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Availability Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Set Your Availability</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Checkbox
                        checked={selectedDays.includes(day)}
                        onCheckedChange={(checked) => handleDayToggle(day, checked as boolean)}
                      />
                      <label className="font-medium text-lg">{day}</label>
                    </div>
                    
                    {selectedDays.includes(day) && (
                      <div className="ml-6">
                        <ToggleGroup
                          type="multiple"
                          value={dayAvailability[day] || []}
                          onValueChange={(value) => handleShiftTypeChange(day, value)}
                          className="justify-start flex-wrap gap-2"
                        >
                          {SHIFT_TYPES.map((shiftType) => (
                            <ToggleGroupItem
                              key={shiftType.value}
                              value={shiftType.value}
                              aria-label={shiftType.label}
                              className="data-[state=on]:bg-blue-100 data-[state=on]:text-blue-900"
                            >
                              {shiftType.label}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save as Pattern Option */}
              <div className="border-t pt-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Checkbox
                    checked={saveAsPattern}
                    onCheckedChange={(checked) => setSaveAsPattern(checked as boolean)}
                  />
                  <label className="font-medium">Save as Quick Pattern</label>
                </div>
                
                {saveAsPattern && (
                  <FormField
                    control={form.control}
                    name="patternName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pattern Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., My Regular Week" 
                            {...field} 
                            className="max-w-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Summary */}
              {Object.keys(dayAvailability).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Availability Summary:</h4>
                  <div className="text-sm space-y-1">
                    {Object.entries(dayAvailability).map(([day, shifts]) => (
                      <div key={day} className="flex justify-between">
                        <span>{day}:</span>
                        <span>{shifts.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={submitAvailabilityMutation.isPending || Object.keys(dayAvailability).length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {submitAvailabilityMutation.isPending ? "Submitting..." : "Submit Availability"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}