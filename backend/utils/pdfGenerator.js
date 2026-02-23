
const PDFDocument = require('pdfkit');

/**
 * Generate PDF Payslip
 * @param {Object} payroll - Payroll data with calculations
 * @param {Object} employee - Employee details
 * @param {Object} res - Express response object to stream PDF
 */
const generatePayslipPDF = (payroll, employee, res) => {
    const doc = new PDFDocument({ margin: 50 });

    // Stream to response
    doc.pipe(res);

    // Get period data safely
    const month = payroll.period?.month || 1;
    const year = payroll.period?.year || new Date().getFullYear();

    // --- Header ---
    doc.fillColor('#444444')
        .fontSize(20)
        .text('SOBAT HR', 50, 50, { align: 'left' })
        .fontSize(10)
        .text('123 Business Road', 50, 80, { align: 'left' })
        .text('Jakarta, Indonesia', 50, 95, { align: 'left' })
        .moveDown();

    doc.fillColor('#000000')
        .fontSize(20)
        .text('PAYSLIP', 50, 50, { align: 'right' })
        .fontSize(10)
        .text(new Date().toDateString(), 50, 80, { align: 'right' });

    // --- Horizontal Line ---
    doc.strokeColor('gray')
        .lineWidth(1)
        .moveTo(50, 130)
        .lineTo(550, 130)
        .stroke();

    // --- Employee Details ---
    const customerInfoTop = 150;
    doc.fontSize(10)
        .text('Employee Name:', 50, customerInfoTop)
        .font('Helvetica-Bold')
        .text(employee.name || 'N/A', 150, customerInfoTop)
        .font('Helvetica')
        .text('Employee ID:', 50, customerInfoTop + 15)
        .text(employee.employeeId || 'N/A', 150, customerInfoTop + 15)
        .text('Department:', 50, customerInfoTop + 30)
        .text(employee.department || 'N/A', 150, customerInfoTop + 30)
        .text('Position:', 50, customerInfoTop + 45)
        .text(employee.position || 'N/A', 150, customerInfoTop + 45)

        .text('Period:', 300, customerInfoTop)
        .text(`${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`, 400, customerInfoTop)
        .text('Pay Date:', 300, customerInfoTop + 15)
        .text(payroll.paidAt ? new Date(payroll.paidAt).toLocaleDateString() : 'Pending', 400, customerInfoTop + 15)
        .text('Status:', 300, customerInfoTop + 30)
        .text((payroll.status || 'draft').toUpperCase(), 400, customerInfoTop + 30);

    // --- Table Headers ---
    const tableTop = 230;
    const itemCodeX = 50;
    const descriptionX = 350;
    const amountX = 450;

    doc.font('Helvetica-Bold');
    doc.fontSize(12).text('Earnings', itemCodeX, tableTop);
    doc.fontSize(10);

    // Header Line
    doc.moveTo(itemCodeX, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    // --- Earnings Content ---
    let position = tableTop + 30;

    const generateRow = (label, amount, isBold = false) => {
        if (isBold) { doc.font('Helvetica-Bold'); }
        else { doc.font('Helvetica'); }

        const safeAmount = typeof amount === 'number' ? amount : 0;
        doc.text(label, itemCodeX, position)
            .text(`Rp ${safeAmount.toLocaleString()}`, amountX, position, { width: 90, align: 'right' });
        position += 20;
    };

    generateRow('Basic Salary', payroll.basicSalary);

    // Iterate over earnings object
    if (payroll.earnings) {
        Object.entries(payroll.earnings).forEach(([type, amount]) => {
            if (amount > 0 && type !== 'total') { // Filter 0 amounts
                const label = type.charAt(0).toUpperCase() + type.slice(1);
                generateRow(label, amount);
            }
        });
    }

    // Total Earnings
    doc.moveTo(itemCodeX, position).lineTo(550, position).stroke();
    position += 10;
    // Use stored totalGross or calculate safe fallback
    const totalGross = typeof payroll.grossPay === 'number' ? payroll.grossPay : 0;
    generateRow('Total Earnings', totalGross, true);

    // --- Deductions Section ---
    position += 30;
    doc.font('Helvetica-Bold').fontSize(12).text('Deductions', itemCodeX, position);
    doc.fontSize(10);
    position += 20;
    doc.moveTo(itemCodeX, position).lineTo(550, position).stroke();
    position += 10;

    // Iterate over deductions object
    if (payroll.deductions) {
        Object.entries(payroll.deductions).forEach(([type, amount]) => {
            if (amount > 0 && type !== 'total') {
                const label = type.charAt(0).toUpperCase() + type.slice(1);
                generateRow(label, amount);
            }
        });
    }

    // Total Deductions
    doc.moveTo(itemCodeX, position).lineTo(550, position).stroke();
    position += 10;
    const totalDeductions = typeof payroll.totalDeductions === 'number' ? payroll.totalDeductions : 0;
    generateRow('Total Deductions', totalDeductions, true);

    // --- Net Pay ---
    position += 30;
    doc.rect(50, position, 500, 40).fill('#f0f9ff'); // Light blue background
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14);
    doc.text('NET PAY', 70, position + 12);
    const safeNetPay = typeof payroll.netPay === 'number' ? payroll.netPay : 0;
    doc.text(`Rp ${safeNetPay.toLocaleString()}`, 400, position + 12, { width: 140, align: 'right' });

    // --- Footer ---
    const bottom = 700;
    doc.fontSize(10).font('Helvetica').text('This is a computer-generated document. No signature is required.', 50, bottom, { align: 'center', width: 500 });

    doc.end();
};

module.exports = { generatePayslipPDF };
