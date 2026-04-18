import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { convertImageFileToWebp } from '@/lib/image-webp';

interface ImageUploadProps {
  onFileChange: (file: File | null) => void;
  previewUrl: string | null;
}

export default function ImageUpload({ onFileChange, previewUrl }: ImageUploadProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const converted = await convertImageFileToWebp(file, { quality: 0.82, maxDimension: 1280 });
      onFileChange(converted);
    }
  }, [onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
    },
    multiple: false,
  });

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
  };

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors relative flex items-center justify-center h-48
        ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}`}
    >
      <input {...getInputProps()} />
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
          <button 
            onClick={handleRemoveImage} 
            className="absolute top-2 right-2 bg-gray-800/50 text-white rounded-full p-1 hover:bg-gray-800/80 transition-colors"
            aria-label="Remove image"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center text-gray-500">
          <div className="flex items-center space-x-4 mb-2">
             <CameraIcon className="w-8 h-8" />
             <CloudArrowUpIcon className="w-8 h-8" />
          </div>
          <p className="font-semibold">Ambil Foto / Upload Gambar</p>
          <p className="text-sm">Klik untuk menggunakan kamera atau pilih file</p>
          {isDragActive && <p className="mt-2 text-primary">Jatuhkan file di sini...</p>}
        </div>
      )}
    </div>
  );
}
