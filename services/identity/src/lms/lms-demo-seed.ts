import type { LessonContentBlock, CheckpointQuestion } from '../entities/lms.entity';

/** Shared VTU pilot content — CS501 Process Scheduling (used by in-memory + DB seed). */
export const LMS_DEMO_COURSE_ID = 'CS501';
export const LMS_DEMO_MODULE_ID = 'mod-os-scheduling';

const sampleCode = `# FCFS scheduling example
processes = [("P1", 5), ("P2", 3), ("P3", 8)]
time = 0
for name, burst in processes:
    print(f"{name} runs from {time} to {time + burst}")
    time += burst
print(f"Average completion time: {time / len(processes):.1f}")`;

export interface LmsDemoLessonSeed {
  id: string;
  title: string;
  order: number;
  topicTags: string[];
  contentBlocks: LessonContentBlock[];
  checkpoint: CheckpointQuestion[];
}

export const LMS_DEMO_MODULE = {
  id: LMS_DEMO_MODULE_ID,
  title: 'Process Scheduling',
  description: 'How the OS decides which process runs next on the CPU.',
  order: 1,
};

export const LMS_DEMO_LESSONS: LmsDemoLessonSeed[] = [
  {
    id: 'les-fcfs',
    title: 'First-Come First-Served (FCFS)',
    order: 1,
    topicTags: ['scheduling', 'fcfs'],
    contentBlocks: [
      {
        kind: 'MARKDOWN',
        data: '## FCFS Scheduling\n\nFirst-Come First-Served is the simplest CPU scheduling algorithm. Processes are executed strictly in the order they arrive in the ready queue.\n\n**Pros:** simple, fair in arrival order.\n\n**Cons:** *convoy effect* — one long process delays many short ones.\n\n### Example\nIf P1 (burst 24ms), P2 (3ms), P3 (3ms) arrive in that order, P2 and P3 wait 24ms each despite needing only 3ms.',
      },
      { kind: 'CODE', data: sampleCode },
    ],
    checkpoint: [
      { q: 'FCFS is best described as:', options: ['Preemptive', 'Non-preemptive', 'Round-robin', 'Priority-based'], correctIndex: 1 },
      { q: 'The "convoy effect" means:', options: ['CPU is idle', 'Short jobs wait behind long jobs', 'Disk is slow', 'I/O bound jobs starve'], correctIndex: 1 },
      { q: 'FCFS scheduling order is determined by:', options: ['Burst time', 'Priority', 'Arrival time', 'Random'], correctIndex: 2 },
    ],
  },
  {
    id: 'les-sjf',
    title: 'Shortest Job First (SJF)',
    order: 2,
    topicTags: ['scheduling', 'sjf'],
    contentBlocks: [
      {
        kind: 'MARKDOWN',
        data: '## Shortest Job First\n\nSJF picks the process with the smallest next CPU burst. Optimal for minimum average waiting time, but predicting the next burst is hard in practice.',
      },
      { kind: 'VIDEO', data: 'https://www.youtube.com/watch?v=2h3eWaPx8SA' },
    ],
    checkpoint: [
      { q: 'SJF minimises:', options: ['Throughput', 'Avg waiting time', 'CPU util', 'Response time'], correctIndex: 1 },
      { q: 'SJF requires:', options: ['Random selection', 'Knowing burst times in advance', 'Two CPUs', 'Priority list'], correctIndex: 1 },
      { q: 'SJF can be:', options: ['Only preemptive', 'Only non-preemptive', 'Either', 'Neither'], correctIndex: 2 },
    ],
  },
  {
    id: 'les-rr',
    title: 'Round Robin (RR)',
    order: 3,
    topicTags: ['scheduling', 'round-robin', 'time-slice'],
    contentBlocks: [
      {
        kind: 'MARKDOWN',
        data: '## Round Robin\n\nEach process gets a fixed *time quantum* (e.g. 10ms) then is preempted. Good for interactive systems. Choosing the quantum is the key tuning knob.',
      },
    ],
    checkpoint: [
      { q: 'Round Robin is:', options: ['Non-preemptive', 'Preemptive', 'Cooperative', 'Manual'], correctIndex: 1 },
      { q: 'A very small time quantum causes:', options: ['Better latency, lower throughput', 'Better throughput', 'CPU starvation', 'Disk thrashing'], correctIndex: 0 },
      { q: 'RR is best for:', options: ['Batch jobs', 'Interactive workloads', 'Real-time only', 'Memory-bound'], correctIndex: 1 },
    ],
  },
];
