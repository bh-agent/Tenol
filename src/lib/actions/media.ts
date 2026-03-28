'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/utils/check-permission';
import {
  uuidSchema,
  saveMediaSchema,
  updateMediaSchema,
} from '@/lib/validations';
import { parseCaption } from '@/lib/utils/mentions';
import { createNotification } from '@/lib/actions/notifications';

export type MediaFile = { url: string; type: 'image' | 'video' };

/**
 * 태그 및 멘션 처리 (게시물 저장 후 호출)
 */
async function processTagsAndMentions(
  mediaId: string,
  caption: string | null,
  uploaderId: string
) {
  if (!caption) return;

  const { tags, mentions } = parseCaption(caption);
  const supabase = await createClient();

  // Insert tags
  if (tags.length > 0) {
    const tagRows = tags.map((tag) => ({ media_id: mediaId, tag }));
    await supabase.from('media_tags').insert(tagRows);
  }

  // Resolve mentions by display_name and insert
  if (mentions.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('display_name', mentions);

    if (profiles && profiles.length > 0) {
      const mentionRows = profiles.map((p) => ({
        media_id: mediaId,
        mentioned_user_id: p.id,
      }));
      await supabase.from('media_mentions').insert(mentionRows);

      // Send notification to mentioned users (skip self-mention)
      for (const profile of profiles) {
        if (profile.id !== uploaderId) {
          try {
            await createNotification(
              profile.id,
              'mention',
              '멘션',
              '게시물에서 회원님을 언급했습니다',
              { media_id: mediaId }
            );
          } catch {
            // Notification failure should not block the post
          }
        }
      }
    }
  }
}

/**
 * 클럽 피드에 게시물 저장 (다중 파일)
 */
export async function saveClubMedia(
  clubId: string,
  files: MediaFile[],
  caption: string | null
) {
  const validClubId = uuidSchema.parse(clubId);
  const validated = saveMediaSchema.parse({ files, caption });
  const { userId } = await requirePermission(validClubId, 'match.create');

  const supabase = await createClient();
  const { data, error } = await supabase.from('media').insert({
    club_id: validClubId,
    uploaded_by: userId,
    file_url: validated.files[0]?.url || '',
    file_type: validated.files[0]?.type || 'image',
    file_urls: validated.files,
    caption: validated.caption,
    feed_type: 'club',
  }).select('id').single();

  if (error || !data) throw new Error('저장에 실패했습니다');

  await processTagsAndMentions(data.id, validated.caption, userId);
}

/**
 * 개인 피드에 게시물 저장 (다중 파일)
 */
export async function savePersonalMedia(
  files: MediaFile[],
  caption: string | null
) {
  const validated = saveMediaSchema.parse({ files, caption });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: membership } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error('클럽에 가입 후 이용할 수 있습니다');

  const { data, error } = await supabase.from('media').insert({
    club_id: membership.club_id,
    uploaded_by: user.id,
    file_url: validated.files[0]?.url || '',
    file_type: validated.files[0]?.type || 'image',
    file_urls: validated.files,
    caption: validated.caption,
    feed_type: 'personal',
  }).select('id').single();

  if (error || !data) throw new Error('저장에 실패했습니다');

  await processTagsAndMentions(data.id, validated.caption, user.id);
}

/**
 * 게시물 수정 (캡션만)
 */
export async function updateMedia(mediaId: string, caption: string | null) {
  const validated = updateMediaSchema.parse({ mediaId, caption });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('media')
    .update({ caption: validated.caption })
    .eq('id', validated.mediaId)
    .eq('uploaded_by', user.id);

  if (error) throw new Error('수정에 실패했습니다');
}

/**
 * 게시물 삭제 (본인 게시물 또는 클럽 관리자)
 */
export async function deleteMedia(mediaId: string) {
  const validMediaId = uuidSchema.parse(mediaId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 게시물 조회
  const { data: media } = await supabase
    .from('media')
    .select('uploaded_by, club_id, file_urls, file_url')
    .eq('id', validMediaId)
    .single();

  if (!media) throw new Error('게시물을 찾을 수 없습니다');

  // 본인 게시물이거나 클럽 관리자인지 확인
  const isOwner = media.uploaded_by === user.id;
  if (!isOwner) {
    // 관리자 확인
    const { data: membership } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', media.club_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('삭제 권한이 없습니다');
    }
  }

  // Storage에서 파일 삭제 시도
  const files: { url: string }[] = media.file_urls || [];
  if (files.length === 0 && media.file_url) {
    files.push({ url: media.file_url });
  }

  for (const file of files) {
    try {
      const path = new URL(file.url).pathname;
      const storagePath = path.split('/object/public/club-media/')[1];
      if (storagePath) {
        await supabase.storage.from('club-media').remove([storagePath]);
      }
    } catch {
      // Storage 삭제 실패해도 DB 삭제는 진행
    }
  }

  const { error } = await supabase.from('media').delete().eq('id', validMediaId);
  if (error) throw new Error('삭제에 실패했습니다');
}
