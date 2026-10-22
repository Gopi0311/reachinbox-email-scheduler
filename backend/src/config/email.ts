import nodemailer, { Transporter } from 'nodemailer';
import { env } from './env.js';
import { logger } from './logger.js';

let transporter: Transporter | null = null;
let etherealAccount: { user: string; pass: string } | null = null;

export const getEmailTransporter = async (): Promise<Transporter> => {
  if (transporter) {
    return transporter;
  }

  // If user provided custom credentials
  if (env.ETHEREAL_USER && env.ETHEREAL_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
      secure: env.ETHEREAL_PORT === 465,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASSWORD,
      },
    });
    logger.info({ user: env.ETHEREAL_USER }, 'Configured custom Ethereal SMTP transporter');
    return transporter;
  }

  // If no credentials supplied, automatically create a real Ethereal test account
  try {
    logger.info('No Ethereal credentials found. Generating automatic Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    etherealAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
    };

    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    logger.info(
      {
        user: testAccount.user,
        webUrl: `https://ethereal.email/login`,
      },
      'Created automatic Ethereal test account successfully'
    );

    return transporter;
  } catch (error) {
    logger.error({ error }, 'Failed to create Ethereal test account, falling back to basic SMTP setup');
    transporter = nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
      auth: {
        user: env.ETHEREAL_USER || 'dummy',
        pass: env.ETHEREAL_PASSWORD || 'dummy',
      },
    });
    return transporter;
  }
};

export const getEtherealCredentials = () => etherealAccount;
