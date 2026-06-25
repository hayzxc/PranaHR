const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Seed Admin User
  const adminEmail = 'admin@sobathr.com';
  
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);
    
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
            department: 'Management',
            position: 'Administrator',
            salary: 0,
            hireDate: new Date(),
          }
        }
      }
    });
    console.log(`Admin user created! Email: ${adminEmail}, Password: password123`);
  } else {
    console.log(`Admin user already exists! Email: ${adminEmail}`);
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
