import { startSession, endSession } from "../events/session.js";
import { logEvent } from "../events/log.js";
import { runReadingPipeline } from "../reading/pipeline.js";

async function main() {
  const session = await startSession();
  console.log(`session gen ${session.generation} (${session.id}) started`);

  await logEvent(session.id, session.generation, "session_start", {});

  try {
    const result = await runReadingPipeline(session.id, session.generation);

    console.log(`wildcard eligible this session: ${result.wildcardEligible}`);
    console.log(`fetched ${result.totalFetched} raw items`);
    console.log(`logged item_seen for ${result.itemsSeen.length} new items (post-dedupe)\n`);
    console.log(`read ${result.itemsRead.length} items in full:\n`);

    for (const { item, chars, selectionReason } of result.itemsRead) {
      console.log(`- [${item.kind}] ${item.title}`);
      console.log(`  ${item.url ?? "(no url)"}`);
      console.log(`  ${chars} chars — ${selectionReason}`);
      console.log();
    }

    if (result.skippedAttempts.length > 0) {
      console.log(`${result.skippedAttempts.length} attempt(s) skipped (below min read chars):`);
      for (const { item, chars, reason } of result.skippedAttempts) {
        console.log(`- [${item.kind}] ${item.title} — ${chars} chars (${reason})`);
      }
      console.log();
    }

    if (result.sourceErrors.length > 0) {
      console.log(`${result.sourceErrors.length} source error(s):`);
      for (const err of result.sourceErrors) {
        console.log(`- [${err.source}] ${err.message}`);
      }
      console.log();
    }

    await endSession(session.id, "completed", {
      notes: `step 2 reading pipeline: ${result.itemsSeen.length} seen, ${result.itemsRead.length} read, ${result.sourceErrors.length} source errors`,
    });

    console.log(`session gen ${session.generation} completed.`);
  } catch (err) {
    console.error(err);
    await endSession(session.id, "failed", {
      notes: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

main();
