import type { ElementType } from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: ElementType;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

const colorMap = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-500',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-500',
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-500',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-500',
  },
};

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon: Icon, color }) => {
  const { bg, text } = colorMap[color];

  return (
    <div className="bg-white p-3 md:p-6 rounded-lg shadow-md flex items-center">
      <div className={`p-3 md:p-4 rounded-full ${bg} ${text} mr-3 md:mr-4 flex-shrink-0`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500 truncate" title={title}>{title}</p>
        <p className="text-2xl font-bold truncate" title={value.toString()}>{value}</p>
      </div>
    </div>
  );
};

export default DashboardCard;
