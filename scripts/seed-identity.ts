const INSTITUTION = { id: 'rvce', name: 'R.V. College of Engineering', code: 'RVCE' };

const ROLES = [
  { name: 'STUDENT', permissions: ['students:read:self', 'attendance:read:self', 'fees:read:self'] },
  { name: 'PARENT', permissions: ['students:read:linked', 'attendance:read:linked', 'fees:read:linked'] },
  { name: 'FACULTY', permissions: ['students:read:section', 'attendance:write', 'marks:write'] },
  { name: 'HOD', permissions: ['students:read', 'faculty:read', 'attendance:read'] },
  { name: 'DEAN', permissions: ['reports:read', 'students:read', 'faculty:read'] },
  { name: 'PRINCIPAL', permissions: ['reports:read', 'users:read', 'students:read'] },
  { name: 'TRUSTEE', permissions: ['analytics:read', 'reports:read'] },
  { name: 'COUNSELLOR', permissions: ['students:read', 'mentorship:write'] },
  { name: 'ADMIN', permissions: ['*'] },
];

const ADMIN_USER = {
  id: 'u-admin',
  email: 'admin@rvce.edu',
  name: 'Admin User',
  role: 'ADMIN',
  institutionId: 'rvce',
};

function main(): void {
  console.log('Seeding institution:', INSTITUTION);
  console.log('Seeding admin user:', ADMIN_USER);
  console.log('Seeding roles:');
  ROLES.forEach((role) => console.log(' -', role.name, role.permissions.join(', ')));
  console.log('Seed complete.');
}

main();
