import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'M월 d일 (EEE)', { locale: ko });
}

export function formatDateFull(dateStr: string) {
  return format(parseISO(dateStr), 'yyyy년 M월 d일 (EEE)', { locale: ko });
}

export function formatTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const period = h < 12 ? '오전' : '오후';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${period} ${displayHour}:${minutes}`;
}

export function formatMatchStatus(status: string) {
  const map: Record<string, string> = {
    upcoming: '예정',
    in_progress: '진행 중',
    completed: '완료',
    cancelled: '취소',
  };
  return map[status] || status;
}

export function formatRole(role: string) {
  const map: Record<string, string> = {
    owner: '클럽장',
    admin: '운영진',
    member: '멤버',
  };
  return map[role] || role;
}

export function formatParticipantStatus(status: string) {
  const map: Record<string, string> = {
    confirmed: '확정',
    pending: '대기중',
    rejected: '거절',
    withdrawn: '취소',
  };
  return map[status] || status;
}
