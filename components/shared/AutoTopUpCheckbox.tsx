"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface AutoTopUpCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  triggerThreshold: number;
  topUpCredits: number;
  topUpPrice: number;
}

export function AutoTopUpCheckbox({
  checked,
  onCheckedChange,
  triggerThreshold,
  topUpCredits,
  topUpPrice,
}: AutoTopUpCheckboxProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <Checkbox
          id="auto-top-up"
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="mt-0.5"
        />
        <div className="flex-1">
          <label
            htmlFor="auto-top-up"
            className="text-sm font-medium text-gray-900 cursor-pointer flex items-center gap-2"
          >
            Enable Auto Top-Up when credits run low?
            <div
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Info className="w-4 h-4 text-gray-500 hover:text-gray-700" />
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50">
                  <p className="leading-relaxed">
                    When your balance reaches {triggerThreshold} credits, we&apos;ll automatically add{" "}
                    {topUpCredits.toLocaleString()} credits to your account for ${topUpPrice.toFixed(2)}.
                  </p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>
          </label>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="text-green-600">✓</span>
              <span>Recommended</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="text-green-600">✓</span>
              <span>Prevents workflow interruptions</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <span className="text-green-600">✓</span>
              <span>Fastest workflow experience</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

