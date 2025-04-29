module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'west.exch091.serverdata.net'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USERNAME', 'noreply@reportrack.com'),
          pass: env('SMTP_PASSWORD'),
        },
        tls: { ciphers: 'SSLv3' }, // Add TLS configuration
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
