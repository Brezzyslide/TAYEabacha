import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pill, Download, Plus, Edit, Trash2, Clock, Calendar, 
  User, AlertTriangle, CheckCircle, XCircle, BarChart3,
  Loader2, FileText, Target, TrendingUp, Grid3X3, List
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const medicationPlanSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  route: z.string().min(1, "Route is required"),
  timeOfDay: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  prescribedBy: z.string().min(1, "Prescriber is required"),
  instructions: z.string().optional(),
  sideEffects: z.string().optional(),
});

const medicationRecordSchema = z.object({
  medicationPlanId: z.number(),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  actualTime: z.string().optional(),
  result: z.enum(["administered", "refused", "missed", "delayed"]),
  notes: z.string().optional(),
  refusalReason: z.string().optional(),
});

interface MedicationAnalyticsProps {
  clientId: string;
  records: any[];
  plans: any[];
}

const MedicationAnalytics = ({ clientId, records, plans }: MedicationAnalyticsProps) => {
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(subDays(new Date(), i));
    }
    return days;
  }, []);

  const adherenceData = useMemo(() => {
    return last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayRecords = records.filter(record => {
        const recordDate = new Date(record.scheduledTime);
        return isAfter(recordDate, dayStart) && isBefore(recordDate, dayEnd);
      });

      const administered = dayRecords.filter(r => r.result === 'administered').length;
      const refused = dayRecords.filter(r => r.result === 'refused').length;
      const delayed = dayRecords.filter(r => r.result === 'delayed').length;

      return {
        date: format(day, 'MMM dd'),
        administered,
        refused,
        delayed,
        total: dayRecords.length
      };
    });
  }, [records, last7Days]);

  const timeOfDayData = useMemo(() => {
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    
    records.forEach(record => {
      const hour = new Date(record.scheduledTime).getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 22) timeSlots.evening++;
      else timeSlots.night++;
    });

    return [
      { name: 'Morning (6AM-12PM)', value: timeSlots.morning, color: '#8884d8' },
      { name: 'Afternoon (12PM-5PM)', value: timeSlots.afternoon, color: '#82ca9d' },
      { name: 'Evening (5PM-10PM)', value: timeSlots.evening, color: '#ffc658' },
      { name: 'Night (10PM-6AM)', value: timeSlots.night, color: '#ff7300' }
    ];
  }, [records]);

  const medicationAdherenceByPlan = useMemo(() => {
    return plans.map(plan => {
      const planRecords = records.filter(r => r.medicationPlanId === plan.id);
      const administered = planRecords.filter(r => r.result === 'administered').length;
      const total = planRecords.length;
      const adherenceRate = total > 0 ? (administered / total) * 100 : 0;

      return {
        name: plan.medicationName,
        adherence: Math.round(adherenceRate * 10) / 10,
        administered,
        total
      };
    });
  }, [plans, records]);

  return (
    <div className="space-y-6">
      {/* Adherence Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            7-Day Medication Adherence Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adherenceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="administered" stroke="#10b981" name="Administered" strokeWidth={2} />
                <Line type="monotone" dataKey="refused" stroke="#ef4444" name="Refused" strokeWidth={2} />
                <Line type="monotone" dataKey="delayed" stroke="#f59e0b" name="Delayed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time of Day Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Administration Times
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timeOfDayData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {timeOfDayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Per-Medication Adherence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Medication Adherence Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {medicationAdherenceByPlan.map((med, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{med.name}</p>
                    <p className="text-xs text-gray-500">{med.administered}/{med.total} doses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${Math.min(med.adherence, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {med.adherence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface MedicationPlanCardProps {
  plan: any;
  onRecordAdministration: (plan: any) => void;
  onEdit: (plan: any) => void;
  onDelete: (plan: any) => void;
}

const MedicationPlanCard = ({ plan, onRecordAdministration, onEdit, onDelete }: MedicationPlanCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{plan.medicationName}</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {plan.dosage} • {plan.frequency} • {plan.route}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {plan.planType || 'Active'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Start Date:</span>
            <p className="font-medium">{format(new Date(plan.startDate), 'MMM dd, yyyy')}</p>
          </div>
          <div>
            <span className="text-gray-500">Prescribed By:</span>
            <p className="font-medium">{plan.prescribedBy}</p>
          </div>
        </div>

        {plan.instructions && (
          <div className="text-sm">
            <span className="text-gray-500">Instructions:</span>
            <p className="mt-1 text-gray-700 dark:text-gray-300">{plan.instructions}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={() => onRecordAdministration(plan)}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Record Administration
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(plan)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(plan)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface RecentAdministrationsProps {
  records: any[];
  viewMode: 'card' | 'list';
}

const RecentAdministrations = ({ records, viewMode }: RecentAdministrationsProps) => {
  const recentRecords = records.slice(0, 10);

  const getStatusIcon = (result: string) => {
    switch (result) {
      case 'administered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'refused':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'delayed':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (result: string) => {
    const variants = {
      administered: 'bg-green-100 text-green-800',
      refused: 'bg-red-100 text-red-800',
      delayed: 'bg-yellow-100 text-yellow-800',
      missed: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge variant="secondary" className={variants[result as keyof typeof variants]}>
        {result}
      </Badge>
    );
  };

  if (viewMode === 'card') {
    return (
      <div className="grid gap-4">
        {recentRecords.map((record, index) => (
          <Card key={record.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(record.result)}
                <div>
                  <p className="font-medium">{record.medicationName}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(record.scheduledTime), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(record.result)}
                {record.administeredBy && (
                  <p className="text-xs text-gray-500 mt-1">{record.administeredBy}</p>
                )}
              </div>
            </div>
            {record.notes && (
              <p className="text-sm text-gray-600 mt-2 pl-7">{record.notes}</p>
            )}
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentRecords.map((record, index) => (
        <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(record.result)}
            <div>
              <p className="font-medium text-sm">{record.medicationName}</p>
              <p className="text-xs text-gray-500">
                {format(new Date(record.scheduledTime), 'MMM dd, h:mm a')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(record.result)}
          </div>
        </div>
      ))}
    </div>
  );
};

interface EnhancedMedicationsTabProps {
  clientId: string;
}

export default function EnhancedMedicationsTab({ clientId }: EnhancedMedicationsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: [`/api/medication-plans?clientId=${clientId}`],
    enabled: !!clientId,
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: [`/api/medication-records?clientId=${clientId}`],
    enabled: !!clientId,
  });

  const recordForm = useForm({
    resolver: zodResolver(medicationRecordSchema),
    defaultValues: {
      result: "administered" as const,
      scheduledTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const recordMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/medication-records`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/medication-records?clientId=${clientId}`] });
      toast({ title: "Administration recorded successfully" });
      setIsRecordDialogOpen(false);
      recordForm.reset();
    },
  });

  const handleRecordAdministration = (plan: any) => {
    setSelectedPlan(plan);
    recordForm.setValue('medicationPlanId', plan.id);
    setIsRecordDialogOpen(true);
  };

  const onSubmitRecord = (data: any) => {
    recordMutation.mutate({
      ...data,
      clientId: parseInt(clientId),
      tenantId: user?.tenantId || 1,
      administeredBy: user?.id || 1,
    });
  };

  const exportToPDF = () => {
    // TODO: Implement PDF export
    toast({ title: "PDF export feature coming soon" });
  };

  const exportToExcel = () => {
    // TODO: Implement Excel export
    toast({ title: "Excel export feature coming soon" });
  };

  if (plansLoading || recordsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analytics" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="plans">Active Plans</TabsTrigger>
            <TabsTrigger value="records">Recent Records</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        <TabsContent value="analytics">
          <MedicationAnalytics clientId={clientId} records={records} plans={plans} />
        </TabsContent>

        <TabsContent value="plans">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Active Medication Plans</h3>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Plan
              </Button>
            </div>
            
            <div className="grid gap-4">
              {plans.map((plan: any) => (
                <MedicationPlanCard
                  key={plan.id}
                  plan={plan}
                  onRecordAdministration={handleRecordAdministration}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="records">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Administrations</h3>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <RecentAdministrations records={records} viewMode={viewMode} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Record Administration Dialog */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Administration</DialogTitle>
          </DialogHeader>
          
          <Form {...recordForm}>
            <form onSubmit={recordForm.handleSubmit(onSubmitRecord)} className="space-y-4">
              <div className="text-sm">
                <p className="font-medium">{selectedPlan?.medicationName}</p>
                <p className="text-gray-500">{selectedPlan?.dosage}</p>
              </div>

              <FormField
                control={recordForm.control}
                name="result"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="administered">Administered</SelectItem>
                        <SelectItem value="refused">Refused</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                        <SelectItem value="missed">Missed</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={recordForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any observations or comments..." />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={recordMutation.isPending}>
                  {recordMutation.isPending ? "Recording..." : "Record"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}