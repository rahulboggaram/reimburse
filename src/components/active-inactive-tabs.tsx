"use client";

import {
  SegmentControl,
  type SegmentOption,
} from "@/components/segment-control";

export type ActiveInactiveTab = "active" | "inactive";

const SEGMENTS: SegmentOption<ActiveInactiveTab>[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

export function ActiveInactiveTabs(props: {
  value: ActiveInactiveTab;
  onChange: (value: ActiveInactiveTab) => void;
  className?: string;
}) {
  return (
    <SegmentControl
      options={SEGMENTS}
      value={props.value}
      onChange={props.onChange}
      ariaLabel="Status"
      outlined={false}
      className={props.className}
    />
  );
}
