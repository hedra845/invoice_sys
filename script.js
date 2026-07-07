/* ============================================
   منشئ الفواتير الذكي - Script
   ============================================ */

// ──────────────────────────────────────────────
// 1. Navbar scroll effect & mobile toggle
// ──────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
document.querySelectorAll('.nav-links a').forEach(link =>
  link.addEventListener('click', () => navLinks.classList.remove('open'))
);

// ──────────────────────────────────────────────
// 2. Tabs navigation
// ──────────────────────────────────────────────
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  tabContents.forEach(tc => tc.classList.toggle('active', tc.id === 'tab-' + name));
  if (name === 'preview') renderPreview();
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
document.querySelectorAll('.btn-next').forEach(b =>
  b.addEventListener('click', () => switchTab(b.dataset.next))
);
document.querySelectorAll('.btn-prev').forEach(b =>
  b.addEventListener('click', () => switchTab(b.dataset.prev))
);

// ──────────────────────────────────────────────
// 3. Auto-generate invoice number & date
// ──────────────────────────────────────────────
function generateInvoiceNumber() {
  const invoices = loadInvoices();
  return 'INV-' + String(invoices.length + 1).padStart(4, '0');
}
document.getElementById('invoiceNumber').value = generateInvoiceNumber();
document.getElementById('invoiceDate').valueAsDate = new Date();

// Logo handling
let currentLogoBase64 = null;
document.getElementById('companyLogo').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentLogoBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        currentLogoBase64 = null;
    }
});

// Load Clients, Products, Profile Data
let savedClients = [];
let savedProducts = [];

async function loadUserData() {
    try {
        const userRes = await fetch('/api/user');
        const userData = await userRes.json();
        if (userData.success && userData.user.profile) {
            const p = userData.user.profile;
            if (p.company_name) document.getElementById('senderName').value = p.company_name;
            if (p.company_address) document.getElementById('senderAddress').value = p.company_address;
            if (p.company_phone) document.getElementById('senderPhone').value = p.company_phone;
            if (p.company_tax_number) document.getElementById('senderTax').value = p.company_tax_number;
        }

        const clientsRes = await fetch('/api/clients');
        const clientsData = await clientsRes.json();
        if (clientsData.success) {
            savedClients = clientsData.clients;
            const select = document.getElementById('savedClientsDropdown');
            select.innerHTML = '<option value="">-- اختر عميل محفوظ --</option>';
            savedClients.forEach((c, idx) => {
                select.innerHTML += `<option value="${idx}">${c.client_name}</option>`;
            });
        }

        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();
        if (productsData.success) {
            savedProducts = productsData.products;
            const select = document.getElementById('savedProductsDropdown');
            select.innerHTML = '<option value="">-- إدراج منتج محفوظ --</option>';
            savedProducts.forEach((p, idx) => {
                select.innerHTML += `<option value="${idx}">${p.name} - ${p.price}</option>`;
            });
        }
    } catch (e) {
        console.error('Failed to load user data', e);
    }
}

document.getElementById('savedClientsDropdown').addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx !== "") {
        const c = savedClients[idx];
        document.getElementById('clientName').value = c.client_name || '';
        document.getElementById('clientPhone').value = c.client_phone || '';
        document.getElementById('clientAddress').value = c.client_address || '';
        document.getElementById('clientTax').value = c.client_tax_number || '';
    }
});

document.getElementById('savedProductsDropdown').addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx !== "") {
        const p = savedProducts[idx];
        const tr = createItemRow();
        tr.querySelector('.item-desc').value = p.name || '';
        tr.querySelector('.item-price').value = p.price || 0;
        itemsTableBody.appendChild(tr);
        bindItemEvents();
        calcTotals();
        e.target.value = ""; // Reset dropdown
    }
});

// ──────────────────────────────────────────────
// 4. Items table logic
// ──────────────────────────────────────────────
const itemsTableBody = document.querySelector('#itemsTable tbody');
const addItemBtn = document.getElementById('addItemBtn');

