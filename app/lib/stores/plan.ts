import { map, computed } from 'nanostores';

/**
 * Represents a single task in the plan
 */
export interface PlanTask {
  /** Unique identifier for the task */
  id: string;

  /** Short title describing the task */
  title: string;

  /** Optional detailed description of what the task accomplishes */
  description?: string;

  /** Current status of the task */
  status: 'not-started' | 'in-progress' | 'completed';

  /** Files this task will create or modify */
  fileActions?: string[];
}

/**
 * State of the planning feature
 */
export interface PlanState {
  /** Whether planning mode is active */
  isActive: boolean;

  /** List of tasks in the plan */
  tasks: PlanTask[];

  /** ID of the currently executing task */
  currentTaskId: string | null;

  /** Whether the user has approved the plan */
  approvedByUser: boolean;

  /** Title of the plan */
  planTitle?: string;
}

/**
 * Initial state for the plan store
 */
const initialState: PlanState = {
  isActive: false,
  tasks: [],
  currentTaskId: null,
  approvedByUser: false,
  planTitle: undefined,
};

/**
 * Main plan store - manages the state of the planning feature
 */
export const planStore = map<PlanState>(initialState);

/**
 * Computed store for progress percentage
 */
export const planProgress = computed(planStore, (state) => {
  if (state.tasks.length === 0) {
    return 0;
  }

  const completedTasks = state.tasks.filter((task) => task.status === 'completed').length;

  return Math.round((completedTasks / state.tasks.length) * 100);
});

/**
 * Computed store for the current task
 */
export const currentTask = computed(planStore, (state) => {
  if (!state.currentTaskId) {
    return null;
  }

  return state.tasks.find((task) => task.id === state.currentTaskId) ?? null;
});

/**
 * Computed store for whether all tasks are completed
 */
export const allTasksCompleted = computed(planStore, (state) => {
  if (state.tasks.length === 0) {
    return false;
  }

  return state.tasks.every((task) => task.status === 'completed');
});

/**
 * Computed store for pending tasks count
 */
export const pendingTasksCount = computed(planStore, (state) => {
  return state.tasks.filter((task) => task.status !== 'completed').length;
});

/**
 * Set the plan with a list of tasks
 */
export function setPlan(tasks: PlanTask[], title?: string): void {
  planStore.set({
    isActive: true,
    tasks: tasks.map((task) => ({
      ...task,
      status: task.status || 'not-started',
    })),
    currentTaskId: null,
    approvedByUser: false,
    planTitle: title,
  });
}

/**
 * Add a single task to the plan
 */
export function addTask(task: Omit<PlanTask, 'status'> & { status?: PlanTask['status'] }): void {
  const currentState = planStore.get();

  planStore.set({
    ...currentState,
    isActive: true,
    tasks: [
      ...currentState.tasks,
      {
        ...task,
        status: task.status || 'not-started',
      },
    ],
  });
}

/**
 * Update the status of a specific task
 */
export function updateTaskStatus(taskId: string, status: PlanTask['status']): void {
  const currentState = planStore.get();
  const taskIndex = currentState.tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    console.warn(`[PlanStore] Task with id "${taskId}" not found`);
    return;
  }

  const updatedTasks = [...currentState.tasks];
  updatedTasks[taskIndex] = {
    ...updatedTasks[taskIndex],
    status,
  };

  // If setting to in-progress, update currentTaskId
  const newCurrentTaskId = status === 'in-progress' ? taskId : currentState.currentTaskId;

  planStore.set({
    ...currentState,
    tasks: updatedTasks,
    currentTaskId: newCurrentTaskId,
  });
}

/**
 * Set the current task by ID
 */
export function setCurrentTask(taskId: string | null): void {
  const currentState = planStore.get();

  planStore.set({
    ...currentState,
    currentTaskId: taskId,
  });
}

/**
 * Mark the plan as approved by the user
 */
export function approvePlan(): void {
  const currentState = planStore.get();

  planStore.set({
    ...currentState,
    approvedByUser: true,
  });
}

/**
 * Reject/cancel the plan
 */
export function rejectPlan(): void {
  planStore.set(initialState);
}

/**
 * Reset the plan to initial state
 */
export function resetPlan(): void {
  planStore.set(initialState);
}

/**
 * Get the next pending task (first task that is not-started)
 */
export function getNextPendingTask(): PlanTask | null {
  const currentState = planStore.get();

  return currentState.tasks.find((task) => task.status === 'not-started') ?? null;
}

/**
 * Advance to the next task - marks current as completed and next as in-progress
 */
export function advanceToNextTask(): PlanTask | null {
  const currentState = planStore.get();

  // Find and complete current task
  if (currentState.currentTaskId) {
    updateTaskStatus(currentState.currentTaskId, 'completed');
  }

  // Find next pending task
  const nextTask = getNextPendingTask();

  if (nextTask) {
    updateTaskStatus(nextTask.id, 'in-progress');
    return nextTask;
  }

  // No more tasks - clear current task
  setCurrentTask(null);

  return null;
}

/**
 * Update a task's details
 */
export function updateTask(taskId: string, updates: Partial<Omit<PlanTask, 'id'>>): void {
  const currentState = planStore.get();
  const taskIndex = currentState.tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    console.warn(`[PlanStore] Task with id "${taskId}" not found`);
    return;
  }

  const updatedTasks = [...currentState.tasks];
  updatedTasks[taskIndex] = {
    ...updatedTasks[taskIndex],
    ...updates,
  };

  planStore.set({
    ...currentState,
    tasks: updatedTasks,
  });
}

/**
 * Remove a task from the plan
 */
export function removeTask(taskId: string): void {
  const currentState = planStore.get();

  planStore.set({
    ...currentState,
    tasks: currentState.tasks.filter((task) => task.id !== taskId),
    currentTaskId: currentState.currentTaskId === taskId ? null : currentState.currentTaskId,
  });
}

/**
 * Reorder tasks in the plan
 */
export function reorderTasks(fromIndex: number, toIndex: number): void {
  const currentState = planStore.get();
  const tasks = [...currentState.tasks];

  const [removed] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, removed);

  planStore.set({
    ...currentState,
    tasks,
  });
}
