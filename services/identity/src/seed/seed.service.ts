import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { totalToVtuGrade, vtuGradeToPoints, computeSgpa } from '../shared/vtu-grading';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RecruiterService } from '../recruiter/recruiter.service';
import { CoursesService } from '../courses/courses.service';
import { AttendanceApiService } from '../attendance-api/attendance-api.service';
import { AssignmentsApiService } from '../assignments-api/assignments-api.service';
import { IaService } from '../ia/ia.service';
import { FeesApiService } from '../fees-api/fees-api.service';
import { VtuService } from '../vtu/vtu.service';
import { WellnessService } from '../wellness/wellness.service';
import { JobsService } from '../jobs/jobs.service';
import { ClassesApiService } from '../classes-api/classes-api.service';
import { StudentPortalService } from '../student-portal/student-portal.service';
import { ParentPortalService } from '../parent-portal/parent-portal.service';
import { CommsService } from '../comms/comms.service';
import { AdminPortalService } from '../admin-portal/admin-portal.service';

const STUDENTS = [
  { usn: '1RV21CS001', name: 'Arjun Kumar', dept: 'Computer Science', semester: 5, cgpa: 8.2 },
  { usn: '1RV21CS002', name: 'Sneha Reddy', dept: 'Computer Science', semester: 5, cgpa: 7.9 },
  { usn: '1RV21CS003', name: 'Priya Sharma', dept: 'Computer Science', semester: 5, cgpa: 6.8 },
  { usn: '1RV21CS004', name: 'Karan Joshi', dept: 'Computer Science', semester: 5, cgpa: 8.7 },
  { usn: '1RV21CS005', name: 'Ravi Kumar', dept: 'Computer Science', semester: 5, cgpa: 5.9 },
];

const SUBJECTS = [
  { code: 'CS501', name: 'Data Structures & Algorithms', credits: 4 },
  { code: 'CS502', name: 'Database Management Systems', credits: 4 },
  { code: 'CS503', name: 'Computer Networks', credits: 3 },
  { code: 'CS504', name: 'Operating Systems', credits: 4 },
];

