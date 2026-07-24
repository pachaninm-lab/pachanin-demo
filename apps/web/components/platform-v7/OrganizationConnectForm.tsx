'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { getOrganizationConnectCopy } from '@/i18n/platform-v7-organization-connect';
import styles from './OrganizationConnectForm.module.css';

type IntakeResult = {
  requestNumber: string;
  status: string;
  replay: boolean;
  correlationId: string;
};

type FailureCode = 'RATE_LIMITED' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_REQUEST' | 'INTAKE_UNAVAILABLE';
type Step = 1 | 2;

function newIdempotencyKey(): string {
  return `public-org-connect:${globalThis.crypto.randomUUID()}`;
}

export function OrganizationConnectForm({ locale }: { locale: string }) {
  const copy = getOrganizationConnectCopy(locale);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<FailureCode | ''>('');
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const idempotencyKey = useRef('');
  const formRef = useRef<HTMLFormElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  const organizationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
    setReady(true);
  }, []);

  function messageFor(code: FailureCode): string {
    if (code === 'RATE_LIMITED') return copy.rateLimited;
    if (code === 'IDEMPOTENCY_CONFLICT') return copy.conflict;
    if (code === 'INVALID_REQUEST') return copy.required;
    return copy.unavailable;
  }

  function validateStepOne() {
    const form = formRef.current;
    if (!form) return false;
    const names = ['organizationName', 'inn', 'contactName'];
    for (const name of names) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement && !field.checkValidity()) {
        setError(copy.required);
        setErrorCode('INVALID_REQUEST');
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  function continueToStepTwo() {
    if (!ready || submitting || !validateStepOne()) return;
    setError('');
    setErrorCode('');
    setStep(2);
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
      detail: { name: 'organization_request_step_completed', locale, step: 1 },
    }));
    window.requestAnimationFrame(() => positionRef.current?.focus());
  }

  function returnToStepOne() {
    if (submitting) return;
    setError('');
    setErrorCode('');
    setStep(1);
    window.requestAnimationFrame(() => organizationRef.current?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting || result || step !== 2) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      setError(copy.required);
      setErrorCode('INVALID_REQUEST');
      form.reportValidity();
      return;
    }

    const values = new FormData(form);
    const payload = {
      organizationName: String(values.get('organizationName') || ''),
      inn: String(values.get('inn') || ''),
      contactName: String(values.get('contactName') || ''),
      position: String(values.get('position') || ''),
      phone: String(values.get('phone') || ''),
      email: String(values.get('email') || ''),
      organizationRole: String(values.get('organizationRole') || ''),
      scenario: String(values.get('scenario') || ''),
      locale: locale === 'en' || locale === 'zh' ? locale : 'ru',
      consent: values.get('consent') === 'on',
      website: String(values.get('website') || ''),
    };

    setError('');
    setErrorCode('');
    setSubmitting(true);
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
      detail: { name: 'submit_organization_request', locale, mode: 'durable_server_intake' },
    }));

    try {
      const response = await fetch('/api/platform-v7/organization-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Idempotency-Key': idempotencyKey.current || newIdempotencyKey(),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json().catch(() => ({})) as Partial<IntakeResult> & { ok?: boolean; code?: string };
      if (!response.ok || body.ok !== true || !body.requestNumber || !body.status || !body.correlationId) {
        const code: FailureCode = body.code === 'RATE_LIMITED'
          ? 'RATE_LIMITED'
          : body.code === 'IDEMPOTENCY_CONFLICT'
            ? 'IDEMPOTENCY_CONFLICT'
            : body.code === 'INVALID_REQUEST'
              ? 'INVALID_REQUEST'
              : 'INTAKE_UNAVAILABLE';
        setErrorCode(code);
        setError(messageFor(code));
        return;
      }
      const accepted: IntakeResult = {
        requestNumber: body.requestNumber,
        status: body.status,
        replay: Boolean(body.replay),
        correlationId: body.correlationId,
      };
      setResult(accepted);
      window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
        detail: { name: 'organization_request_accepted', locale, replay: accepted.replay },
      }));
    } catch {
      setErrorCode('INTAKE_UNAVAILABLE');
      setError(copy.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    if (errorCode === 'IDEMPOTENCY_CONFLICT') idempotencyKey.current = newIdempotencyKey();
    setError('');
    setErrorCode('');
  }

  return (
    <section id='connect-organization' className={styles.section} aria-labelledby='connect-title'>
      <div className={styles.copy}>
        <span>{copy.eyebrow}</span>
        <h2 id='connect-title'>{copy.title}</h2>
        <p>{copy.lead}</p>
        <div className={styles.assurances}>
          <span><ShieldCheck aria-hidden='true' />{copy.note}</span>
          <a href='tel:+79162778989'><Phone aria-hidden='true' />{copy.call}</a>
        </div>
      </div>
      <div>
        {result ? (
          <div className={styles.success} role='status' aria-live='polite'>
            <CheckCircle2 aria-hidden='true' />
            <div>
              <h3>{copy.successTitle}</h3>
              <p>{copy.successText}</p>
              <p className={styles.requestNumber}><span>{copy.requestLabel}</span><strong>{result.requestNumber}</strong></p>
              {result.replay ? <p className={styles.replay}>{copy.replayText}</p> : null}
            </div>
          </div>
        ) : (
          <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate data-ready={ready ? 'true' : 'false'} data-step={step} aria-busy={submitting || !ready}>
            <label className={styles.honeypot} aria-hidden='true'>Website<input name='website' type='text' tabIndex={-1} autoComplete='off' /></label>
            <div className={styles.progress} aria-label={step === 1 ? copy.stepOne : copy.stepTwo}>
              <div><span>{step === 1 ? copy.stepOne : copy.stepTwo}</span><strong>{step === 1 ? copy.stepOneTitle : copy.stepTwoTitle}</strong></div>
              <i><span className={step >= 1 ? styles.complete : undefined} /><span className={step >= 2 ? styles.complete : undefined} /></i>
            </div>

            <div className={styles.step} hidden={step !== 1} aria-hidden={step !== 1}>
              <label><span>{copy.organization}</span><input ref={organizationRef} name='organizationName' autoComplete='organization' minLength={2} maxLength={200} required disabled={!ready || submitting} /></label>
              <label><span>{copy.inn}</span><input name='inn' inputMode='numeric' pattern='[0-9]{10}|[0-9]{12}' maxLength={12} required disabled={!ready || submitting} /></label>
              <label><span>{copy.name}</span><input name='contactName' autoComplete='name' minLength={2} maxLength={160} required disabled={!ready || submitting} /></label>
              {error && step === 1 ? <div className={styles.error} role='alert'><p>{error}</p><button type='button' onClick={retry}><RotateCcw size={16} />{copy.retry}</button></div> : null}
              <div className={styles.actions}><button type='button' onClick={continueToStepTwo} disabled={!ready || submitting}>{copy.continue}<ArrowRight size={18} /></button></div>
            </div>

            <div className={styles.step} hidden={step !== 2} aria-hidden={step !== 2}>
              <div className={styles.twoColumns}>
                <label><span>{copy.position}</span><input ref={positionRef} name='position' autoComplete='organization-title' minLength={2} maxLength={160} required disabled={!ready || submitting} /></label>
                <label><span>{copy.phone}</span><input name='phone' type='tel' autoComplete='tel' maxLength={32} required disabled={!ready || submitting} /></label>
                <label><span>{copy.email}</span><input name='email' type='email' autoComplete='email' maxLength={254} required disabled={!ready || submitting} /></label>
                <label><span>{copy.role}</span><select name='organizationRole' required defaultValue='' disabled={!ready || submitting}><option value='' disabled>—</option>{copy.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
                <label className={styles.full}><span>{copy.scenario}</span><select name='scenario' required defaultValue='' disabled={!ready || submitting}><option value='' disabled>—</option>{copy.scenarios.map((scenario) => <option key={scenario.value} value={scenario.value}>{scenario.label}</option>)}</select></label>
              </div>
              <label className={styles.consent}><input name='consent' type='checkbox' required disabled={!ready || submitting} /><span>{copy.consent}</span></label>
              {error && step === 2 ? <div className={styles.error} role='alert'><p>{error}</p><button type='button' onClick={retry}><RotateCcw size={16} />{copy.retry}</button></div> : null}
              <div className={styles.actions}>
                <button className={styles.back} type='button' onClick={returnToStepOne} disabled={submitting}><ArrowLeft size={18} />{copy.back}</button>
                <button type='submit' disabled={!ready || submitting}>{submitting ? copy.submitting : copy.submit}<ArrowRight size={18} /></button>
              </div>
            </div>
          </form>
        )}
        <noscript>
          <div className={styles.noScript}>
            <ShieldCheck aria-hidden='true' />
            <p>{copy.jsRequired}</p>
            <a href={`/platform-v7/register?entry=organization-connect&lang=${encodeURIComponent(locale)}`}>{copy.protectedContinue}</a>
          </div>
        </noscript>
      </div>
    </section>
  );
}
