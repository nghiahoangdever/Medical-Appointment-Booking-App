export const STEPS = ['Chuyên khoa', 'Bác sĩ', 'Ngày & ca khám', 'Xác nhận'] as const;

interface StepperProps {
  /** 1-based current step. */
  current: number;
  /** Going back to an earlier step is allowed; later steps are not clickable. */
  onGoTo: (step: number) => void;
}

export function Stepper({ current, onGoTo }: StepperProps) {
  return (
    <ol aria-label="Các bước đặt lịch" className="mb-6 grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!done}
              onClick={() => onGoTo(step)}
              aria-current={active ? 'step' : undefined}
              className="group flex w-full flex-col gap-1.5 rounded text-left disabled:cursor-default"
            >
              <span
                className={`h-1 rounded-full transition-colors duration-200 ${
                  active || done ? 'bg-brand-600' : 'bg-slate-200'
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  active
                    ? 'text-brand-700'
                    : done
                      ? 'text-slate-700 group-hover:text-brand-700'
                      : 'text-slate-500'
                }`}
              >
                {step}. {label}
                {active && <span className="sr-only"> (bước hiện tại)</span>}
                {done && <span className="sr-only"> (đã xong)</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
