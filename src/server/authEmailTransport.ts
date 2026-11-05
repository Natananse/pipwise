/// <reference types="node" />
// Server-only Gmail SMTP. Never import this file from a screen or client helper.
import { connect, type TLSSocket } from 'node:tls';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { renderPipWiseOtpEmail, type PipWiseOtpType } from './authEmailTemplate';

export type PipWiseSmtpEnv = Record<string, string | undefined>;
export type PipWiseAuthEmailMessage = { to: string; subject: string; text: string; html: string; messageId: string };
export type PipWiseGmailTransport = { verify(): Promise<void>; send(message: PipWiseAuthEmailMessage): Promise<void> };
type ErrorCode = 'SMTP_NOT_CONFIGURED' | 'INVALID_EMAIL_MESSAGE' | 'SMTP_VERIFY_FAILED' | 'SMTP_SEND_FAILED';
export type AuthEmailTransportStage = 'prepare' | 'tls-connect' | 'tls-handshake' | 'smtp';
export type AuthEmailTransportReason = 'AUTH_REJECTED' | 'NETWORK_ERROR' | 'DNS_ERROR' | 'TIMEOUT' | 'UNSUPPORTED_RUNTIME' | 'TLS_UNAUTHORIZED' | 'UNKNOWN';
const stages: AuthEmailTransportStage[] = ['prepare', 'tls-connect', 'tls-handshake', 'smtp'];
const reasons: AuthEmailTransportReason[] = ['AUTH_REJECTED', 'NETWORK_ERROR', 'DNS_ERROR', 'TIMEOUT', 'UNSUPPORTED_RUNTIME', 'TLS_UNAUTHORIZED', 'UNKNOWN'];

export class AuthEmailTransportError extends Error {
  readonly stage: AuthEmailTransportStage;
  readonly reason: AuthEmailTransportReason;
  constructor(readonly code: ErrorCode, stage: AuthEmailTransportStage = 'prepare', reason: AuthEmailTransportReason = 'UNKNOWN') {
    super(code === 'SMTP_NOT_CONFIGURED' ? 'PipWise email delivery is not configured.'
      : code === 'INVALID_EMAIL_MESSAGE' ? 'The PipWise verification email is invalid.'
        : code === 'SMTP_VERIFY_FAILED' ? 'PipWise email delivery could not be verified.' : 'The PipWise verification email could not be sent.');
    this.name = 'AuthEmailTransportError';
    this.stage = stages.includes(stage) ? stage : 'prepare';
    this.reason = reasons.includes(reason) ? reason : 'UNKNOWN';
  }
}

function diagnosticReason(error: unknown): AuthEmailTransportReason {
  if (error instanceof AuthEmailTransportError) return error.reason;
  try {
    if (!error || typeof error !== 'object') return 'UNKNOWN';
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.message === 'string' && /not implemented|not supported|is not a function/i.test(value.message)) return 'UNSUPPORTED_RUNTIME';
    switch (value.code) {
      case 'EAUTH': return 'AUTH_REJECTED';
      case 'ESOCKET': case 'ECONNECTION': return 'NETWORK_ERROR';
      case 'EDNS': return 'DNS_ERROR';
      case 'ETIMEDOUT': return 'TIMEOUT';
      case 'ERR_NOT_IMPLEMENTED': case 'ERR_METHOD_NOT_IMPLEMENTED': return 'UNSUPPORTED_RUNTIME';
      default: return 'UNKNOWN';
    }
  } catch { return 'UNKNOWN'; }
}

const host = 'smtp.gmail.com';
const port = 465;
const handshakeMs = 4000;
const operationMs = 8000;
const purposes: PipWiseOtpType[] = ['sign-in', 'email-verification', 'forget-password'];

function singleEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254 || /[^\x21-\x7E]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0])) return false;
  const labels = parts[1].split('.');
  return labels.length >= 2 && labels.every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) && labels.at(-1)!.length >= 2;
}

function validatedMessage(input: PipWiseAuthEmailMessage): PipWiseAuthEmailMessage {
  const invalid = () => new AuthEmailTransportError('INVALID_EMAIL_MESSAGE');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['to', 'subject', 'text', 'html', 'messageId'].includes(key))
    || !singleEmail(input.to) || typeof input.subject !== 'string' || input.subject.length > 200 || /[\x00-\x1F\x7F]/.test(input.subject)
    || typeof input.text !== 'string' || input.text.length > 5000 || typeof input.html !== 'string' || input.html.length > 16000
    || typeof input.messageId !== 'string' || input.messageId.length > 200) throw invalid();
  const wrapped = input.messageId.startsWith('<') || input.messageId.endsWith('>');
  if (wrapped && !(input.messageId.startsWith('<') && input.messageId.endsWith('>'))) throw invalid();
  const id = wrapped ? input.messageId.slice(1, -1) : input.messageId;
  if (!singleEmail(id)) throw invalid();
  // The caller must render our approved template, rather than pass arbitrary
  // HTML, links, content objects or headers from the webhook request.
  const code = /^Your PipWise code: ([0-9]{6})$/m.exec(input.text)?.[1];
  if (!code || !purposes.some(type => {
    const expected = renderPipWiseOtpEmail({ code, type });
    return input.subject === expected.subject && input.text === expected.text && input.html === expected.html;
  })) throw invalid();
  return { to: input.to, subject: input.subject, text: input.text, html: input.html, messageId: `<${id}>` };
}

