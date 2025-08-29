module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'west.exch091.serverdata.net'),
        port: env.int('SMTP_PORT', 587),
        secure: false, // Use STARTTLS
        auth: {
          user: env('SMTP_USERNAME', 'noreply@reportrack.com'),
          pass: env('SMTP_PASSWORD'),
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
      },
      settings: {
        defaultFrom: 'noreply@reportrack.com',
        defaultReplyTo: 'noreply@reportrack.com',
      },
    },
  },
  upload: {
    config: {
      provider: '@strapi/provider-upload-aws-s3',
      providerOptions: {
        accessKeyId: env('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env('AWS_ACCESS_SECRET'),
        region: env('AWS_REGION'),
        baseUrl: `https://${env('AWS_BUCKET_NAME')}.s3.${env(
          'AWS_REGION'
        )}.amazonaws.com`, // ✅ Add this!
        params: {
          Bucket: env('AWS_BUCKET_NAME'),
        },
      },
    },
  },
});
