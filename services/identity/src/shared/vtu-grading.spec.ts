import { totalToVtuGrade, vtuGradeToPoints, computeSgpa, computeCgpa } from "./vtu-grading";

describe("totalToVtuGrade — exact boundaries", () => {
  it.each([
    [90, 100, "O"],
    [89, 100, "A+"],
    [80, 100, "A+"],
    [79, 100, "A"],
    [70, 100, "A"],
    [69, 100, "B+"],
    [60, 100, "B+"],
    [59, 100, "B"],
    [55, 100, "B"],
    [54, 100, "C"],
    [50, 100, "C"],
    [49, 100, "P"],
    [40, 100, "P"],
    [39, 100, "F"],
    [0, 100, "F"],
  ])("marks %i/100 → %s", (total, max, expected) => {
    expect(totalToVtuGrade(total, max)).toBe(expected);
  });

  it("throws when maxTotal is 0", () => {
    expect(() => totalToVtuGrade(0, 0)).toThrow("maxTotal must be > 0");
  });

  it("handles non-100 max at exact O boundary (45/50 = 90%)", () => {
    expect(totalToVtuGrade(45, 50)).toBe("O");
  });

  it("handles non-100 max just below O boundary (44/50 = 88%)", () => {
    expect(totalToVtuGrade(44, 50)).toBe("A+");
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
    expect(vtuGradeToPoints("WH")).toBe(0);
  });
});

describe("computeSgpa", () => {
  it("computes weighted average (4×10 + 3×8 + 3×7) / 10 = 8.5", () => {
    const subs = [
      { credits: 4, gradePoints: 10 },
      { credits: 3, gradePoints: 8 },
      { credits: 3, gradePoints: 7 },
    ];
    expect(computeSgpa(subs)).toBe(8.5);
  });

  it("rounds to 2dp for non-exact division (58/7 = 8.29)", () => {
    const subs = [{ credits: 3, gradePoints: 10 }, { credits: 4, gradePoints: 7 }];
    expect(computeSgpa(subs)).toBe(8.29);
  });

  it("returns 0 for empty subjects", () => {
    expect(computeSgpa([])).toBe(0);
  });

  it("returns 0 for all-F grades", () => {
    expect(computeSgpa([{ credits: 4, gradePoints: 0 }, { credits: 3, gradePoints: 0 }])).toBe(0);
  });

  it("ignores zero-credit subjects without corrupting average", () => {
    const subs = [{ credits: 4, gradePoints: 9 }, { credits: 0, gradePoints: 0 }];
    expect(computeSgpa(subs)).toBe(9.0);
  });
});

describe("computeCgpa — concrete values", () => {
  it("aggregates two semesters to correct CGPA (106/14 = 7.57)", () => {
    const sem1 = [{ credits: 4, gradePoints: 9 }, { credits: 3, gradePoints: 8 }];
    const sem2 = [{ credits: 4, gradePoints: 7 }, { credits: 3, gradePoints: 6 }];
    expect(computeCgpa([sem1, sem2])).toBe(7.57);
  });

  it("returns 0 for empty semesters array", () => {
    expect(computeCgpa([])).toBe(0);
  });

  it("single-semester CGPA equals that semester SGPA (57/7 = 8.14)", () => {
    const sem = [{ credits: 4, gradePoints: 9 }, { credits: 3, gradePoints: 7 }];
    expect(computeCgpa([sem])).toBe(8.14);
    expect(computeCgpa([sem])).toBe(computeSgpa(sem));
  });

  it("all-F grades: CGPA is 0", () => {
    const sems = [[{ credits: 4, gradePoints: 0 }]];
    expect(computeCgpa(sems)).toBe(0);
  });
});
