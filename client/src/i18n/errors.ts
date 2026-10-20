// The server returns error codes; this is the only place they become Vietnamese text.

import { ApiError } from '../api/http';

const MESSAGES: Record<string, string> = {
  // General
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối và thử lại.',
  VALIDATION_ERROR: 'Vui lòng kiểm tra lại các thông tin đã nhập.',
  INTERNAL_ERROR: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
  INVALID_JSON: 'Yêu cầu không hợp lệ.',
  ROUTE_NOT_FOUND: 'Không tìm thấy chức năng được yêu cầu.',
  ALREADY_EXISTS: 'Dữ liệu này đã tồn tại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',

  // Authentication
  NOT_AUTHENTICATED: 'Vui lòng đăng nhập để tiếp tục.',
  INVALID_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  INVALID_CREDENTIALS: 'Email/số điện thoại hoặc mật khẩu không đúng.',
  ACCOUNT_DISABLED: 'Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên phòng khám.',
  EMAIL_TAKEN: 'Email này đã được sử dụng.',
  PHONE_TAKEN: 'Số điện thoại này đã được sử dụng.',

  // Booking
  SPECIALTY_NOT_FOUND: 'Không tìm thấy chuyên khoa.',
  DOCTOR_NOT_FOUND: 'Không tìm thấy bác sĩ trong chuyên khoa này.',
  SHIFT_NOT_FOUND: 'Không tìm thấy ca khám.',
  DATE_IN_PAST: 'Không thể đặt lịch cho ngày đã qua.',
  DATE_OUTSIDE_BOOKING_WINDOW: 'Chỉ có thể đặt lịch trước tối đa 14 ngày.',
  SHIFT_ALREADY_STARTED: 'Ca khám này đã bắt đầu. Vui lòng chọn ca khác.',
  DUPLICATE_BOOKING: 'Bạn đã có lịch hẹn trong ca này.',
  NO_DOCTOR_ON_DUTY: 'Không có bác sĩ trực trong ca này.',
  SHIFT_FULL: 'Ca khám này đã hết chỗ. Vui lòng chọn ca khác.',

  // Appointments
  APPOINTMENT_NOT_FOUND: 'Không tìm thấy lịch hẹn.',
  INVALID_STATUS_TRANSITION:
    'Không thể thực hiện thao tác này với trạng thái hiện tại của lịch hẹn.',
  ACTION_NOT_ALLOWED_FOR_ROLE: 'Bạn không có quyền thực hiện thao tác này.',
  CANCEL_DEADLINE_PASSED: 'Đã quá hạn hủy: chỉ có thể hủy trước giờ bắt đầu ca khám.',
  APPOINTMENT_CHANGED: 'Lịch hẹn vừa được người khác cập nhật. Vui lòng tải lại trang.',
  NOT_YOUR_APPOINTMENT: 'Bạn chỉ có thể thao tác với lịch hẹn của chính mình.',

  // Reception
  CHECK_IN_NOT_TODAY: 'Chỉ có thể check-in vào đúng ngày khám.',
  CHECK_IN_SHIFT_ENDED: 'Ca khám đã kết thúc, không thể check-in.',
  NO_SHOW_TOO_EARLY: 'Chỉ có thể đánh dấu vắng mặt sau khi ca khám bắt đầu.',

  // Doctor queue
  NOT_YOUR_PATIENT: 'Bệnh nhân này không thuộc hàng đợi của bạn.',
  EXAM_NOT_TODAY: 'Chỉ có thể bắt đầu khám vào đúng ngày khám.',
  DOCTOR_BUSY:
    'Bạn đang khám một bệnh nhân khác (có thể ở ca khác trong ngày). Vui lòng hoàn thành lượt khám đó trước.',
  NO_PATIENT_WAITING: 'Chưa có bệnh nhân nào đang chờ (đã check-in).',
  ROSTER_ENTRY_NOT_FOUND: 'Không tìm thấy ca trực.',

  // Admin
  SPECIALTY_NAME_TAKEN: 'Đã có chuyên khoa với tên này.',
  SPECIALTY_INACTIVE: 'Chuyên khoa này đã ngừng hoạt động.',
  ROOM_NOT_FOUND: 'Không tìm thấy phòng khám.',
  ROOM_CODE_TAKEN: 'Mã phòng này đã được sử dụng.',
  ROOM_INACTIVE: 'Phòng khám này đã ngừng hoạt động.',
  DOCTOR_INACTIVE: 'Bác sĩ này đã ngừng hoạt động.',
  USER_NOT_FOUND: 'Không tìm thấy tài khoản.',
  HAS_UPCOMING_APPOINTMENTS:
    'Không thể ngừng hoạt động: vẫn còn lịch hẹn chưa hoàn tất từ hôm nay trở đi. Hãy xử lý các lịch hẹn đó trước.',
  SHIFT_TIMES_INVALID: 'Giờ bắt đầu phải trước giờ kết thúc.',
  SHIFT_TIMES_OVERLAP: 'Khung giờ này trùng với ca khám khác.',
  ROSTER_DATE_IN_PAST: 'Không thể thay đổi lịch trực của ngày đã qua.',
  ROSTER_DOCTOR_CONFLICT: 'Bác sĩ đã có lịch trực trong ca này (ở phòng khác).',
  ROSTER_ROOM_CONFLICT: 'Phòng này đã có bác sĩ trực trong ca này.',
  ROSTER_CAPACITY_BELOW_BOOKED: 'Số bệnh nhân tối đa không được nhỏ hơn số lượt đã đặt.',
  ROSTER_HAS_APPOINTMENTS:
    'Không thể xóa ca trực đã có lượt đặt (kể cả lượt đã hủy). Hãy giảm số bệnh nhân tối đa thay vì xóa.',

  // Form fields
  REQUIRED: 'Vui lòng nhập thông tin này.',
  INVALID_VALUE: 'Giá trị không hợp lệ.',
  ID_INVALID: 'Giá trị không hợp lệ.',
  NAME_REQUIRED: 'Vui lòng nhập họ và tên.',
  NAME_TOO_LONG: 'Họ và tên quá dài (tối đa 100 ký tự).',
  EMAIL_INVALID: 'Email không hợp lệ.',
  PHONE_INVALID: 'Số điện thoại phải gồm 9–15 chữ số.',
  PASSWORD_TOO_SHORT: 'Mật khẩu phải có ít nhất 8 ký tự.',
  PASSWORD_TOO_LONG: 'Mật khẩu quá dài (tối đa 72 ký tự).',
  PASSWORD_MISMATCH: 'Mật khẩu nhập lại không khớp.',
  DATE_INVALID: 'Ngày không hợp lệ (định dạng dd/mm/yyyy).',
  DATE_OF_BIRTH_IN_FUTURE: 'Ngày sinh không được ở tương lai.',
  GENDER_INVALID: 'Vui lòng chọn giới tính.',
  ADDRESS_TOO_LONG: 'Địa chỉ quá dài (tối đa 200 ký tự).',
  IDENTIFIER_REQUIRED: 'Vui lòng nhập email hoặc số điện thoại.',
  PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu.',
  REASON_TOO_LONG: 'Nội dung quá dài (tối đa 500 ký tự).',
  NOTE_REQUIRED: 'Vui lòng nhập nội dung ghi chú.',
  NOTE_TOO_LONG: 'Ghi chú quá dài (tối đa 1000 ký tự).',
  DATE_OR_QUERY_REQUIRED: 'Vui lòng chọn ngày hoặc nhập từ khóa tìm kiếm.',
  DESCRIPTION_TOO_LONG: 'Mô tả quá dài (tối đa 500 ký tự).',
  ROOM_CODE_INVALID: 'Mã phòng chỉ gồm chữ, số và dấu gạch ngang (tối đa 10 ký tự), VD: B2-05.',
  FLOOR_TOO_LONG: 'Tầng quá dài (tối đa 20 ký tự).',
  TITLE_REQUIRED: 'Vui lòng nhập học hàm/học vị, VD: BS.CKI.',
  TITLE_TOO_LONG: 'Học hàm/học vị quá dài (tối đa 50 ký tự).',
  BIO_TOO_LONG: 'Giới thiệu quá dài (tối đa 500 ký tự).',
  TIME_INVALID: 'Giờ không hợp lệ (định dạng HH:mm, VD: 07:30).',
  MAX_PATIENTS_INVALID: 'Số bệnh nhân tối đa phải là số nguyên từ 1 đến 100.',
  WEEK_START_NOT_MONDAY: 'Tuần phải bắt đầu từ thứ Hai.',
  STATUS_INVALID: 'Trạng thái không hợp lệ.',
  QUERY_TOO_LONG: 'Từ khóa tìm kiếm quá dài (tối đa 50 ký tự).',
};

const FALLBACK = 'Đã có lỗi xảy ra. Vui lòng thử lại.';

/** Vietnamese text for an error code. */
export function translateError(code: string): string {
  return MESSAGES[code] ?? FALLBACK;
}

/** Vietnamese message for anything thrown by an API call. */
export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? translateError(err.code) : FALLBACK;
}

/** Per-field Vietnamese messages from a VALIDATION_ERROR, keyed by field name. */
export function fieldErrorMessages(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  return Object.fromEntries(err.details.map((d) => [d.path, translateError(d.code)]));
}

export function hasErrorCode(err: unknown, ...codes: string[]): boolean {
  return err instanceof ApiError && codes.includes(err.code);
}
