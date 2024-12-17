module.exports = ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'west.exch091.serverdata.net'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USERNAME', 'noreply@reportrack.com'),
          pass: env('SMTP_PASSWORD', '$sfuciNuXM9Kk4v!'),
        },
        tls: { ciphers: 'SSLv3' }, // Add TLS configuration
      },
      settings: {
        defaultFrom: 'noreply@reportrack.com',
        defaultReplyTo: 'noreply@reportrack.com',
      },
    },
  },
});
