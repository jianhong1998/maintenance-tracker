'use client';

import { useHealthCheck } from '@/hooks/queries/health-check/useBackendHealthCheck';
import { ErrorHandler } from '@/hooks/queries/helper/error-handler';
import { NextPage } from 'next';
import { useEffect } from 'react';
import { toast } from 'sonner';

export const HomePage: NextPage = () => {
  const { error: healthCheckError, data: healthCheckResult } = useHealthCheck();

  useEffect(() => {
    if (!healthCheckError) return;

    const errorMessage = ErrorHandler.extractErrorMessage(healthCheckError);
    toast.error(errorMessage);
  }, [healthCheckError]);

  return (
    <div className="text-3xl font-extrabold text-blue-600">
      Backend Server is {healthCheckResult?.isHealthy ? `Healthy` : `Unhealthy`}
    </div>
  );
};
