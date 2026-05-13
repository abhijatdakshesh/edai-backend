export type VtuGrade = "O" | "A+" | "A" | "B+" | "B" | "C" | "P" | "F";

const GRADE_THRESHOLDS: { pct: number; grade: VtuGrade; points: number }[] = [
  { pct: 90, grade: "O", points: 10 },
  { pct: 80, grade: "A+", points: 9 },
  { pct: 70, grade: "A", points: 8 },
  { pct: 60, grade: "B+", points: 7 },
  { pct: 55, grade: "B", points: 6 },
  { pct: 50, grade: "C", points: 5 },
  { pct: 40, grade: "P", points: 4 },
];

const GRADE_POINTS: Record<string, number> = {
  O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, P: 4, F: 0,
};

export function totalToVtuGrade(total: number, maxTotal: number): VtuGrade {
  const pct = (total / maxTotal) * 100;
  for (const t of GRADE_THRESHOLDS) {
    if (pct >= t.pct) return t.grade;
  }
  return "F";
}

export function vtuGradeToPoints(grade: string): number {
  return GRADE_POINTS[grade] ?? 0;
}

export function computeSgpa(subjects: { credits: number; gradePoints: number }[]): number {
  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0);
  if (totalCredits === 0) return 0;
  const weightedSum = subjects.reduce((s, sub) => s + sub.credits * sub.gradePoints, 0);
  return Math.round((weightedSum / totalCredits) * 100) / 100;
}

export function computeCgpa(semesters: { credits: number; gradePoints: number }[][]): number {
  const flat = semesters.flat();
  return computeSgpa(flat);
}
