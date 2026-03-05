import React from 'react';
import Svg, { Circle, Path, G } from 'react-native-svg';

const LunchTimerIcon = ({ size = 100, color = 'black', iconColor = 'red' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Timer Frame */}
    <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth="1.8" />
    <Path d="M12 5V3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M9 2H15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />

    {/* Fork and Knife */}
    <G
      stroke={iconColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M16 9L8 17" />
      <Path d="M15 8L17 10" />
      <Path d="M8 9L16 17" />
      <Path d="M7 10.5L9 12.5" />
      <Path d="M8 9.5L10 11.5" />
      <Path d="M9 8.5L11 10.5" />
    </G>
  </Svg>
);

export default LunchTimerIcon;
