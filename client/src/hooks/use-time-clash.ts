import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface TimeClash {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
}

interface TimeClashResult {
  hasClash: boolean;
  message: string;
  clashes?: TimeClash[];
}

interface TimeClashCheckParams {
  userId: number;
  startTime: string | Date;
  endTime: string | Date;
  excludeShiftId?: number;
}

export function useTimeClashCheck() {
  const [clashResult, setClashResult] = useState<TimeClashResult | null>(null);

  const checkTimeClash = useMutation({
    mutationFn: async (params: TimeClashCheckParams): Promise<TimeClashResult> => {
      const response = await fetch('/api/shifts/check-clash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: params.userId,
          startTime: typeof params.startTime === 'string' ? params.startTime : params.startTime.toISOString(),
          endTime: typeof params.endTime === 'string' ? params.endTime : params.endTime.toISOString(),
          excludeShiftId: params.excludeShiftId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check time clashes');
      }

      return response.json();
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