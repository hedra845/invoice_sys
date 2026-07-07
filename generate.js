const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF() {
    try {
        const browser = await puppeteer.launch({
            headless: 'new'
        });
        const page = await browser.newPage();

        // Read the HTML file
        const htmlPath = path.join(__dirname, 'invoice.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Set the content
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generate PDF
        await page.pdf({
            path: 'invoice.pdf',
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        await browser.close();
        console.log('PDF generated successfully: invoice.pdf');
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}

generatePDF();
