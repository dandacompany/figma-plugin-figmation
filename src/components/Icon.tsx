import React from 'react';
import figmationIcon from '../assets/figmation.png';

interface IconProps {
  size?: number;
}

const Icon: React.FC<IconProps> = ({ size = 16 }) => {
    return (
      <img
        src={figmationIcon}
        alt="figmation"
        width={size}
        height={size}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
      />
    );
  }


export default Icon;
