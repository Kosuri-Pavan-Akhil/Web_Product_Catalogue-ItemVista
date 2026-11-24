import nodemailer from 'nodemailer';

export interface EnquiryMessage {
  subject: string;
  text: string;
  replyTo: string;
}

export type SendEnquiryMail = (message: EnquiryMessage) => Promise<void>;

export function createSmtpMailer(env: NodeJS.ProcessEnv = process.env): SendEnquiryMail {
  const host = env.SMTP_HOST || '127.0.0.1';
  const port = Number(env.SMTP_PORT || 1025);
  const secure = env.SMTP_SECURE === 'true';
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) {
    throw new Error('SMTP_SECURE must be true or false');
  }

  const tlsOverride = env.SMTP_REQUIRE_TLS;
  if (tlsOverride !== undefined && tlsOverride !== 'true' && tlsOverride !== 'false') {
    throw new Error('SMTP_REQUIRE_TLS must be true or false');
  }

  // Keep TLS on for remote providers. Compose opts out for its unauthenticated Mailpit service.
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && (Boolean(user) || (tlsOverride === undefined ? !local : tlsOverride === 'true')),
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  const from = env.ENQUIRY_FROM || 'enquiries@example.test';
  const to = env.ENQUIRY_TO || 'sales@example.test';

  return async message => {
    const result = await transport.sendMail({ from, to, ...message });
    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new Error('SMTP did not accept the sales recipient');
    }
  };
}
