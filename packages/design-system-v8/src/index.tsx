import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react';
import type { DensityProfile } from '@pc/design-tokens';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  density?: DensityProfile;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  density = 'comfortable',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('pc-v8-button', className)}
      data-variant={variant}
      data-density={density}
      data-full-width={fullWidth ? 'true' : 'false'}
      {...props}
    />
  );
}

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div' | 'aside';
  elevation?: 'flat' | 'raised';
  padding?: 'none' | 'compact' | 'comfortable' | 'field';
};

export function Surface({
  as: Component = 'section',
  elevation = 'flat',
  padding = 'comfortable',
  className,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cx('pc-v8-surface', className)}
      data-elevation={elevation}
      data-padding={padding}
      {...props}
    />
  );
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: StatusTone }) {
  return <span className='pc-v8-status-badge' data-tone={tone}>{children}</span>;
}

export function KeyFactGrid({ children }: { children: ReactNode }) {
  return <dl className='pc-v8-key-fact-grid'>{children}</dl>;
}

export function KeyFact({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className='pc-v8-key-fact'>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export type NextActionPanelProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  blocker?: ReactNode;
  deadline?: ReactNode;
  moneyImpact?: ReactNode;
  action: ReactNode;
  secondaryAction?: ReactNode;
};

export function NextActionPanel({
  eyebrow,
  title,
  description,
  blocker,
  deadline,
  moneyImpact,
  action,
  secondaryAction,
}: NextActionPanelProps) {
  return (
    <Surface className='pc-v8-next-action' elevation='raised' padding='field'>
      <div className='pc-v8-next-action-copy'>
        {eyebrow ? <span className='pc-v8-eyebrow'>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {(blocker || deadline || moneyImpact) ? (
          <div className='pc-v8-action-meta'>
            {blocker ? <span><strong>Блокер:</strong> {blocker}</span> : null}
            {deadline ? <span><strong>Срок:</strong> {deadline}</span> : null}
            {moneyImpact ? <span><strong>Деньги:</strong> {moneyImpact}</span> : null}
          </div>
        ) : null}
      </div>
      <div className='pc-v8-next-action-controls'>
        {action}
        {secondaryAction}
      </div>
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Surface className='pc-v8-empty-state' padding='field'>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </Surface>
  );
}

export type AiTransparencyProps = {
  facts: ReactNode;
  inference?: ReactNode;
  sources?: ReactNode;
  limitation?: ReactNode;
  reviewRequired?: boolean;
};

export function AiTransparency({
  facts,
  inference,
  sources,
  limitation,
  reviewRequired = true,
}: AiTransparencyProps) {
  return (
    <Surface className='pc-v8-ai-transparency' padding='comfortable' aria-label='Основание рекомендации ИИ'>
      <header>
        <div>
          <span className='pc-v8-eyebrow'>ИИ-помощник</span>
          <h2>Основание рекомендации</h2>
        </div>
        <StatusBadge tone={reviewRequired ? 'warning' : 'success'}>
          {reviewRequired ? 'Нужна проверка человеком' : 'Проверено'}
        </StatusBadge>
      </header>
      <dl>
        <div><dt>Факты</dt><dd>{facts}</dd></div>
        {inference ? <div><dt>Вывод</dt><dd>{inference}</dd></div> : null}
        {sources ? <div><dt>Источники</dt><dd>{sources}</dd></div> : null}
        {limitation ? <div><dt>Ограничения</dt><dd>{limitation}</dd></div> : null}
      </dl>
    </Surface>
  );
}

export type WorkbenchTemplateProps = {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  evidence?: ReactNode;
  density?: DensityProfile;
};

export function WorkbenchTemplate({
  title,
  description,
  status,
  primary,
  secondary,
  evidence,
  density = 'comfortable',
}: WorkbenchTemplateProps) {
  return (
    <div className='pc-v8-workbench' data-density={density}>
      <header className='pc-v8-workbench-header'>
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {status}
      </header>
      <main className='pc-v8-workbench-main'>
        <div className='pc-v8-workbench-primary'>{primary}</div>
        {secondary ? <aside className='pc-v8-workbench-secondary'>{secondary}</aside> : null}
      </main>
      {evidence ? <section className='pc-v8-workbench-evidence' aria-label='Доказательства'>{evidence}</section> : null}
    </div>
  );
}

export type AppFrameProps = {
  header: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
  mobileNavigation?: ReactNode;
  drawerOpen?: boolean;
};

export function AppFrame({ header, navigation, children, mobileNavigation, drawerOpen = false }: AppFrameProps) {
  return (
    <div className='pc-v8-app-frame' data-drawer-open={drawerOpen ? 'true' : 'false'}>
      <header className='pc-v8-app-header'>{header}</header>
      <aside className='pc-v8-app-navigation' aria-label='Основная навигация'>{navigation}</aside>
      <main className='pc-v8-app-main' id='main-content'>{children}</main>
      {mobileNavigation ? <nav className='pc-v8-app-mobile-navigation' aria-label='Быстрые действия'>{mobileNavigation}</nav> : null}
    </div>
  );
}
