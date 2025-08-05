import React from 'react';
import './Input.css'; // Import the styles

interface InputProps {
  value?: string;
  type?: string;
  showIcon?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
  id?: string;
}

const Input: React.FC<InputProps> = ({ value = '', type = 'text', showIcon = false, placeholder, onChange, style, id }) => {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <div className="Input" data-non-interactive="true">
      <div className="displayContents">
        <label
          data-tooltip-type="text"
          data-tooltip="X-position"
          aria-label="X-position"
          data-onboarding-key="scrubbable-control-x-position"
          data-temporary-fpl-no-drag=""
        >
          {showIcon && (
            <span className="icon">
              <span>X</span>
            </span>
          )}
          <input
            type={type}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            spellCheck={false}
            dir="auto"
            style={style}
            id={id}
          />
        </label>
      </div>
    </div>
  );
};

export default Input;
