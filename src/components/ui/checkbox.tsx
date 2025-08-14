import * as React from "react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border border-input bg-background text-primary 
                   focus:ring-2 focus:ring-ring focus:ring-offset-2 
                   disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        onChange={(e) => {
          if (onCheckedChange) {
            onCheckedChange(e.target.checked);
          }
          if (props.onChange) {
            props.onChange(e);
          }
        }}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