function createItemRow() {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="item-desc" placeholder="وصف الصنف" required /></td>
    <td><input type="number" class="item-qty" min="1" value="1" /></td>
    <td><input type="number" class="item-price" min="0" step="0.01" value="0" /></td>
    <td class="item-total">0.00</td>
    <td><button type="button" class="btn-remove">✕</button></td>
  `;
  return tr;
}

addItemBtn.addEventListener('click', () => {
  itemsTableBody.appendChild(createItemRow());
  bindItemEvents();
});

function calcTotals() {
  let sub = 0;
  itemsTableBody.querySelectorAll('tr').forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    const tdTotal = row.querySelector('.item-total');
    if (tdTotal) tdTotal.textContent = total.toFixed(2);
    sub += total;
  });
  const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
  const discount = parseFloat(document.getElementById('discount').value) || 0;
  const tax = sub * (taxRate / 100);
  const grand = sub + tax - discount;
  document.getElementById('subtotal').textContent = sub.toFixed(2);
  document.getElementById('taxAmount').textContent = tax.toFixed(2);
  document.getElementById('grandTotal').textContent = grand.toFixed(2);
}

function bindItemEvents() {
  itemsTableBody.querySelectorAll('.item-qty, .item-price').forEach(inp =>
    inp.addEventListener('input', calcTotals)
  );
  itemsTableBody.querySelectorAll('.btn-remove').forEach(btn =>
    btn.addEventListener('click', () => {
      if (itemsTableBody.querySelectorAll('tr').length > 1) {
        btn.closest('tr').remove();
        calcTotals();
      }
    })
  );
}
bindItemEvents();
document.getElementById('taxRate').addEventListener('change', calcTotals);
document.getElementById('discount').addEventListener('input', calcTotals);

// ──────────────────────────────────────────────
// 5. Signature canvas
// ──────────────────────────────────────────────
const canvas = document.getElementById('signaturePad');
const ctx = canvas.getContext('2d');
let drawing = false;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0d9488';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

canvas.addEventListener('mousedown', e => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
canvas.addEventListener('mousemove', e => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseleave', () => drawing = false);

// Touch support
canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
canvas.addEventListener('touchend', () => drawing = false);

document.getElementById('clearSignature').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function getSignatureDataURL() {
  return canvas.toDataURL('image/png');
}

// ──────────────────────────────────────────────
// 6. Invoice preview render
// ──────────────────────────────────────────────
function getFormData() {
  const items = [];
  itemsTableBody.querySelectorAll('tr').forEach(row => {
    items.push({
      desc: row.querySelector('.item-desc')?.value || '',
      qty: parseFloat(row.querySelector('.item-qty')?.value) || 0,
      price: parseFloat(row.querySelector('.item-price')?.value) || 0,
      total: parseFloat(row.querySelector('.item-total')?.textContent) || 0,
    });
  });
  return {
    senderName: document.getElementById('senderName').value,
    senderPhone: document.getElementById('senderPhone').value,
    senderAddress: document.getElementById('senderAddress').value,
    senderTax: document.getElementById('senderTax').value,
    clientName: document.getElementById('clientName').value,
    clientPhone: document.getElementById('clientPhone').value,
    clientAddress: document.getElementById('clientAddress').value,
    clientTax: document.getElementById('clientTax').value,
    invoiceNumber: document.getElementById('invoiceNumber').value,
    invoiceDate: document.getElementById('invoiceDate').value,
    dueDate: document.getElementById('dueDate').value,
    currency: document.getElementById('currency').value,
    items,
    subtotal: document.getElementById('subtotal').textContent,
    taxRate: document.getElementById('taxRate').value,
    taxAmount: document.getElementById('taxAmount').textContent,
    discount: document.getElementById('discount').value,
    grandTotal: document.getElementById('grandTotal').textContent,
    notes: document.getElementById('notes').value,
    signature: getSignatureDataURL(),
    logo: currentLogoBase64
  };
}

function renderPreview() {
  const d = getFormData();
  const cur = d.currency;
  let itemsHTML = d.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="text-align:right">${item.desc}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)} ${cur}</td>
      <td>${item.total.toFixed(2)} ${cur}</td>
    </tr>
  `).join('');

  const notesHTML = d.notes ? `<div class="inv-notes"><strong>ملاحظات:</strong> ${d.notes}</div>` : '';
  const sigHTML = d.signature && d.signature !== 'data:,' ?
    `<div class="inv-signature"><p>التوقيع:</p><img src="${d.signature}" alt="التوقيع" /></div>` : '';
  const logoHTML = d.logo ? `<img src="${d.logo}" style="max-width:80px; margin-bottom:10px; display:block;" alt="Logo" />` : '';

  document.getElementById('invoicePreview').innerHTML = `
    <div class="inv-header">
      <div class="inv-brand">
        ${logoHTML}
        <h2>⚡ ${d.senderName || 'منشئ الفواتير الذكي'}</h2>
        <p>${d.senderAddress || ''}</p>
        <p>${d.senderPhone || ''}</p>
        ${d.senderTax ? '<p>الرقم الضريبي: ' + d.senderTax + '</p>' : ''}
      </div>
      <div class="inv-meta">
        <p><strong>فاتورة رقم:</strong> ${d.invoiceNumber}</p>
        <p><strong>التاريخ:</strong> ${d.invoiceDate}</p>
        ${d.dueDate ? '<p><strong>الاستحقاق:</strong> ' + d.dueDate + '</p>' : ''}
      </div>
    </div>
    <div class="inv-parties">
      <div class="inv-party">
        <h4>المُرسِل</h4>
        <p><strong>${d.senderName}</strong></p>
        <p>${d.senderAddress}</p>
        <p>${d.senderPhone}</p>
      </div>
      <div class="inv-party">
        <h4>العميل</h4>
        <p><strong>${d.clientName}</strong></p>
        <p>${d.clientAddress}</p>
        <p>${d.clientPhone}</p>
        ${d.clientTax ? '<p>الرقم الضريبي: ' + d.clientTax + '</p>' : ''}
      </div>
    </div>
    <table class="inv-items-table">
      <thead><tr><th>#</th><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div class="inv-totals">
      <div class="inv-totals-box">
        <div class="inv-totals-row"><span>المجموع الفرعي</span><span>${d.subtotal} ${cur}</span></div>
        <div class="inv-totals-row"><span>الضريبة (${d.taxRate}%)</span><span>${d.taxAmount} ${cur}</span></div>
        ${parseFloat(d.discount) > 0 ? '<div class="inv-totals-row"><span>الخصم</span><span>-' + parseFloat(d.discount).toFixed(2) + ' ' + cur + '</span></div>' : ''}
        <div class="inv-totals-row grand"><span>الإجمالي</span><span>${d.grandTotal} ${cur}</span></div>
      </div>
    </div>
    ${notesHTML}
    ${sigHTML}
  `;
}

