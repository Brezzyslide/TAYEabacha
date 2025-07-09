import React from "react";

interface CompanyLogoProps {
  companyName?: string;
  customLogo?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export default function CompanyLogo({ 
  companyName = "NeedsCareAI+", // Default fallback
  customLogo, 
  size = "md", 
  showName = true 
}: CompanyLogoProps) {
  // Extract first 3 letters from company name with comprehensive null safety
  const getCompanyLetters = (name: string) => {
    try {
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return ['N', 'C', 'A']; // Default fallback for NeedsCareAI+
      }
      
      // Clean the name and filter out empty words
      const cleanName = name.trim();
      const words = cleanName.split(/\s+/).filter(word => word && word.length > 0 && typeof word === 'string');
      
      if (words.length >= 3) {
        return words.slice(0, 3).map(word => {
          try {
            const firstChar = word.charAt(0);
            return firstChar ? firstChar.toUpperCase() : 'X';
          } catch {
            return 'X';
          }
        });
      } else if (words.length === 2) {
        try {
          const first = words[0]?.charAt(0)?.toUpperCase() || 'X';
          const second = words[1]?.charAt(0)?.toUpperCase() || 'X';
          const third = words[1]?.charAt(1)?.toUpperCase() || 'X';
          return [first, second, third];
        } catch {
          return ['N', 'C', 'A'];
        }
      } else if (words.length === 1 && words[0]) {
        try {
          const singleWord = words[0];
          const letters = singleWord.substring(0, 3).toUpperCase();
          return letters.padEnd(3, 'X').split('');
        } catch {
          return ['N', 'C', 'A'];
        }
      } else {
        // Fallback if no valid words
        return ['N', 'C', 'A'];
      }
    } catch (error) {
      console.warn('[COMPANY LOGO] Error processing company name:', error);
      return ['N', 'C', 'A']; // Safe fallback
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