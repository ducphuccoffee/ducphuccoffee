"use client";

import { Bell, ChevronRight, Search } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  section?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, section, actions }: TopBarProps) {
  return (
    <div className="mb-6">
      {/* Breadcrumb + title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Breadcrumb */}
          {section && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] text-gray-400">Đức Phúc Coffee</span>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <span className="text-[11px] text-gray-500 font-medium">{section}</span>
            </div>
          )}
          {/* Title */}
          <h1 className="text-[20px] font-bold text-gray-800 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-[12px] text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {/* Actions slot */}
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
