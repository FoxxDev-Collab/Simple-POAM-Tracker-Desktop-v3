import React from 'react';
import { Check, X } from 'lucide-react';
import { ProcessingStep } from './types';

interface NessusProcessingStepsProps {
  loading: boolean;
  processingSteps: ProcessingStep[];
  isProcessingComplete: boolean;
}

export const NessusProcessingSteps: React.FC<NessusProcessingStepsProps> = ({
  loading,
  processingSteps,
  isProcessingComplete
}) => {
  if (!loading && processingSteps.length === 0) return null;

  return (
    <>
      {/* Processing Steps Animation */}
      {loading && processingSteps.length > 0 && (
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-semibold text-foreground">Processing Nessus Scan</h3>
          </div>
          <div className="space-y-3">
            {processingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                {/* Step Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.status === 'completed' 
                    ? 'bg-success/20 text-success' 
                    : step.status === 'processing'
                    ? 'bg-primary/20 text-primary'
                    : step.status === 'error'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.status === 'completed' ? (
                    <Check className="w-4 h-4" />
                  ) : step.status === 'processing' ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : step.status === 'error' ? (
                    <X className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                
                {/* Step Content */}
                <div className="flex-1">
                  <div className={`font-medium ${
                    step.status === 'completed' 
                      ? 'text-success' 
                      : step.status === 'processing'
                      ? 'text-primary'
                      : step.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </div>
                  {step.message && (
                    <div className="text-sm text-muted-foreground">{step.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Complete Confirmation */}
      {isProcessingComplete && !loading && (
        <div className="mb-8 p-6 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-success/20 text-success rounded-full flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">Nessus Analysis Complete!</h3>
              <p className="text-success/90">Your Nessus scan has been processed and analyzed successfully.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded">
            <div className="text-sm text-primary">
              <strong>Next Steps:</strong> Review the findings below and use "Create Prep List" to generate vulnerability remediation plans.
            </div>
          </div>
        </div>
      )}

      {/* Simple Loading State for other operations */}
      {loading && processingSteps.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
    </>
  );
};