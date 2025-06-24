import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Download, 
  FileText, 
  Send,
  Printer,
  Star,
  Clock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WizardCompletionFlowProps {
  completedSections: string[];
  totalSections: number;
  planData: any;
  onExportPDF: () => void;
  onComplete: () => void;
  onGoToSection: (sectionIndex: number) => void;
}

const REQUIRED_SECTIONS = [
  { id: 'client', title: 'Client Selection', required: true },
  { id: 'aboutMe', title: 'About Me', required: true },
  { id: 'goals', title: 'Goals & Outcomes', required: true },
  { id: 'adl', title: 'ADL Support', required: false },
  { id: 'structure', title: 'Structure & Routine', required: false },
  { id: 'communication', title: 'Communication', required: true },
  { id: 'behaviour', title: 'Behaviour Support', required: false },
  { id: 'disaster', title: 'Disaster Management', required: false },
  { id: 'mealtime', title: 'Mealtime Management', required: false },
];

export function WizardCompletionFlow({
  completedSections,
  totalSections,
  planData,
  onExportPDF,
  onComplete,
  onGoToSection
}: WizardCompletionFlowProps) {
  const [showDetails, setShowDetails] = useState(false);

  const completionPercentage = (completedSections.length / totalSections) * 100;
  const requiredComplete = REQUIRED_SECTIONS.filter(s => s.required).every(s => 
    completedSections.includes(s.id)
  );
  const isReadyForCompletion = requiredComplete && completedSections.length >= 4;

  const getSectionStatus = (sectionId: string) => {
    const section = REQUIRED_SECTIONS.find(s => s.id === sectionId);
    const isCompleted = completedSections.includes(sectionId);
    
    if (isCompleted) return 'completed';
    if (section?.required) return 'required';
    return 'optional';
  };

  const getSectionIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'required':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      default:
        return <Circle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getSectionBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>;
      case 'required':
        return <Badge variant="destructive" className="bg-amber-100 text-amber-800">Required</Badge>;
      default:
        return <Badge variant="outline">Optional</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Completion Overview */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-blue-900">Plan Completion Status</CardTitle>
            <div className="text-2xl font-bold text-blue-700">
              {Math.round(completionPercentage)}%
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={completionPercentage} className="h-3" />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {completedSections.length}
                </div>
                <div className="text-sm text-slate-600">Completed</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-amber-600">
                  {REQUIRED_SECTIONS.filter(s => s.required && !completedSections.includes(s.id)).length}
                </div>
                <div className="text-sm text-slate-600">Required Remaining</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-slate-500">
                  {totalSections - completedSections.length}
                </div>
                <div className="text-sm text-slate-600">Total Remaining</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Status Alert */}
      {isReadyForCompletion ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Ready for completion!</strong> All required sections are complete. 
            You can now finalize and export your care support plan.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Completion required:</strong> Please complete all required sections before finalizing the plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Section Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Section Checklist</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {REQUIRED_SECTIONS.map((section, index) => {
              const status = getSectionStatus(section.id);
              return (
                <div key={section.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {getSectionIcon(status)}
                    <div>
                      <span className="font-medium">{section.title}</span>
                      {showDetails && (
                        <div className="text-sm text-slate-600 mt-1">
                          {status === 'completed' && 'Section completed with all required information.'}
                          {status === 'required' && 'This section must be completed before finalizing the plan.'}
                          {status === 'optional' && 'Optional section - can be completed later if needed.'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getSectionBadge(status)}
                    {status !== 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onGoToSection(index)}
                      >
                        Go to Section
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Export and Completion Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Save Draft */}
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Save Draft</span>
            </Button>

            {/* Export PDF */}
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={onExportPDF}
              disabled={completedSections.length === 0}
            >
              <Download className="h-5 w-5" />
              <span className="text-sm">Export PDF</span>
            </Button>

            {/* Print Preview */}
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              disabled={completedSections.length === 0}
            >
              <Printer className="h-5 w-5" />
              <span className="text-sm">Print Preview</span>
            </Button>

            {/* Complete Plan */}
            <Button 
              className="h-20 flex-col space-y-2 bg-green-600 hover:bg-green-700"
              onClick={onComplete}
              disabled={!isReadyForCompletion}
            >
              <Star className="h-5 w-5" />
              <span className="text-sm">Complete Plan</span>
            </Button>
          </div>

          {!isReadyForCompletion && (
            <div className="mt-4 text-sm text-slate-600 text-center">
              Complete all required sections to enable plan finalization
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Summary */}
      {planData.clientData && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Client Information</h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <div><strong>Name:</strong> {planData.clientData.fullName}</div>
                  <div><strong>Client ID:</strong> {planData.clientData.clientId}</div>
                  <div><strong>Date of Birth:</strong> {planData.clientData.dateOfBirth}</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Plan Details</h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <div><strong>Plan Title:</strong> {planData.planTitle}</div>
                  <div><strong>Created:</strong> {new Date().toLocaleDateString()}</div>
                  <div><strong>Status:</strong> {isReadyForCompletion ? 'Ready for completion' : 'In progress'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}