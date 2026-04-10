'use client';

import { UserIcon, EnvelopeIcon, BriefcaseIcon, PencilSquareIcon, KeyIcon, XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile, changePassword, type ActionState } from '@/lib/actions';
import toast from 'react-hot-toast';
import type { User as PrismaUser } from '@prisma/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import ImageUpload from '@/components/ui/ImageUpload';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const initialState: ActionState = {
  message: '',
  error: '',
  success: false,
};

function SubmitButton({ text, loadingText }: { text: string; loadingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {pending && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
      {pending ? loadingText : text}
    </button>
  );
}

type KebunTerikat = { id: number; name: string }

export default function ProfileView({
  user,
  kebunTerikat = [],
}: {
  user: PrismaUser & { passwordChangedAt?: Date | null }
  kebunTerikat?: KebunTerikat[]
}) {
  // const { name, role, email, passwordChangedAt, photoUrl } = user; // Removed to use displayUser
  
  const [displayUser, setDisplayUser] = useState(user);
  const { name, role, email, passwordChangedAt, photoUrl, createdAt } = displayUser; // Destructure from state
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl || null);

  const [updateState, updateDispatch] = useFormState(updateProfile, initialState);
  const [passwordState, passwordDispatch] = useFormState(changePassword, initialState);

  // Sync displayUser when prop updates (from revalidatePath)
  useEffect(() => {
    setDisplayUser(user);
    setPreviewUrl(user.photoUrl || null);
  }, [user]);

  useEffect(() => {
    if (updateState.success) {
      // Server confirmed success
      toast.success(updateState.message || 'Profil berhasil diperbarui');
      // No need to close modal here as we did it optimistically, 
      // but safe to ensure state is correct
      setIsEditingProfile(false);
      setSelectedFile(null);
    } else if (updateState.error) {
      // Revert on error
      toast.error(updateState.error);
      setDisplayUser(user); // Revert to original prop
      setPreviewUrl(user.photoUrl || null);
    }
  }, [updateState, user]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(displayUser.photoUrl || null);
    }
  };

  const handleUpdateProfile = (formData: FormData) => {
    // 1. Optimistic Update
    const newName = formData.get('name') as string;
    const newEmail = formData.get('email') as string;
    
    // Create optimistic user object
    const optimisticUser = {
      ...displayUser,
      name: newName,
      email: newEmail,
      // If there's a preview URL from a new file, use it. 
      // Note: This is a local blob/data URL, might not persist on refresh until server returns real URL.
      // But for optimistic UI it's fine.
      photoUrl: selectedFile ? previewUrl : displayUser.photoUrl
    };

    setDisplayUser(optimisticUser);
    setIsEditingProfile(false);

    // 2. Server Action (Background)
    if (selectedFile) {
      formData.append('photo', selectedFile);
    }
    updateDispatch(formData);
  };

  useEffect(() => {
    if (passwordState.success) {
      toast.success(passwordState.message || 'Password berhasil diubah');
      setIsChangingPassword(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } else if (passwordState.error) {
      toast.error(passwordState.error);
    }
  }, [passwordState]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800 border-red-200";
      case "PEMILIK":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "KASIR":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const jobType = ((displayUser as any).jobType || '') as string
  const formatJobTypeLabel = (raw: string) => {
    const v = String(raw || '').trim()
    if (!v) return '-'
    return v
      .toLowerCase()
      .split(/[\s_]+/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Profil Saya</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Cover Background */}
          <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-600"></div>

          <div className="px-6 pb-6 md:px-8 md:pb-8 relative">
            {/* Profile Picture / Avatar */}
            <div className="relative -mt-16 mb-6">
              <div className="h-32 w-32 rounded-full bg-white p-1.5 shadow-md inline-block">
                <div className="h-full w-full rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold border-2 border-white overflow-hidden">
                    {photoUrl ? (
                    <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    name ? getInitials(name) : <UserIcon className="w-20 h-20 text-blue-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User Info */}
              <div className="space-y-6">
                {!isEditingProfile ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{name || 'User'}</h2>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={clsx("px-3 py-1 rounded-full text-xs font-medium border", getRoleBadgeColor(role))}>
                            {role || 'USER'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                        Edit
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3 text-gray-600">
                        <EnvelopeIcon className="w-5 h-5 mt-0.5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email</p>
                          <p className="text-sm">{email || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 text-gray-600">
                        <BriefcaseIcon className="w-5 h-5 mt-0.5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Role / Jabatan</p>
                          <p className="text-sm capitalize">{role?.toLowerCase() || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 text-gray-600">
                        <BriefcaseIcon className="w-5 h-5 mt-0.5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Jenis Pekerjaan</p>
                          <p className="text-sm">{formatJobTypeLabel(jobType)}</p>
                        </div>
                      </div>

                      {kebunTerikat.length > 0 ? (
                        <div className="flex items-start gap-3 text-gray-600">
                          <MapPinIcon className="w-5 h-5 mt-0.5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Kebun Terikat</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {kebunTerikat.map(k => (
                                <span key={k.id} className="px-2 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-800 border-gray-200">
                                  {k.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <form action={handleUpdateProfile} className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-800">Edit Profil</h3>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsEditingProfile(false);
                          setPreviewUrl(photoUrl || null);
                          setSelectedFile(null);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Foto Profil</label>
                      <ImageUpload 
                        onFileChange={handleFileChange} 
                        previewUrl={previewUrl} 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                      <input 
                        name="name"
                        type="text" 
                        defaultValue={name}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input 
                        name="email"
                        type="email" 
                        defaultValue={email}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsEditingProfile(false);
                          setPreviewUrl(photoUrl || null);
                          setSelectedFile(null);
                        }}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Batal
                      </button>
                      <SubmitButton text="Simpan" loadingText="Menyimpan..." />
                    </div>
                  </form>
                )}
              </div>

              {/* Account Summary / Stats */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 h-fit">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Akun</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="text-sm font-medium text-green-600">Aktif</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Bergabung Sejak</span>
                    <span className="text-sm font-medium text-gray-900">{createdAt ? format(new Date(createdAt), 'dd MMMM yyyy', { locale: id }) : '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Login Terakhir</span>
                    <span className="text-sm font-medium text-gray-900">Hari ini</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <KeyIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Keamanan</h2>
            <p className="text-sm text-gray-500">Kelola password dan keamanan akun Anda</p>
          </div>
        </div>

        {!isChangingPassword ? (
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Password</p>
              <p className="text-sm text-gray-500">
                Terakhir diubah: {passwordChangedAt ? format(new Date(passwordChangedAt), 'dd MMMM yyyy HH:mm', { locale: id }) : '-'}
              </p>
            </div>
            <button
              onClick={() => setIsChangingPassword(true)}
              className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Ganti Password
            </button>
          </div>
        ) : (
          <form action={passwordDispatch} className="max-w-md bg-gray-50 p-6 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Ganti Password</h3>
                <button 
                  type="button" 
                  onClick={() => setIsChangingPassword(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Saat Ini</label>
                <div className="relative">
                  <input 
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"} 
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                    aria-label={showCurrentPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showCurrentPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <div className="relative">
                  <input 
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"} 
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                    aria-label={showNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showNewPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimal 6 karakter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input 
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"} 
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                    aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Batal
                </button>
                <SubmitButton text="Update Password" loadingText="Updating..." />
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
