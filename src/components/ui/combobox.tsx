
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  onAddOption?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyPlaceholder?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  onAddOption,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyPlaceholder = "No results found.",
  className
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue); 
    setOpen(false);
  };
  
  const handleInputChange = (search: string) => {
    setInputValue(search);
  };
  
  const handleAdd = () => {
    if (inputValue && onAddOption) {
      onAddOption(inputValue);
      onChange(inputValue); 
      setOpen(false);
    }
  }

  const displayLabel = value
    ? options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label || value
    : placeholder;
    
  const isNewValue = onAddOption && inputValue && !options.some(option => option.value.toLowerCase() === inputValue.toLowerCase());

  const commandFilter = (value: string, search: string) => {
    // Always show the 'Add new' item
    if (value.startsWith("__add__")) return 1;

    const option = options.find(opt => opt.value === value);
    if (!option) return 0;
    
    const isInLabel = option.label.toLowerCase().includes(search.toLowerCase());
    const isInValue = option.value.toLowerCase().includes(search.toLowerCase());

    return isInLabel || isInValue ? 1 : 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-8", className)}
        >
          <span className="truncate">
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={commandFilter}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={inputValue}
            onValueChange={handleInputChange}
            />
          <CommandList>
            <CommandEmpty>
                <div className="py-6 text-center text-sm">{emptyPlaceholder}</div>
            </CommandEmpty>
            <CommandGroup>
              {isNewValue && (
                 <CommandItem
                    onSelect={handleAdd}
                    value={`__add__${inputValue}`}
                    className="text-primary cursor-pointer"
                    >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm "{inputValue}"
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
