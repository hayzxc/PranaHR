# Sobat HR - HRIS MERN Stack Application

A comprehensive Human Resource Information System built with the MERN stack (MongoDB, Express.js, React.js, Node.js).

![Sobat HR](https://img.shields.io/badge/Sobat_HR-HRIS-6366f1?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
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

### New Modules (v2.0)

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

✅ **Payroll** (HR/Admin)
- Batch payroll generation
- Individual payroll management
- Earnings and deductions tracking
- Approval workflow (draft → approved → paid)
- Payslip details with PDF download

✅ **Performance** (All users)
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
- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **helmet** - Security headers
- **express-rate-limit** - Rate limiting

### Frontend
- **React 19** - UI library
- **React Router 6** - Routing
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons

## Getting Started

### Prerequisites
- Node.js v20+
- MongoDB (local or Atlas)
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
MONGODB_URI=mongodb://localhost:27017/sobat-hr
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

4. **Seed the database** (optional)
```bash
npm run seed
```

5. **Start backend server**
```bash
npm run dev
```

6. **Frontend Setup** (new terminal)
```bash
cd frontend
npm install
npm run dev
```

7. **Open in browser**
Navigate to `http://localhost:5173`

## Demo Accounts

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sobathr.com | admin123 |
| HR | hr@sobathr.com | hr123456 |
| Employee | john@sobathr.com | password123 |

## API Endpoints

### Authentication
```
POST /api/auth/register  - Register new user
POST /api/auth/login     - Login
GET  /api/auth/me        - Get current user
```

### Employees
```
GET    /api/employees           - Get all employees
GET    /api/employees/:id       - Get employee by ID
POST   /api/employees           - Create employee (HR/Admin)
PUT    /api/employees/:id       - Update employee
DELETE /api/employees/:id       - Delete employee (Admin)
GET    /api/employees/stats/summary - Get statistics
```

### Leaves
```
GET  /api/leaves            - Get leaves
GET  /api/leaves/pending    - Get pending requests (HR/Admin)
POST /api/leaves            - Submit leave request
PUT  /api/leaves/:id/approve - Approve leave (HR/Admin)
PUT  /api/leaves/:id/reject  - Reject leave (HR/Admin)
PUT  /api/leaves/:id/cancel  - Cancel leave request
GET  /api/leaves/stats       - Get leave statistics
```

### Attendance
```
GET  /api/attendance           - Get attendance records
GET  /api/attendance/today     - Get today's attendance
POST /api/attendance/clock-in  - Clock in
POST /api/attendance/clock-out - Clock out
GET  /api/attendance/summary   - Get attendance summary
GET  /api/attendance/report/:id - Get employee report
```

### Recruiting (New)
```
GET    /api/recruiting/jobs           - Get all job postings
POST   /api/recruiting/jobs           - Create job posting
PUT    /api/recruiting/jobs/:id       - Update job posting
DELETE /api/recruiting/jobs/:id       - Delete job posting
GET    /api/recruiting/jobs/:id/candidates - Get candidates for job
POST   /api/recruiting/jobs/:id/candidates - Add candidate
PUT    /api/recruiting/candidates/:id/stage - Update candidate stage
GET    /api/recruiting/stats          - Get recruiting statistics
```

### Onboarding (New)
```
GET    /api/onboarding           - Get all onboarding records
POST   /api/onboarding           - Create onboarding for employee
GET    /api/onboarding/:id       - Get onboarding by ID
PUT    /api/onboarding/:id/tasks/:taskId - Update task status
PUT    /api/onboarding/:id/status - Update onboarding status
POST   /api/onboarding/:id/feedback - Add feedback
```

### Payroll (New)
```
GET    /api/payroll              - Get all payroll records
POST   /api/payroll              - Create individual payroll
POST   /api/payroll/batch        - Generate batch payroll
GET    /api/payroll/:id          - Get payroll by ID
PUT    /api/payroll/:id/approve  - Approve payroll
PUT    /api/payroll/:id/pay      - Mark as paid
GET    /api/payroll/stats        - Get payroll statistics
```

### Performance (New)
```
GET    /api/performance/reviews      - Get reviews
POST   /api/performance/reviews      - Create review
PUT    /api/performance/reviews/:id  - Update review
GET    /api/performance/goals        - Get goals
POST   /api/performance/goals        - Create goal
PUT    /api/performance/goals/:id    - Update goal progress
DELETE /api/performance/goals/:id    - Delete goal
GET    /api/performance/stats        - Get statistics
```

### Settings (New)
```
GET    /api/settings            - Get all settings
PUT    /api/settings            - Update settings (Admin)
GET    /api/settings/holidays   - Get holidays
POST   /api/settings/holidays   - Add holiday
DELETE /api/settings/holidays/:id - Remove holiday
```

## Project Structure

```
Sobat-Hr/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validate.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Employee.js
│   │   ├── Leave.js
│   │   ├── Attendance.js
│   │   ├── Job.js           # NEW
│   │   ├── Candidate.js     # NEW
│   │   ├── Onboarding.js    # NEW
│   │   ├── Payroll.js       # NEW
│   │   ├── PerformanceReview.js # NEW
│   │   ├── Goal.js          # NEW
│   │   └── Settings.js      # NEW
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js
│   │   ├── leaves.js
│   │   ├── attendance.js
│   │   ├── recruiting.js    # NEW
│   │   ├── onboarding.js    # NEW
│   │   ├── payroll.js       # NEW
│   │   ├── performance.js   # NEW
│   │   └── settings.js      # NEW
│   ├── .env
│   ├── server.js
│   ├── seed.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Employees.jsx
│   │   │   ├── Leaves.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── Recruiting.jsx   # NEW
│   │   │   ├── Onboarding.jsx   # NEW
│   │   │   ├── Payroll.jsx      # NEW
│   │   │   ├── Performance.jsx  # NEW
│   │   │   ├── Reports.jsx      # NEW
│   │   │   └── Settings.jsx     # NEW
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## License

MIT License - feel free to use this project for learning or production.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Built with ❤️ using the MERN Stack

