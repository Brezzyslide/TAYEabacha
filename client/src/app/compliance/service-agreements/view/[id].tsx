import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Edit, FileText, Lock, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency } from "@shared/utils/calc";
import { calculateRatioMultiplier } from "@shared/utils/ratioCalculator";

export default function ViewServiceAgreement() {
  const [, params] = useRoute("/compliance/service-agreements/view/:id");
  const [, setLocation] = useLocation();
  const agreementId = params?.id;

  // Get current user data for permission checking
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Check if user has access to compliance module
  if (user && !hasPermission(user, "ACCESS_COMPLIANCE")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              Access Restricted
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">
              Only Admin and Program Coordinators can access the Compliance module.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
          <Shield className="h-3 w-3 mr-1" />
          Your role: {user.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  const { data: agreement, isLoading } = useQuery({
    queryKey: [`/api/compliance/service-agreements/${agreementId}`],
    enabled: !!agreementId,
  });

  const { data: client } = useQuery({
    queryKey: [`/api/clients/${agreement?.clientId}`],
    enabled: !!agreement?.clientId,
  });

  const handleExportPDF = async () => {
    if (!agreementId) return;
    
    try {
      const response = await fetch(`/api/compliance/service-agreements/${agreementId}/pdf`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-agreement-${agreementId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

  const getStatusBadge = (agreement: any) => {
    const now = new Date();
    const startDate = new Date(agreement.startDate);
    const endDate = new Date(agreement.endDate);
    
    if (now < startDate) {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (now > endDate) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const calculateItemTotal = (item: any) => {
    const toNumber = (value: string | number | undefined) => {
      if (typeof value === 'string') return parseFloat(value) || 0;
      return value || 0;
    };

    const ratioMultiplier = calculateRatioMultiplier(item.ratioOfSupport || "1:1");
    const weeks = item.weeks || 1;
    
    const dayAmount = toNumber(item.hoursDay) * toNumber(item.unitDay) * ratioMultiplier;
    const weekdayEveningAmount = toNumber(item.hoursWeekdayEvening) * toNumber(item.unitWeekdayEvening) * ratioMultiplier;
    const activeNightAmount = toNumber(item.hoursActiveNight) * toNumber(item.unitActiveNight) * ratioMultiplier;
    const sleeperAmount = toNumber(item.hoursSleepover) * toNumber(item.unitSleepover) * ratioMultiplier;
    const saturdayAmount = toNumber(item.hoursSaturday) * toNumber(item.unitSaturday) * ratioMultiplier;
    const sundayAmount = toNumber(item.hoursSunday) * toNumber(item.unitSunday) * ratioMultiplier;
    const holidayAmount = toNumber(item.hoursPublicHoliday) * toNumber(item.unitPublicHoliday) * ratioMultiplier;
    
    const weeklyTotal = dayAmount + weekdayEveningAmount + activeNightAmount + sleeperAmount + 
                      saturdayAmount + sundayAmount + holidayAmount;
    
    return weeklyTotal * weeks;
  };

  const calculateGrandTotal = () => {
    if (!agreement?.items) return 0;
    return agreement.items.reduce((total: number, item: any) => {
      return total + calculateItemTotal(item);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-600">Loading agreement...</div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <FileText className="h-16 w-16 text-slate-400" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Agreement Not Found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            The service agreement you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
        <Button onClick={() => setLocation("/compliance/service-agreements")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agreements
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/compliance/service-agreements")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agreements
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Service Agreement #{agreement.agreementNumber || agreement.id}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Client: {client?.fullName || client?.firstName + ' ' + client?.lastName || 'Unknown Client'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(agreement)}
          <Button 
            variant="outline"
            onClick={handleExportPDF}
          >
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          {hasPermission(user, "CREATE_SERVICE_AGREEMENT") && (
            <Button 
              onClick={() => setLocation(`/compliance/service-agreements/edit/${agreementId}`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Agreement
            </Button>
          )}
        </div>
      </div>

      {/* Agreement Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agreement Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Agreement Number
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {agreement.agreementNumber || `SA-${agreement.id}`}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Period
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {new Date(agreement.startDate).toLocaleDateString()} - {new Date(agreement.endDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Status
              </label>
              <div className="mt-1">
                {getStatusBadge(agreement)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Participant Number
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {agreement.billingDetails?.participantNumber || 'Not specified'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Plan Number
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {agreement.billingDetails?.planNumber || 'Not specified'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Plan Manager
              </label>
              <p className="text-slate-900 dark:text-slate-100">
                {agreement.billingDetails?.planManager || 'Not specified'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Items */}
      <Card>
        <CardHeader>
          <CardTitle>Service Items</CardTitle>
          <CardDescription>
            Detailed breakdown of services and pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agreement.items && agreement.items.length > 0 ? (
            <div className="space-y-4">
              {agreement.items.map((item: any, index: number) => (
                <div key={item.id || index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        {item.ndisCode} - {item.supportDescription}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Duration: {item.weeks} weeks • Ratio: {item.ratioOfSupport || '1:1'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(calculateItemTotal(item))}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Total
                      </p>
                    </div>
                  </div>
                  
                  {/* Rate breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {item.hoursDay > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Day Rate</p>
                        <p>{item.hoursDay}h × {formatCurrency(item.unitDay)}</p>
                      </div>
                    )}
                    {item.hoursWeekdayEvening > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Evening Rate</p>
                        <p>{item.hoursWeekdayEvening}h × {formatCurrency(item.unitWeekdayEvening)}</p>
                      </div>
                    )}
                    {item.hoursActiveNight > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Active Night</p>
                        <p>{item.hoursActiveNight}h × {formatCurrency(item.unitActiveNight)}</p>
                      </div>
                    )}
                    {item.hoursSleepover > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Sleepover</p>
                        <p>{item.hoursSleepover}h × {formatCurrency(item.unitSleepover)}</p>
                      </div>
                    )}
                    {item.hoursSaturday > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Saturday</p>
                        <p>{item.hoursSaturday}h × {formatCurrency(item.unitSaturday)}</p>
                      </div>
                    )}
                    {item.hoursSunday > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Sunday</p>
                        <p>{item.hoursSunday}h × {formatCurrency(item.unitSunday)}</p>
                      </div>
                    )}
                    {item.hoursPublicHoliday > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium">Public Holiday</p>
                        <p>{item.hoursPublicHoliday}h × {formatCurrency(item.unitPublicHoliday)}</p>
                      </div>
                    )}
                  </div>
                  
                  {item.notes && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Notes:</strong> {item.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Grand Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    Total Agreement Value:
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(calculateGrandTotal())}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                No service items
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                This agreement doesn't have any service items yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Terms */}
      {agreement.customTerms && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {agreement.customTerms}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}