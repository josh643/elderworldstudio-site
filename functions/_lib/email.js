// Customer emails via AgentMail (same inbox key as /api/lead). Generic copy only.
import { PLANS } from './plans.js';

const FROM = 'annaews@agentmail.to';

export function welcomeText(customer, plan, site) {
  const p = PLANS[plan] || PLANS.starter;
  const monthly = p.monthly ? ` plus $${p.monthly}/mo` : ' (one time, no monthly fee)';
  return [
    `Hi${customer.name ? ' ' + customer.name : ''},`,
    '',
    `Welcome to Elder World Studio. Your ${p.name} website is ready to design.`,
    `Plan: ${p.name} — $${p.setup} setup${monthly}.`,
    site ? `Open your site: https://elderworldstudio.com/account/#/studio?site=${site.id}` : 'Sign in at https://elderworldstudio.com/account/ to start.',
    '',
    'You can preview, edit, and download your site files from your account.',
    p.kind === 'subscription' ? 'Manage or cancel any time from Billing in your account (Stripe customer portal).' : 'This is a one-time handoff. Edits and hosting are not included.',
    '',
    '— Elder World Studio',
    'annaews@agentmail.to',
  ].join('\n');
}

export function receiptText(customer, plan, order) {
  const p = PLANS[plan] || PLANS.starter;
  const dollars = ((order && order.amount_cents) || p.setup * 100) / 100;
  return [
    `Hi${customer.name ? ' ' + customer.name : ''},`,
    '',
    `We received your payment for the ${p.name} website plan ($${dollars.toFixed(2)} USD).`,
    'Stripe will also email a receipt from Stripe.',
    '',
    'Sign in: https://elderworldstudio.com/account/',
    '',
    '— Elder World Studio',
  ].join('\n');
}

export async function sendMail(env, { to, subject, text }, fetcher = fetch) {
  if (!env.AGENTMAIL_SEND_KEY || !to) return { ok: false, skipped: true };
  const r = await fetcher(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(FROM)}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AGENTMAIL_SEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [to], subject: String(subject).slice(0, 180), text }),
  });
  return { ok: r.ok };
}

export function sendWelcome(env, customer, plan, site) {
  return sendMail(env, {
    to: customer.email,
    subject: `Your ${PLANS[plan]?.name || 'website'} is ready to design`,
    text: welcomeText(customer, plan, site),
  });
}

export function sendReceipt(env, customer, plan, order) {
  return sendMail(env, {
    to: customer.email,
    subject: `Receipt: ${PLANS[plan]?.name || 'website'} plan`,
    text: receiptText(customer, plan, order),
  });
}

export function sendLoginLink(env, email, link) {
  return sendMail(env, {
    to: email,
    subject: 'Your Elder World Studio sign-in link',
    text: `Sign in with this one-time link (expires in 1 hour):\n\n${link}\n\nIf you did not ask for this, you can ignore it.\n`,
  });
}
