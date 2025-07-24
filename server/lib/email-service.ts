import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Load environment from .env.local if available (for runtime initialization)
const loadLocalEnv = () => {
  const localEnvPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    const envFile = fs.readFileSync(localEnvPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !process.env[key.trim()]) {
        process.env[key.trim()] = value.trim();
      }
    });
    console.log('[EMAIL] Loaded environment from .env.local');
  }
};

// Ensure environment is loaded
loadLocalEnv();

// Gmail SMTP configuration with detailed debugging
let transporter: any;

// Create transporter function for lazy initialization
const getTransporter = () => {
  if (!transporter) {
    console.log('[EMAIL] ====== Gmail Configuration Debug ======');
    console.log('[EMAIL] GMAIL_EMAIL:', process.env.GMAIL_EMAIL);
    console.log('[EMAIL] GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD?.length || 0);
    console.log('[EMAIL] GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);

    if (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_EMAIL,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      
      console.log('[EMAIL] Gmail transporter created with service: gmail');
      
      // Test connection
      transporter.verify((error: any, success: any) => {
        if (error) {
          console.error('[EMAIL] ❌ Gmail verification failed:', error.message);
          console.error('[EMAIL] Error code:', error.code);
          console.error('[EMAIL] Response code:', error.responseCode);
        } else {
          console.log('[EMAIL] ✅ Gmail SMTP verified successfully');
        }
      });
    } else {
      console.log('[EMAIL] ❌ Gmail credentials missing');
      throw new Error('Gmail credentials not configured');
    }
  }
  return transporter;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: `"NeedsCareAI+ Platform" <${process.env.GMAIL_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    console.log('[EMAIL] Sending email to:', options.to);
    console.log('[EMAIL] Subject:', options.subject);
    
    const result = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] ✅ Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send email:', error);
    return false;
  }
}

// Company welcome email template
export function getCompanyWelcomeEmail(companyName: string, adminEmail: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to NeedsCareAI+ - Your Healthcare Management Platform',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #2B4B73, #B8944D); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .cta-button { display: inline-block; background: #2B4B73; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NeedsCareAI+</div>
          <p>Built with Positive Behaviour in Mind</p>
        </div>
        
        <div class="content">
          <h2>Welcome to NeedsCareAI+, ${companyName}!</h2>
          
          <p>Congratulations! Your organization has successfully joined the NeedsCareAI+ platform - the leading healthcare management solution designed specifically for NDIS providers and care organizations.</p>
          
          <h3>🚀 What's Next?</h3>
          <ul>
            <li><strong>Login to your dashboard</strong> using your admin credentials</li>
            <li><strong>Add your staff members</strong> and assign appropriate roles</li>
            <li><strong>Set up your first clients</strong> and begin care planning</li>
            <li><strong>Explore modules:</strong> Care Plans, Shift Management, Medication Tracking, and more</li>
          </ul>
          
          <h3>🎯 Key Features Available:</h3>
          <ul>
            <li>Comprehensive Care Support Plan Management</li>
            <li>GPS-Verified Shift Tracking</li>
            <li>Medication Administration Records</li>
            <li>NDIS Budget Management</li>
            <li>Incident Reporting & Case Notes</li>
            <li>Staff Hour Allocation & Timesheets</li>
            <li>Multi-tenant Security & Compliance</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://your-platform.replit.app'}" class="cta-button">
              Access Your Platform
            </a>
          </div>
          
          <h3>📞 Need Help?</h3>
          <p>Our support team is here to help you get started. Contact us at:</p>
          <ul>
            <li>Email: ${process.env.GMAIL_EMAIL}</li>
            <li>Platform: Built-in messaging system</li>
          </ul>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Empowering healthcare providers with intelligent workforce management</p>
          <p>This email was sent to ${adminEmail} as the administrator for ${companyName}</p>
        </div>
      </body>
      </html>
    `
  };
}

// New user welcome email template
export function getUserWelcomeEmail(
  userEmail: string, 
  companyName: string, 
  temporaryPassword: string,
  role: string
): { subject: string; html: string } {
  return {
    subject: `Welcome to NeedsCareAI+ - Your ${companyName} Account`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #2B4B73, #B8944D); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .credentials { background: #fff; padding: 20px; border-left: 4px solid #2B4B73; margin: 20px 0; }
          .cta-button { display: inline-block; background: #2B4B73; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
          .security-note { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NeedsCareAI+</div>
          <p>Built with Positive Behaviour in Mind</p>
        </div>
        
        <div class="content">
          <h2>Welcome to ${companyName}!</h2>
          
          <p>Your account has been created on the NeedsCareAI+ platform. You now have access to our comprehensive healthcare management system as a <strong>${role}</strong>.</p>
          
          <div class="credentials">
            <h3>🔐 Your Login Credentials</h3>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Temporary Password:</strong> <code>${temporaryPassword}</code></p>
            <p><strong>Role:</strong> ${role}</p>
          </div>
          
          <div class="security-note">
            <strong>⚠️ Important Security Notice:</strong><br>
            Please change your password immediately after your first login for security purposes.
          </div>
          
          <h3>🎯 Your Access Includes:</h3>
          <ul>
            <li>Client management and care planning</li>
            <li>Shift management and GPS tracking</li>
            <li>Medication administration records</li>
            <li>Case notes and observations</li>
            <li>Internal messaging system</li>
            <li>Professional PDF exports</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://your-platform.replit.app'}" class="cta-button">
              Login to Your Account
            </a>
          </div>
          
          <h3>📚 Getting Started</h3>
          <ol>
            <li>Click the login button above</li>
            <li>Enter your credentials</li>
            <li>Change your password</li>
            <li>Explore your dashboard</li>
            <li>Contact your administrator for role-specific training</li>
          </ol>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Empowering healthcare providers with intelligent workforce management</p>
          <p>This email was sent to ${userEmail} for ${companyName}</p>
          <p>If you have questions, contact your system administrator or email ${process.env.GMAIL_EMAIL}</p>
        </div>
      </body>
      </html>
    `
  };
}

// Send company welcome email
export async function sendCompanyWelcomeEmail(companyName: string, adminEmail: string): Promise<boolean> {
  const emailContent = getCompanyWelcomeEmail(companyName, adminEmail);
  return await sendEmail({
    to: adminEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });
}

// Send user welcome email
export async function sendUserWelcomeEmail(
  userEmail: string,
  companyName: string,
  temporaryPassword: string,
  role: string
): Promise<boolean> {
  const emailContent = getUserWelcomeEmail(userEmail, companyName, temporaryPassword, role);
  return await sendEmail({
    to: userEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });
}