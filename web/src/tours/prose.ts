const UNITS = ["bohr", "eV", "nm", "pm", "MHz", "GHz", "K", "%"];

export function measurementsIn(text: string): string[] {
  const units = UNITS.join("|");
  const re = new RegExp(`-?\\d+(?:\\.\\d+)?\\s(?:${units})(?![A-Za-z])`, "g");
  return text.match(re) ?? [];
}
