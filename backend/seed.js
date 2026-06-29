const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  const salt = await bcrypt.genSalt(12);

  // 1. Seed Admin User
  const adminEmail = 'admin@sobathr.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        employee: {
          create: {
            employeeId: 'ADM001',
            name: 'System Administrator',
            email: adminEmail,
            department: 'Admin/CS',
            position: 'Administrator',
            salary: 0,
            hireDate: new Date(),
          }
        }
      }
    });
    console.log(`Admin user created! Email: ${adminEmail}, Password: admin123`);
  } else {
    // If the admin existed with old password, update it to match README (admin123)
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { password: hashedPassword }
    });
    console.log(`Admin user password updated to: admin123`);
  }

  // 2. Seed HR User
  const hrEmail = 'hr@sobathr.com';
  const existingHr = await prisma.user.findUnique({ where: { email: hrEmail } });

  if (!existingHr) {
    const hashedPassword = await bcrypt.hash('hr123456', salt);
    await prisma.user.create({
      data: {
        email: hrEmail,
        password: hashedPassword,
        role: 'hr',
        employee: {
          create: {
            employeeId: 'HR001',
            name: 'HR Specialist',
            email: hrEmail,
            department: 'Admin/CS',
            position: 'HR Manager',
            salary: 6000000,
            hireDate: new Date(),
          }
        }
      }
    });
    console.log(`HR user created! Email: ${hrEmail}, Password: hr123456`);
  } else {
    console.log(`HR user already exists! Email: ${hrEmail}`);
  }

  // 3. Seed Employee User
  const employeeEmail = 'john@sobathr.com';
  const existingEmployee = await prisma.user.findUnique({ where: { email: employeeEmail } });

  if (!existingEmployee) {
    const hashedPassword = await bcrypt.hash('password123', salt);
    await prisma.user.create({
      data: {
        email: employeeEmail,
        password: hashedPassword,
        role: 'employee',
        employee: {
          create: {
            employeeId: 'EMP001',
            name: 'John Doe',
            email: employeeEmail,
            department: 'Teknis dan IT',
            position: 'Software Engineer',
            salary: 8000000,
            hireDate: new Date(),
          }
        }
      }
    });
    console.log(`Employee user created! Email: ${employeeEmail}, Password: password123`);
  } else {
    console.log(`Employee user already exists! Email: ${employeeEmail}`);
  }

  // Ensure singleton settings exist
  const existingSettings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!existingSettings) {
    await prisma.settings.create({
      data: { id: 'singleton' }
    });
    console.log('Singleton settings initialized.');
  }

  console.log('Database seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
