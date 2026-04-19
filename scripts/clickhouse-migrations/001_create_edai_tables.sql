-- EdAI ClickHouse analytics tables
-- Run once on ClickHouse container startup

CREATE TABLE IF NOT EXISTS attendance_daily_agg (
    institution_id  String,
    class_id        String,
    date            Date,
    total_students  UInt32,
    present         UInt32,
    absent          UInt32,
    late            UInt32,
    avg_pct         Float32,
    at_risk_count   UInt32
) ENGINE = ReplacingMergeTree()
  PARTITION BY toYYYYMM(date)
  ORDER BY (institution_id, class_id, date);

CREATE TABLE IF NOT EXISTS student_risk_scores (
    student_id           String,
    institution_id       String,
    calculated_at        DateTime,
    risk_score           UInt8,
    attendance_risk      UInt8,
    academic_risk        UInt8,
    financial_risk       UInt8,
    behavioral_risk      UInt8,
    primary_risk_factor  String,
    recommended_action   String
) ENGINE = ReplacingMergeTree()
  ORDER BY (student_id, calculated_at);

CREATE TABLE IF NOT EXISTS teacher_workload (
    teacher_id       String,
    institution_id   String,
    week_start       Date,
    classes_per_week UInt8,
    papers_graded    UInt16,
    ptms_held        UInt8,
    workload_index   Float32,
    is_overloaded    Bool
) ENGINE = ReplacingMergeTree()
  ORDER BY (teacher_id, week_start);

CREATE TABLE IF NOT EXISTS subject_intelligence (
    subject_id                String,
    institution_id            String,
    class_id                  String,
    assessment_date           Date,
    avg_score                 Float32,
    pass_rate                 Float32,
    concept_difficulty        String,
    struggling_student_count  UInt16
) ENGINE = ReplacingMergeTree()
  ORDER BY (subject_id, class_id, assessment_date);

CREATE TABLE IF NOT EXISTS audit_anomalies (
    id              String,
    institution_id  String,
    detected_at     DateTime,
    anomaly_type    String,
    severity        String,
    description     String,
    resolved        Bool DEFAULT false
) ENGINE = MergeTree()
  ORDER BY (institution_id, detected_at);
