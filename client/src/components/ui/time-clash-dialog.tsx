import React from 'react';
import { AlertTriangle, Clock, Calendar, Users, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface TimeClash {
  id: number;
  title: string;
  startTime: string | Date;
  endTime: string | Date;
  status?: string;
  staffName?: string;
  clientName?: string;
  conflictType?: 'staff' | 'client';
}

interface TimeClashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffClashes?: TimeClash[];
  clientClashes?: TimeClash[];
  clashes?: TimeClash[]; // Legacy support
  userName?: string;
  clientName?: string;
  onProceed: () => void;
  onCancel: () => void;
}

export default function TimeClashDialog({ 
  open,
  onOpenChange,
  staffClashes = [],
  clientClashes = [],
  clashes = [], // Legacy support
  userName,
  clientName,
  onProceed, 
  onCancel
}: TimeClashDialogProps) {
  // Support legacy usage
  const allStaffClashes = [...staffClashes, ...clashes.filter(c => !c.conflictType || c.conflictType === 'staff')];
  const allClientClashes = [...clientClashes, ...clashes.filter(c => c.conflictType === 'client')];
  const totalConflicts = allStaffClashes.length + allClientClashes.length;
  
  const handleProceed = () => {
    onProceed();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const renderClashes = (conflicts: TimeClash[], type: 'staff' | 'client') => {
    if (conflicts.length === 0) return null;
    
    const typeLabel = type === 'staff' ? 'Staff' : 'Client';
    const typeColor = type === 'staff' ? 'text-red-700' : 'text-blue-700';
    const typeBg = type === 'staff' ? 'bg-red-50' : 'bg-blue-50';
    const typeBorder = type === 'staff' ? 'border-red-200' : 'border-blue-200';
    
    return (
      <div className="space-y-3">
        <h4 className={`font-semibold ${typeColor} flex items-center gap-2`}>
          {type === 'staff' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          {typeLabel} Conflicts ({conflicts.length})
        </h4>
        {conflicts.map((clash) => (
          <div 
            key={`${type}-${clash.id}`} 
            className={`${typeBg} rounded-lg p-4 border ${typeBorder}`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className={`font-medium ${typeColor.replace('700', '900')}`}>
                  {clash.title}
                </h5>
                <Badge variant="secondary" className="text-xs">
                  ID: {clash.id}
                </Badge>
              </div>
              <div className={`flex items-center gap-4 text-sm ${typeColor}`}>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(clash.startTime), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(clash.startTime), 'h:mm a')} - {format(new Date(clash.endTime), 'h:mm a')}
                </div>
              </div>
              {clash.status && (
                <Badge variant="outline" className="text-xs">
                  Status: {clash.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Schedule Conflict Detected
          </DialogTitle>
          <DialogDescription>
            The shift you're trying to {staffClashes.length > 0 || clashes.length > 0 ? 'create or update' : 'schedule'} conflicts with existing shifts. 
            Please review the conflicts below and choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Alert */}
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Warning:</strong> Found {totalConflicts} scheduling conflict{totalConflicts > 1 ? 's' : ''}.
              {userName && ` Staff member "${userName}" is already scheduled during this time.`}
              {clientName && ` Client "${clientName}" already has a shift during this time.`}
            </AlertDescription>
          </Alert>

          {/* Staff Conflicts */}
          {renderClashes(allStaffClashes, 'staff')}

          {/* Client Conflicts */}
          {renderClashes(allClientClashes, 'client')}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              onClick={handleProceed}
              variant="destructive"
              className="flex-1"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Proceed Anyway (Override)
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel & Review Schedule
            </Button>
          </div>

          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
            <strong>Note:</strong> Proceeding will create/update the shift despite conflicts. 
            Make sure this is intentional and won't cause scheduling issues.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}