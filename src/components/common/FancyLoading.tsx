// src/components/FancyLoading.tsx
import React from 'react';
import { Player } from '@lottiefiles/react-lottie-player';
import Lottie from 'lottie-react';
import loadingAnimation from '../../assets/robot-smart-glow.json';

const FancyLoading = ({ message = 'TW Loading...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-6">
      <Lottie
        animationData={loadingAnimation}
        loop
        autoplay
        style={{ height: 160, width: 160 }}
      />
      <div className="text-xl font-bold animate-pulse">{message}</div>
      <div className="text-fluid-sm text-gray-400 animate-pulse">
        Vui lòng chờ trong giây lát...
      </div>
    </div>
  );
};

export default FancyLoading;