// ──────────────────────────────────────────────
// 7. localStorage for invoice history
// ──────────────────────────────────────────────
const STORAGE_KEY = 'smartInvoiceBuilder:invoices';

function loadInvoices() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveInvoices(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ──────────────────────────────────────────────
// 8. Save invoice (form submit)
// ──────────────────────────────────────────────
const form = document.getElementById('invoiceForm');
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = getFormData();
  if (!data.clientName || !data.invoiceDate) {
    alert('يرجى ملء بيانات العميل وتاريخ الفاتورة على الأقل.');
    switchTab('info');
    return;
  }
  const invoices = loadInvoices();
  invoices.unshift(data);
  saveInvoices(invoices);
  renderHistory();
  updateCounter();

  alert('✅ تم حفظ الفاتورة بنجاح!');

  // Reset
  form.reset();
  itemsTableBody.innerHTML = '';
  itemsTableBody.appendChild(createItemRow());
  bindItemEvents();
  calcTotals();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('invoiceNumber').value = generateInvoiceNumber();
  document.getElementById('invoiceDate').valueAsDate = new Date();
  switchTab('info');
});

// ──────────────────────────────────────────────
// 9. History table rendering
// ──────────────────────────────────────────────
const historyBody = document.querySelector('#historyTable tbody');
const emptyMsg = document.getElementById('emptyMsg');

