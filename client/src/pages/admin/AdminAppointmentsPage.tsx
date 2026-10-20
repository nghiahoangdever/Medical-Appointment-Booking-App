import { ReceptionPage } from '../reception/ReceptionPage';

/**
 * UC-A8: all appointments (same list, filters and search as reception). Admins can cancel
 * (state machine) and read notes, but don't check in or add notes.
 */
export function AdminAppointmentsPage() {
  return (
    <ReceptionPage
      title="Tất cả lịch hẹn"
      subtitle="Xem lịch hẹn theo ngày hoặc tìm theo mã / số điện thoại. Quản trị viên có thể hủy lịch hẹn chưa check-in."
      canAddNotes={false}
    />
  );
}
