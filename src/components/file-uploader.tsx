"use client";

import { useState, type DragEvent, type ReactNode } from 'react';
import { UploadCloud, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploaderProps {
  id: string; // Unique identifier
  onFilesSelected: (files: File[]) => void;
  acceptedFileTypes?: string;
  multiple?: boolean;
  uploadIcon?: ReactNode;
  dragText?: string;
  buttonText?: string;
}

const MAX_FILES_DISPLAY = 5;

export function FileUploader({ 
  id,
  onFilesSelected, 
  acceptedFileTypes = '.xml',
  multiple = true,
  uploadIcon = <UploadCloud className="h-12 w-12 text-primary" />,
  dragText = "Kéo và thả tệp của bạn vào đây",
  buttonText = "Chọn tệp từ máy tính",
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => 
        acceptedFileTypes.split(',').some(type => file.name.endsWith(type.trim()))
    );
    if (files.length > 0) {
      const selected = multiple ? files : [files[0]];
      setSelectedFiles(selected);
      onFilesSelected(selected);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      onFilesSelected(files);
    }
  };
  
  const handleButtonClick = () => {
    document.getElementById(`file-input-${id}`)?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "w-full border-2 border-dashed rounded-xl p-7 text-center transition-colors duration-200 cursor-pointer bg-slate-50/80 hover:bg-blue-50/50",
          isDragging ? "border-primary bg-primary/10" : "border-slate-300 hover:border-primary/60"
        )}
        onClick={handleButtonClick}
      >
        <input
          type="file"
          id={`file-input-${id}`}
          multiple={multiple}
          accept={acceptedFileTypes}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          {uploadIcon}
          <p className="font-semibold text-slate-900 text-sm sm:text-base">
            {dragText}
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-600">hoặc</p>
          <Button type="button" variant="outline" className="border-slate-300 text-slate-900 hover:text-primary hover:border-primary bg-white font-semibold h-9 px-4 shadow-xs">
            {buttonText}
          </Button>
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <div className="w-full text-left">
          <h3 className="font-semibold text-slate-900 text-sm">Tệp đã chọn ({selectedFiles.length}):</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 font-medium">
            {selectedFiles.slice(0, MAX_FILES_DISPLAY).map((file, i) => (
              <li key={i} className="flex items-center gap-2 truncate" title={file.name}>
                <FileIcon className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
            {selectedFiles.length > MAX_FILES_DISPLAY && (
                 <li className="flex items-center gap-2 pl-6 text-slate-600">
                    ... và {selectedFiles.length - MAX_FILES_DISPLAY} tệp khác.
                </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
