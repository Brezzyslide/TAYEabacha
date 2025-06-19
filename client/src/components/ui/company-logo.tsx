import React from "react";

interface CompanyLogoProps {
  companyName: string;
  customLogo?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export default function CompanyLogo({ 
  companyName, 
  customLogo, 
  size = "md", 
  showName = true 
}: CompanyLogoProps) {
  // Extract first 3 letters from company name
  const getCompanyLetters = (name: string) => {
    const words = name.split(/\s+/);
    if (words.length >= 3) {
      return words.slice(0, 3).map(word => word[0].toUpperCase());
    } else if (words.length === 2) {
      return [words[0][0], words[1][0], words[1][1] || 'X'].map(letter => letter.toUpperCase());
    } else {
      const letters = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
      return letters.padEnd(3, 'X').split('');
    }
  };

  const letters = getCompanyLetters(companyName);
  
  // Size configurations
  const sizeConfig = {
    sm: {
      container: "w-12 h-8",
      blade: "w-3 h-6",
      text: "text-xs",
      nameText: "text-xs",
      gap: "gap-0.5"
    },
    md: {
      container: "w-16 h-10",
      blade: "w-4 h-8",
      text: "text-sm",
      nameText: "text-sm",
      gap: "gap-1"
    },
    lg: {
      container: "w-20 h-12",
      blade: "w-5 h-10",
      text: "text-base",
      nameText: "text-base",
      gap: "gap-1"
    }
  };

  const config = sizeConfig[size];

  // Color scheme for the three blades
  const bladeColors = [
    "bg-blue-600", // Left blade
    "bg-amber-600", // Center blade  
    "bg-green-600", // Right blade
  ];

  if (customLogo) {
    return (
      <div className="flex flex-col items-center">
        <img 
          src={customLogo} 
          alt={`${companyName} Logo`}
          className={`${config.container} object-contain`}
        />
        {showName && (
          <span className={`font-bold text-gray-800 dark:text-white ${config.nameText} mt-1`}>
            {companyName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Fan Blade Logo */}
      <div className={`relative ${config.container} flex items-center justify-center ${config.gap}`}>
        {letters.map((letter, index) => (
          <div
            key={index}
            className={`
              ${config.blade} 
              ${bladeColors[index]} 
              rounded-lg 
              flex 
              items-center 
              justify-center 
              text-white 
              font-bold 
              ${config.text}
              shadow-sm
              transform
              ${index === 0 ? '-rotate-12' : index === 2 ? 'rotate-12' : ''}
            `}
            style={{
              transformOrigin: 'center bottom'
            }}
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Company Name */}
      {showName && (
        <span className={`font-bold text-gray-800 dark:text-white ${config.nameText} mt-1 text-center`}>
          {companyName}
        </span>
      )}
    </div>
  );
}