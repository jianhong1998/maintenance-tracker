export const JOB_TYPES = {
  notificationUpcoming: 'notification.upcoming',
  notificationOverdue: 'notification.overdue',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
