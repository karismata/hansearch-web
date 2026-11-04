import { accountClient } from './accounts';

export interface InfoComment {
  id: string;
  info_id: number;
  author_id: string;
  author_username: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}
const PAGE_SIZE = 30;
export async function fetchComments(infoId: number, offset = 0) {
  const { data, error, count } = await accountClient().from('info_comments')
    .select('*', { count: 'exact' }).eq('info_id', infoId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return { comments: (data || []) as InfoComment[], total: count || 0 };
}
export async function addComment(infoId: number, body: string) {
  const { data, error } = await accountClient().from('info_comments')
    .insert({ info_id: infoId, body: body.trim() }).select().single();
  if (error) throw error;
  return data as InfoComment;
}
export async function editComment(id: string, body: string) {
  const { data, error } = await accountClient().from('info_comments')
    .update({ body: body.trim() }).eq('id', id).select().single();
  if (error) throw error;
  return data as InfoComment;
}
export async function deleteComment(id: string) {
  const { data, error } = await accountClient().from('info_comments').delete().eq('id', id).select('id').single();
  if (error || !data) throw error || new Error('삭제할 댓글을 찾지 못했습니다.');
}

