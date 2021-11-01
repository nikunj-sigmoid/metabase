import React from "react";
import { Group } from "@visx/group";
import { AreaClosed, LinePath } from "@visx/shape";
import { AccessorForArrayItem, PositionScale } from "@visx/shape/lib/types";

interface AreaProps {
  x: AccessorForArrayItem<unknown, number>;
  y: AccessorForArrayItem<unknown, number>;
  yScale: PositionScale;
  data: unknown[];
  color: string;
}

export const Area = ({ x, y, data, yScale, color }: AreaProps) => {
  return (
    <Group>
      <LinePath x={x} y={y} data={data} stroke={color} strokeWidth={2} />

      <AreaClosed
        x={x}
        y={y}
        yScale={yScale}
        data={data}
        fill={color}
        opacity={0.2}
      />
    </Group>
  );
};