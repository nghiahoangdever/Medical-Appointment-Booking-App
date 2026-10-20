import { shiftShortLabel } from '../../../i18n/labels';
import { formatDayMonth, todayIso, weekdayShort } from '../../../lib/date';
import type { RosterEntry, RosterWeek } from '../../../types';

export interface RosterCell {
  date: string;
  shiftId: number;
  roomId: number;
}

// One colour per specialty (by order of first appearance), so the week reads at a glance.
const PALETTE = [
  'bg-teal-50 text-teal-900 ring-teal-200',
  'bg-sky-50 text-sky-900 ring-sky-200',
  'bg-violet-50 text-violet-900 ring-violet-200',
  'bg-amber-50 text-amber-900 ring-amber-200',
  'bg-rose-50 text-rose-900 ring-rose-200',
];

interface RosterGridProps {
  week: RosterWeek;
  selected: RosterCell | null;
  onSelect: (cell: RosterCell) => void;
}

/** Rows = rooms, columns = day × shift. Each cell is one roster slot (empty or an entry). */
export function RosterGrid({ week, selected, onSelect }: RosterGridProps) {
  const today = todayIso();
  const specialtyColor = new Map<number, string>();
  for (const d of week.doctors) {
    if (!specialtyColor.has(d.specialty.id)) {
      specialtyColor.set(d.specialty.id, PALETTE[specialtyColor.size % PALETTE.length]);
    }
  }
  const entryAt = (cell: RosterCell) =>
    week.entries.find(
      (e) => e.date === cell.date && e.shiftId === cell.shiftId && e.roomId === cell.roomId,
    );

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-28" />
        </colgroup>
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th rowSpan={2} className="border-b border-slate-200 px-3 text-left font-semibold">
              Phòng
            </th>
            {week.days.map((day) => (
              <th
                key={day.date}
                colSpan={week.shifts.length}
                className={`border-b border-l border-slate-200 px-1 pt-2 pb-1 font-semibold ${
                  day.date === today ? 'text-teal-700' : ''
                } ${day.editable ? '' : 'text-slate-400'}`}
              >
                {weekdayShort(day.date)} {formatDayMonth(day.date)}
                {day.date === today && <span className="ml-1 font-normal">(hôm nay)</span>}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50 text-slate-500">
            {week.days.flatMap((day) =>
              week.shifts.map((shift, i) => (
                <th
                  key={`${day.date}-${shift.id}`}
                  className={`border-b border-slate-200 px-1 pb-2 font-normal ${i === 0 ? 'border-l' : ''}`}
                >
                  {shiftShortLabel(shift.name)}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {week.rooms.map((room) => (
            <tr key={room.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 align-top">
                <div className="font-mono font-semibold text-slate-800">{room.code}</div>
                {!room.isActive && <div className="text-[11px] text-rose-600">Ngừng hoạt động</div>}
              </td>
              {week.days.flatMap((day) =>
                week.shifts.map((shift, i) => {
                  const cell = { date: day.date, shiftId: shift.id, roomId: room.id };
                  const entry = entryAt(cell);
                  const isSelected =
                    selected?.date === cell.date &&
                    selected.shiftId === cell.shiftId &&
                    selected.roomId === cell.roomId;
                  return (
                    <td
                      key={`${day.date}-${shift.id}`}
                      className={`h-14 p-0.5 align-top ${i === 0 ? 'border-l border-slate-200' : ''} ${
                        day.editable ? '' : 'bg-slate-50'
                      }`}
                    >
                      {entry ? (
                        <EntryChip
                          entry={entry}
                          color={specialtyColor.get(entry.doctor.specialty.id) ?? PALETTE[0]}
                          selected={isSelected}
                          onClick={() => onSelect(cell)}
                        />
                      ) : (
                        day.editable && (
                          <button
                            type="button"
                            onClick={() => onSelect(cell)}
                            aria-label="Thêm ca trực"
                            className={`flex h-full w-full items-center justify-center rounded text-base text-slate-300 hover:bg-slate-100 hover:text-teal-700 ${
                              isSelected ? 'bg-teal-50 text-teal-700 ring-2 ring-teal-500' : ''
                            }`}
                          >
                            +
                          </button>
                        )
                      )}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryChip({
  entry,
  color,
  selected,
  onClick,
}: {
  entry: RosterEntry;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const shortName = entry.doctor.fullName.split(' ').at(-1);
  const full = entry.activeCount >= entry.maxPatients;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.doctor.title} ${entry.doctor.fullName} — ${entry.doctor.specialty.name}`}
      className={`flex h-full w-full flex-col justify-between rounded px-1 py-0.5 text-left ring-1 ${color} ${
        selected ? 'ring-2 ring-teal-600' : ''
      } ${entry.doctor.isActive ? '' : 'opacity-60'}`}
    >
      <span className="truncate font-medium">{shortName}</span>
      <span className={`tabular-nums ${full ? 'font-semibold text-rose-700' : ''}`}>
        {entry.activeCount}/{entry.maxPatients}
      </span>
    </button>
  );
}
