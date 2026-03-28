'use client';

import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/profile';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <Button
      variant="ghost"
      fullWidth
      onClick={handleSignOut}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="w-4 h-4 mr-2" />
      로그아웃
    </Button>
  );
}
