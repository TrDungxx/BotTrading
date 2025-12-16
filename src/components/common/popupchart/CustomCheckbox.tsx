import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const iconSizes = {
    sm: { width: 8, height: 6 },
    md: { width: 10, height: 8 },
    lg: { width: 12, height: 10 },
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        rounded
        border
        transition-all duration-150
        ${checked 
           ? 'bg-[#256ec2ff] border-[#256ec2ff]' 
          : 'bg-transparent border-[#474d57] group-hover:border-[#848e9c]'
        }
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
        ${className}
      `}
    >
      {checked && (
        <svg 
          width={iconSizes[size].width} 
          height={iconSizes[size].height} 
          viewBox="0 0 10 8" 
          fill="none"
          className="text-[#1e2329]"
        >
          <path 
            d="M1 4L3.5 6.5L9 1" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

export default CustomCheckbox;