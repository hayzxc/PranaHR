const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Employee = require('./models/Employee');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Employee.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const admin = new User({
      email: 'admin@sobathr.com',
      password: 'admin123',
      role: 'admin',
    });
    await admin.save();
    console.log('Created admin user: admin@sobathr.com / admin123');

    // Create HR user
    const hr = new User({
      email: 'hr@sobathr.com',
      password: 'hr123456',
      role: 'hr',
    });
    await hr.save();

    const hrEmployee = new Employee({
      userId: hr._id,
      name: 'Sarah HR Manager',
      email: 'hr@pranahr.com',
      department: 'Admin/CS',
      position: 'HR Manager',
      salary: 15000000,
      phone: '081234567890',
    });
    await hrEmployee.save();
    console.log('Created HR user: hr@pranahr.com / hr123456');

    // Create sample employees
    const employees = [
      {
        name: 'Budi Sertifikasi',
        email: 'budi@pranahr.com',
        department: 'Sertifikasi',
        position: 'Auditor Senior',
        salary: 12000000,
        phone: '081234567891',
      },
      {
        name: 'Dewi Admin',
        email: 'dewi@pranahr.com',
        department: 'Admin/CS',
        position: 'Customer Support',
        salary: 8000000,
        phone: '081234567892',
      },
      {
        name: 'Eko Finance',
        email: 'eko@pranahr.com',
        department: 'Finance',
        position: 'Akuntan',
        salary: 11000000,
        phone: '081234567893',
      },
      {
        name: 'Rina Verifikasi',
        email: 'rina@pranahr.com',
        department: 'Verifikasi',
        position: 'Verifikator',
        salary: 9000000,
        phone: '081234567894',
      },
      {
        name: 'Agus Teknis',
        email: 'agus@pranahr.com',
        department: 'Teknis dan IT',
        position: 'IT Support',
        salary: 10000000,
        phone: '081234567895',
      },
    ];

    for (const emp of employees) {
      const user = new User({
        email: emp.email,
        password: 'password123',
        role: 'employee',
      });
      await user.save();

      const employee = new Employee({
        userId: user._id,
        ...emp,
      });
      await employee.save();
    }
    console.log(`Created ${employees.length} sample employees (password: password123)`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('  Admin: admin@sobathr.com / admin123');
    console.log('  HR: hr@sobathr.com / hr123456');
    console.log('  Employee: john@sobathr.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
