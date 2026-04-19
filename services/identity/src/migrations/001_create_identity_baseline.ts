/**
 * Migration 001 — Identity baseline schema.
 * Placeholder: implement with TypeORM QueryRunner in the DB integration phase.
 */
export class CreateIdentityBaseline001 {
  public readonly name = 'CreateIdentityBaseline001';

  public async up(): Promise<void> {
    // CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    // CREATE TABLE users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), ...);
    // CREATE TABLE parents (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), ...);
    // CREATE TABLE students (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), usn VARCHAR UNIQUE, ...);
    // CREATE TABLE parent_student_links (id UUID PRIMARY KEY, parent_id UUID, student_id UUID, UNIQUE(parent_id, student_id));
    // CREATE TABLE roles (id UUID PRIMARY KEY, name VARCHAR UNIQUE, permissions JSONB);
  }

  public async down(): Promise<void> {
    // DROP TABLE parent_student_links;
    // DROP TABLE students;
    // DROP TABLE parents;
    // DROP TABLE users;
    // DROP TABLE roles;
  }
}
