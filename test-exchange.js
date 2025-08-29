const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Testing Microsoft Exchange Server Connection');
console.log('='.repeat(50));
console.log('Server:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USERNAME);
console.log('='.repeat(50));

async function testExchangeConfigurations() {
  const configurations = [
    {
      name: 'Exchange with NTLM auth',
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          type: 'NTLM',
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
          domain: 'reportrack.com',
          workstation: 'WORKSTATION'
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        debug: true,
        logger: true
      }
    },
    {
      name: 'Exchange with LOGIN auth (standard)',
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        },
        debug: true,
        logger: true
      }
    },
    {
      name: 'Exchange with requireTLS',
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false,
          servername: 'west.exch091.serverdata.net'
        },
        debug: true,
        logger: true
      }
    },
    {
      name: 'Exchange on port 25 (if available)',
      config: {
        host: process.env.SMTP_HOST,
        port: 25,
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        },
        debug: true,
        logger: true
      }
    },
    {
      name: 'Exchange with connection timeout settings',
      config: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD
        },
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false
        },
        debug: true,
        logger: true
      }
    }
  ];

  for (const test of configurations) {
    console.log(`\n\nTesting: ${test.name}`);
    console.log('-'.repeat(50));
    
    const transporter = nodemailer.createTransport(test.config);
    
    try {
      // First verify the connection
      console.log('Verifying connection...');
      await transporter.verify();
      console.log('✅ Connection verified!');
      
      // Now try to send an email
      console.log('\nSending test email...');
      const info = await transporter.sendMail({
        from: process.env.SMTP_USERNAME,
        to: process.env.SMTP_USERNAME, // Send to self
        subject: `Test from Nodemailer - ${test.name}`,
        text: `This is a test email using configuration: ${test.name}`,
        html: `<p>This is a test email using configuration: <strong>${test.name}</strong></p>`
      });
      
      console.log('✅ SUCCESS! Email sent');
      console.log('Message ID:', info.messageId);
      console.log('Accepted:', info.accepted);
      console.log('\n🎉 WORKING CONFIGURATION FOUND!');
      console.log('Use this in your plugins.js:');
      console.log(JSON.stringify(test.config, null, 2));
      
      transporter.close();
      return; // Stop testing once we find a working config
      
    } catch (error) {
      console.log('❌ Failed:', error.message);
      if (error.code) console.log('Error code:', error.code);
      if (error.responseCode) console.log('Response code:', error.responseCode);
      transporter.close();
    }
  }
  
  console.log('\n\n❌ No working configuration found.');
  console.log('The issue might be:');
  console.log('1. Network/firewall blocking connections');
  console.log('2. Exchange server requires specific authentication method');
  console.log('3. Rate limiting on the server');
  console.log('4. Incorrect credentials');
}

// Run the test
testExchangeConfigurations().catch(console.error);