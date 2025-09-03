import React from 'react';
import { AlertTriangle, Clock, Calendar } from 'lucide-react';
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

interface TimeClashWarningProps {
  staffClashes?: TimeClash[];
  clientClashes?: TimeClash[];
  clashes?: TimeClash[]; // Legacy support
  userName?: string;
  clientName?: string;
  onProceed?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export default function TimeClashWarning({ 
  staffClashes = [],
  clientClashes = [],
  clashes = [], // Legacy support
  userName,
  clientName,
  onProceed, 
  onCancel, 
  showActions = true 
}: TimeClashWarningProps) {
  // Support legacy usage
  const allStaffClashes = [...staffClashes, ...clashes.filter(c => !c.conflictType || c.conflictType === 'staff')];
  const allClientClashes = [...clientClashes, ...clashes.filter(c => c.conflictType === 'client')];
  const totalConflicts = allStaffClashes.length + allClientClashes.length;
  
  if (totalConflicts === 0) return null;

  const renderClashes = (conflicts: TimeClash[], type: 'staff' | 'client') => {
    if (conflicts.length === 0) return null;
    
    const typeLabel = type === 'staff' ? 'Staff' : 'Client';
    const typeColor = type === 'staff' ? 'text-red-700' : 'text-blue-700';
    const typeBg = type === 'staff' ? 'bg-red-100' : 'bg-blue-100';
    const typeBorder = type === 'staff' ? 'border-red-200' : 'border-blue-200';
    
    return (
      <div className="space-y-2">
        <h4 className={`font-medium ${typeColor} dark:${typeColor.replace('700', '300')}`}>
          {typeLabel} Conflicts ({conflicts.length})
        </h4>
        {conflicts.map((clash) => (
          <div 
            key={`${type}-${clash.id}`} 
            className={`${typeBg} dark:${typeBg.replace('100', '900/30')} rounded-md p-3 border ${typeBorder} dark:${typeBorder.replace('200', '800')}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h5 className={`font-medium ${typeColor.replace('700', '900')} dark:${typeColor.replace('700', '100')}`}>
                  {clash.title}
                </h5>
                <div className={`flex items-center gap-4 text-sm ${typeColor} dark:${typeColor.replace('700', '300')}`}>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(clash.startTime), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(clash.startTime), 'h:mm a')} - {format(new Date(clash.endTime), 'h:mm a')}
                  </div>
                </div>
                {(clash.staffName || clash.clientName) && (
                  <p className={`text-xs ${typeColor} dark:${typeColor.replace('700', '300')}`}>
                    {type === 'staff' ? clash.staffName : clash.clientName}
                  </p>
                )}
              </div>
              {clash.status && (
                <Badge variant="secondary" className="text-xs">
                  {clash.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <strong className="text-orange-800 dark:text-orange-200">
              Time Conflict Warning
            </strong>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
              {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''}
            </Badge>
          </div>
          
          {allStaffClashes.length > 0 && (
            <div>
              <p className="text-orange-700 dark:text-orange-300 mb-2">
                {userName || 'This staff member'} has overlapping shift assignments:
              </p>
              {renderClashes(allStaffClashes, 'staff')}
            </div>
          )}
          
          {allClientClashes.length > 0 && (
            <div>
              <p className="text-orange-700 dark:text-orange-300 mb-2">
                {clientName || 'This client'} has overlapping scheduled care:
              </p>
              {renderClashes(allClientClashes, 'client')}
            </div>
          )}
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 dark:bg-yellow-900/20 dark:border-yellow-800">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              ⚠️ Scheduling Conflict Detected
            </p>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              {allStaffClashes.length > 0 && allClientClashes.length > 0 
                ? "Both staff and client have conflicting schedules. Please verify coverage and ensure quality of care."
                : allStaffClashes.length > 0 
                  ? "Staff member has overlapping shifts. Ensure they can manage multiple responsibilities safely."
                  : "Client has overlapping care sessions. Verify this doesn't exceed their support plan limits."
              }
            </p>
          </div>
          
          {showActions && (onProceed || onCancel) && (
            <div className="flex gap-2 pt-2">
              {onProceed && (
                <button
                  onClick={onProceed}
                  className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                >
                  Proceed with Warning
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel & Reschedule
                </button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}