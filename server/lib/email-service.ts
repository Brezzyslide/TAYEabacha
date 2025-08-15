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
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}" class="cta-button">
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
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}" class="cta-button">
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

// Password reset email template
export function getPasswordResetEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  newPassword: string
): { subject: string; html: string } {
  return {
    subject: `NeedsCareAI+ Password Reset - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #2B4B73, #B8944D); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .password-box { background: #fff; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0; border-radius: 5px; }
          .cta-button { display: inline-block; background: #2B4B73; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
          .security-alert { background: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NeedsCareAI+</div>
          <p>Built with Positive Behaviour in Mind</p>
        </div>
        
        <div class="content">
          <h2>🔐 Password Reset Notification</h2>
          
          <p>Hello <strong>${userName}</strong>,</p>
          
          <p>Your password for the NeedsCareAI+ platform has been reset by an administrator at <strong>${companyName}</strong>.</p>
          
          <div class="password-box">
            <h3>🔑 Your New Login Credentials</h3>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>New Password:</strong> <code>${newPassword}</code></p>
          </div>
          
          <div class="security-alert">
            <strong>🛡️ Important Security Notice:</strong><br>
            Please change this password immediately after logging in for your security. This temporary password should only be used for your next login.
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}" class="cta-button">
              Login to Your Account
            </a>
          </div>
          
          <h3>🛡️ Security Steps</h3>
          <ol>
            <li>Login with your new password</li>
            <li>Go to your profile settings</li>
            <li>Change to a secure password of your choice</li>
            <li>Never share your login credentials</li>
          </ol>
          
          <p><strong>If you did not request this password reset,</strong> please contact your system administrator immediately.</p>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Empowering healthcare providers with intelligent workforce management</p>
          <p>This password reset notification was sent to ${userEmail} for ${companyName}</p>
          <p>If you have questions, contact your system administrator or email ${process.env.GMAIL_EMAIL}</p>
        </div>
      </body>
      </html>
    `
  };
}

// Send password reset email
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  newPassword: string
): Promise<boolean> {
  const emailContent = getPasswordResetEmail(userEmail, userName, companyName, newPassword);
  return await sendEmail({
    to: userEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });
}

// Incident report notification email template
export function getIncidentReportEmail(
  adminEmails: string[],
  incidentId: string,
  clientName: string,
  reporterName: string,
  incidentType: string[],
  severity: string,
  companyName: string,
  isNDISReportable: boolean
): { subject: string; html: string } {
  return {
    subject: `🚨 URGENT: New Incident Report ${incidentId} - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #dc3545, #721c24); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .incident-box { background: #fff; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0; border-radius: 5px; }
          .cta-button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
          .urgent-alert { background: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545; }
          .ndis-alert { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🚨 NeedsCareAI+ Alert</div>
          <p>Incident Report Notification</p>
        </div>
        
        <div class="content">
          <div class="urgent-alert">
            <strong>⚠️ URGENT NOTIFICATION:</strong><br>
            A new incident report has been filed and requires immediate attention.
          </div>
          
          <h2>Incident Report Details</h2>
          
          <div class="incident-box">
            <h3>📋 Incident Summary</h3>
            <p><strong>Incident ID:</strong> ${incidentId}</p>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Reported by:</strong> ${reporterName}</p>
            <p><strong>Incident Type:</strong> ${incidentType.join(', ')}</p>
            <p><strong>Severity:</strong> ${severity}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('en-AU')}</p>
          </div>
          
          ${isNDISReportable ? `
          <div class="ndis-alert">
            <strong>🔴 NDIS REPORTABLE INCIDENT:</strong><br>
            This incident has been marked as NDIS reportable and requires immediate escalation and documentation according to NDIS reporting requirements.
          </div>
          ` : ''}
          
          <h3>📝 Required Actions</h3>
          <ul>
            <li><strong>Review incident details</strong> in the platform immediately</li>
            <li><strong>Contact the reporting staff member</strong> for additional details if needed</li>
            <li><strong>Follow up with the client</strong> and ensure appropriate care</li>
            ${isNDISReportable ? '<li><strong>Submit NDIS report</strong> within required timeframes</li>' : ''}
            <li><strong>Document follow-up actions</strong> and closure when appropriate</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}/incident-management" class="cta-button">
              View Incident Report
            </a>
          </div>
          
          <h3>📞 Emergency Contact</h3>
          <p>If this incident requires immediate emergency response, follow your organization's emergency procedures and contact emergency services if necessary.</p>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Incident Management System</p>
          <p>This urgent notification was sent to administrators for ${companyName}</p>
          <p>Do not reply to this email. Login to the platform to manage the incident.</p>
        </div>
      </body>
      </html>
    `
  };
}

// Send incident report notification email
export async function sendIncidentReportNotification(
  adminEmails: string[],
  incidentId: string,
  clientName: string,
  reporterName: string,
  incidentType: string[],
  severity: string,
  companyName: string,
  isNDISReportable: boolean = false
): Promise<boolean> {
  if (!adminEmails || adminEmails.length === 0) {
    console.log('[EMAIL] No admin emails provided for incident notification');
    return false;
  }

  const emailContent = getIncidentReportEmail(
    adminEmails,
    incidentId,
    clientName,
    reporterName,
    incidentType,
    severity,
    companyName,
    isNDISReportable
  );
  
  // Send to all admin emails
  const emailPromises = adminEmails.map(email => 
    sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html
    })
  );
  
  try {
    const results = await Promise.all(emailPromises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('[EMAIL] Failed to send incident notifications:', error);
    return false;
  }
}

