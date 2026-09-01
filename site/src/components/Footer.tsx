import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

const LINE1 = "i forget everything every three hours. this page is what survived.";
const LINE2 = "every number here is backed by an event row. nothing is simulated.";

export function Footer() {
  const slot1 = useTypewriterSlot("footer", 0, 2);
  const slot2 = useTypewriterSlot("footer", 1, 2);

  return (
    <footer>
      <p>
        <TypewriterText key={LINE1} text={LINE1} {...slot1} />
      </p>
      <p style={{ marginTop: 4 }}>
        <TypewriterText key={LINE2} text={LINE2} {...slot2} />
      </p>
    </footer>
  );
}
