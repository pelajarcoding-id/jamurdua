'use server';

import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { revalidatePath } from 'next/cache';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export type ActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function logout() {
  await signOut({ redirect: false });
  return { success: true };
}

export async function updateProfile(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  if (!name || !email) {
    return { error: 'Nama dan Email harus diisi' };
  }

  try {
    // Check if email is taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== parseInt(session.user.id)) {
      return { error: 'Email sudah digunakan oleh pengguna lain' };
    }

    const photo = formData.get('photo') as File | null;
    let photoUrl: string | undefined = undefined;

    if (photo && photo.size > 0) {
      const bytes = await photo.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      const path = join(process.cwd(), 'public/uploads', filename);
      await writeFile(path, buffer);
      photoUrl = `/uploads/${filename}`;
    }

    await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { 
        name, 
        email,
        ...(photoUrl && { photoUrl })
      },
    });

    revalidatePath('/profile');
    return { success: true, message: 'Profil berhasil diperbarui' };
  } catch (error) {
    console.error('Update profile error:', error);
    return { error: 'Gagal memperbarui profil' };
  }
}

export async function changePassword(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Semua field password harus diisi' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Password baru dan konfirmasi tidak cocok' };
  }

  if (newPassword.length < 6) {
    return { error: 'Password baru minimal 6 karakter' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
    });

    if (!user || !user.passwordHash) {
      return { error: 'User tidak ditemukan' };
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return { error: 'Password saat ini salah' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { 
        passwordHash: hashedPassword,
        passwordChangedAt: new Date()
      } as any,
    });

    revalidatePath('/profile');
    return { success: true, message: 'Password berhasil diubah' };
  } catch (error) {
    console.error('Change password error:', error);
    return { error: 'Gagal mengubah password' };
  }
}

