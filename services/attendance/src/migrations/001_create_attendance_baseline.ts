export class CreateAttendanceBaseline001 {
  public readonly name = 'CreateAttendanceBaseline001';

  public async up(): Promise<void> {
    // CREATE TABLE attendance_records (
    //   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    //   student_id UUID NOT NULL,
    //   section_id VARCHAR NOT NULL,
    //   institution_id VARCHAR NOT NULL,
    //   date DATE NOT NULL,
    //   period SMALLINT NOT NULL,
    //   course_id VARCHAR NOT NULL,
    //   status VARCHAR NOT NULL,
    //   marked_by UUID NOT NULL,
    //   biometric_ref VARCHAR,
    //   created_at TIMESTAMPTZ DEFAULT now()
    // );
    // CREATE INDEX idx_attendance_student ON attendance_records(student_id, date);
    // CREATE INDEX idx_attendance_section ON attendance_records(section_id, date);
  }

  public async down(): Promise<void> {
    // DROP TABLE attendance_records;
  }
}
