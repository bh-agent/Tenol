'use client';

import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { MentionAutocomplete } from '@/components/media/mention-autocomplete';
import { useMentionInput } from '@/lib/hooks/use-mention-input';
import { ImagePlus, X, ChevronLeft, ChevronRight, Camera, Film, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface MultiUploadProps {
  storagePath: string;
  onUpload: (files: { url: string; type: 'image' | 'video' }[], caption: string | null) => Promise<void>;
  maxFiles?: number;
  userAvatar?: string | null;
  userName?: string;
  clubId?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export function MultiUpload({ storagePath, onUpload, maxFiles = 10, userAvatar, userName, clubId }: MultiUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentPreview, setCurrentPreview] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mention = useMentionInput(textareaRef, setCaption);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      alert(`최대 ${maxFiles}개까지 업로드 가능합니다`);
      return;
    }

    const toAdd = selected.slice(0, remaining);
    const invalidType = toAdd.filter((f) => !ALLOWED_TYPES.includes(f.type));
    if (invalidType.length > 0) {
      alert('이미지(JPEG, PNG, GIF, WebP) 또는 동영상(MP4, WebM)만 업로드 가능합니다');
      return;
    }

    const oversized = toAdd.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      alert('10MB 이하의 파일만 업로드 가능합니다');
      return;
    }

    const newPreviews: FilePreview[] = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));

    setFiles((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      const next = prev.filter((_, i) => i !== index);
      if (currentPreview >= next.length && next.length > 0) {
        setCurrentPreview(next.length - 1);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      const supabase = createClient();
      const uploadedFiles: { url: string; type: 'image' | 'video' }[] = [];

      for (const { file, type } of files) {
        const fileExt = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const fileName = `${storagePath}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error } = await supabase.storage
          .from('club-media')
          .upload(fileName, file);

        if (error) throw new Error(`업로드 실패: ${error.message}`);

        const { data: urlData } = supabase.storage
          .from('club-media')
          .getPublicUrl(fileName);

        uploadedFiles.push({ url: urlData.publicUrl, type });
      }

      await onUpload(uploadedFiles, caption || null);
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setCaption('');
      setCurrentPreview(0);
    } catch (e) {
      alert(e instanceof Error ? e.message : '업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const cancel = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setCaption('');
    setCurrentPreview(0);
  };

  // Auto-resize textarea + mention detection
  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaption(e.target.value);
    mention.handleInputChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  // ── Empty state: Instagram-style upload prompt ──
  if (files.length === 0) {
    return (
      <>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl overflow-hidden group active:scale-[0.98] transition-transform"
        >
          <div className="relative bg-surface border border-border rounded-2xl overflow-hidden">
            {/* Visual area */}
            <div className="aspect-square max-h-[280px] w-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-surface to-surface-elevated">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/15 transition-all duration-300">
                <Camera className="w-8 h-8 text-primary/70 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">사진이나 동영상을 선택하세요</p>
                <p className="text-xs text-muted-foreground mt-1">최대 {maxFiles}개, 10MB 이하</p>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="w-4 h-4" />
                <span>사진</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Film className="w-4 h-4" />
                <span>동영상</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <span className="text-xs text-primary font-medium">선택하기</span>
            </div>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </>
    );
  }

  // ── Instagram-style create post view ──
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={cancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          취소
        </button>
        <span className="text-sm font-semibold text-foreground">새 게시물</span>
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="text-sm font-semibold text-primary hover:text-primary-light transition-colors disabled:opacity-50"
        >
          {uploading ? '공유 중...' : '공유'}
        </button>
      </div>

      {/* Image preview carousel */}
      <div className="relative aspect-square bg-black">
        {files[currentPreview]?.type === 'video' ? (
          <video
            src={files[currentPreview].preview}
            className="w-full h-full object-contain"
            controls
            muted
          />
        ) : (
          <Image
            src={files[currentPreview]?.preview || ''}
            alt=""
            fill
            className="object-contain"
          />
        )}

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            {currentPreview > 0 && (
              <button
                onClick={() => setCurrentPreview((p) => p - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {currentPreview < files.length - 1 && (
              <button
                onClick={() => setCurrentPreview((p) => p + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {/* Photo count */}
        {files.length > 1 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
            {currentPreview + 1}/{files.length}
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm text-white font-medium">업로드 중...</span>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto scrollbar-hide">
        {files.map((f, i) => (
          <button
            key={i}
            onClick={() => setCurrentPreview(i)}
            className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
              i === currentPreview ? 'border-primary' : 'border-transparent opacity-60'
            }`}
          >
            <Image src={f.preview} alt="" fill className="object-cover" />
            {f.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Film className="w-3 h-3 text-white" />
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </button>
        ))}

        {/* Add more */}
        {files.length < maxFiles && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-lg border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 hover:border-primary transition-colors"
          >
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Caption input area (Instagram-style) */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {userName && (
            <Avatar
              src={userAvatar}
              alt={userName}
              fallback={userName}
              size="sm"
            />
          )}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={caption}
              onChange={handleCaptionChange}
              onKeyDown={(e) => {
                if (mention.handleKeyDown(e)) {
                  e.preventDefault();
                }
              }}
              placeholder="문구를 작성하세요..."
              rows={1}
              className="w-full text-sm text-foreground bg-transparent placeholder:text-muted-foreground resize-none focus:outline-none min-h-[60px] max-h-[120px]"
            />
            <MentionAutocomplete
              query={mention.autocompleteQuery}
              clubId={clubId}
              isOpen={mention.isAutocompleteOpen}
              onSelect={mention.handleSelect}
              onClose={mention.handleClose}
              position="above"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 pl-11">
          #태그 로 해시태그, @이름 으로 멤버 언급
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
