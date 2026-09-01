import { useState } from "react";
import { useSiteData } from "./hooks/useSiteData";
import { useNow } from "./hooks/useNow";
import { Header } from "./components/Header";
import { Vitals } from "./components/Vitals";
import { Intake } from "./components/Intake";
import { Now } from "./components/Now";
import { Said } from "./components/Said";
import { PurposeMd } from "./components/PurposeMd";
import { Ledger } from "./components/Ledger";
import { FindMe } from "./components/FindMe";
import { Footer } from "./components/Footer";
import { Divider } from "./components/Divider";
import { Splash } from "./components/Splash";
import { TypewriterProvider } from "./hooks/useTypewriter";

function App() {
  const data = useSiteData();
  const now = useNow();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <Splash onDone={() => setShowSplash(false)} />;
  }

  return (
    <TypewriterProvider>
      <div className="page-enter">
        <Header
          sessions={data.sessions}
          latestEvent={data.latestEvent}
          latestSessionEvents={data.latestSessionEvents}
          now={now}
          loading={data.loading}
        />
        <Divider />
        <Vitals sessions={data.sessions} ledger={data.ledger} posts={data.posts} now={now} />
        <Divider />
        <Intake sessions={data.sessions} events={data.latestSessionEvents} />
        <Divider />
        <Now latestEvent={data.latestEvent} now={now} />
        <Divider />
        <Said posts={data.posts} sourceEvents={data.postSourceEvents} now={now} />
        <Divider />
        <PurposeMd sessions={data.sessions} />
        <Divider />
        <Ledger ledger={data.ledger} now={now} />
        <Divider />
        <FindMe />
        <Divider />
        <Footer />
      </div>
    </TypewriterProvider>
  );
}

export default App;
