'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExclamationTriangleIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { ModalContentWrapper, ModalFooter, ModalHeader } from "@/components/ui/modal-elements";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
}

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, description }: ConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white p-0 overflow-hidden flex flex-col [&>button.absolute]:hidden sm:max-w-[420px]">
                <ModalHeader
                    title={title}
                    subtitle="Konfirmasi tindakan"
                    variant="emerald"
                    icon={<ExclamationTriangleIcon className="h-5 w-5 text-white" />}
                    onClose={onClose}
                />
                <ModalContentWrapper className="text-sm text-gray-700">
                    {description}
                </ModalContentWrapper>
                <ModalFooter className="sm:justify-between">
                    <Button variant="outline" onClick={onClose} className="rounded-full">
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} className="rounded-full">
                        <CheckIcon className="h-4 w-4 mr-2" />
                        Konfirmasi
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>
    );
}