/** Creates no connection until verify/send; each operation owns fresh sockets. */
export function createGmailTransport(env: PipWiseSmtpEnv): PipWiseGmailTransport {
  const user = env?.PIPWISE_SMTP_USER;
  const rawPassword = env?.PIPWISE_SMTP_APP_PASSWORD;
  const password = typeof rawPassword === 'string' ? rawPassword.replace(/ /g, '') : '';
  if (!singleEmail(user) || typeof rawPassword !== 'string' || rawPassword.length > 64 || !/^[a-z]{16}$/i.test(password))
    throw new AuthEmailTransportError('SMTP_NOT_CONFIGURED');

  async function run(message?: PipWiseAuthEmailMessage): Promise<void> {
    const sockets = new Set<TLSSocket>();
    const handshakeTimers = new Set<ReturnType<typeof setTimeout>>();
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let stage: AuthEmailTransportStage = 'prepare';
    const failed = (error?: unknown, reason?: AuthEmailTransportReason) => {
      const failure = new AuthEmailTransportError(message ? 'SMTP_SEND_FAILED' : 'SMTP_VERIFY_FAILED',
        error instanceof AuthEmailTransportError ? error.stage : stage, reason ?? diagnosticReason(error));
      return failure;
    };
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (deadline !== undefined) clearTimeout(deadline);
      handshakeTimers.forEach(timer => clearTimeout(timer));
      handshakeTimers.clear();
      try { transport?.close(); } catch { /* Socket cleanup must still run. */ }
      sockets.forEach(socket => { try { socket.destroy(); } catch { /* No raw transport errors escape. */ } });
      sockets.clear();
    };
    try {
      const options: SMTPTransport.Options = {
        host, port, secure: true, pool: false, forceAuth: true, auth: { user, pass: password },
        tls: { servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
        logger: false, debug: false, transactionLog: false,
        connectionTimeout: handshakeMs, greetingTimeout: handshakeMs, socketTimeout: operationMs,
        disableFileAccess: true, disableUrlAccess: true,
        getSocket(_options, callback) {
          if (finished) { callback(failed()); return; }
          let socket: TLSSocket;
          stage = 'tls-connect';
          if (typeof connect !== 'function') { callback(failed(undefined, 'UNSUPPORTED_RUNTIME')); return; }
          try { socket = connect({ host, port, servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2' }); }
          catch (error) { callback(failed(error)); return; }
          stage = 'tls-handshake';
          sockets.add(socket);
          // Keep shutdown errors handled even after the operation has completed.
          socket.on('error', () => {});
          let settled = false;
          const complete = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer); handshakeTimers.delete(timer);
            socket.removeListener('secureConnect', secure);
            socket.removeListener('error', fail);
            socket.removeListener('close', closed);
            if (error || finished) { try { socket.destroy(); } catch {} callback(error ?? failed()); }
            // Nodemailer merges secured=true into SMTPConnection options. Only
            // hand off after verified TLS, so it neither rewraps nor resolves DNS.
            else { stage = 'smtp'; callback(null, { connection: socket, secured: true }); }
          };
          const secure = () => complete(socket.authorized ? undefined : failed(undefined, 'TLS_UNAUTHORIZED'));
          const fail = (error: unknown) => complete(failed(error));
          const closed = () => complete(failed(undefined, 'NETWORK_ERROR'));
          const timer = setTimeout(() => complete(failed(undefined, 'TIMEOUT')), handshakeMs);
          handshakeTimers.add(timer);
          socket.once('secureConnect', secure);
          socket.once('error', fail);
          socket.once('close', closed);
        },
      };
      transport = nodemailer.createTransport(options);
      const mailer = transport;
      const outcome: unknown = await new Promise((resolve, reject) => {
        deadline = setTimeout(() => { cleanup(); reject(failed(undefined, 'TIMEOUT')); }, operationMs);
        const operation = message ? mailer.sendMail({
          from: { name: 'PipWise', address: user }, to: { address: message.to, name: '' },
          envelope: { from: user, to: [message.to] }, subject: message.subject, text: message.text, html: message.html,
          messageId: message.messageId, disableFileAccess: true, disableUrlAccess: true,
        }) : mailer.verify();
        Promise.resolve(operation).then(resolve, reject);
      });
      if (!message && outcome !== true) throw failed();
      if (message && (!outcome || typeof outcome !== 'object' || !('accepted' in outcome) || !Array.isArray(outcome.accepted)
        || !outcome.accepted.some((address: unknown) => typeof address === 'string' && address.toLowerCase() === message.to.toLowerCase()))) throw failed();
    } catch (error) { throw failed(error); }
    finally { cleanup(); }
  }

  return { verify: () => run(), send: message => run(validatedMessage(message)) };
}
