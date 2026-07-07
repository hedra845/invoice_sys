const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const QRCode = require('qrcode');
const reshaper = require('arabic-persian-reshaper');
const bidi = require('bidi-js');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 8090; // Updated to avoid EADDRINUSE

// Helper to fix Arabic text for PDFKit
function fixArabic(text) {
    if (!text) return '';
    // Reshape the Arabic characters using the correct API
    const reshaped = reshaper.ArabicShaper.convertArabic(text);
    // For PDFKit, the reshaped text is sufficient; bidi handling omitted
    return reshaped;
}

function getProfileSubscription(profile) {
    if (!profile) return false;
    if (profile.is_subscribed === true) return true;
    if (profile.subscribed === true) return true;
    if (profile.is_premium === true) return true;
    if (profile.premium === true) return true;
    if (typeof profile.plan === 'string' && ['pro', 'premium', 'paid'].includes(profile.plan.toLowerCase())) return true;
    if (typeof profile.subscription === 'string' && ['pro', 'premium', 'paid'].includes(profile.subscription.toLowerCase())) return true;
    return false;
}

function isSubscribedRequest(req, profile) {
    return Boolean(req.session && req.session.isSubscribed) || getProfileSubscription(profile);
}

async function isUserSubscribedByCode(userId) {
    if (!userId) return false;
    const { data, error } = await supabaseAdmin
        .from('subscription_codes')
        .select('id')
        .eq('used_by_user_id', userId)
        .not('used_at', 'is', null)
        .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}

