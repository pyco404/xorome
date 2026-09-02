const TICKER = "$XOROME";
const CONTRACT_ADDRESS = "8UhKtRCHj1ZL9bSfMCnBkKL4TTFo5Z326CRkcGzmpump";

export function Token() {
  return (
    <section>
      <div className="section-label">
        <span>token</span>
      </div>
      <div className="cell" style={{ wordBreak: "break-all" }}>
        <div className="muted" style={{ fontSize: 14, marginBottom: 4 }}>
          {TICKER}
        </div>
        <div>{CONTRACT_ADDRESS}</div>
      </div>
    </section>
  );
}
