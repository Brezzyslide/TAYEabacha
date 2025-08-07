import React, { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { hasRole } from '@/lib/role-utils';
import { CreditCard, FileText, History, RefreshCw, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

interface PaymentInfo {
  paymentInfo?: {
    id: number;
    companyId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    paymentStatus: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    nextPaymentDate?: string;
    lastPaymentAmount?: string;
    lastPaymentDate?: string;
  };
  recentPayments: Array<{
    id: number;
    stripePaymentIntentId?: string;
    amount: string;
    currency: string;
    status: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    paymentDate?: string;
    failureReason?: string;
    createdAt: string;
  }>;
}

interface BillingData {
  totalActiveStaff: number;
  totalMonthlyRevenue: number;
  roleDistribution: Record<string, number>;
  nextBillingDate: string;
}

// Payment Form Component
const PaymentForm: React.FC<{
  billingData: BillingData;
  onSuccess: () => void;
  paymentType: 'one-time' | 'subscription';
}> = ({ billingData, onSuccess, paymentType }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    setIsProcessing(true);
    
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/billing',
        },
      });
      
      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Successful",
          description: paymentType === 'subscription' 
            ? "Your subscription has been activated!" 
            : "Thank you for your payment!",
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Payment Summary</h4>
        <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <div className="flex justify-between">
            <span>Active Staff:</span>
            <span>{billingData.totalActiveStaff}</span>
          </div>
          <div className="flex justify-between">
            <span>Monthly Amount:</span>
            <span className="font-semibold">${billingData.totalMonthlyRevenue.toFixed(2)} AUD</span>
          </div>
          {paymentType === 'subscription' && billingData.nextBillingDate && (
            <div className="flex justify-between">
              <span>Next Billing:</span>
              <span>
                {(() => {
                  try {
                    const date = new Date(billingData.nextBillingDate);
                    if (isNaN(date.getTime())) {
                      return 'TBD';
                    }
                    return format(date, 'MMM d, yyyy');
                  } catch (error) {
                    return 'TBD';
                  }
                })()}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <PaymentElement />
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {paymentType === 'subscription' ? 'Start Subscription' : 'Pay Now'}
          </>
        )}
      </Button>
    </form>
  );
};

