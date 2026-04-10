'use client'

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import type { NotaSawitData } from './columns';
import { DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ModalHeader, ModalContentWrapper, ModalFooter } from '@/components/ui/modal-elements'

interface UbahStatusModalProps {
  nota: NotaSawitData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, status: 'LUNAS' | 'BELUM_LUNAS') => void;
}

export function UbahStatusModal({
  nota,
  isOpen,
  onClose,
  onSave,
}: UbahStatusModalProps) {
  const saveAs = (newStatus: 'LUNAS' | 'BELUM_LUNAS') => {
    if (!nota) return;
    if (newStatus === 'LUNAS' && (!nota.hargaPerKg || nota.hargaPerKg <= 0)) {
      toast.error("Harap masukkan harga terlebih dahulu sebelum mengubah status ke Lunas.");
      return;
    }
    onSave(nota.id, newStatus);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white w-[92vw] sm:w-full sm:max-w-[520px] max-h-[92vh] rounded-2xl p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden">
        <ModalHeader
          title="Ubah Status Pembayaran"
          variant="emerald"
          icon={<DocumentDuplicateIcon className="h-5 w-5 text-white" />}
          onClose={onClose}
        />
        <ModalContentWrapper className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <p className="text-sm text-gray-600 mb-4">Pilih status baru untuk nota ini.</p>
          <div className="flex flex-col space-y-4">
            <button 
              onClick={() => saveAs('LUNAS')} 
              disabled={!nota?.hargaPerKg || nota?.hargaPerKg === 0}
              className="w-full px-4 py-2 rounded-full text-white bg-green-500 border border-green-600 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ubah menjadi LUNAS
            </button>
            <button 
              onClick={() => saveAs('BELUM_LUNAS')} 
              className="w-full px-4 py-2 rounded-full text-white bg-yellow-500 border border-yellow-600 hover:bg-yellow-600"
            >
              Ubah menjadi BELUM LUNAS
            </button>
          </div>
          {(!nota?.hargaPerKg || nota?.hargaPerKg === 0) && (
            <div className="text-right text-xs text-red-500 mt-3">
              * Harga belum dimasukkan (Edit nota untuk mengisi harga)
            </div>
          )}
        </ModalContentWrapper>
        <ModalFooter>
          <Button className="rounded-full w-full sm:w-auto" variant="outline" onClick={onClose}>
            <XMarkIcon className="h-4 w-4 mr-2" />
            Batal
          </Button>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
}