async function resolveSubscribed(req, profile) {
    if (isSubscribedRequest(req, profile)) return true;
    const userId = req.session ? req.session.userId : null;
    const subscribed = await isUserSubscribedByCode(userId);
    if (req.session) req.session.isSubscribed = subscribed;
    return subscribed;
}

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
function getJwtRole(jwt) {
    try {
        const parts = String(jwt || '').split('.');
        if (parts.length < 2) return '';
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        const json = Buffer.from(padded, 'base64').toString('utf8');
        const obj = JSON.parse(json);
        return String(obj.role || '');
    } catch {
        return '';
    }
}
const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) || getJwtRole(supabaseAdminKey) === 'service_role';

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'invoice-system-secret-123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Ensure uploads directory exists on startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Set up storage for uploaded logos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'logo' + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// PDF Generation Logic
async function generatePDF(data, outputPath, callback) {
    try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Determine language and layout direction
        const lang = data.lang || 'en';
        const isRTL = lang === 'ar';
        // Define positions based on direction
        const leftX = isRTL ? 300 : 50;
        const rightX = isRTL ? 50 : 300;
        const alignLeft = isRTL ? 'right' : 'left';
        const alignRight = isRTL ? 'left' : 'right';
        // Adjust company info placement
        const companyX = isRTL ? 50 : 300;
        const companyW = 250;
        // Adjust details placement
        const detailsX = isRTL ? 50 : 380;
        const detailsValX = isRTL ? 110 : 440;
        const detailsW = 110;
        
        const blueColor = '#2e86de';       // Main blue for INVOICE title
        const darkColor = '#2c3e50';       // Dark text
        const grayColor = '#7f8c8d';       // Secondary gray text
        const lightBg = '#f0f4f8';         // Light background for table header
        const lineColor = '#2e86de';       // Blue line separator
        const orangeColor = '#e67e22';     // Orange for Total Amount label
        const borderLight = '#dce1e8';     // Light border for table rows

        // Font setup
        const fontPath = path.join(__dirname, 'fonts', 'Cairo-Regular.ttf');
        const fontBoldPath = path.join(__dirname, 'fonts', 'Cairo-Bold.ttf');
        const hasCustomFont = fs.existsSync(fontPath);
        const hasCustomBold = fs.existsSync(fontBoldPath);
        
        const arialPath = 'C:\\Windows\\Fonts\\arial.ttf';
        const arialBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
        const hasArial = fs.existsSync(arialPath);
        const hasArialBold = fs.existsSync(arialBoldPath);

        // Select fonts
        let fontRegular, fontBold;
        if (hasCustomFont) {
            fontRegular = fontPath;
            fontBold = hasCustomBold ? fontBoldPath : fontPath;
        } else if (hasArial) {
            fontRegular = arialPath;
            fontBold = hasArialBold ? arialBoldPath : arialPath;
        } else {
            fontRegular = 'Helvetica';
            fontBold = 'Helvetica-Bold';
        }

        doc.font(fontRegular);

        // Language translations for static labels
        const translations = {
            en: {
                invoiceTitle: 'INVOICE',
                billTo: 'BILL TO:',
                details: 'DETAILS:',
                invoiceNumber: 'Invoice #:',
                date: 'Date:',
                dueDate: 'Due Date:',
                description: 'Description',
                quantity: 'Quantity',
                unitPrice: 'Unit Price',
                total: 'Total',
                subtotal: 'Subtotal:',
                tax: (rate) => `Tax (${rate}%):`,
                discount: 'Discount:',
                totalAmount: 'Total Amount:',
                notes: 'Notes:',
                thankYou: 'Thank you for your business!',
                paymentTerms: 'Payment terms: Net 14 days. Please make checks payable to '
            },
            ar: {
                invoiceTitle: 'فاتورة',
                billTo: 'إلى:',
                details: 'تفاصيل:',
                invoiceNumber: 'رقم الفاتورة:',
                date: 'التاريخ:',
                dueDate: 'تاريخ الاستحقاق:',
                description: 'الوصف',
                quantity: 'الكمية',
                unitPrice: 'سعر الوحدة',
                total: 'الإجمالي',
                subtotal: 'الإجمالي الفرعي:',
                tax: (rate) => `الضريبة (${rate}%):`,
                discount: 'خصم:',
                totalAmount: 'الإجمالي الكلي:',
                notes: 'ملاحظات:',
                thankYou: 'شكراً لتعاملكم معنا!',
                paymentTerms: 'شروط الدفع: صافي 14 يوم. يرجى تسديد الشيكات إلى '
            }
        };
        const txt = isRTL ? translations.ar : translations.en;

        
        // "INVOICE" title - large blue text
        doc.font(fontBold).fontSize(32).fillColor(blueColor)
            .text(txt.invoiceTitle, 50, 45);

        // Company info - aligned based on language
        doc.font(fontBold).fontSize(11).fillColor(darkColor)
            .text(fixArabic(data.companyName || 'Your Company Name'), companyX, 45, { align: alignRight, width: companyW });
        
        doc.font(fontRegular).fontSize(9).fillColor(grayColor);
        let companyY = 62;
        if (data.companyAddress) {
            doc.text(fixArabic(data.companyAddress), companyX, companyY, { align: alignRight, width: companyW });
            companyY += 14;
        }
        if (data.companyEmail) {
            doc.text('Email: ' + data.companyEmail, companyX, companyY, { align: alignRight, width: companyW });
            companyY += 14;
        }
        if (data.commercialRegister) {
            doc.text(fixArabic('س.ت: ' + data.commercialRegister), companyX, companyY, { align: alignRight, width: companyW });
            companyY += 14;
        }
        if (data.taxCardNumber) {
            doc.text(fixArabic('ب.ض: ' + data.taxCardNumber), companyX, companyY, { align: alignRight, width: companyW });
        }

        // Logo (small, next to INVOICE title if present)
        if (data.logoPath && fs.existsSync(data.logoPath)) {
            try {
                doc.image(data.logoPath, 50, 80, { width: 50 });
            } catch (imgErr) {
                console.error('Logo error:', imgErr);
            }
        }

        // ============================================================
        // 2. BLUE SEPARATOR LINE
        // ============================================================
        const separatorY = 115;
        doc.moveTo(50, separatorY).lineTo(550, separatorY).lineWidth(2.5).strokeColor(lineColor).stroke();

        // ============================================================
        // 3. BILL TO (left) + DETAILS (right)
        // ============================================================
        const sectionTop = 135;

        // BILL TO label
        doc.font(fontBold).fontSize(11).fillColor(darkColor)
            .text(txt.billTo, leftX, sectionTop);
        
        // Client info
        doc.font(fontRegular).fontSize(10).fillColor(darkColor);
        let clientY = sectionTop + 20;
        if (data.clientName) {
            doc.font(fontBold).text(fixArabic(data.clientName), leftX, clientY);
            clientY += 16;
        }
        doc.font(fontRegular).fillColor(grayColor);
        if (data.clientAddress) {
            doc.text(fixArabic(data.clientAddress), leftX, clientY, { width: 220 });
            clientY += 14;
        }
        if (data.clientEmail) {
            doc.text('Email: ' + data.clientEmail, leftX, clientY);
        }

        // DETAILS label
        doc.font(fontBold).fontSize(11).fillColor(darkColor)
            .text(txt.details, detailsX, sectionTop);

        doc.fontSize(10);
        let detailY = sectionTop + 20;

        // Invoice #
        doc.font(fontBold).fillColor(darkColor)
            .text(txt.invoiceNumber, detailsX, detailY);
        doc.font(fontRegular).fillColor(grayColor)
            .text(data.invoiceNumber || 'N/A', detailsValX, detailY, { align: alignRight, width: detailsW });
        detailY += 16;

        // Date
        doc.font(fontBold).fillColor(darkColor)
            .text(txt.date, detailsX, detailY);
        doc.font(fontRegular).fillColor(grayColor)
            .text(data.invoiceDate || 'N/A', detailsValX, detailY, { align: alignRight, width: detailsW });
        detailY += 16;

        // Due Date
        doc.font(fontBold).fillColor(darkColor)
            .text(txt.dueDate, detailsX, detailY);
        doc.font(fontRegular).fillColor(grayColor)
            .text(data.dueDate || 'N/A', detailsValX, detailY, { align: alignRight, width: detailsW });

        // ============================================================
        // 4. ITEMS TABLE
        // ============================================================
        const tableTop = 250;
        const tableLeft = 50;
        const tableRight = 550;
        const tableWidth = tableRight - tableLeft;
        const rowHeight = 40;
        const headerHeight = 32;

        // Column positions
        const col1 = tableLeft;       // Description
        const col2 = 300;             // Quantity
        const col3 = 390;             // Unit Price
        const col4 = 480;             // Total

        // Table Header Background
        doc.rect(tableLeft, tableTop, tableWidth, headerHeight).fill(lightBg);
        
        // Table Header Border
        doc.moveTo(tableLeft, tableTop).lineTo(tableRight, tableTop).lineWidth(0.5).strokeColor(borderLight).stroke();
        doc.moveTo(tableLeft, tableTop + headerHeight).lineTo(tableRight, tableTop + headerHeight).lineWidth(0.5).strokeColor(borderLight).stroke();

        // Header text
        doc.font(fontBold).fontSize(10).fillColor(grayColor);
        doc.text(txt.description, col1 + 10, tableTop + 10);
        doc.text(txt.quantity, col2, tableTop + 10, { width: 80, align: 'center' });
        doc.text(txt.unitPrice, col3, tableTop + 10, { width: 80, align: 'right' });
        doc.text(txt.total, col4, tableTop + 10, { width: 70, align: 'right' });

        // Table Rows
        let subtotal = 0;
        const items = data.items || [];
        doc.font(fontRegular).fontSize(10);

        items.forEach((item, index) => {
            const y = tableTop + headerHeight + (index * rowHeight);
            const price = parseFloat(item.price || 0);
            const qty = parseFloat(item.quantity || 0);
            const total = price * qty;
            subtotal += total;

            // Row bottom border
            doc.moveTo(tableLeft, y + rowHeight).lineTo(tableRight, y + rowHeight)
                .lineWidth(0.5).strokeColor(borderLight).stroke();

            // Row data
            doc.fillColor(darkColor);
            doc.text(fixArabic(item.name || ''), col1 + 10, y + 14, { width: 230 });
            doc.text(qty.toString(), col2, y + 14, { width: 80, align: 'center' });
            doc.text('$' + price.toFixed(2), col3, y + 14, { width: 80, align: 'right' });
            doc.text('$' + total.toFixed(2), col4, y + 14, { width: 70, align: 'right' });
        });

        // ============================================================
        // 5. TOTALS SECTION (right-aligned)
        // ============================================================
        const lastRowBottom = tableTop + headerHeight + (items.length * rowHeight) + 20;
        const totalsLabelX = 380;
        const totalsValueX = 470;
        const totalsValueW = 80;

        const taxRate = parseFloat(data.taxRate || 0);
        const discountAmount = parseFloat(data.discountAmount || 0);
        const currency = data.currency || '$';

        const taxAmount = subtotal * (taxRate / 100);
        const totalWithTax = subtotal + taxAmount - discountAmount;

        let totY = lastRowBottom;

        // Subtotal
        doc.font(fontBold).fontSize(10).fillColor(grayColor)
            .text(txt.subtotal, totalsLabelX, totY, { width: 80, align: 'right' });
        doc.font(fontRegular).fillColor(darkColor)
            .text(currency + subtotal.toFixed(2), totalsValueX, totY, { width: totalsValueW, align: 'right' });
        totY += 20;

        // Tax
        if (taxRate > 0) {
            doc.font(fontBold).fillColor(grayColor)
                .text(txt.tax(taxRate), totalsLabelX, totY, { width: 80, align: 'right' });
            doc.font(fontRegular).fillColor(darkColor)
                .text(currency + taxAmount.toFixed(2), totalsValueX, totY, { width: totalsValueW, align: 'right' });
            totY += 20;
        }

        // Discount
        if (discountAmount > 0) {
            doc.font(fontBold).fillColor(grayColor)
                .text(txt.discount, totalsLabelX, totY, { width: 80, align: 'right' });
            doc.font(fontRegular).fillColor('#e74c3c')
                .text('-' + currency + discountAmount.toFixed(2), totalsValueX, totY, { width: totalsValueW, align: 'right' });
            totY += 20;
        }

        // Separator line before total
        doc.moveTo(totalsLabelX, totY).lineTo(550, totY).lineWidth(1).strokeColor(borderLight).stroke();
        totY += 10;

        // Total Amount (orange label, blue value)
        doc.font(fontBold).fontSize(12).fillColor(orangeColor)
            .text(txt.totalAmount, totalsLabelX - 20, totY, { width: 100, align: 'right' });
        doc.font(fontBold).fillColor(blueColor)
            .text(currency + totalWithTax.toFixed(2), totalsValueX, totY, { width: totalsValueW, align: 'right' });

        // ============================================================
        // 6. QR CODE (optional, small, bottom-left)
        // ============================================================
        try {
            const qrText = `Invoice: ${data.invoiceNumber}\nClient: ${data.clientName}\nAmount: ${totalWithTax.toFixed(2)} ${currency}`;
            const qrDataUrl = await QRCode.toDataURL(qrText);
            doc.image(qrDataUrl, 50, totY + 30, { width: 60 });
        } catch (qrErr) {
            console.error('QR Code error:', qrErr);
        }

        // ============================================================
        // 7. NOTES & SIGNATURE
        // ============================================================
        if (data.notes || data.signatureData) {
            const notesTop = totY + 100;

            if (data.notes) {
                doc.font(fontBold).fontSize(10).fillColor(darkColor)
                    .text(fixArabic(txt.notes), 50, notesTop);
                doc.font(fontRegular).fontSize(9).fillColor(grayColor)
                    .text(fixArabic(data.notes), 50, notesTop + 16, { width: 300, lineGap: 3 });
            }

            if (data.signatureData) {
                try {
                    doc.image(data.signatureData, 400, notesTop, { width: 120 });
                } catch (sigErr) {
                    console.error('Signature error:', sigErr);
                }
            }
        }

        // ============================================================
        // 8. FOOTER
        // ============================================================
        const footerY = 750;

        // Light gray footer background
        doc.rect(0, footerY, 612, 100).fill('#f7f9fc');

        // Footer separator line
        doc.moveTo(50, footerY).lineTo(550, footerY).lineWidth(0.5).strokeColor(borderLight).stroke();

        // Thank you message
        doc.font(fontBold).fontSize(10).fillColor(blueColor)
            .text(txt.thankYou, 50, footerY + 15, { align: 'center', width: 500 });

        // Payment terms
        doc.font(fontRegular).fontSize(8).fillColor(grayColor)
            .text(fixArabic(data.paymentTerms || (txt.paymentTerms + (data.companyName || 'Your Company Name') + '.')), 
                50, footerY + 32, { align: 'center', width: 500 });

        // ============================================================
        // FINALIZE
        // ============================================================
        doc.end();
        stream.on('finish', () => callback(null));
        stream.on('error', (err) => callback(err));
    } catch (err) {
        callback(err);
    }
}

