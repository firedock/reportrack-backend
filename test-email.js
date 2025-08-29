const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailConnection() {
  console.log('Testing email configuration...\n');
  console.log('SMTP Settings:');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('Username:', process.env.SMTP_USERNAME);
  console.log('-------------------\n');

  // Test different TLS configurations
  const configurations = [
    {
      name: 'Current config (TLS 1.2, rejectUnauthorized: false)',
      options: {
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
        logger: true,
        debug: true
      }
    },
    {
      name: 'STARTTLS (port 587)',
      options: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        },
        logger: true,
        debug: true
      }
    },
    {
      name: 'Ignore TLS',
      options: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        ignoreTLS: true,
        logger: true,
        debug: true
      }
    },
    {
      name: 'Basic (no explicit TLS config)',
      options: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        logger: true,
        debug: true
      }
    }
  ];

  for (const config of configurations) {
    console.log(`\nTesting: ${config.name}`);
    console.log('='.repeat(50));
    
    try {
      const transporter = nodemailer.createTransport(config.options);
      
      // Verify connection
      console.log('Verifying connection...');
      await transporter.verify();
      console.log('✅ Connection successful!');
      
      // Try sending a test email
      console.log('Sending test email...');
      const info = await transporter.sendMail({
        from: process.env.SMTP_USERNAME,
        to: 'test@example.com', // This won't actually send since we're just testing
        subject: 'Test Email - Connection Successful',
        text: 'This is a test email to verify SMTP configuration.',
        html: '<p>This is a test email to verify SMTP configuration.</p>'
      });
      
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', info.messageId);
      
      // Close the connection
      transporter.close();
      
      console.log('\n🎉 SUCCESS! Use this configuration in your plugins.js file.');
      break; // Stop testing once we find a working config
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
      if (error.code) console.log('Error code:', error.code);
      if (error.command) console.log('Command:', error.command);
    }
  }
}

// Run the test
testEmailConnection().catch(console.error);