import React from "react";

interface ApexLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ApexLogo: React.FC<ApexLogoProps> = ({
  size = 24,
  className = "",
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Apex Logo"
      {...props}
    >
      <path d="M12 2.5L1.5 21.5H7L12 12L17 21.5H22.5L12 2.5Z" />
      <polygon points="12,15 8.7,21.5 15.3,21.5" />
    </svg>
  );
};

export default ApexLogo;