function generateTableRow(doc, y, item, desc, price, qty, total) {
    doc.fontSize(10)
        .text(item, 60, y, { width: 230 })
        .text(qty, 300, y, { width: 80, align: 'center' })
        .text(price, 390, y, { width: 80, align: 'right' })
        .text(total, 480, y, { width: 70, align: 'right' });
}

function generateHr(doc, y) {
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

// Routes
// 1. Authentication Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const email = username.includes('@') ? username : `${username}@invoice.com`;
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    
    if (data.user) {
        await supabaseAdmin.from('profiles').insert([
            { id: data.user.id, username: username }
        ]);
    }

    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const email = username.includes('@') ? username : `${username}@invoice.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) return res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    
    if (data.user) {
        req.session.userId = data.user.id;
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();
        const subscribed = await resolveSubscribed(req, profile);
        res.json({ success: true, user: { username: profile ? profile.username : username, subscribed } });
    }
});

app.get('/api/user', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', req.session.userId)
        .single();
        
    if (error || !profile) return res.status(401).json({ success: false });
    
    const subscribed = await resolveSubscribed(req, profile);
    res.json({ success: true, user: { username: profile.username, subscribed, profile: profile } });
});

app.put('/api/profile', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    
    const updates = {
        company_name: req.body.companyName,
        company_address: req.body.companyAddress,
        company_phone: req.body.companyPhone,
        company_tax_number: req.body.companyTaxNumber
    };
    
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', req.session.userId)
        .select();
        
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, profile: data[0] });
});

// Clients API
app.get('/api/clients', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { data: clients, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('user_id', req.session.userId)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, clients });
});

app.post('/api/clients', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const client = {
        user_id: req.session.userId,
        client_name: req.body.clientName,
        client_phone: req.body.clientPhone,
        client_address: req.body.clientAddress,
        client_tax_number: req.body.clientTaxNumber,
        client_email: req.body.clientEmail
    };
    const { data, error } = await supabaseAdmin.from('clients').insert([client]).select();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, client: data[0] });
});

// Products API
app.get('/api/products', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('user_id', req.session.userId)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, products });
});

app.post('/api/products', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const product = {
        user_id: req.session.userId,
        name: req.body.name,
        description: req.body.description,
        price: req.body.price
    };
    const { data, error } = await supabaseAdmin.from('products').insert([product]).select();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, product: data[0] });
});

// Update Invoice Status API
app.put('/api/invoices/:id/status', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { status } = req.body;
    const { data, error } = await supabaseAdmin
        .from('invoices')
        .update({ status: status })
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId)
        .select();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, invoice: data[0] });
});

app.post('/api/logout', async (req, res) => {
    await supabase.auth.signOut();
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/subscription', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', req.session.userId).single();
    const subscribed = await resolveSubscribed(req, profile);
    res.json({ success: true, subscribed });
});

app.post('/api/activate-subscription', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { code } = req.body || {};
    const rawCode = String(code || '').trim();
    if (!rawCode) return res.status(400).json({ success: false, error: 'أدخل كود الاشتراك' });
    if (!hasServiceRoleKey) {
        return res.status(500).json({
            success: false,
            error: 'التفعيل يحتاج مفتاح Service Role. أضِف SUPABASE_SERVICE_ROLE_KEY في ملف .env أو استخدم Service Role Key كمفتاح للاتصال ثم أعد تشغيل السيرفر.'
        });
    }

    const candidates = Array.from(new Set([
        rawCode,
        rawCode.toUpperCase(),
        rawCode.toLowerCase()
    ])).filter(Boolean);

    const { data: codeRows, error: codeErr } = await supabaseAdmin
        .from('subscription_codes')
        .select('*')
        .in('code', candidates)
        .limit(1);

    if (codeErr) {
        console.error('Activate subscription - DB error:', codeErr);
        return res.status(500).json({
            success: false,
            error: 'مشكلة في جدول الأكواد. تأكد من إنشاء جدول subscription_codes وإعداد صلاحياته (RLS/Policies).'
        });
    }

    const codeRow = Array.isArray(codeRows) ? codeRows[0] : null;
    if (!codeRow) return res.status(400).json({ success: false, error: 'كود الاشتراك غير صحيح' });
    if (codeRow.used_at) return res.status(400).json({ success: false, error: 'هذا الكود مستخدم من قبل' });
    if (Number(codeRow.price_egp) !== 100) return res.status(400).json({ success: false, error: 'سعر هذا الكود غير صحيح' });

    const { data: updatedRows, error: updateErr } = await supabaseAdmin
        .from('subscription_codes')
        .update({ used_by_user_id: req.session.userId, used_at: new Date().toISOString() })
        .eq('code', codeRow.code)
        .is('used_at', null)
        .select();

    if (updateErr) {
        console.error('Activate subscription - update error:', updateErr);
        return res.status(500).json({
            success: false,
            error: 'تعذر تفعيل الكود بسبب صلاحيات قاعدة البيانات. راجع RLS/Policies لجدول subscription_codes.'
        });
    }
    if (!updatedRows || updatedRows.length === 0) return res.status(400).json({ success: false, error: 'تعذر تفعيل الكود' });

    req.session.isSubscribed = true;
    try {
        await supabaseAdmin.from('profiles').update({ is_subscribed: true }).eq('id', req.session.userId);
    } catch (e) {}

    res.json({ success: true, subscribed: true });
});

// 2. Invoice History Route
app.get('/api/invoices', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ success: false, error: 'غير مصدق' });
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', req.session.userId).single();
        const subscribed = await resolveSubscribed(req, profile);
        console.log('Fetching invoices for user', req.session.userId, 'subscribed:', subscribed);
        const { data: invoices = [], error } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('user_id', req.session.userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Invoice fetch error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
        console.log('Invoices fetched count:', invoices.length);
        // Return a consistent payload structure
        res.json({ success: true, subscribed, invoices });
    } catch (e) {
        console.error('Unexpected error in /api/invoices:', e);
        res.status(500).json({ success: false, error: e.message || 'خطأ غير معروف' });
    }
});
// Old duplicate invoice route removed - replaced by robust implementation above


// 3. PDF Generation (Protected)
app.post('/generate-pdf', upload.fields([{ name: 'logo', maxCount: 1 }]), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول أولاً' });
    }

    try {
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', req.session.userId).single();
        const subscribed = await resolveSubscribed(req, profile);

        // Validate incoming data
        if (!req.body || !req.body.data) {
          return res.status(400).json({ success: false, error: 'Missing invoice data' });
        }

        // Parse invoice JSON
        let data;
        try {
          data = JSON.parse(req.body.data);
        } catch (parseErr) {
          console.error('Data Parsing Error:', parseErr);
          return res.status(400).json({ success: false, error: 'Invalid JSON data' });
        }

        // Handle optional logo upload
        if (req.files && req.files['logo']) {
          data.logoPath = req.files['logo'][0].path;
        }

        // Handle signature data if provided
        if (req.body.signatureData) {
          data.signatureData = req.body.signatureData;
        }

        // Calculate totals with safety checks
        const itemsArray = Array.isArray(data.items) ? data.items : [];
        const subtotal = itemsArray.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseFloat(item.quantity) || 0;
            return sum + price * qty;
        }, 0);
        const taxRate = parseFloat(data.taxRate || 0);
        const discountAmount = parseFloat(data.discountAmount || 0);
        const totalAmount = subtotal + (subtotal * (taxRate / 100)) - discountAmount;
        data.totalAmount = totalAmount.toFixed(2);
        // Ensure items field exists for downstream processing
        data.items = itemsArray;

        // Generate PDF
        const pdfFilename = `invoice-${Date.now()}.pdf`;
        const pdfPath = path.join(__dirname, 'uploads', pdfFilename);
        try {
          await new Promise((resolve, reject) => {
            generatePDF(data, pdfPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (pdfErr) {
          console.error('PDF Generation Error (route):', pdfErr);
          return res.status(500).json({ success: false, error: pdfErr.message || 'خطأ في إنشاء PDF' });
        }

         // Save invoice to database if user is subscribed
         if (subscribed) {
             await supabaseAdmin.from('invoices').insert([{
                 user_id: req.session.userId,
                 pdf_path: pdfPath,
                 total_amount: totalAmount,
                 data_json: JSON.stringify(data)
             }]);
         }

         // Respond with PDF URL
         res.send({
             success: true,
             pdfUrl: `/uploads/${pdfFilename}`,
             saved: subscribed
         });
    } catch (error) {
        console.error('PDF Generation Error (route):', error);
        res.status(500).json({ success: false, error: error.message || 'خطأ غير معروف' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});
