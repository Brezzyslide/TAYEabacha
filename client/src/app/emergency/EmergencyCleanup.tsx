import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trash2, CheckCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EmergencyCleanup() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const { toast } = useToast();

  const executeCleanup = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL demo data from the production database. This action cannot be undone. Are you sure you want to proceed?")) {
      return;
    }

    setIsExecuting(true);
    try {
      const result = await apiRequest("POST", "/api/emergency/cleanup-demo-data", {});
      setCleanupResult(result);
      toast({
        title: "Cleanup Completed",
        description: "Production demo data has been successfully removed",
      });

    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const verifyCleanup = async () => {
    setIsVerifying(true);
    try {
      const result = await apiRequest("GET", "/api/emergency/verify-cleanup", {});
      setVerificationResult(result);
      toast({
        title: "Verification Complete",
        description: result.message,
      });

    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">🚨 Emergency Production Cleanup</h1>
          <p className="text-gray-300">Remove demo data from AWS production database</p>
        </div>

        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>CRITICAL:</strong> This tool removes ALL demo data from the production database permanently. 
            Use only when demo data persists in production despite code elimination.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Cleanup Card */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-400" />
                Execute Cleanup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300 text-sm">
                Permanently removes all demo clients, shifts, case notes, and related records from production database.
              </p>
              
              <Button 
                onClick={executeCleanup}
                disabled={isExecuting}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executing Cleanup...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Execute Demo Data Cleanup
                  </>
                )}
              </Button>

              {cleanupResult && (
                <div className="mt-4 p-3 bg-green-900/50 rounded-lg border border-green-500">
                  <p className="text-green-300 font-medium">✅ Cleanup Completed</p>
                  <div className="text-green-200 text-xs mt-2 space-y-1">
                    <div>Budget Transactions: {cleanupResult.result?.budgetTransactions || 0}</div>
                    <div>Timesheet Entries: {cleanupResult.result?.timesheetEntries || 0}</div>
                    <div>Case Notes: {cleanupResult.result?.caseNotes || 0}</div>
                    <div>Medication Records: {cleanupResult.result?.medicationRecords || 0}</div>
                    <div>Incident Reports: {cleanupResult.result?.incidentReports || 0}</div>
                    <div>Observations: {cleanupResult.result?.observations || 0}</div>
                    <div>NDIS Budgets: {cleanupResult.result?.ndisBudgets || 0}</div>
                    <div>Shifts: {cleanupResult.result?.shifts || 0}</div>
                    <div>Clients: {cleanupResult.result?.clients || 0}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification Card */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Verify Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300 text-sm">
                Check if any demo data still exists in the production database.
              </p>
              
              <Button 
                onClick={verifyCleanup}
                disabled={isVerifying}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify Database Status
                  </>
                )}
              </Button>

              {verificationResult && (
                <div className={`mt-4 p-3 rounded-lg border ${
                  verificationResult.isClean 
                    ? 'bg-green-900/50 border-green-500' 
                    : 'bg-red-900/50 border-red-500'
                }`}>
                  <p className={`font-medium ${
                    verificationResult.isClean ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {verificationResult.isClean ? '✅ Database Clean' : '⚠️ Demo Data Found'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    verificationResult.isClean ? 'text-green-200' : 'text-red-200'
                  }`}>
                    {verificationResult.message}
                  </p>
                  
                  {verificationResult.remainingDemo?.length > 0 && (
                    <div className="text-red-200 text-xs mt-2">
                      <p>Remaining demo records:</p>
                      <ul className="list-disc list-inside ml-2">
                        {verificationResult.remainingDemo.map((record: any, index: number) => (
                          <li key={index}>
                            {record.firstName} {record.lastName} (ID: {record.id}, Tenant: {record.tenantId})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <strong>How it works:</strong> This cleanup targets demo data patterns (test names, demo emails) 
            while preserving all legitimate user data. Always verify the results after cleanup.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}