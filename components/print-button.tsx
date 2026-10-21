"use client";

import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button tone="gold" className="print:hidden" onClick={() => window.print()}>
      Print or save PDF
    </Button>
  );
}
