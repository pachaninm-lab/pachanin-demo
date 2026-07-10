import type { AppLocale } from './locale';

type PublicEntryMessages = {
  language: {
    switchLabel: string;
    switchTitle: string;
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
    unavailable: string;
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
    mfaError: string;
    mfaBack: string;
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
    language: {
      switchLabel: 'Текущий язык: {current}. Переключить на {next}',
      switchTitle: 'Язык: {current}',
    },
    rolesCatalog: {
      title: 'Рабочие места участников сделки',
      text: 'Вход единый. Роль, организация и полномочия определяются сервером после проверки учётной записи.',
      cta: 'Войти',
    },
    login: {
      publicNav: 'Навигация страницы входа',
      brandTagline: 'Единый вход в контур сделки',
      backHome: 'На главную',
      title: 'Войти в систему',
      lead: 'Роль, организация и полномочия определяются сервером после проверки учётной записи.',
      email: 'Рабочий email',
      emailPlaceholder: 'name@company.ru',
      password: 'Пароль',
      passwordPlaceholder: 'Введите пароль',
      showPassword: 'Показать пароль',
      hidePassword: 'Скрыть пароль',
      submit: 'Войти',
      loading: 'Проверяем доступ…',
      forgot: 'Восстановить доступ',
      register: 'Создать учётную запись',
      required: 'Введите email и пароль.',
      unavailable: 'Не удалось войти. Проверьте данные или восстановите доступ.',
      note: 'После входа откроется рабочее место, назначенное вашей организации. Роль нельзя выбрать или изменить через URL.',
      mfaTitle: 'Подтвердить вход',
      mfaLead: 'Введите код второго фактора. Основная сессия будет создана только после успешной проверки.',
      totpMethod: 'Код приложения',
      backupMethod: 'Резервный код',
      mfaCode: 'Код подтверждения',
      mfaCodePlaceholder: '6 цифр',
      backupCodePlaceholder: 'Резервный код',
      mfaSubmit: 'Подтвердить',
      mfaLoading: 'Проверяем код…',
      mfaError: 'Не удалось подтвердить второй фактор. Проверьте код или начните вход заново.',
      mfaBack: 'Вернуться к паролю',
      enrollmentTitle: 'Подключение второго фактора',
      enrollmentLead: 'Добавьте ключ в приложение-аутентификатор, затем введите текущий код.',
      setupSecretLabel: 'Ключ настройки',
      backupCodesTitle: 'Сохраните резервные коды',
      backupCodesLead: 'Они показываются один раз. Храните их отдельно от пароля.',
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
      note: 'Пароль не передаётся в поддержку. Восстановление выполняется только после проверки принадлежности учётной записи.',
      requestName: 'Восстановление доступа',
      requestMessage: 'Запрос на восстановление доступа к рабочей платформе.',
    },
  },
  en: {
    language: {
      switchLabel: 'Current language: {current}. Switch to {next}',
      switchTitle: 'Language: {current}',
    },
    rolesCatalog: {
      title: 'Deal participant workspaces',
      text: 'Sign-in is unified. The server resolves the role, organisation and permissions after the account is verified.',
      cta: 'Sign in',
    },
    login: {
      publicNav: 'Sign-in page navigation',
      brandTagline: 'Single entry to the deal circuit',
      backHome: 'Back to home',
      title: 'Sign in',
      lead: 'The server resolves the role, organisation and permissions after the account is verified.',
      email: 'Work email',
      emailPlaceholder: 'name@company.com',
      password: 'Password',
      passwordPlaceholder: 'Enter password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      submit: 'Sign in',
      loading: 'Verifying access…',
      forgot: 'Restore access',
      register: 'Create account',
      required: 'Enter email and password.',
      unavailable: 'Sign-in failed. Check the credentials or restore access.',
      note: 'After sign-in, the workspace assigned to your organisation will open. A role cannot be selected or changed through the URL.',
      mfaTitle: 'Confirm sign-in',
      mfaLead: 'Enter the second-factor code. The main session is created only after successful verification.',
      totpMethod: 'Authenticator code',
      backupMethod: 'Backup code',
      mfaCode: 'Verification code',
      mfaCodePlaceholder: '6 digits',
      backupCodePlaceholder: 'Backup code',
      mfaSubmit: 'Confirm',
      mfaLoading: 'Verifying code…',
      mfaError: 'The second factor could not be verified. Check the code or restart sign-in.',
      mfaBack: 'Back to password',
      enrollmentTitle: 'Set up a second factor',
      enrollmentLead: 'Add the key to an authenticator app, then enter the current code.',
      setupSecretLabel: 'Setup key',
      backupCodesTitle: 'Save the backup codes',
      backupCodesLead: 'They are displayed once. Store them separately from the password.',
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
      note: 'Never send a password to support. Recovery proceeds only after account ownership is verified.',
      requestName: 'Access recovery',
      requestMessage: 'Request to restore access to the working platform.',
    },
  },
  zh: {
    language: {
      switchLabel: '当前语言：{current}。切换到 {next}',
      switchTitle: '语言：{current}',
    },
    rolesCatalog: {
      title: '交易参与方工作区',
      text: '统一登录。服务器在验证账户后确定角色、组织和权限。',
      cta: '登录',
    },
    login: {
      publicNav: '登录页导航',
      brandTagline: '统一进入交易闭环',
      backHome: '返回首页',
      title: '登录系统',
      lead: '服务器在验证账户后确定角色、组织和权限。',
      email: '工作邮箱',
      emailPlaceholder: 'name@company.cn',
      password: '密码',
      passwordPlaceholder: '输入密码',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      submit: '登录',
      loading: '正在验证访问权限…',
      forgot: '恢复访问权限',
      register: '创建账户',
      required: '请输入邮箱和密码。',
      unavailable: '登录失败。请检查凭据或恢复访问权限。',
      note: '登录后将打开分配给贵组织的工作区。不能通过 URL 选择或更改角色。',
      mfaTitle: '确认登录',
      mfaLead: '请输入第二因素代码。只有验证成功后才会创建主会话。',
      totpMethod: '身份验证器代码',
      backupMethod: '备用代码',
      mfaCode: '验证码',
      mfaCodePlaceholder: '6 位数字',
      backupCodePlaceholder: '备用代码',
      mfaSubmit: '确认',
      mfaLoading: '正在验证代码…',
      mfaError: '无法验证第二因素。请检查代码或重新开始登录。',
      mfaBack: '返回密码登录',
      enrollmentTitle: '设置第二因素',
      enrollmentLead: '将密钥添加到身份验证器应用，然后输入当前代码。',
      setupSecretLabel: '设置密钥',
      backupCodesTitle: '保存备用代码',
      backupCodesLead: '备用代码仅显示一次。请与密码分开保存。',
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
      note: '不要向支持人员发送密码。只有在核验账户归属后才会恢复访问权限。',
      requestName: '恢复访问权限',
      requestMessage: '请求恢复工作平台访问权限。',
    },
  },
};
