# PC-CROP reviewer SMTP587 probe

Registration-only diagnostic for issue #3785.

The probe authenticates to the existing REG.RU SMTP service on port 587, upgrades with STARTTLS, and stops after RCPT TO. DATA is forbidden. It does not send mail, issue or replay password reset, mutate PostgreSQL, restart containers, change production configuration, or expose reviewer/sender/SMTP credentials.

PRODUCTION_MUTATION=NONE. New recurring cost: 0 RUB.
