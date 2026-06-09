import * as bcrypt from 'bcryptjs';
import type { User } from '../entities/user.entity';

/**
 * Phase 1 seed users for the AuthService fallback store. Phase 2 replaces this
 * with a TypeORM UserRepository query.
 *
 * Lives in its own module so {@link UsersService.findAll} can dedupe-merge it
 * with the canonical mutable store without creating a circular import between
 * AuthService and UsersService.
 *
 * Default passwords (rotate in production):
 *   admin@rvce.edu      → Admin@123
 *   teacher@rvce.edu    → Teacher@123
 *   student@rvce.edu    → Student@123
 *   parent@rvce.edu     → Parent@123
 *   hod@rvce.edu        → Hod@123
 *   principal@rvce.edu  → Principal@123
 *   recruiter@demo.com  → Recruiter@123
 *   applicant@demo.com  → Applicant@123
 */
export const AUTH_SEED_USERS: User[] = (() => {
  const h = (plain: string) => bcrypt.hashSync(plain, 10);
  return [
    { id: 'u-admin-01',     email: 'admin@rvce.edu',     passwordHash: h('Admin@123'),     name: 'Admin User',       role: 'ADMIN',     institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-faculty-01',   email: 'teacher@rvce.edu',   passwordHash: h('Teacher@123'),   name: 'Dr. Priya Sharma', role: 'FACULTY',   institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-student-01',   email: 'student@rvce.edu',   passwordHash: h('Student@123'),   name: 'Arjun Sharma',     role: 'STUDENT',   institutionId: 'rvce', preferredLanguage: 'en', isActive: true, sapId: '1RV21CS001', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-parent-01',    email: 'parent@rvce.edu',    passwordHash: h('Parent@123'),    name: 'Suresh Sharma',    role: 'PARENT',    institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-hod-01',       email: 'hod@rvce.edu',       passwordHash: h('Hod@123'),       name: 'Dr. Meena Rao',    role: 'HOD',       institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-principal-01', email: 'principal@rvce.edu', passwordHash: h('Principal@123'), name: 'Dr. K. Venkatesh', role: 'PRINCIPAL', institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-recruiter-01', email: 'recruiter@demo.com', passwordHash: h('Recruiter@123'), name: 'Recruiter',        role: 'RECRUITER', institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'u-applicant-01', email: 'applicant@demo.com', passwordHash: h('Applicant@123'), name: 'Applicant',        role: 'APPLICANT', institutionId: 'rvce', preferredLanguage: 'en', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
})();
