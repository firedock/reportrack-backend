// Test email configuration within Strapi context
// Run this with: node test-strapi-email.js

require('dotenv').config();

// Mock the Strapi email plugin structure
const nodemailer = require('nodemailer');

// Use the exact configuration from plugins.js
const emailConfig = {
  host: process.env.SMTP_HOST || 'west.exch091.serverdata.net',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SMTP_USERNAME || 'noreply@reportrack.com',
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates
    ciphers: 'HIGH:!aNULL' // Use high-strength ciphers
  },
  // Connection pooling to reuse connections
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  // Timeouts
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000,
  socketTimeout: 30000,
};

async function testEmailInStrapiContext() {
  console.log('Testing Strapi email configuration with pooling...\n');
  console.log('Configuration:', JSON.stringify({...emailConfig, auth: {user: emailConfig.auth.user, pass: '***'}}, null, 2));
  
  const transporter = nodemailer.createTransport(emailConfig);
  
  try {
    // Test 1: Verify connection
    console.log('\n1. Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified!');
    
    // Test 2: Send single email
    console.log('\n2. Sending single email...');
    const result1 = await transporter.sendMail({
      from: 'noreply@reportrack.com',
      to: 'noreply@reportrack.com',
      subject: 'Test 1 - Single Email',
      text: 'This is a test of the Strapi email configuration.',
      html: '<p>This is a test of the Strapi email configuration.</p>'
    });
    console.log('✅ Email 1 sent:', result1.messageId);
    
    // Test 3: Send multiple emails (simulating alarm notifications)
    console.log('\n3. Sending multiple emails (simulating alarm notifications)...');
    const emails = [
      { to: 'noreply@reportrack.com', subject: 'Test 2 - Alarm Notification 1' },
      { to: 'noreply@reportrack.com', subject: 'Test 3 - Alarm Notification 2' },
      { to: 'noreply@reportrack.com', subject: 'Test 4 - Alarm Notification 3' },
    ];
    
    for (const [index, email] of emails.entries()) {
      const result = await transporter.sendMail({
        from: 'noreply@reportrack.com',
        to: email.to,
        subject: email.subject,
        text: `Alarm notification ${index + 1}`,
        html: `<p>Alarm notification ${index + 1}</p>`
      });
      console.log(`✅ Email ${index + 2} sent:`, result.messageId);
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 SUCCESS! All emails sent using pool configuration.');
    console.log('This configuration should work in Strapi.');
    
    // Close the pool
    transporter.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) console.log('Error code:', error.code);
    if (error.command) console.log('Command:', error.command);
    transporter.close();
  }
}

testEmailInStrapiContext().catch(console.error);