from pathlib import Path

path = Path('apps/web/i18n/staff-control-center-messages.ts')
text = path.read_text(encoding='utf-8')
replacements = {
    "maturity: 'Промышленный контур доступа. Боевые полномочия появляются только после подтверждённой серверной сессии, MFA и необходимых согласований.',":
        "maturity: 'Полномочия действуют только в подтверждённой сессии с MFA и согласованиями.',",
    "maturity: 'Industrial access control plane. Operational authority exists only after a verified server session, MFA and required approvals.',":
        "maturity: 'Authority is active only in a verified session with MFA and required approvals.',",
    "maturity: '工业级访问控制面。只有经过服务器验证的会话、MFA 和必要审批后，操作权限才会生效。',":
        "maturity: '权限仅在通过 MFA 和必要审批的已验证会话中生效。',",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected copy: {old}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

Path('.github/workflows/compact-staff-maturity.yml').unlink(missing_ok=True)
Path('.github/scripts/compact-staff-maturity.py').unlink(missing_ok=True)
