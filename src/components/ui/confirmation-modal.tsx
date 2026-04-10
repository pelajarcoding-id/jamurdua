'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalContentWrapper, ModalFooter, ModalHeader, type ModalVariant } from "@/components/ui/modal-elements";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    variant?: ModalVariant;
}

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, description, variant = 'blue' }: ConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="bg-white p-0 overflow-hidden [&>button.absolute]:hidden">
                <ModalHeader
                    title={title}
                    variant={variant}
                    onClose={onClose}
                />
                <ModalContentWrapper>
                    <p>{description}</p>
                </ModalContentWrapper>
                <ModalFooter>
                    <Button variant="outline" onClick={onClose} className="rounded-full">
                        Batal
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} className="rounded-full">
                        Konfirmasi
                    </Button>
                </ModalFooter>
            </DialogContent>
        </Dialog>
    );
}
