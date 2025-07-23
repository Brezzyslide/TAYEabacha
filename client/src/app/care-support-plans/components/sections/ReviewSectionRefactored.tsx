import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useCarePlan } from '../../contexts/CarePlanContext';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  Circle, 
  Download, 
  FileText, 
  Mail, 
  Printer, 
  User,
  Calendar,
  Target,
  Users,
  Home,
  MessageSquare,
  Shield,
  AlertTriangle,
  Utensils
} from 'lucide-react';

const SECTION_INFO = [
  { id: 'aboutMe', title: 'About Me', icon: User, description: 'Personal background and preferences' },
  { id: 'goals', title: 'Goals & Outcomes', icon: Target, description: 'NDIS goals and personal objectives' },
  { id: 'adl', title: 'ADL Support', icon: Users, description: 'Activities of Daily Living assessment' },
  { id: 'structure', title: 'Structure & Routine', icon: Home, description: 'Daily schedules and routines' },
  { id: 'communication', title: 'Communication', icon: MessageSquare, description: 'Communication strategies and support' },
  { id: 'behaviour', title: 'Behaviour Support', icon: Shield, description: 'Positive behaviour support strategies' },
  { id: 'disaster', title: 'Disaster Management', icon: AlertTriangle, description: 'Emergency and disaster preparedness' },
  { id: 'mealtime', title: 'Mealtime Management', icon: Utensils, description: 'Nutrition and mealtime risk assessment' }
];

export function ReviewSectionRefactored() {
  const { planData, getSectionStatus, clientData, updateBasicInfo } = useCarePlan();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalizingPlan, setIsFinalizingPlan] = useState(false);

  // Calculate completion statistics
  const completedSections = SECTION_INFO.filter(section => 
    getSectionStatus(section.id) === 'completed'
  ).length;
  const totalSections = SECTION_INFO.length;
  const completionPercentage = Math.round((completedSections / totalSections) * 100);

  const handleExport = async (format: 'pdf' | 'word' | 'print') => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        const { exportCarePlanToPDF } = await import('@/lib/pdf-export');
        const { user } = useAuth();
        await exportCarePlanToPDF(planData, clientData, user);
      } else if (format === 'print') {
        window.print();
      } else {
        console.log(`${format} export not yet implemented`);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFinalizePlan = async () => {
    setIsFinalizingPlan(true);
    try {
      // Update status to completed in context
      updateBasicInfo('status', 'completed');
      
      // Save the plan with completed status
      const { clientData, ...saveData } = planData;
      
      await apiRequest("PUT", `/api/care-support-plans/${planData.id}`, {
        ...saveData,
        status: 'completed'
      });
      
      // Invalidate queries to refresh the care plans list
      queryClient.invalidateQueries({ queryKey: ["/api/care-support-plans"] });
      
      // Show success message
      toast({
        title: "Plan Finalized",
        description: "Care support plan has been completed successfully!",
      });
    } catch (error) {
      console.error('Finalization failed:', error);
      toast({
        title: "Error",
        description: "Failed to finalize care support plan",
        variant: "destructive",
      });
    } finally {
      setIsFinalizingPlan(false);
    }
  };

  const renderSectionSummary = (section: typeof SECTION_INFO[0]) => {
    const status = getSectionStatus(section.id);
    const isCompleted = status === 'completed';
    const Icon = section.icon;

    return (
      <Card key={section.id} className={`transition-colors ${isCompleted ? 'bg-green-50 dark:bg-green-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              {section.title}
            </div>
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-gray-400" />
            )}
          </CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={isCompleted ? 'default' : 'secondary'} className={isCompleted ? 'bg-green-600' : ''}>
            {isCompleted ? 'Completed' : 'Incomplete'}
          </Badge>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Care Support Plan Overview
          </CardTitle>
          <CardDescription>
            Review your complete care support plan before finalizing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Plan Title</p>
              <p className="text-lg font-semibold">{planData.planTitle || 'Untitled Plan'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Client</p>
              <p className="text-lg font-semibold">
                {clientData ? `${clientData.firstName} ${clientData.lastName}` : 'No client selected'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
              <Badge variant="outline" className="text-lg">
                {planData.status || 'Draft'}
              </Badge>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completion Progress</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {completedSections} of {totalSections} sections
              </span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {completionPercentage}% complete
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section Status */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Section Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTION_INFO.map(renderSectionSummary)}
        </div>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-6 w-6" />
            Export Options
          </CardTitle>
          <CardDescription>
            Download or share your completed care support plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => handleExport('pdf')}
              disabled={isExporting || completedSections < totalSections}
              className="h-20 flex-col gap-2"
            >
              <FileText className="h-6 w-6" />
              Export as PDF
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => handleExport('word')}
              disabled={isExporting || completedSections < totalSections}
              className="h-20 flex-col gap-2"
            >
              <FileText className="h-6 w-6" />
              Export as Word
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => handleExport('print')}
              disabled={isExporting || completedSections < totalSections}
              className="h-20 flex-col gap-2"
            >
              <Printer className="h-6 w-6" />
              Print Plan
            </Button>
          </div>
          
          {completedSections < totalSections && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Complete all sections before exporting your care support plan.
                You have {totalSections - completedSections} section(s) remaining.
              </p>
            </div>
          )}
          
          {completedSections === totalSections && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Congratulations!</strong> Your care support plan is complete and ready for export.
                </p>
              </div>
              
              {planData.status === 'draft' && (
                <div className="flex justify-center">
                  <Button 
                    onClick={handleFinalizePlan}
                    disabled={isFinalizingPlan}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                    size="lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {isFinalizingPlan ? 'Finalizing...' : 'Finalize Care Plan'}
                  </Button>
                </div>
              )}
              
              {planData.status === 'completed' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <CheckCircle className="h-5 w-5 inline mr-2" />
                    <strong>Plan Completed!</strong> This care support plan has been finalized.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Actions</CardTitle>
          <CardDescription>
            Other options for managing your care support plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Email Plan
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Review
            </Button>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Share with Team
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}