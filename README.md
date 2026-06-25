# PranaHR - Modern HRIS Application

A comprehensive Human Resource Information System built with a modern tech stack (PostgreSQL, Prisma, Express.js, React.js, Node.js).

![Sobat HR](https://img.shields.io/badge/Prana_HR-HRIS-6366f1?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

## Features

### Core Modules

✅ **Authentication & Authorization**
- JWT-based authentication
- Role-based access control (Admin, HR, Employee)
- Secure password hashing with bcrypt

✅ **Employee Management** (HR/Admin)
- Create, read, update, delete employees
- Search and filter by department
- **Interactive Organization Chart** (Drag, pan, zoom reporting structures)
- Auto-generated employee IDs

✅ **Leave Management**
- Submit leave requests
- Approve/reject workflow (HR/Admin)
- Multiple leave types (annual, sick, personal, etc.)
- Leave history and statistics

✅ **Attendance Tracking**
- Clock in/out with timestamps
- Automatic hours calculation
- Late detection
- Attendance history and reports

✅ **Dashboard**
- Role-based dashboards
- Real-time statistics
- Department breakdown charts

### Advanced Modules

✅ **Recruiting** (HR/Admin)
- Job posting management (draft, publish, close, fill)
- Candidate pipeline visualization
- Interview scheduling and tracking
- Offer management
- Recruiting statistics and analytics

✅ **Onboarding** (HR/Admin)
- Onboarding task templates
- Progress tracking with checklist
- Document management
- Mentor assignment
- Feedback collection

✅ **Tasks & Productivity** (All users)
- Assign tasks to employees
- Track task status and priorities
- **File Uploads & Attachments** (Attach PDFs, documents, or images to tasks)
- Due date tracking

✅ **Payroll** (HR/Admin)
- Batch payroll generation
- Individual payroll management
- Earnings and deductions tracking
- Approval workflow (draft → approved → paid)
- Payslip details with PDF download

✅ **Performance & OKR** (All users)
- Goal setting with milestones
- Progress tracking with sliders
- Performance reviews with ratings
- Category and priority management
- Statistics and analytics

✅ **Reports & Analytics** (HR/Admin)
- Employee statistics overview
- Department distribution
- Leave and attendance trends
- Payroll summaries
- Export capabilities

✅ **Settings** (Admin)
- Company information
- Work schedule configuration
- Leave policy management
- Payroll settings
- Notification preferences

## Tech Stack

### Backend
- **Node.js + Express.js** - Web framework
- **PostgreSQL** - Relational Database
- **Prisma ORM** - Database Toolkit & Type-Safe Queries
- **Multer** - File Uploads Handling
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **helmet** - Security headers

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **React Router 6** - Routing
- **Tailwind CSS** - Styling
- **react-zoom-pan-pinch** - Interactive Org Chart
- **Axios** - HTTP client
- **Lucide React** - Icons

## Getting Started

### Prerequisites
- Node.js v20+
- PostgreSQL Server
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Sobat-Hr
```

2. **Backend Setup**
```bash
cd backend
npm install
```

3. **Configure environment variables**
Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5433/sobathr?schema=public"
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

4. **Initialize Database**
```bash
npx prisma db push
npx prisma generate
```

5. **Seed the database** (optional)
```bash
npm run seed
```

6. **Start backend server**
```bash
npm run dev
```

7. **Frontend Setup** (new terminal)
```bash
cd frontend
npm install
npm run dev
```

8. **Open in browser**
Navigate to `http://localhost:5173`

## Demo Accounts

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sobathr.com | admin123 |
| HR | hr@sobathr.com | hr123456 |
| Employee | john@sobathr.com | password123 |

## Project Structure

```
Sobat-Hr/
├── backend/
│   ├── lib/
│   │   └── prisma.js        # Prisma Client Instance
│   ├── prisma/
│   │   └── schema.prisma    # Database Schema
│   ├── middleware/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js
│   │   ├── leaves.js
│   │   ├── attendance.js
│   │   ├── tasks.js         # Now with file upload support
│   │   └── ...
│   ├── .env
│   ├── server.js
│   ├── seed.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Employees.jsx
│   │   │   ├── OrgChart.jsx   # Interactive Reporting Structure
│   │   │   ├── Tasks.jsx      # Task Management with Attachments
│   │   │   └── ...
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
└── README.md
```

## License

MIT License - feel free to use this project for learning or production.

---

Built with ❤️ using PostgreSQL, React, Node, and Prisma.
