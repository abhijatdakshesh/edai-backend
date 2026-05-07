-- ============================================================
-- Chatbot seed data: adds missing columns + tables + demo data
-- Run: psql $DATABASE_URL -f seed_chatbot_data.sql
-- ============================================================

-- 1. Add missing columns to students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS semester    INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS section     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department  VARCHAR(100) DEFAULT 'Computer Science & Engineering',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Derive section from section_id (e.g. "CS-A" → "A")
UPDATE students SET
  section = SPLIT_PART(section_id, '-', 2),
  preferred_language = COALESCE(parent_preferred_language, 'en'),
  department = CASE
    WHEN section_id LIKE 'CS-%' THEN 'Computer Science & Engineering'
    WHEN section_id LIKE 'EC-%' THEN 'Electronics & Communication Engineering'
    WHEN section_id LIKE 'ME-%' THEN 'Mechanical Engineering'
    WHEN section_id LIKE 'IS-%' THEN 'Information Science & Engineering'
    ELSE 'Engineering'
  END,
  semester = 5;

-- 2. Faculty table
CREATE TABLE IF NOT EXISTS faculty (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id      VARCHAR(50)  UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(200),
  department  VARCHAR(100),
  preferred_language VARCHAR(10) DEFAULT 'en',
  created_at  TIMESTAMPTZ  DEFAULT now()
);

INSERT INTO faculty (emp_id, name, email, department, preferred_language) VALUES
  ('FAC001', 'Dr. Priya Sharma',    'priya.sharma@rvce.edu.in',    'Computer Science & Engineering', 'en'),
  ('FAC002', 'Prof. Anitha Rao',    'anitha.rao@rvce.edu.in',      'Computer Science & Engineering', 'kn'),
  ('FAC003', 'Dr. Ramesh Nair',     'ramesh.nair@rvce.edu.in',     'Computer Science & Engineering', 'en'),
  ('FAC004', 'Prof. Suresh Kumar',  'suresh.kumar@rvce.edu.in',    'Electronics & Communication Engineering', 'kn'),
  ('FAC005', 'Dr. Lakshmi Devi',    'lakshmi.devi@rvce.edu.in',    'Mechanical Engineering', 'kn'),
  ('FAC006', 'Prof. Arun Menon',    'arun.menon@rvce.edu.in',      'Information Science & Engineering', 'ml'),
  ('dev-admin', 'Administrator',   'admin@rvce.edu.in',            'Administration', 'en'),
  ('ADMIN001', 'Admin User',        'admin@rvce.edu.in',            'Administration', 'en')
ON CONFLICT (emp_id) DO NOTHING;

-- 3. Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_usn     VARCHAR(50) NOT NULL,
  subject_name    VARCHAR(200) NOT NULL,
  status          VARCHAR(20) NOT NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed 3 months of attendance for CS students (subjects from timetable)
DO $$
DECLARE
  usns TEXT[] := ARRAY['1RV21CS001','1RV21CS002','1RV21CS003','1RV21CS004','1RV21CS005'];
  subjects TEXT[] := ARRAY['DBMS Lab','Management & Entrepreneurship','Computer Networks','Operating Systems','Design & Analysis of Algorithms','Microprocessors & Embedded Systems'];
  u TEXT; sub TEXT; d DATE; stat TEXT;
BEGIN
  FOREACH u IN ARRAY usns LOOP
    FOREACH sub IN ARRAY subjects LOOP
      -- 60 classes per subject over 3 months
      FOR i IN 1..60 LOOP
        d := CURRENT_DATE - (i * 2)::int;
        -- 80-90% attendance for most, 60% for CS003 (at risk)
        IF u = '1RV21CS003' THEN
          stat := CASE WHEN random() < 0.60 THEN 'PRESENT' ELSE 'ABSENT' END;
        ELSIF u = '1RV21CS004' AND sub = 'Computer Networks' THEN
          stat := CASE WHEN random() < 0.68 THEN 'PRESENT' ELSE 'ABSENT' END;
        ELSE
          stat := CASE WHEN random() < 0.88 THEN 'PRESENT' ELSE 'ABSENT' END;
        END IF;
        INSERT INTO attendance (student_usn, subject_name, status, attendance_date)
        VALUES (u, sub, stat, d);
      END LOOP;
    END LOOP;
  END LOOP;
