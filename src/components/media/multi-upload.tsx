'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

interface FilePreview {
  file: File;
  preview: string;
}

interface MultiUploadProps {
  storagePath: string;
  onUpload: (files: { url: string; type: 'image' | 'video' }[], caption: string | null) => Promise<void>;
  maxFiles?: number;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export function MultiUpload({ storagePath, onUpload, maxFiles = 10 }: MultiUploadProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const newPreviews = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      const supabase = createClient();
      const uploadedFiles: { url: string; type: 'image' | 'video' }[] = [];

      for (const { file } of files) {
        const fileExt = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const fileName = `${storagePath}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error } = await supabase.storage
          .from('club-media')
          .upload(fileName, file);

        if (error) throw new Error(`업로드 실패: ${error.message}`);

        const { data: urlData } = supabase.storage
          .from('club-media')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          url: urlData.publicUrl,
          type: file.type.startsWith('video/') ? 'video' : 'image',
        });
      }

      await onUpload(uploadedFiles, caption || null);

      // 초기화
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setCaption('');
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
  };

  if (files.length === 0) {
    return (
      <>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-2xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98] bg-transparent"
        >
          <ImagePlus className="w-8 h-8" />
          <span className="text-sm font-medium">사진 업로드</span>
          <span className="text-xs">최대 {maxFiles}장</span>
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

  return (
    <Card>
      {/* Preview Grid */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
        {files.map((f, i) => (
          <div key={i} className="relative aspect-square bg-surface-elevated rounded-lg overflow-hidden">
            <Image src={f.preview} alt="" fill className="object-cover" />
            <button
              onClick={() => removeFile(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}

        {/* Add More */}
        {files.length < maxFiles && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-[10px]">{files.length}/{maxFiles}</span>
          </button>
        )}
      </div>

      {/* Caption & Actions */}
      <div className="mt-3 space-y-2">
        <div>
          <input
            type="text"
            placeholder="설명 추가 (선택)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-[11px] text-muted-foreground mt-1 px-1">
            #태그 로 해시태그, @이름 으로 멤버 언급
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={cancel} disabled={uploading} fullWidth>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={uploading} fullWidth>
            {uploading ? '올리는 중...' : `올리기 (${files.length}장)`}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
}
