from pathlib import Path

path = Path('apps/web/i18n/staff-control-center-messages.ts')
text = path.read_text(encoding='utf-8')
replacements = {
    "description: 'Доступ сотрудников, поддержка пользователей и просмотр кабинетов управляются отдельными ограниченными сессиями. Постоянная роль сотрудника сама по себе не открывает данные клиента.',":
        "description: 'Данные клиентов доступны только в ограниченной защищённой сессии.',",
    "description: 'Staff access, user support and cabinet viewing use separate time-bound sessions. A permanent staff role never grants customer-data access by itself.',":
        "description: 'Customer data is available only in a time-bound protected session.',",
    "description: '员工访问、用户支持和账户查看均使用独立的限时会话。永久员工角色本身不会授予客户数据访问权限。',":
        "description: '客户数据仅在限时受保护会话中可用。',",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected copy: {old}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

Path('.github/workflows/shorten-staff-hero.yml').unlink(missing_ok=True)
Path('.github/scripts/shorten-staff-hero.py').unlink(missing_ok=True)