END$$;

-- EC and ME students
DO $$
DECLARE
  ec_usns TEXT[] := ARRAY['1RV21EC001','1RV21EC002'];
  ec_subjects TEXT[] := ARRAY['Signals & Systems','Analog Circuits','Digital Electronics','Microcontrollers','Electromagnetic Fields'];
  me_usns TEXT[] := ARRAY['1RV21ME001','1RV21ME002'];
  me_subjects TEXT[] := ARRAY['Fluid Mechanics','Heat Transfer','Machine Design','Manufacturing Processes','Thermodynamics'];
  u TEXT; sub TEXT; stat TEXT;
BEGIN
  FOREACH u IN ARRAY ec_usns LOOP
    FOREACH sub IN ARRAY ec_subjects LOOP
      FOR i IN 1..60 LOOP
        stat := CASE WHEN random() < 0.85 THEN 'PRESENT' ELSE 'ABSENT' END;
        INSERT INTO attendance (student_usn, subject_name, status, attendance_date)
        VALUES (u, sub, stat, CURRENT_DATE - (i * 2)::int);
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH u IN ARRAY me_usns LOOP
    FOREACH sub IN ARRAY me_subjects LOOP
      FOR i IN 1..60 LOOP
        stat := CASE WHEN random() < 0.82 THEN 'PRESENT' ELSE 'ABSENT' END;
        INSERT INTO attendance (student_usn, subject_name, status, attendance_date)
        VALUES (u, sub, stat, CURRENT_DATE - (i * 2)::int);
      END LOOP;
    END LOOP;
  END LOOP;
END$$;

-- 4. Internal marks table
CREATE TABLE IF NOT EXISTS internal_marks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_usn  VARCHAR(50) NOT NULL,
  subject_name VARCHAR(200) NOT NULL,
  exam_type    VARCHAR(20) NOT NULL,
  marks_obtained NUMERIC(5,2),
  max_marks    INTEGER DEFAULT 20,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO internal_marks (student_usn, subject_name, exam_type, marks_obtained, max_marks) VALUES
  -- Arjun Sharma (CS001) - good student
  ('1RV21CS001','DBMS Lab','IA1',18,20), ('1RV21CS001','DBMS Lab','IA2',19,20),
  ('1RV21CS001','Computer Networks','IA1',16,20), ('1RV21CS001','Computer Networks','IA2',17,20),
  ('1RV21CS001','Operating Systems','IA1',15,20), ('1RV21CS001','Operating Systems','IA2',18,20),
  ('1RV21CS001','Design & Analysis of Algorithms','IA1',14,20), ('1RV21CS001','Design & Analysis of Algorithms','IA2',16,20),
  -- Priya Nair (CS002) - excellent student
  ('1RV21CS002','DBMS Lab','IA1',19,20), ('1RV21CS002','DBMS Lab','IA2',20,20),
  ('1RV21CS002','Computer Networks','IA1',18,20), ('1RV21CS002','Computer Networks','IA2',19,20),
  ('1RV21CS002','Operating Systems','IA1',17,20), ('1RV21CS002','Operating Systems','IA2',20,20),
  -- Karthik Reddy (CS003) - struggling student
  ('1RV21CS003','DBMS Lab','IA1',9,20), ('1RV21CS003','DBMS Lab','IA2',11,20),
  ('1RV21CS003','Computer Networks','IA1',8,20), ('1RV21CS003','Computer Networks','IA2',10,20),
  ('1RV21CS003','Operating Systems','IA1',7,20), ('1RV21CS003','Operating Systems','IA2',9,20),
  -- Sneha Iyer (CS004)
  ('1RV21CS004','DBMS Lab','IA1',15,20), ('1RV21CS004','DBMS Lab','IA2',16,20),
  ('1RV21CS004','Computer Networks','IA1',12,20), ('1RV21CS004','Computer Networks','IA2',13,20),
  -- Rahul Kumar (CS005)
  ('1RV21CS005','DBMS Lab','IA1',16,20), ('1RV21CS005','DBMS Lab','IA2',17,20),
  ('1RV21CS005','Computer Networks','IA1',15,20), ('1RV21CS005','Computer Networks','IA2',14,20),
  -- EC students
  ('1RV21EC001','Signals & Systems','IA1',16,20), ('1RV21EC001','Signals & Systems','IA2',17,20),
  ('1RV21EC001','Analog Circuits','IA1',14,20), ('1RV21EC001','Analog Circuits','IA2',15,20),
  ('1RV21EC002','Signals & Systems','IA1',13,20), ('1RV21EC002','Signals & Systems','IA2',15,20),
  -- ME students
  ('1RV21ME001','Fluid Mechanics','IA1',17,20), ('1RV21ME001','Fluid Mechanics','IA2',18,20),
  ('1RV21ME002','Fluid Mechanics','IA1',12,20), ('1RV21ME002','Fluid Mechanics','IA2',14,20),
  -- IS student
  ('1RV21IS001','Data Structures','IA1',19,20), ('1RV21IS001','Data Structures','IA2',20,20);