const TEACHER_ID = 'u-faculty-01';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly coursesSvc: CoursesService,
    private readonly attendanceSvc: AttendanceApiService,
    private readonly assignmentsSvc: AssignmentsApiService,
    private readonly iaSvc: IaService,
    private readonly feesSvc: FeesApiService,
    private readonly vtuSvc: VtuService,
    private readonly wellnessSvc: WellnessService,
    private readonly jobsSvc: JobsService,
    private readonly classesSvc: ClassesApiService,
    private readonly studentPortalSvc: StudentPortalService,
    private readonly parentPortalSvc: ParentPortalService,
    private readonly commsSvc: CommsService,
    private readonly adminPortalSvc: AdminPortalService,
    private readonly recruiterSvc: RecruiterService,
    @Optional() @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit(): void {
    this.logger.log('Seeding in-memory stores...');
    this.seedCourses();
    this.seedClasses();
    this.seedAttendance();
    this.seedAssignments();
    this.seedIaMarks();
    this.seedFees();
    this.seedVtu();
    this.seedWellness();
    this.seedJobs();
    this.seedStudentPortal();
    this.seedParentPortal();
    this.seedComms();
    this.seedAcademicResults();
    this.seedAdminPortal();
    // Fire-and-forget — recruiter seed is DB-backed (async), not in-memory
    this.seedRecruiterJobs().catch(e => this.logger.warn('Recruiter seed skipped (DB may not be ready)', e));
    this.logger.log('Seed complete — all modules populated');
  }

  private seedCourses(): void {
    this.coursesSvc.courses = [
      { id: 'course-1', name: 'Data Structures & Algorithms', code: 'CS501', credits: 4, department: 'Computer Science', instructorName: 'Ravi Shankar', instructorId: TEACHER_ID, enrolled: 120 },
      { id: 'course-2', name: 'Database Management Systems', code: 'CS502', credits: 4, department: 'Computer Science', instructorName: 'Dr. Lakshmi Devi', instructorId: 'teacher-002', enrolled: 115 },
      { id: 'course-3', name: 'Computer Networks', code: 'CS503', credits: 3, department: 'Computer Science', instructorName: 'Prof. Suresh Kumar', instructorId: 'teacher-003', enrolled: 118 },
      { id: 'course-4', name: 'Operating Systems', code: 'CS504', credits: 4, department: 'Computer Science', instructorName: 'Ravi Shankar', instructorId: TEACHER_ID, enrolled: 122 },
      { id: 'course-5', name: 'Software Engineering', code: 'CS505', credits: 3, department: 'Computer Science', instructorName: 'Dr. Meena Iyer', instructorId: 'teacher-004', enrolled: 110 },
      { id: 'course-6', name: 'Machine Learning', code: 'CS601', credits: 4, department: 'Computer Science', instructorName: 'Dr. Raj Patel', instructorId: 'teacher-005', enrolled: 90 },
      { id: 'course-7', name: 'Circuit Theory', code: 'EC501', credits: 4, department: 'Electronics', instructorName: 'Dr. Vinod Hegde', instructorId: 'teacher-006', enrolled: 85 },
      { id: 'course-8', name: 'Thermodynamics', code: 'ME501', credits: 4, department: 'Mechanical', instructorName: 'Dr. Prakash Nair', instructorId: 'teacher-007', enrolled: 78 },
    ];

    // Seed enrollments for the demo students so the My Courses page shows
    // realistic "Enrolled" badges out-of-the-box.
    const seededEnrollments = ['1RV21CS001', 'u-student-01'].flatMap((usn) => [
      { courseId: 'course-1', studentUsn: usn },
      { courseId: 'course-2', studentUsn: usn },
      { courseId: 'course-3', studentUsn: usn },
      { courseId: 'course-4', studentUsn: usn },
    ]);
    this.coursesSvc.enrollments = seededEnrollments;
  }

  private seedClasses(): void {
    this.classesSvc.classes = [
      { id: 'class-cs501-a', name: 'CS 5A', departmentCode: 'CSE', section: 'A', subject: 'Data Structures & Algorithms', subjectCode: 'CS501', semester: 5, instructorId: TEACHER_ID, instructorName: 'Ravi Shankar', classTeacherId: TEACHER_ID, classTeacherName: 'Ravi Shankar', strength: 60, studentCount: 60 },
      { id: 'class-cs504-a', name: 'CS 5B', departmentCode: 'CSE', section: 'B', subject: 'Operating Systems', subjectCode: 'CS504', semester: 5, instructorId: TEACHER_ID, instructorName: 'Ravi Shankar', classTeacherId: TEACHER_ID, classTeacherName: 'Ravi Shankar', strength: 62, studentCount: 62 },
      { id: 'class-cs502-a', name: 'CS 5C', departmentCode: 'CSE', section: 'C', subject: 'Database Management Systems', subjectCode: 'CS502', semester: 5, instructorId: 'teacher-002', instructorName: 'Dr. Lakshmi Devi', classTeacherId: 'teacher-002', classTeacherName: 'Dr. Lakshmi Devi', strength: 58, studentCount: 58 },
      { id: 'class-cs503-a', name: 'CS 5D', departmentCode: 'CSE', section: 'D', subject: 'Computer Networks', subjectCode: 'CS503', semester: 5, instructorId: 'teacher-003', instructorName: 'Prof. Suresh Kumar', classTeacherId: 'teacher-003', classTeacherName: 'Prof. Suresh Kumar', strength: 60, studentCount: 60 },
    ];

    const roster = STUDENTS.map((s) => ({ usn: s.usn, name: s.name, dept: s.dept }));
    this.classesSvc.rosters.set('class-cs501-a', roster);
    this.classesSvc.rosters.set('class-cs504-a', roster);
    this.classesSvc.rosters.set('class-cs502-a', roster);
    this.classesSvc.rosters.set('class-cs503-a', roster);
  }

  private seedAttendance(): void {
    const records: typeof this.attendanceSvc.records = [];
    const now = new Date();

    for (const student of STUDENTS) {
      for (const subject of SUBJECTS) {
        for (let d = 29; d >= 0; d--) {
          const date = new Date(now);
          date.setDate(date.getDate() - d);
          if (date.getDay() === 0 || date.getDay() === 6) continue;

          const attendanceProb = student.cgpa > 7.5 ? 0.88 : student.cgpa > 6.5 ? 0.78 : 0.65;
          const status: 'P' | 'A' | 'L' =
            Math.random() < attendanceProb ? 'P' : Math.random() < 0.2 ? 'L' : 'A';

          records.push({
            id: `att-${student.usn}-${subject.code}-${date.toISOString().split('T')[0]}`,
            classId: `class-${subject.code.toLowerCase()}-a`,
            date: date.toISOString().split('T')[0],
            usn: student.usn,
            status,
            subjectCode: subject.code,
            subjectName: subject.name,
            markedBy: TEACHER_ID,
            studentName: student.name,
          });
        }
      }
    }
    this.attendanceSvc.records = records;
  }

  private seedAssignments(): void {
    const assignments = [
      {
        id: 'asn-1',
        title: 'Implement Binary Search Tree',
        dueDate: '2026-04-25',
        subjectCode: 'CS501',
        description: 'Implement a BST with insert, delete, and search operations',
        maxMarks: 20,
        status: 'PUBLISHED' as const,
        teacherId: TEACHER_ID,
        submissionCount: 3,
      },
      {
        id: 'asn-2',
        title: 'SQL Query Optimization',
        dueDate: '2026-04-28',
        subjectCode: 'CS502',
        description: 'Write optimized SQL queries for given scenarios',
        maxMarks: 15,
        status: 'PUBLISHED' as const,
        teacherId: 'teacher-002',
        submissionCount: 2,
      },
      {
        id: 'asn-3',
        title: 'Socket Programming Lab',
        dueDate: '2026-05-02',
        subjectCode: 'CS503',
        description: 'Implement a TCP client-server application',
        maxMarks: 25,
        status: 'PUBLISHED' as const,
        teacherId: 'teacher-003',
        submissionCount: 1,
      },
      {
        id: 'asn-4',
        title: 'Operating Systems Lab Report — Process Scheduling',
        dueDate: '2026-05-12',
        subjectCode: 'CS504',
        description: 'Submit a 5-page lab report comparing FCFS, SJF and Round-Robin scheduling with a runnable simulation.',
        maxMarks: 50,
        status: 'PUBLISHED' as const,
        teacherId: 'teacher-002',
        submissionCount: 0,
      },
      {
        id: 'asn-5',
        title: 'Dynamic Programming Problem Set',
        dueDate: '2026-05-18',
        subjectCode: 'CS505',
        description: 'Solve LIS, edit distance and matrix-chain multiplication. Submit code + complexity analysis.',
        maxMarks: 40,
        status: 'PUBLISHED' as const,
        teacherId: TEACHER_ID,
        submissionCount: 0,
      },
      {
        id: 'asn-6',
        title: 'CNN Image Classifier on CIFAR-10',
        dueDate: '2026-05-25',
        subjectCode: 'CS506',
        description: 'Build a convolutional neural network and report training/validation accuracy with plots.',
        maxMarks: 60,
        status: 'PUBLISHED' as const,
        teacherId: 'teacher-004',
        submissionCount: 0,
      },
      {
        id: 'asn-7',
        title: 'Embedded Systems — LED Pattern via Timer Interrupts',
        dueDate: '2026-04-30',
        subjectCode: 'CS507',
        description: 'Use ARM Cortex-M timer interrupts to drive an LED pattern. Submit schematic + code.',
        maxMarks: 30,
        status: 'PUBLISHED' as const,
        teacherId: 'teacher-005',
        submissionCount: 1,
      },
    ];
    this.assignmentsSvc.assignments = assignments;

    const submissions = [
      { id: 'sub-1', assignmentId: 'asn-1', usn: '1RV21CS001', studentName: 'Arjun Kumar', submittedAt: '2026-04-20T10:00:00Z', marks: 18, feedback: 'Excellent implementation', status: 'GRADED' as const },
      { id: 'sub-2', assignmentId: 'asn-1', usn: '1RV21CS002', studentName: 'Sneha Reddy', submittedAt: '2026-04-21T09:30:00Z', status: 'SUBMITTED' as const },
      { id: 'sub-3', assignmentId: 'asn-2', usn: '1RV21CS001', studentName: 'Arjun Kumar', submittedAt: '2026-04-22T14:00:00Z', status: 'SUBMITTED' as const },
      { id: 'sub-4', assignmentId: 'asn-1', usn: '1RV21CS003', studentName: 'Priya Sharma', status: 'PENDING' as const },
      { id: 'sub-5', assignmentId: 'asn-1', usn: '1RV21CS004', studentName: 'Karan Joshi', submittedAt: '2026-04-20T16:00:00Z', status: 'SUBMITTED' as const },
      // Demo student (1RV21CS001) — mixed statuses across the new assignments for a realistic My Assignments view
      { id: 'sub-6', assignmentId: 'asn-3', usn: '1RV21CS001', studentName: 'Arjun Kumar', submittedAt: '2026-04-30T11:00:00Z', marks: 22, feedback: 'Good — minor TCP teardown issues.', status: 'GRADED' as const },
      { id: 'sub-7', assignmentId: 'asn-7', usn: '1RV21CS001', studentName: 'Arjun Kumar', submittedAt: '2026-04-29T17:30:00Z', status: 'SUBMITTED' as const },
    ];
    this.assignmentsSvc.submissions = submissions;
  }

  private seedIaMarks(): void {
    const entries = STUDENTS.flatMap((s) =>
      SUBJECTS.map((sub) => ({
        usn: s.usn,
        name: s.name,
        subjectCode: sub.code,
        sem: 5,
        ia1: Math.min(20, Math.round((s.cgpa / 10) * 20 + (Math.random() * 4 - 2))),
        ia2: Math.min(20, Math.round((s.cgpa / 10) * 20 + (Math.random() * 4 - 2))),
        ia3: Math.min(20, Math.round((s.cgpa / 10) * 20 + (Math.random() * 4 - 2))),
      })),
    );
    this.iaSvc.entries = entries;

    this.iaSvc.submissions = [
      { id: 'ia-sub-1', teacherId: TEACHER_ID, subjectCode: 'CS501', sem: 5, submittedAt: '2026-04-15T10:00:00Z', status: 'CONFIRMED' },
      { id: 'ia-sub-2', teacherId: TEACHER_ID, subjectCode: 'CS504', sem: 5, submittedAt: '2026-04-16T10:00:00Z', status: 'SUBMITTED' },
      { id: 'ia-sub-3', teacherId: 'teacher-002', subjectCode: 'CS502', sem: 5, submittedAt: '2026-04-17T10:00:00Z', status: 'SUBMITTED' },
      { id: 'ia-sub-4', teacherId: 'teacher-003', subjectCode: 'CS503', sem: 5, submittedAt: '2026-04-14T10:00:00Z', status: 'DRAFT' },
      { id: 'ia-sub-5', teacherId: 'teacher-004', subjectCode: 'CS505', sem: 5, submittedAt: '2026-04-18T10:00:00Z', status: 'CONFIRMED' },
    ];
  }

  private seedFees(): void {
    const components = ['Tuition', 'Lab', 'Exam'];
    const fees = STUDENTS.flatMap((s) =>
      components.map((comp, i) => ({
        id: `fee-${s.usn}-${comp.toLowerCase()}`,
        usn: s.usn,
        component: comp,
        semester: 5,
        amount: comp === 'Tuition' ? 45000 : comp === 'Lab' ? 5000 : 2500,
        dueDate: '2026-04-30',
        status: (i === 0 ? 'PAID' : i === 1 && s.cgpa > 7 ? 'PAID' : s.cgpa < 6.5 ? 'OVERDUE' : 'PENDING') as 'PAID' | 'PENDING' | 'OVERDUE',
        paidDate: i === 0 ? '2026-04-01T00:00:00Z' : undefined,
      })),
    );
    this.feesSvc.feeItems = fees;
  }

  private seedVtu(): void {
    const win = {
      id: 'vtu-win-2026-sem5',
      title: 'VTU Registration — May 2026 Exams',
      openDate: '2026-04-01',
      closeDate: '2026-04-30',
      semester: 5,
      isActive: true,
      subjectCodes: SUBJECTS.map((s) => s.code),
    };
    this.vtuSvc.windows = [win];

    this.vtuSvc.eligibilities = STUDENTS.map((s) => ({
      windowId: win.id,
      usn: s.usn,
      eligibleSubjects: s.cgpa >= 6.0 ? SUBJECTS.map((sub) => sub.code) : [],
      isEligible: s.cgpa >= 6.0,
      category: 'REGULAR' as const,
    }));

    this.vtuSvc.registrations = [
      { windowId: win.id, usn: '1RV21CS001', subjectCodes: SUBJECTS.map((s) => s.code), registeredAt: '2026-04-05T10:00:00Z' },
      { windowId: win.id, usn: '1RV21CS002', subjectCodes: SUBJECTS.map((s) => s.code), registeredAt: '2026-04-06T10:00:00Z' },
      { windowId: win.id, usn: '1RV21CS004', subjectCodes: SUBJECTS.map((s) => s.code), registeredAt: '2026-04-07T10:00:00Z' },
    ];
  }

  private seedWellness(): void {
    const slots = [
      { id: 'slot-1', dateTime: '2026-04-22T10:00:00Z', counsellorId: 'counsellor-001', isBooked: true },
      { id: 'slot-2', dateTime: '2026-04-22T11:00:00Z', counsellorId: 'counsellor-001', isBooked: false },
      { id: 'slot-3', dateTime: '2026-04-23T10:00:00Z', counsellorId: 'counsellor-001', isBooked: false },
    ];
    this.wellnessSvc.slots = slots;

    this.wellnessSvc.sessions = [
      { id: 'sess-1', slotId: 'slot-1', studentUsn: '1RV21CS003', reason: 'Academic stress', status: 'BOOKED' },
    ];

    this.wellnessSvc.studyTasks = [
      { id: 'task-1', usn: '1RV21CS001', subject: 'CS501', title: 'Revise tree traversals', done: true, dueDate: '2026-04-20' },
      { id: 'task-2', usn: '1RV21CS001', subject: 'CS502', title: 'Practice SQL joins', done: false, dueDate: '2026-04-24' },
      { id: 'task-3', usn: '1RV21CS001', subject: 'CS503', title: 'Read OSI model notes', done: false, dueDate: '2026-04-25' },
    ];

    this.wellnessSvc.riskScores.set('1RV21CS001', { score: 20, level: 'LOW', factors: ['Good attendance', 'Assignments on track'] });
    this.wellnessSvc.riskScores.set('1RV21CS003', { score: 70, level: 'HIGH', factors: ['Low attendance: 68%', 'Missed 3 assignments'] });
    this.wellnessSvc.riskScores.set('1RV21CS005', { score: 55, level: 'MEDIUM', factors: ['CGPA below 6.0', 'Fee overdue'] });
  }

  private seedJobs(): void {
    this.jobsSvc.jobs = [
      { id: 'job-1', company: 'Infosys', role: 'Systems Engineer', package: '4.5 LPA', deadline: '2026-05-15', eligibility: 'CGPA >= 6.0', applyUrl: 'https://careers.infosys.com/campus', dept: 'CS' },
      { id: 'job-2', company: 'Wipro', role: 'Software Engineer', package: '4.0 LPA', deadline: '2026-05-20', eligibility: 'CGPA >= 6.0', applyUrl: 'https://careers.wipro.com/campus', dept: 'CS' },
      { id: 'job-3', company: 'TCS', role: 'Associate Software Engineer', package: '3.8 LPA', deadline: '2026-05-25', eligibility: 'CGPA >= 5.5', applyUrl: 'https://careers.tcs.com/campus', dept: 'CS' },
      { id: 'job-4', company: 'Accenture', role: 'Associate', package: '4.5 LPA', deadline: '2026-06-01', eligibility: 'CGPA >= 6.0', applyUrl: 'https://careers.accenture.com/campus', dept: 'CS' },
      { id: 'job-5', company: 'Amazon', role: 'SDE Intern', package: '8.0 LPA', deadline: '2026-05-01', eligibility: 'CGPA >= 7.5', applyUrl: 'https://amazon.jobs/campus', dept: 'CS' },
      { id: 'job-6', company: 'Google', role: 'Step Intern', package: '12.0 LPA', deadline: '2026-04-30', eligibility: 'CGPA >= 8.0', applyUrl: 'https://careers.google.com/campus', dept: 'CS' },
      { id: 'job-7', company: 'Bosch', role: 'Graduate Engineer Trainee', package: '4.2 LPA', deadline: '2026-06-10', eligibility: 'CGPA >= 6.5', applyUrl: 'https://careers.bosch.com/campus', dept: 'ME' },
      { id: 'job-8', company: 'ABB', role: 'Field Engineer', package: '4.0 LPA', deadline: '2026-06-15', eligibility: 'CGPA >= 6.0', applyUrl: 'https://careers.abb.com/campus', dept: 'EC' },
      { id: 'job-9', company: 'Flipkart', role: 'SDE I', package: '16.0 LPA', deadline: '2026-04-28', eligibility: 'CGPA >= 7.5', applyUrl: 'https://careers.flipkart.com/campus', dept: 'CS' },
      { id: 'job-10', company: 'Capgemini', role: 'Analyst', package: '3.8 LPA', deadline: '2026-06-20', eligibility: 'CGPA >= 5.5', applyUrl: 'https://careers.capgemini.com/campus', dept: 'CS' },
    ];

    this.jobsSvc.predictions = STUDENTS.map((s) => ({
      usn: s.usn,
      name: s.name,
      dept: s.dept,
      likelihood: s.cgpa >= 7.5 ? 'HIGH' : s.cgpa >= 6.5 ? 'MEDIUM' : 'LOW',
      skillGaps: s.cgpa >= 7.5 ? ['System Design'] : s.cgpa >= 6.5 ? ['DSA', 'System Design'] : ['DSA', 'SQL', 'Communication'],
    }));

    // Placement drives (CRM)
    this.jobsSvc.drives = [
      { id: 'drive-1', company: 'Microsoft', scheduledDate: '2026-05-10', venue: 'Main Auditorium', rounds: ['Online Test', 'Technical Interview', 'HR Interview'], eligibleDepts: ['CSE', 'ISE', 'AIML'], minCgpa: 7.0, status: 'SCHEDULED', offersExtended: 0 },
      { id: 'drive-2', company: 'Infosys', scheduledDate: '2026-04-20', venue: 'Seminar Hall A', rounds: ['Aptitude', 'Technical', 'HR'], eligibleDepts: ['CSE', 'ECE', 'ISE', 'ME'], minCgpa: 6.0, status: 'COMPLETED', offersExtended: 45 },
      { id: 'drive-3', company: 'Wipro Elite', scheduledDate: '2026-05-18', venue: 'Online', rounds: ['WILP Test', 'Technical Round'], eligibleDepts: ['CSE', 'ISE'], minCgpa: 6.5, status: 'SCHEDULED', offersExtended: 0 },
    ];

    // Alumni outcomes
    this.jobsSvc.alumni = [
      { usn: '1RV20CS001', name: 'Priya Nair',    graduationYear: 2024, company: 'Google',    role: 'SWE',             packageLpa: 42, dept: 'CSE', location: 'Bengaluru' },
      { usn: '1RV20CS002', name: 'Arjun Mehta',   graduationYear: 2024, company: 'Microsoft', role: 'SDE II',          packageLpa: 38, dept: 'CSE', location: 'Hyderabad' },
      { usn: '1RV20EC001', name: 'Suresh Kumar',  graduationYear: 2024, company: 'Qualcomm',  role: 'DSP Engineer',    packageLpa: 22, dept: 'ECE', location: 'Bengaluru' },
      { usn: '1RV19CS005', name: 'Ananya Bhat',   graduationYear: 2023, company: 'Amazon',    role: 'SDE I',           packageLpa: 28, dept: 'CSE', location: 'Bengaluru' },
      { usn: '1RV19ME003', name: 'Rahul Sharma',  graduationYear: 2023, company: 'Bosch',     role: 'GTE',             packageLpa: 6,  dept: 'ME',  location: 'Pune' },
    ];
  }

  private seedStudentPortal(): void {
    const defaultSchedule = [
      { dayOfWeek: 'Monday', subject: 'Data Structures & Algorithms', room: 'Room 301', startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 'Monday', subject: 'Database Management Systems', room: 'Room 302', startTime: '10:00', endTime: '11:00' },
      { dayOfWeek: 'Tuesday', subject: 'Computer Networks', room: 'Lab 101', startTime: '09:00', endTime: '11:00' },
      { dayOfWeek: 'Wednesday', subject: 'Operating Systems', room: 'Room 301', startTime: '11:00', endTime: '12:00' },
      { dayOfWeek: 'Thursday', subject: 'Data Structures & Algorithms', room: 'Room 301', startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 'Friday', subject: 'Software Engineering', room: 'Room 303', startTime: '14:00', endTime: '15:00' },
    ];
    this.studentPortalSvc.schedules.set('default', defaultSchedule);

    const defaultHostel = {
      hostel: {
        roomNumber: '204',
        block: 'Block B',
        warden: 'Mr. Krishnamurthy',
        messMenu: [
          { day: 'Monday', breakfast: 'Idli Sambar', lunch: 'Rice Dal Sabzi', dinner: 'Chapati Paneer' },
          { day: 'Tuesday', breakfast: 'Upma', lunch: 'Curd Rice', dinner: 'Biryani' },
          { day: 'Wednesday', breakfast: 'Dosa Chutney', lunch: 'Rice Sambar', dinner: 'Chapati Dal' },
        ],
      },
      transport: {
        route: 'Route 4 — Koramangala to College',
        pickupPoint: 'Koramangala BDA Complex',
        timing: '7:45 AM',
      },
    };
    this.studentPortalSvc.hostelData.set('default', defaultHostel);

    this.studentPortalSvc.staff = [
      { name: 'Dr. Meena Rao', role: 'Professor & HoD', department: 'Computer Science', email: 'meena.rao@rvce.edu.in', phone: '+91-9876543210' },
      { name: 'Ravi Shankar', role: 'Assistant Professor', department: 'Computer Science', email: 'teacher@rvce.edu.in', phone: '+91-9876543217' },
      { name: 'Dr. Lakshmi Devi', role: 'Associate Professor', department: 'Computer Science', email: 'lakshmi.devi@rvce.edu.in', phone: '+91-9876543211' },
      { name: 'Prof. Suresh Kumar', role: 'Assistant Professor', department: 'Computer Science', email: 'suresh.kumar@rvce.edu.in', phone: '+91-9876543212' },
      { name: 'Dr. Meena Iyer', role: 'Associate Professor', department: 'Computer Science', email: 'meena.iyer@rvce.edu.in', phone: '+91-9876543213' },
      { name: 'Ms. Divya Nair', role: 'Lab Instructor', department: 'Computer Science', email: 'divya.nair@rvce.edu.in', phone: '+91-9876543214' },
      { name: 'Mr. Rajesh Shetty', role: 'Placement Coordinator', department: 'Placements', email: 'rajesh.shetty@rvce.edu.in', phone: '+91-9876543215' },
      { name: 'Dr. Preethi Rao', role: 'Counsellor', department: 'Student Welfare', email: 'preethi.rao@rvce.edu.in', phone: '+91-9876543216' },
    ];
  }

  private seedParentPortal(): void {
    const parentId = 'u-parent-01';
    this.parentPortalSvc.parentChildMap.set(parentId, ['1RV21CS001', '1RV21CS003']);

    for (const s of STUDENTS) {
      this.parentPortalSvc.childProfiles.set(s.usn, {
        usn: s.usn,
        name: s.name,
        semester: s.semester,
        dept: s.dept,
        cgpa: s.cgpa,
        attendance: Math.round((s.cgpa / 10) * 30 + 60),
      });
    }
  }

  private seedComms(): void {
    const now = new Date();
    this.commsSvc.callLogs = STUDENTS.slice(0, 5).map((s, i) => {
      const calledAt = new Date(now);
      calledAt.setDate(calledAt.getDate() - i);
      const outcomes: Array<'ANSWERED' | 'VOICEMAIL' | 'NO_ANSWER'> = ['ANSWERED', 'ANSWERED', 'VOICEMAIL', 'ANSWERED', 'NO_ANSWER'];
      return {
        id: `call-${i + 1}`,
        calledAt: calledAt.toISOString(),
        studentName: s.name,
        studentUsn: s.usn,
        parentId: 'u-parent-01',
        outcome: outcomes[i],
        duration: outcomes[i] === 'ANSWERED' ? 120 + Math.floor(Math.random() * 180) : 0,
        transcript: outcomes[i] === 'ANSWERED' ? `Parent acknowledged absence of ${s.name} on ${calledAt.toLocaleDateString()}` : undefined,
        summary: outcomes[i] === 'ANSWERED' ? `Parent was informed and will follow up with student` : undefined,
      };
    });

    // Seed DPDP consent for all students and parent u-parent-01
    STUDENTS.forEach((s) => {
      this.commsSvc.grantConsent(s.usn, ['ATTENDANCE_ALERTS', 'FEES_ALERTS', 'MARKS_ALERTS', 'GENERAL', 'VOICE']);
    });
    this.commsSvc.grantConsent('u-parent-01', ['ATTENDANCE_ALERTS', 'FEES_ALERTS', 'MARKS_ALERTS', 'GENERAL', 'VOICE']);

    this.commsSvc.messages = [
      { id: 'msg-1', parentId: 'u-parent-01', content: 'Your child was absent today. Please ensure they attend tomorrow.', direction: 'OUTBOUND', sentAt: now.toISOString(), channel: 'WHATSAPP' },
      { id: 'msg-2', parentId: 'u-parent-01', content: 'Noted, thank you for informing us.', direction: 'INBOUND', sentAt: new Date(now.getTime() + 60000).toISOString(), channel: 'WHATSAPP' },
      { id: 'msg-3', parentId: 'u-parent-01', content: 'Fee reminder: ₹52,500 due by 30-Apr-2026', direction: 'OUTBOUND', sentAt: new Date(now.getTime() - 86400000).toISOString(), channel: 'SMS' },
    ];
  }

  private seedAcademicResults(): void {
    this.coursesSvc.academicResults = STUDENTS.map((s) => ({
      usn: s.usn,
      cgpa: s.cgpa,
      semesters: [
        {
          sem: 1,
          get sgpa() {
            return computeSgpa([
              { credits: 4, gradePoints: vtuGradeToPoints(totalToVtuGrade(90, 100)) },
              { credits: 4, gradePoints: vtuGradeToPoints(totalToVtuGrade(84, 100)) },
              { credits: 3, gradePoints: vtuGradeToPoints(totalToVtuGrade(95, 100)) },
            ]);
          },
          subjects: [
            { code: 'MA101', name: 'Engineering Mathematics I', ia: 18, ese: 72, total: 90, grade: totalToVtuGrade(90, 100) },
            { code: 'PH101', name: 'Engineering Physics', ia: 16, ese: 68, total: 84, grade: totalToVtuGrade(84, 100) },
            { code: 'CS101', name: 'Programming in C', ia: 19, ese: 76, total: 95, grade: totalToVtuGrade(95, 100) },
          ],
        },
        {
          sem: 5,
          get sgpa() {
            return computeSgpa(
              SUBJECTS.map((sub) => {
                const ia = Math.min(20, Math.round((s.cgpa / 10) * 20));
                const ese = Math.min(80, Math.round((s.cgpa / 10) * 80));
                return { credits: sub.credits ?? 3, gradePoints: vtuGradeToPoints(totalToVtuGrade(ia + ese, 100)) };
              }),
            );
          },
          subjects: SUBJECTS.map((sub) => {
            const ia = Math.min(20, Math.round((s.cgpa / 10) * 20));
            const ese = Math.min(80, Math.round((s.cgpa / 10) * 80));
            const total = ia + ese;
            const grade = totalToVtuGrade(total, 100);
            return { code: sub.code, name: sub.name, ia, ese, total, grade };
          }),
        },
      ],
    }));
  }

  private seedAdminPortal(): void {
    const dashboard = this.adminPortalSvc.getDashboard();
    this.logger.log(
      `Admin portal ready — ${dashboard.totalStudents} students, ` +
      `${dashboard.totalFaculty} faculty, ` +
      `fees collected ₹${dashboard.feesCollected.toLocaleString('en-IN')}, ` +
      `${dashboard.alerts.length} active alerts`,
    );
  }

  private async seedRecruiterJobs(): Promise<void> {
    const RECRUITER_ID = 'u-recruiter-01';
    const INSTITUTION_ID = 'rvce';

    const existing = await this.recruiterSvc.listMyJobs(RECRUITER_ID);
    if ((existing as unknown[]).length > 0) {
      this.logger.log('Recruiter jobs already seeded — skipping');
      return;
    }

    const jobs = await Promise.all([
      this.recruiterSvc.postJob(RECRUITER_ID, INSTITUTION_ID, {
        title: 'Software Development Engineer – I (Backend)',
        description: 'Flipkart Platform Engineering team hiring Backend SDE-Is for supply-chain and catalog microservices built on Java, Kafka, and distributed data stores. Strong DSA and large-scale systems curiosity required.',
        roleType: 'PRODUCT',
        ctcLpa: 18,
        minCgpa: 7.5,
        eligibleBranches: ['CSE', 'ISE'],
        eligibleSemesters: [8],
        requiredSkills: ['Java', 'Data Structures', 'System Design', 'SQL', 'Problem Solving'],
        location: 'Bengaluru',
        applyDeadline: '2026-07-15',
      }),
      this.recruiterSvc.postJob(RECRUITER_ID, INSTITUTION_ID, {
        title: 'Systems Engineer – Digital (InfyTQ Track)',
        description: 'Infosys hiring Systems Engineers for the InfyTQ track. 4-month training at Mysuru before client deployment in BFSI and retail digital transformation projects. All branches eligible with min 6.0 CGPA.',
        roleType: 'SERVICE',
        ctcLpa: 7,
        minCgpa: 6.0,
        eligibleBranches: ['CSE', 'ISE', 'ECE', 'EEE', 'ME'],
        eligibleSemesters: [8],
        requiredSkills: ['Python', 'SQL', 'Communication Skills', 'Agile'],
        location: 'Bengaluru',
        applyDeadline: '2026-06-30',
      }),
      this.recruiterSvc.postJob(RECRUITER_ID, INSTITUTION_ID, {
        title: 'Associate Software Engineer – Cloud & DevOps',
        description: 'Accenture Cloud First practice hiring engineers for AWS migration and DevOps pipeline modernization across Fortune 500 accounts. Containerization and automation scripting preferred.',
        roleType: 'SERVICE',
        ctcLpa: 9.5,
        minCgpa: 6.5,
        eligibleBranches: ['CSE', 'ISE', 'ECE'],
        eligibleSemesters: [8],
        requiredSkills: ['AWS', 'Docker', 'Linux', 'Python', 'CI/CD', 'Git'],
        location: 'Bengaluru',
        applyDeadline: '2026-07-05',
      }),
      this.recruiterSvc.postJob(RECRUITER_ID, INSTITUTION_ID, {
        title: 'Software Engineer – Payments Infrastructure',
        description: 'Razorpay Payments Infrastructure team processes Rs 10 lakh crore annually. Own components from design to production in first quarter. Deep thinking about latency, fault tolerance, and correctness required.',
        roleType: 'STARTUP',
        ctcLpa: 24,
        minCgpa: 8.0,
        eligibleBranches: ['CSE', 'ISE'],
        eligibleSemesters: [8],
        requiredSkills: ['Go', 'Distributed Systems', 'PostgreSQL', 'REST APIs', 'System Design', 'Redis'],
        location: 'Bengaluru',
        applyDeadline: '2026-07-10',
      }),
      this.recruiterSvc.postJob(RECRUITER_ID, INSTITUTION_ID, {
        title: 'Embedded Software Engineer – ADAS',
        description: 'Bosch ADAS software division hiring embedded engineers for sensor fusion, camera perception, and real-time control systems. Strong C programming and microcontroller exposure required.',
        roleType: 'CORE',
        ctcLpa: 11,
        minCgpa: 7.0,
        eligibleBranches: ['ECE', 'EEE'],
        eligibleSemesters: [8],
        requiredSkills: ['C', 'Embedded C', 'RTOS', 'CAN', 'AUTOSAR', 'Microcontrollers', 'MATLAB'],
        location: 'Bengaluru',
        applyDeadline: '2026-07-20',
      }),
    ]);

    const [flipkartId, infosysId, accentureId, razorpayId, boschId] = jobs.map(j => j.id);

    // Flipkart: 5 apps — full funnel with Karan (CGPA 8.7) getting OFFERED
    await this.ds.query(`
      INSERT INTO recruiter_applications (id, job_id, student_usn, status) VALUES
      (gen_random_uuid(), $1, '1RV21CS004', 'OFFERED'),
      (gen_random_uuid(), $1, '1RV21CS001', 'INTERVIEW'),
      (gen_random_uuid(), $1, '1RV21CS002', 'SHORTLISTED'),
      (gen_random_uuid(), $1, '1RV21CS003', 'APPLIED'),
      (gen_random_uuid(), $1, '1RV21CS005', 'REJECTED')
      ON CONFLICT (job_id, student_usn) DO NOTHING
    `, [flipkartId]);

    // Infosys: 3 apps — broad funnel (high-volume role)
    await this.ds.query(`
      INSERT INTO recruiter_applications (id, job_id, student_usn, status) VALUES
      (gen_random_uuid(), $1, '1RV21CS003', 'SHORTLISTED'),
      (gen_random_uuid(), $1, '1RV21CS005', 'SHORTLISTED'),
      (gen_random_uuid(), $1, '1RV21CS002', 'APPLIED')
      ON CONFLICT (job_id, student_usn) DO NOTHING
    `, [infosysId]);

    // Accenture: 2 apps
    await this.ds.query(`
      INSERT INTO recruiter_applications (id, job_id, student_usn, status) VALUES
      (gen_random_uuid(), $1, '1RV21CS001', 'INTERVIEW'),
      (gen_random_uuid(), $1, '1RV21CS003', 'APPLIED')
      ON CONFLICT (job_id, student_usn) DO NOTHING
    `, [accentureId]);

    // Razorpay: 1 app — Karan OFFERED (triggers HIGH decline risk in Flipkart predict-offers demo)
    await this.ds.query(`
      INSERT INTO recruiter_applications (id, job_id, student_usn, status) VALUES
      (gen_random_uuid(), $1, '1RV21CS004', 'OFFERED')
      ON CONFLICT (job_id, student_usn) DO NOTHING
    `, [razorpayId]);

    // Bosch: 2 apps (CSE cross-applying to CORE — realistic)
    await this.ds.query(`
      INSERT INTO recruiter_applications (id, job_id, student_usn, status) VALUES
      (gen_random_uuid(), $1, '1RV21CS001', 'APPLIED'),
      (gen_random_uuid(), $1, '1RV21CS002', 'APPLIED')
      ON CONFLICT (job_id, student_usn) DO NOTHING
    `, [boschId]);

    this.logger.log('Recruiter seed complete — 5 jobs, 13 applications');
  }
}
