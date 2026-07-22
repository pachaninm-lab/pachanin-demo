'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Phone, ShieldCheck } from 'lucide-react';
import { getOrganizationConnectCopy } from '@/i18n/platform-v7-organization-connect';
import styles from './OrganizationConnectForm.module.css';

export function OrganizationConnectForm({ locale }: { locale: string }) {
  const copy = getOrganizationConnectCopy(locale);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      setError(copy.required);
      form.reportValidity();
      return;
    }
    setError('');
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
      detail: { name: 'submit_organization_request', locale, mode: 'staged_client_validation' },
    }));
    window.location.assign(`/platform-v7/register?entry=organization-connect&lang=${encodeURIComponent(locale)}`);
  }

  return <section id='connect-organization' className={styles.section} aria-labelledby='connect-title'>
    <div className={styles.copy}>
      <span>{copy.eyebrow}</span>
      <h2 id='connect-title'>{copy.title}</h2>
      <p>{copy.lead}</p>
      <p className={styles.note}>{copy.note}</p>
    </div>
    <div>
      <form className={styles.form} onSubmit={onSubmit} noValidate data-ready={ready ? 'true' : 'false'} aria-busy={!ready}>
        <label><span>{copy.organization}</span><input name='organization' autoComplete='organization' required disabled={!ready} /></label>
        <label><span>{copy.inn}</span><input name='inn' inputMode='numeric' pattern='[0-9]{10}|[0-9]{12}' required disabled={!ready} /></label>
        <label><span>{copy.name}</span><input name='name' autoComplete='name' required disabled={!ready} /></label>
        <label><span>{copy.position}</span><input name='position' autoComplete='organization-title' required disabled={!ready} /></label>
        <label><span>{copy.phone}</span><input name='phone' type='tel' autoComplete='tel' required disabled={!ready} /></label>
        <label><span>{copy.email}</span><input name='email' type='email' autoComplete='email' required disabled={!ready} /></label>
        <label><span>{copy.role}</span><select name='role' required defaultValue='' disabled={!ready}><option value='' disabled>—</option>{copy.roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label><span>{copy.scenario}</span><select name='scenario' required defaultValue='' disabled={!ready}><option value='' disabled>—</option>{copy.scenarios.map((scenario) => <option key={scenario}>{scenario}</option>)}</select></label>
        <label className={styles.consent}><input name='consent' type='checkbox' required disabled={!ready} /><span>{copy.consent}</span></label>
        {error ? <p className={styles.error} role='alert'>{error}</p> : null}
        <div className={styles.actions}>
          <button type='submit' disabled={!ready}>{copy.submit}<ArrowRight size={18}/></button>
          <a href='tel:+79162778989' onClick={() => window.dispatchEvent(new CustomEvent('pc:public-product-analytics', { detail: { name: 'call_click', locale, source: 'organization_connect' } }))}><Phone size={18}/>{copy.call}</a>
        </div>
      </form>
      <noscript>
        <div className={styles.noScript}>
          <ShieldCheck aria-hidden='true'/>
          <p>{copy.jsRequired}</p>
          <a href={`/platform-v7/register?entry=organization-connect&lang=${encodeURIComponent(locale)}`}>{copy.protectedContinue}</a>
        </div>
      </noscript>
    </div>
  </section>;
}
