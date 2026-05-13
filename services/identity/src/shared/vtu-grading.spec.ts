import { totalToVtuGrade, vtuGradeToPoints, computeSgpa, computeCgpa } from "./vtu-grading";

describe("totalToVtuGrade", () => {
  it.each([
    [92, 100, "O"],
    [80, 100, "A+"],
    [75, 100, "A"],
    [62, 100, "B+"],
    [55, 100, "B"],
    [50, 100, "C"],
    [45, 100, "P"],
    [35, 100, "F"],
  ])("marks %i/%i → %s", (total, max, expected) => {
    expect(totalToVtuGrade(total, max)).toBe(expected);
  });

  it("handles non-100 max", () => {
    expect(totalToVtuGrade(45, 50)).toBe("O"); // 90%
  });
});

describe("vtuGradeToPoints", () => {
  it.each([
    ["O", 10], ["A+", 9], ["A", 8], ["B+", 7],
    ["B", 6], ["C", 5], ["P", 4], ["F", 0],
  ])("%s → %i", (grade, pts) => {
    expect(vtuGradeToPoints(grade)).toBe(pts);
  });

  it("returns 0 for legacy/unknown grades", () => {
    expect(vtuGradeToPoints("S")).toBe(0);
    expect(vtuGradeToPoints("D")).toBe(0);
  });
});

describe("computeSgpa", () => {
  it("computes weighted average", () => {
    const subs = [
      { credits: 4, gradePoints: 10 }, // O
      { credits: 3, gradePoints: 8 },  // A
      { credits: 3, gradePoints: 7 },  // B+
    ];
    // (4*10 + 3*8 + 3*7) / 10 = (40+24+21)/10 = 8.5
    expect(computeSgpa(subs)).toBe(8.5);
  });

  it("returns 0 for empty subjects", () => {
    expect(computeSgpa([])).toBe(0);
  });

  it("rounds to 2dp", () => {
    const subs = [{ credits: 3, gradePoints: 10 }, { credits: 3, gradePoints: 7 }];
    // (30+21)/6 = 51/6 = 8.5
    expect(computeSgpa(subs)).toBe(8.5);
  });
});

describe("computeCgpa", () => {
  it("flattens semesters and computes", () => {
    const sem1 = [{ credits: 4, gradePoints: 9 }, { credits: 3, gradePoints: 8 }];
    const sem2 = [{ credits: 4, gradePoints: 7 }, { credits: 3, gradePoints: 6 }];
    const flat = [...sem1, ...sem2];
    expect(computeCgpa([sem1, sem2])).toBe(computeSgpa(flat));
  });

  it("handles all F grades", () => {
    const sems = [[{ credits: 4, gradePoints: 0 }]];
    expect(computeCgpa(sems)).toBe(0);
  });
});
