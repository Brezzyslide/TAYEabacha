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
}

interface TimeClashWarningProps {
  clashes: TimeClash[];
  userName?: string;
  onProceed?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export default function TimeClashWarning({ 
  clashes, 
  userName,
  onProceed, 
  onCancel, 
  showActions = true 
}: TimeClashWarningProps) {
  if (!clashes || clashes.length === 0) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <strong className="text-orange-800 dark:text-orange-200">
              Time Clash Warning
            </strong>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
              {clashes.length} conflict{clashes.length > 1 ? 's' : ''}
            </Badge>
          </div>
          
          <p className="text-orange-700 dark:text-orange-300">
            {userName ? `${userName} is` : 'This user is'} already assigned to overlapping shift{clashes.length > 1 ? 's' : ''}:
          </p>
          
          <div className="space-y-2">
            {clashes.map((clash) => (
              <div 
                key={clash.id} 
                className="bg-orange-100 dark:bg-orange-900/30 rounded-md p-3 border border-orange-200 dark:border-orange-800"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100">
                      {clash.title}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-orange-700 dark:text-orange-300">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(clash.startTime), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(clash.startTime), 'h:mm a')} - {format(new Date(clash.endTime), 'h:mm a')}
                      </div>
                    </div>
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
          
          <p className="text-orange-700 dark:text-orange-300 text-sm">
            You can still proceed with this assignment, but please ensure the staff member can manage overlapping responsibilities.
          </p>
          
          {showActions && (onProceed || onCancel) && (
            <div className="flex gap-2 pt-2">
              {onProceed && (
                <button
                  onClick={onProceed}
                  className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition-colors"
                >
                  Proceed Anyway
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel Assignment
                </button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}