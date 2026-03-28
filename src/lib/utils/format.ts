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

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
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

export function formatDDay(dateString: string): string {
  const target = parseISO(dateString);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = targetStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `D-${diffDays}`;
  if (diffDays === 0) return '오늘';
  return `D+${Math.abs(diffDays)}`;
}

export function formatDDayWithStatus(dateString: string, status: string): string {
  if (status === 'in_progress') return '진행중';
  if (status === 'completed') return '종료';
  if (status === 'cancelled') return '취소';
  return formatDDay(dateString);
}