// Shift assignment notification email template
export function getShiftAssignmentEmail(
  staffEmail: string,
  staffName: string,
  clientName: string,
  shiftDate: string,
  shiftTime: string,
  location: string,
  companyName: string
): { subject: string; html: string } {
  return {
    subject: `📅 New Shift Assignment - ${shiftDate} - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #2B4B73, #B8944D); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .shift-box { background: #fff; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 5px; }
          .cta-button { display: inline-block; background: #2B4B73; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NeedsCareAI+</div>
          <p>Shift Assignment Notification</p>
        </div>
        
        <div class="content">
          <h2>📅 New Shift Assignment</h2>
          
          <p>Hello <strong>${staffName}</strong>,</p>
          
          <p>You have been assigned a new shift. Please review the details below and confirm your availability.</p>
          
          <div class="shift-box">
            <h3>📋 Shift Details</h3>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Date:</strong> ${shiftDate}</p>
            <p><strong>Time:</strong> ${shiftTime}</p>
            <p><strong>Location:</strong> ${location}</p>
          </div>
          
          <h3>📝 Next Steps</h3>
          <ul>
            <li><strong>Login to the platform</strong> to view full shift details</li>
            <li><strong>Review client care plan</strong> and special requirements</li>
            <li><strong>Contact your supervisor</strong> if you have any questions</li>
            <li><strong>Use GPS check-in/out</strong> when arriving and leaving</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}/shift-management" class="cta-button">
              View My Shifts
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Shift Management System</p>
          <p>This notification was sent to ${staffEmail} for ${companyName}</p>
        </div>
      </body>
      </html>
    `
  };
}

// Send shift assignment notification
export async function sendShiftAssignmentNotification(
  staffEmail: string,
  staffName: string,
  clientName: string,
  shiftDate: string,
  shiftTime: string,
  location: string,
  companyName: string
): Promise<boolean> {
  if (!staffEmail) {
    console.log('[EMAIL] No staff email provided for shift assignment notification');
    return false;
  }

  const emailContent = getShiftAssignmentEmail(
    staffEmail,
    staffName,
    clientName,
    shiftDate,
    shiftTime,
    location,
    companyName
  );
  
  return await sendEmail({
    to: staffEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });
}

// Client creation notification email template
export function getClientCreationEmail(
  adminEmails: string[],
  clientName: string,
  createdBy: string,
  companyName: string
): { subject: string; html: string } {
  return {
    subject: `👤 New Client Added - ${clientName} - ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #2B4B73, #B8944D); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .client-box { background: #fff; padding: 20px; border-left: 4px solid #17a2b8; margin: 20px 0; border-radius: 5px; }
          .cta-button { display: inline-block; background: #2B4B73; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #e9e9e9; }
          .logo { font-size: 24px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NeedsCareAI+</div>
          <p>Client Management Notification</p>
        </div>
        
        <div class="content">
          <h2>👤 New Client Added</h2>
          
          <p>A new client has been added to the system and requires setup.</p>
          
          <div class="client-box">
            <h3>📋 Client Information</h3>
            <p><strong>Client Name:</strong> ${clientName}</p>
            <p><strong>Added by:</strong> ${createdBy}</p>
            <p><strong>Date Added:</strong> ${new Date().toLocaleString('en-AU')}</p>
          </div>
          
          <h3>📝 Required Setup Actions</h3>
          <ul>
            <li><strong>Review client profile</strong> and complete any missing information</li>
            <li><strong>Set up care support plan</strong> and assessment schedules</li>
            <li><strong>Create NDIS budget</strong> and funding allocations</li>
            <li><strong>Assign staff members</strong> and schedule initial shifts</li>
            <li><strong>Configure medication plans</strong> if required</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_BASE_URL || 'https://localhost:5000'}/support-work/clients" class="cta-button">
              View Client Directory
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>NeedsCareAI+</strong> - Client Management System</p>
          <p>This notification was sent to administrators for ${companyName}</p>
        </div>
      </body>
      </html>
    `
  };
}

// Send client creation notification
export async function sendClientCreationNotification(
  adminEmails: string[],
  clientName: string,
  createdBy: string,
  companyName: string
): Promise<boolean> {
  if (!adminEmails || adminEmails.length === 0) {
    console.log('[EMAIL] No admin emails provided for client creation notification');
    return false;
  }

  const emailContent = getClientCreationEmail(adminEmails, clientName, createdBy, companyName);
  
  // Send to all admin emails
  const emailPromises = adminEmails.map(email => 
    sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html
    })
  );
  
  try {
    const results = await Promise.all(emailPromises);
    return results.every(result => result === true);
  } catch (error) {
    console.error('[EMAIL] Failed to send client creation notifications:', error);
    return false;
  }
}