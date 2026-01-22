import React, { memo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { planStore, planProgress, approvePlan, rejectPlan, type PlanTask } from '~/lib/stores/plan';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { Progress } from '~/components/ui/Progress';

/**
 * Status icon component for task status in compact view
 */
const StatusIcon = memo(({ status }: { status: PlanTask['status'] }) => {
  switch (status) {
    case 'completed':
      return <span className="text-green-500">✓</span>;
    case 'in-progress':
      return <span className="text-blue-500 animate-pulse">●</span>;
    default:
      return <span className="text-bolt-elements-textSecondary">○</span>;
  }
});

StatusIcon.displayName = 'StatusIcon';

interface PlanApprovalAlertProps {
  /** Optional callback when plan is approved */
  onApprove?: () => void;

  /** Optional callback when plan is rejected */
  onReject?: () => void;

  /** Optional callback to send a message to continue execution */
  postMessage?: (message: string) => void;
}

/**
 * PlanApprovalAlert component - shows in the chat area when a plan is pending approval
 */
export const PlanApprovalAlert = memo(({ onApprove, onReject, postMessage }: PlanApprovalAlertProps) => {
  const state = useStore(planStore);
  const progress = useStore(planProgress);

  const handleApprove = useCallback(() => {
    approvePlan();
    onApprove?.();

    // Send a message to continue execution
    postMessage?.('Plan approved. Please proceed with the implementation.');
  }, [onApprove, postMessage]);

  const handleReject = useCallback(() => {
    rejectPlan();
    onReject?.();
  }, [onReject]);

  const handleModify = useCallback(() => {
    // For now, just reject and ask user to clarify
    postMessage?.('I would like to modify the plan. Please adjust the following tasks before proceeding...');
  }, [postMessage]);

  // Don't show if no plan or already approved
  if (!state.isActive || state.tasks.length === 0 || state.approvedByUser) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={classNames('rounded-lg border-2 border-blue-500/50 bg-blue-500/10', 'p-4 mb-4')}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="i-ph:list-checks-fill text-xl text-blue-500" />
            <h3 className="font-semibold text-bolt-elements-textPrimary">{state.planTitle || 'Implementation Plan'}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-bolt-elements-textSecondary">{state.tasks.length} tasks</span>
          </div>
        </div>

        {/* Task list preview */}
        <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {state.tasks.map((task, index) => (
            <div key={task.id} className="flex items-start gap-2 text-sm py-1">
              <span className="text-bolt-elements-textSecondary font-mono w-5">{index + 1}.</span>
              <StatusIcon status={task.status} />
              <div className="flex-1 min-w-0">
                <span className="text-bolt-elements-textPrimary">{task.title}</span>
                {task.description && (
                  <span className="text-bolt-elements-textSecondary text-xs ml-1">— {task.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-bolt-elements-textSecondary mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-bolt-elements-textSecondary">Review the plan before execution</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            >
              <div className="i-ph:x-bold mr-1" />
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleModify}>
              <div className="i-ph:pencil-simple mr-1" />
              Modify
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <div className="i-ph:check-bold mr-1" />
              Approve & Execute
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

PlanApprovalAlert.displayName = 'PlanApprovalAlert';

export default PlanApprovalAlert;
