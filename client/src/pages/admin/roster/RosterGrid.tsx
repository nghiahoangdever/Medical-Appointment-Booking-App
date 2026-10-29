import { shiftLabel, shiftShortLabel } from '../../../i18n/labels';
import { formatDayMonth, todayIso, weekdayShort } from '../../../lib/date';
import type { RosterEntry, RosterWeek } from '../../../types';

export interface RosterCell {
  date: string;
  shiftId: number;
  roomId: number;
}

// One colour per specialty (by order of first appearance), so the week reads at a glance.
const PALETTE = [
  { fill: 'bg-roster-1-bg text-roster-1-fg', ring: 'ring-roster-1-ring' },
  { fill: 'bg-roster-2-bg text-roster-2-fg', ring: 'ring-roster-2-ring' },
  { fill: 'bg-roster-3-bg text-roster-3-fg', ring: 'ring-roster-3-ring' },
  { fill: 'bg-roster-4-bg text-roster-4-fg', ring: 'ring-roster-4-ring' },
  { fill: 'bg-roster-5-bg text-roster-5-fg', ring: 'ring-roster-5-ring' },
];

interface RosterGridProps {
  week: RosterWeek;
  selected: RosterCell | null;
  onSelect: (cell: RosterCell) => void;
}

/** Rows = rooms, columns = day × shift. Each cell is one roster slot (empty or an entry). */
export function RosterGrid({ week, selected, onSelect }: RosterGridProps) {
  const today = todayIso();
  const specialtyColor = new Map<number, (typeof PALETTE)[number]>();
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
    <div
      tabIndex={0}
      role="region"
      aria-label="Lưới lịch trực theo phòng, ngày và ca"
      className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200"
    >
      <table className="w-full min-w-[1040px] table-fixed border-collapse text-xs">
        <caption className="sr-only">Lịch trực theo tuần</caption>
        <colgroup>
          <col className="w-28" />
        </colgroup>
        <thead>
          <tr className="bg-slate-25 text-slate-700">
            <th
              scope="col"
              rowSpan={2}
              className="border-b border-slate-200 px-3 text-left font-semibold"
            >
              Phòng
            </th>
            {week.days.map((day) => (
              <th
                key={day.date}
                scope="colgroup"
                colSpan={week.shifts.length}
                className={`border-b border-l border-slate-200 px-1 pt-2 pb-1 font-semibold ${
                  day.date === today ? 'text-brand-700' : day.editable ? '' : 'text-slate-500'
                }`}
              >
                {weekdayShort(day.date)} {formatDayMonth(day.date)}
                {day.date === today && <span className="ml-1 font-normal">(hôm nay)</span>}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-25 text-slate-500">
            {week.days.flatMap((day) =>
              week.shifts.map((shift, i) => (
                <th
                  key={`${day.date}-${shift.id}`}
                  scope="col"
                  className={`border-b border-slate-200 px-1 pb-2 font-normal ${i === 0 ? 'border-l' : ''}`}
                >
                  {shiftShortLabel(shift.name)}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {week.rooms.length === 0 && (
            <tr>
              <td
                colSpan={1 + week.days.length * week.shifts.length}
                className="px-4 py-10 text-center text-sm text-slate-500"
              >
                Chưa có phòng khám nào. Thêm phòng ở trang “Phòng khám” trước khi xếp lịch trực.
              </td>
            </tr>
          )}
          {week.rooms.map((room) => (
            <tr key={room.id} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-3 py-2 text-left align-top font-normal">
                <div className="code-text text-slate-900">{room.code}</div>
                {!room.isActive && <div className="text-[11px] text-danger">Ngừng hoạt động</div>}
              </th>
              {week.days.flatMap((day) =>
                week.shifts.map((shift, i) => {
                  const cell = { date: day.date, shiftId: shift.id, roomId: room.id };
                  const entry = entryAt(cell);
                  const isSelected =
                    selected?.date === cell.date &&
                    selected.shiftId === cell.shiftId &&
                    selected.roomId === cell.roomId;
                  const where = `Phòng ${room.code}, ${weekdayShort(day.date)} ${formatDayMonth(day.date)}, ${shiftLabel(shift.name).toLowerCase()}`;
                  return (
                    <td
                      key={`${day.date}-${shift.id}`}
                      className={`h-14 p-0.5 align-top ${i === 0 ? 'border-l border-slate-200' : ''} ${
                        day.editable ? '' : 'bg-slate-25'
                      }`}
                    >
                      {entry ? (
                        <EntryChip
                          entry={entry}
                          where={where}
                          color={specialtyColor.get(entry.doctor.specialty.id) ?? PALETTE[0]}
                          selected={isSelected}
                          onClick={() => onSelect(cell)}
                        />
                      ) : (
                        day.editable && (
                          <button
                            type="button"
                            onClick={() => onSelect(cell)}
                            aria-label={`Thêm ca trực: ${where}`}
                            aria-pressed={isSelected}
                            className={`flex h-full w-full items-center justify-center rounded text-base transition-colors duration-150 hover:bg-slate-100 hover:text-brand-700 ${
                              isSelected
                                ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600 ring-inset'
                                : 'text-slate-500'
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
  where,
  color,
  selected,
  onClick,
}: {
  entry: RosterEntry;
  /** Room, day and shift, for the spoken label. */
  where: string;
  color: (typeof PALETTE)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const shortName = entry.doctor.fullName.split(' ').at(-1);
  const full = entry.activeCount >= entry.maxPatients;
  const doctor = `${entry.doctor.title} ${entry.doctor.fullName}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${doctor} — ${entry.doctor.specialty.name}`}
      aria-label={`${where}: ${doctor}, ${entry.activeCount}/${entry.maxPatients} bệnh nhân${
        full ? ', đã đầy' : ''
      }${entry.doctor.isActive ? '' : ', bác sĩ ngừng hoạt động'}`}
      aria-pressed={selected}
      className={`flex h-full w-full flex-col justify-between rounded px-1 py-0.5 text-left ring-inset ${color.fill} ${
        selected ? 'ring-2 ring-brand-600' : `ring-1 ${color.ring}`
      } ${entry.doctor.isActive ? '' : 'opacity-60'}`}
    >
      <span className="w-full truncate font-medium">{shortName}</span>
      <span className={`tabular ${full ? 'font-semibold text-danger' : ''}`}>
        {entry.activeCount}/{entry.maxPatients}
        {full && ' · Đầy'}
      </span>
    </button>
  );
}
