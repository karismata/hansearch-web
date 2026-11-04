import { accountClient } from './accounts';
import type { InfoItem } from '../types';
import type { InfoComment } from './comments';

export interface CommentNotification {
  id: string; info_id: number; comment_id: string; actor_username: string; info_title: string;
  kind: 'comment' | 'reply'; created_at: string; read_at: string | null;
}
export interface NotificationContext {
  item: InfoItem; threadId: string; comment: InfoComment;
}
export async function fetchUnreadCount() {
  const { error, count } = await accountClient().from('comment_notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count || 0;
}
export async function fetchNotifications(offset = 0) {
  const { data, error, count } = await accountClient().from('comment_notifications').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 19);
  if (error) throw error;
  return { notifications: (data || []) as CommentNotification[], total: count || 0 };
}
export async function markNotificationRead(id: string) {
  const { error } = await accountClient().from('comment_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await accountClient().from('comment_notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
  if (error) throw error;
}
export async function fetchNotificationContext(notification: CommentNotification): Promise<NotificationContext> {
  const [item, comment] = await Promise.all([
    accountClient().from('info').select('*').eq('id', notification.info_id).maybeSingle(),
    accountClient().from('info_comments').select('*').eq('info_id', notification.info_id).eq('id', notification.comment_id).maybeSingle(),
  ]);
  if (item.error || comment.error) throw item.error || comment.error;
  if (!item.data || !comment.data) throw new Error('삭제되었거나 확인할 수 없는 자료·댓글입니다.');
  return { item: item.data as InfoItem, threadId: (comment.data.parent_id || comment.data.id) as string, comment: comment.data as InfoComment };
}
