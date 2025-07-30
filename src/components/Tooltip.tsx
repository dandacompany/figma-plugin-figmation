import React, { useState } from 'react'
import './Tooltip.css'

interface TooltipProps {
  text: string
  children?: React.ReactNode
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="tooltip-container">
      <button
        className="tooltip-trigger"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label={text}
        type="button"
      >
        {children || (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="6.5" stroke="#666" strokeWidth="1"/>
            <path d="M7 5.5V10.5M7 3.5V4.5" stroke="#666" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        )}
      </button>
      {isVisible && (
        <div className="tooltip-content" role="tooltip">
          {text}
        </div>
      )}
    </div>
  )
}

export default Tooltip