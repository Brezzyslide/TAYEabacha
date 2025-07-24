import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Load environment from .env.local
const localEnvPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  const envFile = fs.readFileSync(localEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
  console.log('Loaded local environment variables');
}

console.log('Testing Gmail credentials:');
console.log('GMAIL_EMAIL:', process.env.GMAIL_EMAIL);
console.log('GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD?.length || 0);

if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
  console.error('Missing Gmail credentials');
  process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

console.log('Testing transporter connection...');

transporter.verify()
  .then(() => {
    console.log('✅ Gmail connection successful!');
    
    // Send test email
    return transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: 'admin@needscare.io',
      subject: 'Gmail Test - Connection Successful',
      html: `
        <h2>Gmail Connection Test</h2>
        <p>This email confirms that Gmail SMTP authentication is working correctly.</p>
        <p><strong>From:</strong> ${process.env.GMAIL_EMAIL}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      `
    });
  })
  .then((info) => {
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Gmail connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Response code:', error.responseCode);
    process.exit(1);
  });