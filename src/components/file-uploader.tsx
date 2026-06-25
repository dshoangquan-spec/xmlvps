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
          "w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 cursor-pointer",
          isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/50"
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
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          {uploadIcon}
          <p className="font-semibold text-foreground">
            {dragText}
          </p>
          <p className="text-sm">hoặc</p>
          <Button type="button" variant="outline">
            {buttonText}
          </Button>
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <div className="w-full text-left">
          <h3 className="font-medium">Tệp đã chọn ({selectedFiles.length}):</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {selectedFiles.slice(0, MAX_FILES_DISPLAY).map((file, i) => (
              <li key={i} className="flex items-center gap-2 truncate" title={file.name}>
                <FileIcon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
            {selectedFiles.length > MAX_FILES_DISPLAY && (
                 <li className="flex items-center gap-2 pl-6">
                    ... và {selectedFiles.length - MAX_FILES_DISPLAY} tệp khác.
                </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
