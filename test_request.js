const http = require('http');

const data = JSON.stringify({
    companyName: "Test Company",
    items: [
        {name: "Item 1", desc: "Desc 1", price: "10", quantity: "1"}
    ]
});

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const body = `--${boundary}\r\n` +
             `Content-Disposition: form-data; name="data"\r\n\r\n` +
             `${JSON.stringify({ companyName: "Test Company", items: [{name: "Item 1", desc: "Desc 1", price: "10", quantity: "1"}] })}\r\n` +
             `--${boundary}--\r\n`;

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/generate-pdf',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
    }
};

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', responseData);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(body);
req.end();