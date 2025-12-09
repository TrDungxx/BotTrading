import React, { useState } from "react";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import "../../style/carousel/ticker-filter-toolbar.css";

export type FilterType = "default" | "top-gainers" | "top-losers";

interface TickerFilterToolbarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

const TickerFilterToolbar: React.FC<TickerFilterToolbarProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const filters = [
    {
      type: "default" as FilterType,
      label: "Volume",
      icon: <BarChart3 className="filter-icon" />,
      description: "Top by volume",
    },
    {
      type: "top-gainers" as FilterType,
      label: "Gainers",
      icon: <TrendingUp className="filter-icon" />,
      description: "Top gainers 24h",
    },
    {
      type: "top-losers" as FilterType,
      label: "Losers",
      icon: <TrendingDown className="filter-icon" />,
      description: "Top losers 24h",
    },
  ];

  return (
    <div
      className={`ticker-filter-toolbar ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="toolbar-content">
        {filters.map((filter) => (
          <button
            key={filter.type}
            className={`filter-button ${
              activeFilter === filter.type ? "active" : ""
            }`}
            onClick={() => onFilterChange(filter.type)}
            title={filter.description}
          >
            {filter.icon}
            {isExpanded && <span className="filter-label">{filter.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TickerFilterToolbar;