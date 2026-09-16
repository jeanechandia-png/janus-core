export type JobStatus = 'queued' | 'running' | 'paused' | 'blocked' | 'completed' | 'failed' | 'cancelled';

export interface JobPartition {
  id: string;
  order: number;
  inputRef: string;
  status: JobStatus;
  attempts: number;
  checkpoint?: string;
}

export interface DurableJob {
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  partitions: JobPartition[];
  maxConcurrency: number;
}

export function nextRunnablePartitions(job: DurableJob): JobPartition[] {
  if (job.status === 'paused' || job.status === 'blocked' || job.status === 'cancelled' || job.status === 'completed') {
    return [];
  }
  const active = job.partitions.filter((partition) => partition.status === 'running').length;
  const capacity = Math.max(0, job.maxConcurrency - active);
  return job.partitions
    .filter((partition) => partition.status === 'queued' || partition.status === 'failed')
    .sort((a, b) => a.order - b.order)
    .slice(0, capacity);
}

export function jobProgress(job: DurableJob): { completed: number; total: number; ratio: number } {
  const total = job.partitions.length;
  const completed = job.partitions.filter((partition) => partition.status === 'completed').length;
  return { completed, total, ratio: total === 0 ? 1 : completed / total };
}

export function canFinalizeJob(job: DurableJob): boolean {
  return job.partitions.every((partition) => partition.status === 'completed');
}
