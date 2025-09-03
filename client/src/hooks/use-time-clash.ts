import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TimeClash {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
  staffName?: string;
  clientName?: string;
  conflictType?: 'staff' | 'client';
}

interface TimeClashResult {
  hasClash: boolean;
  message: string;
  staffClashes?: TimeClash[];
  clientClashes?: TimeClash[];
  totalConflicts?: number;
}

interface TimeClashCheckParams {
  userId?: number;
  clientId?: number;
  startTime: string | Date;
  endTime: string | Date;
  excludeShiftId?: number;
  checkStaff?: boolean;
  checkClient?: boolean;
}

export function useTimeClashCheck() {
  const [clashResult, setClashResult] = useState<TimeClashResult | null>(null);

  const checkTimeClash = useMutation({
    mutationFn: async (params: TimeClashCheckParams): Promise<TimeClashResult> => {
      console.log('[TIME CLASH] Checking for conflicts:', params);
      return await apiRequest('POST', '/api/shifts/check-clash', {
        userId: params.userId,
        clientId: params.clientId,
        startTime: typeof params.startTime === 'string' ? params.startTime : params.startTime.toISOString(),
        endTime: typeof params.endTime === 'string' ? params.endTime : params.endTime.toISOString(),
        excludeShiftId: params.excludeShiftId,
        checkStaff: params.checkStaff ?? true,
        checkClient: params.checkClient ?? true,
      });
    },
    onSuccess: (result) => {
      setClashResult(result);
    },
    onError: (error) => {
      console.error('Time clash check failed:', error);
      setClashResult(null);
    },
  });

  const clearClashResult = () => {
    setClashResult(null);
  };

  return {
    checkTimeClash: checkTimeClash.mutate,
    isChecking: checkTimeClash.isPending,
    clashResult,
    clearClashResult,
    error: checkTimeClash.error,
  };
}