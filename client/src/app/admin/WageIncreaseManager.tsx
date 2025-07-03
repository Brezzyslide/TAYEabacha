import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { TrendingUp, Calendar, AlertTriangle, CheckCircle, Users, DollarSign, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface WageIncreasePreview {
  totalTenants: number;
  totalRatesAffected: number;
  sampleCalculations: Array<{
    level: number;
    payPoint: number;
    employmentType: string;
    currentRate: number;
    newRate: number;
    increase: number;
  }>;
}

interface WageIncreaseDueCheck {
  isDue: boolean;
  nextIncreaseDate: string;
  currentDate: string;
}

interface WageIncreaseHistory {
  id: number;
  description: string;
  createdAt: string;
  tenantId: number;
}

export default function WageIncreaseManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [increasePercentage, setIncreasePercentage] = useState<string>('3.5');
  const [effectiveDate, setEffectiveDate] = useState<string>('2025-07-01');
  const [description, setDescription] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [previewData, setPreviewData] = useState<WageIncreasePreview | null>(null);

  // Check if wage increase is due
  const { data: dueCheck } = useQuery<WageIncreaseDueCheck>({
    queryKey: ['/api/schads/wage-increase/due-check'],
  });

  // Get wage increase history
  const { data: history = [] } = useQuery<WageIncreaseHistory[]>({
    queryKey: ['/api/schads/wage-increase/history'],
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (percentage: number) => 
      apiRequest('POST', '/api/schads/wage-increase/preview', { increasePercentage: percentage }),
    onSuccess: (data: WageIncreasePreview) => {
      setPreviewData(data);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate preview. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Apply wage increase mutation
  const applyMutation = useMutation({
    mutationFn: (params: { increasePercentage: number; effectiveDate: string; description: string }) =>
      apiRequest('POST', '/api/schads/wage-increase/apply', params),
    onSuccess: (data: { results: any[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schads/wage-increase/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pay-scales'] });
      setShowConfirmDialog(false);
      setPreviewData(null);
      toast({
        title: "Wage Increase Applied",
        description: `Successfully updated pay scales for ${data.results.length} tenants.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply wage increase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreview = () => {
    const percentage = parseFloat(increasePercentage);
    if (percentage > 0 && percentage <= 50) {
      previewMutation.mutate(percentage);
    }
  };

  const handleApply = () => {
    const percentage = parseFloat(increasePercentage);
    applyMutation.mutate({
      increasePercentage: percentage,
      effectiveDate,
      description: description || `${percentage}% ScHADS wage increase`
    });
  };

  const nextIncreaseDate = dueCheck ? new Date(dueCheck.nextIncreaseDate) : null;
  const isOverdue = dueCheck?.isDue || false;

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">ScHADS Wage Increase Manager</h2>
          <p className="text-muted-foreground">Apply yearly wage increases across all tenants</p>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          {isOverdue ? (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Increase Due</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3" />
              <span>Up to Date</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Due Date Alert */}
      {isOverdue && nextIncreaseDate && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            ScHADS wage increase is due! Next increase date: {format(nextIncreaseDate, 'MMMM d, yyyy')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wage Increase Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Apply Wage Increase</span>
            </CardTitle>
            <CardDescription>
              Set the percentage increase and effective date for all ScHADS pay scales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Percentage Input */}
            <div className="space-y-2">
              <Label htmlFor="percentage">Increase Percentage (%)</Label>
              <Input
                id="percentage"
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={increasePercentage}
                onChange={(e) => setIncreasePercentage(e.target.value)}
                placeholder="3.5"
              />
            </div>

            {/* Effective Date */}
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Annual ScHADS wage increase per Fair Work decision..."
                rows={3}
              />
            </div>

            {/* Preview Button */}
            <Button 
              onClick={handlePreview}
              disabled={previewMutation.isPending || !increasePercentage}
              className="w-full"
              variant="outline"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <DollarSign className="h-4 w-4 mr-2" />
              )}
              Preview Impact
            </Button>
          </CardContent>
        </Card>

        {/* Preview Results */}
        {previewData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Impact Preview</span>
              </CardTitle>
              <CardDescription>
                {increasePercentage}% increase across all tenants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {previewData.totalTenants}
                  </div>
                  <div className="text-sm text-muted-foreground">Tenants</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {previewData.totalRatesAffected}
                  </div>
                  <div className="text-sm text-muted-foreground">Pay Scales</div>
                </div>
              </div>

              {/* Sample Calculations */}
              <div className="space-y-2">
                <h4 className="font-medium">Sample Rate Changes:</h4>
                <div className="space-y-1">
                  {previewData.sampleCalculations.slice(0, 4).map((calc, index) => (
                    <div key={index} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>L{calc.level}.{calc.payPoint} ({calc.employmentType})</span>
                      <span className="font-mono">
                        ${calc.currentRate.toFixed(2)} → ${calc.newRate.toFixed(2)} 
                        <span className="text-green-600 ml-1">(+${calc.increase.toFixed(2)})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Apply {increasePercentage}% Increase
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Wage Increase</DialogTitle>
                    <DialogDescription>
                      This will apply a {increasePercentage}% increase to all pay scales across 
                      {previewData.totalTenants} tenants ({previewData.totalRatesAffected} rates).
                      This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleApply} disabled={applyMutation.isPending}>
                      {applyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Confirm Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Wage Increase History</span>
          </CardTitle>
          <CardDescription>
            Previous wage increases applied to the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No wage increases have been applied yet.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(item.createdAt), 'MMM d, yyyy at h:mm a')}
                    </div>
                  </div>
                  <Badge variant="outline">Applied</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}