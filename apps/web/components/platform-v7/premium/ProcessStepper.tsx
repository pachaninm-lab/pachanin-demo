export type ProcessStep = {
  label: string;
  state: 'done' | 'current' | 'upcoming';
};

export function ProcessStepper({ steps, ariaLabel = 'Этапы процесса' }: { steps: readonly ProcessStep[]; ariaLabel?: string }) {
  return (
    <ol className='pc-prem-stepper' aria-label={ariaLabel} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {steps.map((step, index) => (
        <li key={step.label} className='pc-prem-step' data-state={step.state}>
          <span className='pc-prem-step__dot' aria-hidden='true'>
            {step.state === 'done' ? '✓' : index + 1}
          </span>
          <span className='pc-prem-step__label'>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
