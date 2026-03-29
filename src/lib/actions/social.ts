'use server';

import { createClient } from '@/lib/supabase/server';
import { uuidSchema, commentBodySchema } from '@/lib/validations';
import { createNotification } from '@/lib/actions/notifications';

/**
 * 좋아요 토글 (좋아요가 있으면 취소, 없으면 추가)
 */
export async function toggleLike(mediaId: string) {
  const validMediaId = uuidSchema.parse(mediaId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 기존 좋아요 확인
  const { data: existing } = await supabase
    .from('media_likes')
    .select('id')
    .eq('media_id', validMediaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // 좋아요 취소
    const { error } = await supabase
      .from('media_likes')
      .delete()
      .eq('id', existing.id);

    if (error) throw new Error('좋아요 취소에 실패했습니다');
  } else {
    // 좋아요 추가
    const { error } = await supabase
      .from('media_likes')
      .insert({ media_id: validMediaId, user_id: user.id });

    if (error) throw new Error('좋아요에 실패했습니다');

    // 게시물 작성자에게 좋아요 알림 (본인 제외)
    try {
      const { data: media } = await supabase
        .from('media')
        .select('uploaded_by')
        .eq('id', validMediaId)
        .single();

      if (media && media.uploaded_by !== user.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();

        const name = profile?.display_name ?? '누군가';
        await createNotification(
          media.uploaded_by,
          'new_like',
          `${name}님이 회원님의 게시물을 좋아합니다`,
          '게시물에 좋아요를 눌렀습니다',
          { media_id: validMediaId, liker_id: user.id }
        );
      }
    } catch {
      // 알림 실패는 좋아요 동작에 영향을 주지 않음
    }
  }

  // 업데이트된 카운트 조회
  const { count } = await supabase
    .from('media_likes')
    .select('*', { count: 'exact', head: true })
    .eq('media_id', validMediaId);

  return { liked: !existing, likeCount: count ?? 0 };
}

/**
 * 댓글 작성
 */
export async function addComment(mediaId: string, body: string) {
  const validMediaId = uuidSchema.parse(mediaId);
  const validBody = commentBodySchema.parse(body);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data, error } = await supabase
    .from('media_comments')
    .insert({
      media_id: validMediaId,
      user_id: user.id,
      body: validBody,
    })
    .select(`
      id, media_id, user_id, body, created_at,
      profiles:user_id (display_name, avatar_url)
    `)
    .single();

  if (error) throw new Error('댓글 작성에 실패했습니다');

  // 게시물 작성자에게 댓글 알림 (본인 제외)
  try {
    const { data: media } = await supabase
      .from('media')
      .select('uploaded_by')
      .eq('id', validMediaId)
      .single();

    if (media && media.uploaded_by !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const name = profile?.display_name ?? '누군가';
      const preview = validBody.length > 30 ? validBody.slice(0, 30) + '...' : validBody;
      await createNotification(
        media.uploaded_by,
        'new_comment',
        `${name}님이 댓글을 남겼습니다`,
        preview,
        { media_id: validMediaId, commenter_id: user.id }
      );
    }
  } catch {
    // 알림 실패는 댓글 동작에 영향을 주지 않음
  }

  return data;
}

/**
 * 댓글 삭제 (본인 댓글 또는 게시물 작성자)
 */
export async function deleteComment(commentId: string) {
  const validCommentId = uuidSchema.parse(commentId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 댓글 조회하여 소유권 확인
  const { data: comment } = await supabase
    .from('media_comments')
    .select('id, user_id, media_id')
    .eq('id', validCommentId)
    .single();

  if (!comment) throw new Error('댓글을 찾을 수 없습니다');

  // 본인 댓글인지 확인
  const isCommentOwner = comment.user_id === user.id;

  if (!isCommentOwner) {
    // 게시물 작성자인지 확인
    const { data: media } = await supabase
      .from('media')
      .select('uploaded_by')
      .eq('id', comment.media_id)
      .single();

    if (!media || media.uploaded_by !== user.id) {
      throw new Error('삭제 권한이 없습니다');
    }
  }

  const { error } = await supabase
    .from('media_comments')
    .delete()
    .eq('id', validCommentId);

  if (error) throw new Error('댓글 삭제에 실패했습니다');
}