// Payment History Component
const PaymentHistory: React.FC<{ payments: PaymentInfo['recentPayments'] }> = ({ payments }) => {
  if (!payments?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No payment history available</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      succeeded: { variant: 'default' as const, label: 'Paid' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
      pending: { variant: 'secondary' as const, label: 'Pending' },
      canceled: { variant: 'outline' as const, label: 'Canceled' },
    };
    
    const config = statusMap[status as keyof typeof statusMap] || 
                   { variant: 'secondary' as const, label: status };
    
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {payments.map((payment) => (
        <div key={payment.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold">${parseFloat(payment.amount).toFixed(2)} {payment.currency.toUpperCase()}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(payment.billingPeriodStart), 'MMM d')} - {' '}
                {format(new Date(payment.billingPeriodEnd), 'MMM d, yyyy')}
              </p>
            </div>
            {getStatusBadge(payment.status)}
          </div>
          
          {payment.paymentDate && (
            <p className="text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 inline mr-1" />
              Paid on {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
            </p>
          )}
          
          {payment.failureReason && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">
              Reason: {payment.failureReason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

// Main Payment Manager Component
export const PaymentManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'one-time' | 'subscription'>('one-time');

  // Get company data first
  const { data: company } = useQuery({
    queryKey: ['/api/company'],
    queryFn: () => apiRequest('GET', '/api/company').then(res => res.json()),
    enabled: !!user
  });

  // Fetch payment information
  const { data: paymentInfo, isLoading: paymentInfoLoading } = useQuery<PaymentInfo>({
    queryKey: ['/api/payments/company', company?.id],
    queryFn: () => apiRequest('GET', `/api/payments/company/${company?.id}`).then(res => res.json()),
    enabled: !!company?.id
  });

  // Fetch billing data
  const { data: billingData, isLoading: billingLoading } = useQuery<BillingData>({
    queryKey: ['/api/billing/analytics'],
    queryFn: () => apiRequest('GET', '/api/billing/analytics').then(res => res.json()),
  });

  // Create payment intent mutation
  const createPaymentMutation = useMutation({
    mutationFn: (type: 'one-time' | 'subscription') => {
      if (!company?.id) throw new Error('Company ID required');
      const endpoint = type === 'subscription' 
        ? '/api/payments/create-subscription'
        : '/api/payments/create-payment-intent';
      
      console.log(`[PAYMENT DEBUG] Creating ${type} payment for company:`, company.id);
      
      return apiRequest('POST', endpoint, {
        companyId: company.id,
        amount: billingData?.totalMonthlyRevenue || 0
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      console.log('[PAYMENT DEBUG] Payment creation successful:', data);
      console.log('[PAYMENT DEBUG] Client secret received:', data.clientSecret);
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        toast({
          title: "Payment Ready",
          description: "Please complete your payment below.",
        });
      } else {
        console.error('[PAYMENT DEBUG] No client secret in response:', data);
        toast({
          title: "Payment Setup Failed",
          description: "No payment details received from server",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });

  const handlePaymentSuccess = () => {
    setClientSecret('');
    queryClient.invalidateQueries({ queryKey: ['/api/payments/company', company?.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/billing/analytics'] });
  };

  const isLoading = paymentInfoLoading || billingLoading;
  const hasActiveSubscription = paymentInfo?.paymentInfo?.stripeSubscriptionId && 
                                 paymentInfo?.paymentInfo?.paymentStatus === 'active';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Payment form wrapper with Stripe Elements
  const PaymentFormWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!clientSecret) return null;
    
    return (
      <Elements 
        stripe={stripePromise} 
        options={{ 
          clientSecret,
          appearance: {
            theme: 'stripe',
          },
        }}
      >
        {children}
      </Elements>
    );
  };

  return (
    <div className="space-y-6">
      {/* Payment Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Payment Status
          </CardTitle>
          <CardDescription>
            Manage your billing and subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Payment Status</p>
              <Badge variant={hasActiveSubscription ? 'default' : 'secondary'}>
                {paymentInfo?.paymentInfo?.paymentStatus || 'Pending'}
              </Badge>
            </div>
            
            {paymentInfo?.paymentInfo?.lastPaymentAmount && (
              <div>
                <p className="text-sm text-muted-foreground">Last Payment</p>
                <p className="font-semibold">
                  ${parseFloat(paymentInfo.paymentInfo.lastPaymentAmount).toFixed(2)} AUD
                </p>
              </div>
            )}
            
            {billingData?.totalMonthlyRevenue && (
              <div>
                <p className="text-sm text-muted-foreground">Current Bill</p>
                <p className="font-semibold text-lg text-primary">
                  ${billingData.totalMonthlyRevenue.toFixed(2)} AUD
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payment" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payment">Make Payment</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="payment" className="space-y-4">
          {!clientSecret ? (
            <Card>
              <CardHeader>
                <CardTitle>Choose Payment Method</CardTitle>
                <CardDescription>
                  Pay your monthly bill or set up automatic billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {billingData && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Current Billing Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Active Staff: {billingData.totalActiveStaff}</div>
                      <div>Monthly Total: ${billingData.totalMonthlyRevenue.toFixed(2)} AUD</div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4"
                    onClick={() => {
                      setPaymentType('one-time');
                      createPaymentMutation.mutate('one-time');
                    }}
                    disabled={createPaymentMutation.isPending}
                  >
                    <div className="text-center">
                      <CreditCard className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-semibold">One-Time Payment</div>
                      <div className="text-sm text-muted-foreground">
                        Pay your current bill manually
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto p-4"
                    onClick={() => {
                      setPaymentType('subscription');
                      createPaymentMutation.mutate('subscription');
                    }}
                    disabled={createPaymentMutation.isPending || !!hasActiveSubscription}
                  >
                    <div className="text-center">
                      <RefreshCw className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-semibold">
                        {hasActiveSubscription ? 'Subscription Active' : 'Monthly Subscription'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {hasActiveSubscription 
                          ? 'You have an active subscription'
                          : 'Set up automatic monthly billing'
                        }
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Complete Payment</CardTitle>
                <CardDescription>
                  {paymentType === 'subscription' 
                    ? 'Set up your monthly subscription'
                    : 'Pay your current bill'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentFormWrapper>
                  {billingData && (
                    <PaymentForm
                      billingData={billingData}
                      onSuccess={handlePaymentSuccess}
                      paymentType={paymentType}
                    />
                  )}
                </PaymentFormWrapper>
                
                <Button
                  variant="ghost"
                  onClick={() => setClientSecret('')}
                  className="w-full mt-4"
                >
                  Cancel Payment
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="w-5 h-5 mr-2" />
                Payment History
              </CardTitle>
              <CardDescription>
                View your recent payments and billing history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentHistory payments={paymentInfo?.recentPayments || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};