-- 5. Fee payments table
CREATE TABLE IF NOT EXISTS fee_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_usn    VARCHAR(50) NOT NULL,
  total_amount   NUMERIC(10,2) NOT NULL,
  paid_amount    NUMERIC(10,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  due_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

INSERT INTO fee_payments (student_usn, total_amount, paid_amount, payment_status, due_date) VALUES
  ('1RV21CS001', 125000, 125000, 'PAID',    NULL),
  ('1RV21CS002', 125000, 125000, 'PAID',    NULL),
  ('1RV21CS003', 125000,  60000, 'PARTIAL', CURRENT_DATE + 30),
  ('1RV21CS004', 125000,  90000, 'PARTIAL', CURRENT_DATE + 15),
  ('1RV21CS005', 125000, 125000, 'PAID',    NULL),
  ('1RV21EC001', 130000, 130000, 'PAID',    NULL),
  ('1RV21EC002', 130000,  65000, 'PARTIAL', CURRENT_DATE + 20),
  ('1RV21ME001', 128000, 128000, 'PAID',    NULL),
  ('1RV21ME002', 128000,      0, 'PENDING', CURRENT_DATE + 7),
  ('1RV21IS001', 122000, 122000, 'PAID',    NULL);

-- 6. Student risk scores table
CREATE TABLE IF NOT EXISTS student_risk_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_usn      VARCHAR(50) UNIQUE NOT NULL,
  risk_score       NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  risk_level       VARCHAR(20) NOT NULL DEFAULT 'LOW',
  primary_concern  VARCHAR(200),
  computed_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO student_risk_scores (student_usn, risk_score, risk_level, primary_concern) VALUES
  ('1RV21CS001', 0.12, 'LOW',      'No major concerns'),
  ('1RV21CS002', 0.05, 'LOW',      'Performing well'),
  ('1RV21CS003', 0.78, 'HIGH',     'Low attendance + Low marks'),
  ('1RV21CS004', 0.45, 'MEDIUM',   'Attendance borderline in CN'),
  ('1RV21CS005', 0.18, 'LOW',      'Minor attendance dip'),
  ('1RV21EC001', 0.15, 'LOW',      'No major concerns'),
  ('1RV21EC002', 0.35, 'MEDIUM',   'Fee overdue'),
  ('1RV21ME001', 0.10, 'LOW',      'Performing well'),
  ('1RV21ME002', 0.65, 'HIGH',     'Fee pending + attendance risk'),
  ('1RV21IS001', 0.08, 'LOW',      'Top performer')
ON CONFLICT (student_usn) DO UPDATE SET
  risk_score = EXCLUDED.risk_score,
  risk_level = EXCLUDED.risk_level,
  primary_concern = EXCLUDED.primary_concern;

-- Done
SELECT 'Seed complete' AS status,
  (SELECT count(*) FROM faculty)           AS faculty_count,
  (SELECT count(*) FROM attendance)        AS attendance_records,
  (SELECT count(*) FROM internal_marks)    AS marks_records,
  (SELECT count(*) FROM fee_payments)      AS fee_records,
  (SELECT count(*) FROM student_risk_scores) AS risk_records;
