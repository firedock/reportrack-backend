const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailWithPool() {
  console.log('Testing email with connection pooling...\n');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
    // Connection pooling settings
    pool: true,
    maxConnections: 1,
    maxMessages: 1,
    rateDelta: 3000, // Rate limit (3 seconds between messages)
    rateLimit: 1, // Max 1 message per rateDelta
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    logger: true,
    debug: true
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified!\n');
    
    console.log('Waiting 2 seconds before sending...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USERNAME,
      to: process.env.SMTP_USERNAME, // Send to self for testing
      subject: 'Test Email - Nodemailer Pool',
      text: 'This is a test email using connection pooling.',
      html: '<p>This is a test email using connection pooling.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
    // Close the pool
    transporter.close();
    console.log('\n🎉 SUCCESS! Pool configuration works.');
    
  } catch (error) {
    console.log('❌ Failed:', error.message);
    if (error.code) console.log('Error code:', error.code);
    if (error.response) console.log('Response:', error.response);
    transporter.close();
  }
}

// Also test without pool but with single connection reuse
async function testEmailSingleConnection() {
  console.log('\n\nTesting with single connection (no pool)...\n');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 10000,      // 10 seconds
    logger: false,
    debug: false
  });

  try {
    console.log('Sending test email (no verification first)...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USERNAME,
      to: process.env.SMTP_USERNAME,
      subject: 'Test Email - Direct Send',
      text: 'Testing direct send without verify.',
      html: '<p>Testing direct send without verify.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Accepted:', info.accepted);
    
  } catch (error) {
    console.log('❌ Failed:', error.message);
    if (error.code) console.log('Error code:', error.code);
  }
}

// Run tests
async function runTests() {
  await testEmailWithPool();
  await testEmailSingleConnection();
}

runTests().catch(console.error);