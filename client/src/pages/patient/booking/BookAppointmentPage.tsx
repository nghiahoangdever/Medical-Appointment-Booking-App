import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import type { Appointment, Doctor, ShiftAvailability, Specialty } from '../../../types';
import { BookingSuccess } from './BookingSuccess';
import { StepConfirm } from './StepConfirm';
import { StepDoctor } from './StepDoctor';
import { StepSchedule } from './StepSchedule';
import { StepSpecialty } from './StepSpecialty';
import { Stepper } from './Stepper';

interface Choices {
  specialty?: Specialty;
  /** undefined = not chosen yet, null = any doctor. */
  doctor?: Doctor | null;
  date?: string;
  shift?: ShiftAvailability;
}

/**
 * UC-P4 booking wizard: specialty → doctor (optional) → date & shift → confirm.
 * Changing an earlier choice clears the later ones.
 */
export function BookAppointmentPage() {
  const [step, setStep] = useState(1);
  const [choices, setChoices] = useState<Choices>({});
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  function reset() {
    setChoices({});
    setBooked(null);
    setStep(1);
  }

  if (booked) return <BookingSuccess appointment={booked} onBookAnother={reset} />;

  const { specialty, doctor, date, shift } = choices;

  return (
    <>
      <PageHeader title="Đặt lịch khám" />
      <Stepper current={step} onGoTo={setStep} />

      {step === 1 && (
        <StepSpecialty
          selectedId={specialty?.id}
          onSelect={(s) => {
            setChoices({ specialty: s });
            setStep(2);
          }}
        />
      )}

      {step === 2 && specialty && (
        <StepDoctor
          specialty={specialty}
          selected={doctor}
          onSelect={(d) => {
            setChoices({ specialty, doctor: d });
            setStep(3);
          }}
        />
      )}

      {step === 3 && specialty && doctor !== undefined && (
        <StepSchedule
          specialty={specialty}
          doctor={doctor}
          selectedDate={date ?? null}
          selectedShiftId={shift?.shiftId}
          reloadKey={availabilityVersion}
          onSelectDate={(d) => setChoices({ specialty, doctor, date: d })}
          onSelectShift={(d, s) => {
            setChoices({ specialty, doctor, date: d, shift: s });
            setStep(4);
          }}
        />
      )}

      {step === 4 && specialty && doctor !== undefined && date && shift && (
        <StepConfirm
          specialty={specialty}
          doctor={doctor}
          date={date}
          shift={shift}
          onBooked={setBooked}
          onPickAnotherShift={() => {
            setChoices({ specialty, doctor, date });
            setAvailabilityVersion((v) => v + 1);
            setStep(3);
          }}
        />
      )}

      {step > 1 && (
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Quay lại
          </Button>
        </div>
      )}
    </>
  );
}
