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
  ACCOUNT_DISABLED: 'Tài khoản này đã bị vô hiệu hóa.',
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
