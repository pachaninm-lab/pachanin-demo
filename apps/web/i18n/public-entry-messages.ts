import type { AppLocale } from './locale';

type PublicEntryMessages = {
  chrome: {
    brandHomeLabel: string;
    navLabel: string;
    menuLabel: string;
    skipToContent: string;
  };
  language: {
    switchLabel: string;
    switchTitle: string;
  };
  landing: {
    visualTitle: string;
    visualBasisLabel: string;
    visualBasisText: string;
    rolesAccessTitle: string;
    rolesAccessText: string;
    rolesAccessCta: string;
    footerStatement: string;
    footerDocs: string;
    footerContact: string;
    footerLogin: string;
    footerRights: string;
  };
  rolesCatalog: {
    title: string;
    text: string;
    cta: string;
  };
  login: {
    publicNav: string;
    brandTagline: string;
    backHome: string;
    title: string;
    lead: string;
    secureEyebrow: string;
    assuranceRole: string;
    assuranceMfa: string;
    assuranceAudit: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    loading: string;
    forgot: string;
    register: string;
    required: string;
    invalidEmail: string;
    unavailable: string;
    capsLock: string;
    note: string;
    mfaTitle: string;
    mfaLead: string;
    totpMethod: string;
    backupMethod: string;
    mfaCode: string;
    mfaCodePlaceholder: string;
    backupCodePlaceholder: string;
    mfaSubmit: string;
    mfaLoading: string;
    mfaBack: string;
    mfaError: string;
    enrollmentTitle: string;
    enrollmentLead: string;
    setupSecretLabel: string;
    backupCodesTitle: string;
    backupCodesLead: string;
  };
  forgot: {
    publicNav: string;
    brandTagline: string;
    backHome: string;
    title: string;
    lead: string;
    email: string;
    emailPlaceholder: string;
    submit: string;
    loading: string;
    successTitle: string;
    successText: string;
    error: string;
    backToLogin: string;
    note: string;
    requestName: string;
    requestMessage: string;
  };
};

