const PDFDocument = require('pdfkit');
const fs = require('fs');

function createInvoice(invoice, path) {
    let doc = new PDFDocument({ size: 'A4', margin: 50 });

    generateHeader(doc);
    generateCustomerInformation(doc, invoice);
    generateInvoiceTable(doc, invoice);
    generateFooter(doc);

    // Ensure all drawing commands finish before ending the stream
    doc.pipe(fs.createWriteStream(path));
    doc.end();
}

function generateHeader(doc) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('INVOICE', 50, 57)
        .fontSize(10)
        .text('Your Company Name', 200, 50, { align: 'right' })
        .text('123 Business Road', 200, 65, { align: 'right' })
        .text('City, Country, 12345', 200, 80, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, invoice) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('Bill To', 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .text('Invoice Number:', 50, customerInformationTop)
        .font('Helvetica-Bold')
        .text(invoice.invoice_nr, 150, customerInformationTop)
        .font('Helvetica')
        .text('Invoice Date:', 50, customerInformationTop + 15)
        .text(invoice.date, 150, customerInformationTop + 15)
        .text('Balance Due:', 50, customerInformationTop + 30)
        .text(invoice.subtotal - invoice.paid, 150, customerInformationTop + 30)

        .font('Helvetica-Bold')
        .text(invoice.shipping.name, 300, customerInformationTop)
        .font('Helvetica')
        .text(invoice.shipping.address, 300, customerInformationTop + 15)
        .text(
            invoice.shipping.city +
            ', ' +
            invoice.shipping.state +
            ', ' +
            invoice.shipping.country,
            300,
            customerInformationTop + 30
        )
        .moveDown();

    generateHr(doc, 252);
}

function generateInvoiceTable(doc, invoice) {
    let i;
    const invoiceTableTop = 330;
    const rowHeight = 30;
    const colWidths = [150, 150, 80, 70, 100];
    const tableLeft = 50;

    doc.fontSize(10).font('Helvetica-Bold');
    
    // Header Background
    doc.rect(tableLeft, invoiceTableTop, 550, rowHeight).fill('#f2f2f2');
    doc.fillColor('#000000');
    
    generateTableRow(doc, invoiceTableTop + 10, 'Item', 'Description', 'Unit Cost', 'Quantity', 'Line Total', colWidths, tableLeft);

    doc.font('Helvetica');
    for (i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const position = invoiceTableTop + (i + 1) * rowHeight;
        
        // Draw border
        doc.rect(tableLeft, position, 550, rowHeight).stroke('#cccccc');
        
        generateTableRow(doc, position + 10, item.item, item.description, (item.amount / item.quantity).toString(), item.quantity.toString(), item.amount.toString(), colWidths, tableLeft);
    }
}

function generateTableRow(doc, y, c1, c2, c3, c4, c5, colWidths, startX) {
    let currentX = startX;
    const rowData = [c1, c2, c3, c4, c5];
    
    rowData.forEach((text, i) => {
        doc.text(text, currentX + 5, y, { width: colWidths[i] - 10 });
        currentX += colWidths[i];
    });
}

function generateFooter(doc) {
    // Add signature text centered at the bottom
    const signature = 'Signature: ________________________';
    const bottomY = doc.page.height - 50; // 50pt from bottom
    doc
        .fontSize(10)
        .text(
            'Payment is due within 15 days. Thank you for your business.',
            50,
            730,
            { align: 'center', width: 500 }
        );
    // Add a small gap then the signature line
    doc
        .fontSize(12)
        .text(signature, 0, bottomY, { align: 'center' });
}



function generateHr(doc, y) {
    doc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}

const invoice = {
    shipping: {
        name: 'John Doe',
        address: '1234 Main Street',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        postal_code: 94111
    },
    items: [
        {
            item: 'TC 100',
            description: 'Toner Cartridge',
            quantity: 2,
            amount: 6000
        },
        {
            item: 'USB_EXT',
            description: 'USB Cable Extender',
            quantity: 1,
            amount: 2000
        }
    ],
    subtotal: 8000,
    paid: 0,
    invoice_nr: 1234
};

createInvoice(invoice, 'invoice.pdf');
console.log('Invoice generated successfully: invoice.pdf');