function renderHistory() {
  const invoices = loadInvoices();
  historyBody.innerHTML = '';
  if (invoices.length === 0) {
    emptyMsg.style.display = 'block';
    document.querySelector('.history-table-wrapper').style.display = 'none';
    return;
  }
  emptyMsg.style.display = 'none';
  document.querySelector('.history-table-wrapper').style.display = 'block';

  invoices.forEach((inv, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${inv.invoiceNumber}</td>
      <td>${inv.clientName}</td>
      <td>${inv.invoiceDate}</td>
      <td>${inv.grandTotal} ${inv.currency}</td>
      <td>
        <button class="btn-view" data-idx="${idx}">عرض</button>
        <button class="btn-delete" data-idx="${idx}">حذف</button>
      </td>
    `;
    historyBody.appendChild(tr);
  });
}

historyBody.addEventListener('click', e => {
  const idx = parseInt(e.target.dataset.idx);
  const invoices = loadInvoices();
  if (e.target.classList.contains('btn-view')) {
    // Populate preview with saved invoice
    const inv = invoices[idx];
    document.getElementById('invoicePreview').innerHTML = buildSavedPreview(inv);
    switchTab('preview');
    document.getElementById('create').scrollIntoView({ behavior: 'smooth' });
  }
  if (e.target.classList.contains('btn-delete')) {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      invoices.splice(idx, 1);
      saveInvoices(invoices);
      renderHistory();
      updateCounter();
    }
  }
});

function buildSavedPreview(d) {
  const cur = d.currency || 'ج.م';
  let itemsHTML = (d.items || []).map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="text-align:right">${item.desc}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)} ${cur}</td>
      <td>${item.total.toFixed(2)} ${cur}</td>
    </tr>
  `).join('');
  const notesHTML = d.notes ? `<div class="inv-notes"><strong>ملاحظات:</strong> ${d.notes}</div>` : '';
  const sigHTML = d.signature && d.signature !== 'data:,' ?
    `<div class="inv-signature"><p>التوقيع:</p><img src="${d.signature}" alt="التوقيع" /></div>` : '';

  return `
    <div class="inv-preview-wrapper ${d.templateType || 'modern'}" style="--theme-color: ${d.themeColor || '#2563eb'}">
    <div class="inv-header">
      <div class="inv-brand">
        <h2>⚡ ${d.senderName || 'منشئ الفواتير الذكي'}</h2>
        <p>${d.senderAddress || ''}</p>
        <p>${d.senderPhone || ''}</p>
        ${d.senderTax ? '<p>الرقم الضريبي: ' + d.senderTax + '</p>' : ''}
      </div>
      <div class="inv-meta">
        <p><strong>فاتورة رقم:</strong> ${d.invoiceNumber}</p>
        <p><strong>التاريخ:</strong> ${d.invoiceDate}</p>
        ${d.dueDate ? '<p><strong>الاستحقاق:</strong> ' + d.dueDate + '</p>' : ''}
      </div>
    </div>
    <div class="inv-parties">
      <div class="inv-party"><h4>المُرسِل</h4><p><strong>${d.senderName}</strong></p><p>${d.senderAddress}</p><p>${d.senderPhone}</p></div>
      <div class="inv-party"><h4>العميل</h4><p><strong>${d.clientName}</strong></p><p>${d.clientAddress}</p><p>${d.clientPhone}</p>${d.clientTax ? '<p>الرقم الضريبي: ' + d.clientTax + '</p>' : ''}</div>
    </div>
    <table class="inv-items-table">
      <thead><tr><th>#</th><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div class="inv-totals"><div class="inv-totals-box">
      <div class="inv-totals-row"><span>المجموع الفرعي</span><span>${d.subtotal} ${cur}</span></div>
      <div class="inv-totals-row"><span>الضريبة (${d.taxRate}%)</span><span>${d.taxAmount} ${cur}</span></div>
      ${parseFloat(d.discount) > 0 ? '<div class="inv-totals-row"><span>الخصم</span><span>-' + parseFloat(d.discount).toFixed(2) + ' ' + cur + '</span></div>' : ''}
      <div class="inv-totals-row grand"><span>الإجمالي</span><span>${d.grandTotal} ${cur}</span></div>
    </div></div>
    ${notesHTML}
    ${sigHTML}
    </div>
  `;
}

// ──────────────────────────────────────────────
// 10. Counter in hero
// ──────────────────────────────────────────────
function updateCounter() {
  document.getElementById('totalCount').textContent = loadInvoices().length;
}

// ──────────────────────────────────────────────
// 11. Print
// ──────────────────────────────────────────────
document.getElementById('printInvoice').addEventListener('click', () => {
  renderPreview();
  setTimeout(() => window.print(), 300);
});

// ──────────────────────────────────────────────
// 12. Init on load
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  updateCounter();
  loadUserData(); // Load clients, products, profile
});

// ──────────────────────────────────────────────
// 13. Settings Modal Logic
// ──────────────────────────────────────────────
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

if(openSettingsBtn) openSettingsBtn.addEventListener('click', (e) => { e.preventDefault(); settingsModal.style.display = 'block'; });
if(closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; });

// Settings Tabs
document.querySelectorAll('.s-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.s-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.s-tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('stab-' + tab.dataset.stab).classList.add('active');
    });
});

// Appearance Form Listeners
const appForm = document.getElementById('appearanceForm');
if(appForm) {
    appForm.addEventListener('input', () => renderPreview());
}

// Profile Form Submit
const profileForm = document.getElementById('profileForm');
if(profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            companyName: document.getElementById('profName').value,
            companyPhone: document.getElementById('profPhone').value,
            companyAddress: document.getElementById('profAddress').value,
            companyTaxNumber: document.getElementById('profTax').value
        };
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if(data.success) {
                alert('تم حفظ بيانات الشركة بنجاح');
                loadUserData();
            }
        } catch(err) { console.error(err); }
    });
}

// Add Client Form Submit
const addClientForm = document.getElementById('addClientForm');
if(addClientForm) {
    addClientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            clientName: document.getElementById('newClientName').value,
            clientPhone: document.getElementById('newClientPhone').value
        };
        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if(data.success) {
                alert('تم إضافة العميل بنجاح');
                addClientForm.reset();
                loadUserData();
            }
        } catch(err) { console.error(err); }
    });
}

// Add Product Form Submit
const addProductForm = document.getElementById('addProductForm');
if(addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById('newProdName').value,
            price: document.getElementById('newProdPrice').value
        };
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if(data.success) {
                alert('تم إضافة المنتج بنجاح');
                addProductForm.reset();
                loadUserData();
            }
        } catch(err) { console.error(err); }
    });
}