export const publicEntryMessages: Record<AppLocale, PublicEntryMessages> = {
  ru: {
    chrome: {
      brandHomeLabel: 'Прозрачная Цена — на главную',
      navLabel: 'Разделы',
      menuLabel: 'Открыть меню',
      skipToContent: 'Перейти к содержанию',
    },
    language: {
      switchLabel: 'Текущий язык: {current}. Переключить на {next}',
      switchTitle: 'Язык: {current}',
    },
    landing: {
      visualTitle: 'Единая сделка',
      visualBasisLabel: 'Основание для расчёта',
      visualBasisText: 'Приёмка + качество + документы',
      rolesAccessTitle: 'Один вход для всех участников',
      rolesAccessText: 'Роль не выбирается вручную. После проверки учётной записи сервер открывает рабочее место организации и применяет назначенные полномочия.',
      rolesAccessCta: 'Войти в рабочую платформу',
      footerStatement: 'Цифровой контур исполнения внебиржевой зерновой сделки.',
      footerDocs: 'Документы',
      footerContact: 'Связаться',
      footerLogin: 'Войти',
      footerRights: 'Все права защищены',
    },
    rolesCatalog: {
      title: 'Рабочие места участников сделки',
      text: 'Каждый участник видит только свои задачи, документы, статусы и разрешённые действия в едином объекте сделки.',
      cta: 'Рабочее место',
    },
    login: {
      publicNav: 'Навигация страницы входа',
      brandTagline: 'Единый вход в контур сделки',
      backHome: 'На главную',
      title: 'Вход в рабочую платформу',
      lead: 'Используйте корпоративную учётную запись. Роль, организация и полномочия определяются сервером.',
      secureEyebrow: 'Защищённый доступ',
      assuranceRole: 'Роль и организация назначаются сервером',
      assuranceMfa: 'MFA запрашивается по политике доступа',
      assuranceAudit: 'События входа журналируются',
      email: 'Рабочий email',
      emailPlaceholder: 'name@company.ru',
      password: 'Пароль',
      passwordPlaceholder: 'Введите пароль',
      showPassword: 'Показать пароль',
      hidePassword: 'Скрыть пароль',
      submit: 'Войти',
      loading: 'Проверяем доступ…',
      forgot: 'Восстановить доступ',
      register: 'Запросить подключение',
      required: 'Заполните обязательное поле.',
      invalidEmail: 'Введите корректный рабочий email.',
      unavailable: 'Не удалось подтвердить доступ. Проверьте данные или повторите позже.',
      capsLock: 'Включён Caps Lock.',
      note: 'После проверки откроется рабочее место, назначенное вашей организации.',
      mfaTitle: 'Подтвердить вход',
      mfaLead: 'Введите код из приложения-аутентификатора или одноразовый резервный код.',
      totpMethod: 'Код приложения',
      backupMethod: 'Резервный код',
      mfaCode: 'Код подтверждения',
      mfaCodePlaceholder: '6 цифр',
      backupCodePlaceholder: 'Резервный код',
      mfaSubmit: 'Подтвердить',
      mfaLoading: 'Проверяем код…',
      mfaBack: 'Начать вход заново',
      mfaError: 'Код не принят или срок проверки истёк. Проверьте код или начните вход заново.',
      enrollmentTitle: 'Настройте двухфакторную защиту',
      enrollmentLead: 'Добавьте секрет в приложение-аутентификатор и подтвердите первый код.',
      setupSecretLabel: 'Секрет настройки',
      backupCodesTitle: 'Сохраните резервные коды',
      backupCodesLead: 'Каждый код используется один раз. Сохраните их в защищённом месте до перехода в кабинет.',
    },
    forgot: {
      publicNav: 'Навигация восстановления доступа',
      brandTagline: 'Восстановление доступа',
      backHome: 'На главную',
      title: 'Восстановить доступ',
      lead: 'Укажите рабочий email. Запрос будет обработан без раскрытия наличия учётной записи.',
      email: 'Рабочий email',
      emailPlaceholder: 'name@company.ru',
      submit: 'Отправить запрос',
      loading: 'Отправляем…',
      successTitle: 'Запрос принят',
      successText: 'Если адрес связан с учётной записью, инструкции будут направлены после проверки доступа.',
      error: 'Не удалось принять запрос. Повторите позже или обратитесь в поддержку.',
      backToLogin: 'Вернуться ко входу',
      note: 'Восстановление выполняется только после проверки принадлежности учётной записи.',
      requestName: 'Восстановление доступа',
      requestMessage: 'Запрос на восстановление доступа к рабочей платформе.',
    },
  },
  en: {
    chrome: {
      brandHomeLabel: 'Transparent Price — home',
      navLabel: 'Sections',
      menuLabel: 'Open menu',
      skipToContent: 'Skip to content',
    },
    language: {
      switchLabel: 'Current language: {current}. Switch to {next}',
      switchTitle: 'Language: {current}',
    },
    landing: {
      visualTitle: 'One deal record',
      visualBasisLabel: 'Settlement basis',
      visualBasisText: 'Acceptance + quality + documents',
      rolesAccessTitle: 'One sign-in for every participant',
      rolesAccessText: 'A role is never selected manually. After account verification, the server opens the organisation workspace and applies assigned permissions.',
      rolesAccessCta: 'Sign in to the working platform',
      footerStatement: 'Digital execution circuit for an OTC grain transaction.',
      footerDocs: 'Documents',
      footerContact: 'Contact',
      footerLogin: 'Sign in',
      footerRights: 'All rights reserved',
    },
    rolesCatalog: {
      title: 'Deal participant workspaces',
      text: 'Each participant sees only their tasks, documents, statuses and permitted actions inside the same deal record.',
      cta: 'Workspace',
    },
    login: {
      publicNav: 'Sign-in page navigation',
      brandTagline: 'Single entry to the deal circuit',
      backHome: 'Back to home',
      title: 'Sign in to the working platform',
      lead: 'Use your corporate account. The server resolves the role, organisation and permissions.',
      secureEyebrow: 'Protected access',
      assuranceRole: 'Role and organisation are assigned by the server',
      assuranceMfa: 'MFA is requested by access policy',
      assuranceAudit: 'Sign-in events are recorded',
      email: 'Work email',
      emailPlaceholder: 'name@company.com',
      password: 'Password',
      passwordPlaceholder: 'Enter password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Sign in',
      loading: 'Verifying access…',
      forgot: 'Restore access',
      register: 'Request onboarding',
      required: 'Complete the required field.',
      invalidEmail: 'Enter a valid work email.',
      unavailable: 'Access could not be verified. Check the credentials or try again later.',
      capsLock: 'Caps Lock is on.',
      note: 'After verification, the workspace assigned to your organisation will open.',
      mfaTitle: 'Verify sign-in',
      mfaLead: 'Enter the code from your authenticator app or a one-time backup code.',
      totpMethod: 'Authenticator code',
      backupMethod: 'Backup code',
      mfaCode: 'Verification code',
      mfaCodePlaceholder: '6 digits',
      backupCodePlaceholder: 'Backup code',
      mfaSubmit: 'Verify',
      mfaLoading: 'Verifying code…',
      mfaBack: 'Restart sign-in',
      mfaError: 'The code was not accepted or the challenge expired. Check the code or restart sign-in.',
      enrollmentTitle: 'Set up two-factor protection',
      enrollmentLead: 'Add the secret to your authenticator app and confirm the first code.',
      setupSecretLabel: 'Setup secret',
      backupCodesTitle: 'Save your backup codes',
      backupCodesLead: 'Each code can be used once. Store them securely before opening the workspace.',
    },
    forgot: {
      publicNav: 'Access recovery navigation',
      brandTagline: 'Access recovery',
      backHome: 'Back to home',
      title: 'Restore access',
      lead: 'Enter your work email. The request is processed without disclosing whether an account exists.',
      email: 'Work email',
      emailPlaceholder: 'name@company.com',
      submit: 'Send request',
      loading: 'Sending…',
      successTitle: 'Request accepted',
      successText: 'If the address is linked to an account, instructions will be sent after access verification.',
      error: 'The request could not be accepted. Try again later or contact support.',
      backToLogin: 'Back to sign in',
      note: 'Recovery proceeds only after account ownership is verified.',
      requestName: 'Access recovery',
      requestMessage: 'Request to restore access to the working platform.',
    },
  },
  zh: {
    chrome: {
      brandHomeLabel: '透明价格 — 返回首页',
      navLabel: '页面栏目',
      menuLabel: '打开菜单',
      skipToContent: '跳到主要内容',
    },
    language: {
      switchLabel: '当前语言：{current}。切换到 {next}',
      switchTitle: '语言：{current}',
    },
    landing: {
      visualTitle: '统一交易记录',
      visualBasisLabel: '结算依据',
      visualBasisText: '验收 + 质量 + 文件',
      rolesAccessTitle: '所有参与方统一登录',
      rolesAccessText: '用户无需手动选择角色。账户验证后，服务器会打开所属组织的工作区并应用已分配权限。',
      rolesAccessCta: '登录工作平台',
      footerStatement: '场外粮食交易的数字化执行闭环。',
      footerDocs: '文件',
      footerContact: '联系',
      footerLogin: '登录',
      footerRights: '保留所有权利',
    },
    rolesCatalog: {
      title: '交易参与方工作区',
      text: '每个参与方只看到统一交易记录中与其相关的任务、文件、状态和获准操作。',
      cta: '工作区',
    },
    login: {
      publicNav: '登录页导航',
      brandTagline: '统一进入交易闭环',
      backHome: '返回首页',
      title: '登录工作平台',
      lead: '请使用企业账户。角色、组织和权限由服务器确定。',
      secureEyebrow: '受保护的访问',
      assuranceRole: '角色和组织由服务器分配',
      assuranceMfa: '系统按访问策略要求 MFA',
      assuranceAudit: '登录事件会被记录',
      email: '工作邮箱',
      emailPlaceholder: 'name@company.cn',
      password: '密码',
      passwordPlaceholder: '输入密码',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      submit: '登录',
      loading: '正在验证访问权限…',
      forgot: '恢复访问权限',
      register: '申请接入',
      required: '请填写必填项。',
      invalidEmail: '请输入有效的工作邮箱。',
      unavailable: '无法验证访问权限。请检查凭据或稍后重试。',
      capsLock: '大写锁定已开启。',
      note: '验证通过后，系统会打开分配给贵组织的工作区。',
      mfaTitle: '确认登录',
      mfaLead: '请输入身份验证器中的代码或一次性备用代码。',
      totpMethod: '验证器代码',
      backupMethod: '备用代码',
      mfaCode: '验证码',
      mfaCodePlaceholder: '6 位数字',
      backupCodePlaceholder: '备用代码',
      mfaSubmit: '确认',
      mfaLoading: '正在验证代码…',
      mfaBack: '重新登录',
      mfaError: '代码未通过或验证已过期。请检查代码或重新登录。',
      enrollmentTitle: '设置双重身份验证',
      enrollmentLead: '将设置密钥添加到身份验证器，然后输入第一个代码。',
      setupSecretLabel: '设置密钥',
      backupCodesTitle: '保存备用代码',
      backupCodesLead: '每个代码只能使用一次。进入工作区前请将其安全保存。',
    },
    forgot: {
      publicNav: '访问恢复导航',
      brandTagline: '恢复访问权限',
      backHome: '返回首页',
      title: '恢复访问权限',
      lead: '请输入工作邮箱。系统不会披露该账户是否存在。',
      email: '工作邮箱',
      emailPlaceholder: 'name@company.cn',
      submit: '发送请求',
      loading: '正在发送…',
      successTitle: '请求已受理',
      successText: '如果该地址关联账户，完成访问核验后将发送说明。',
      error: '无法受理请求。请稍后重试或联系支持。',
      backToLogin: '返回登录',
      note: '只有在核验账户归属后才会恢复访问权限。',
      requestName: '恢复访问权限',
      requestMessage: '请求恢复工作平台访问权限。',
    },
  },
};
