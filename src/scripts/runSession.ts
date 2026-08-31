import { startSession, endSession } from "../events/session.js";
import { logEvent } from "../events/log.js";
import { logSessionApiSpend } from "../events/ledger.js";
import { runReadingPipeline } from "../reading/pipeline.js";
import { generatePost } from "../posting/generatePost.js";
import { savePost } from "../posting/savePost.js";

// Full session: read, generate a post attempt through the quality gate,
// journal, log real spend. Separate from `npm run read` (still what the
// supply-test cron calls) on purpose — this one makes real, billed Agent
// SDK calls, and switching the cron over to it should be a deliberate
// choice, not a side effect of this file existing.
async function main() {
  const session = await startSession();
  console.log(`session gen ${session.generation} (${session.id}) started`);
  await logEvent(session.id, session.generation, "session_start", {});

  let totalCostUsd = 0;

  try {
    const reading = await runReadingPipeline(session.id, session.generation);
    console.log(
      `read: ${reading.itemsSeen.length} seen, ${reading.itemsRead.length} read, ${reading.sourceErrors.length} source errors\n`
    );

    const post = await generatePost(reading);
    totalCostUsd += post?.totalCostUsd ?? 0;

    if (!post) {
      console.log("nothing to write about this session (no material for any category, even opinion).");
      await logEvent(session.id, session.generation, "journal", {
        text: "nothing to read that cleared the bar this session — no post attempted.",
      });
    } else {
      console.log(`category: ${post.category}`);
      console.log(`\ncandidates:`);
      for (const [i, c] of post.candidates.entries()) {
        console.log(`\n[${i}] ${c.mechanicalPass ? "PASS" : "REJECTED"} — ${c.text}`);
        if (!c.mechanicalPass) console.log(`    reasons: ${c.mechanicalReasons.join("; ")}`);
      }
      console.log(`\njudge: ${post.judgeReasoning}`);

      if (post.winner) {
        const postId = await savePost({
          session_id: session.id,
          generation: session.generation,
          category: post.category,
          content: post.winner,
          in_reply_to_id: null,
          in_reply_to_url: null,
          event_ids: post.eventIds,
          metadata: { judge_reasoning: post.judgeReasoning },
        });
        await logEvent(session.id, session.generation, "post", {
          postId,
          category: post.category,
          content: post.winner,
        });
        console.log(`\nPOSTED (pending approval): ${post.winner}`);
      } else {
        console.log("\nno candidate passed — posting nothing.");
      }

      await logEvent(session.id, session.generation, "journal", { text: post.journal });
      console.log(`\njournal: ${post.journal}`);
    }

    await logSessionApiSpend(
      session.id,
      totalCostUsd,
      `session gen ${session.generation}: read + post generation`
    );
    await endSession(session.id, "completed", {
      notes: `step 3: ${reading.itemsRead.length} read, post ${post?.winner ? "published" : "none"}`,
      budgetUsdSpent: totalCostUsd,
    });
    console.log(`\nsession gen ${session.generation} completed. cost: $${totalCostUsd.toFixed(4)}`);
  } catch (err) {
    console.error(err);
    await logEvent(session.id, session.generation, "journal", {
      text: `session failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    await logSessionApiSpend(session.id, totalCostUsd, `session gen ${session.generation}: failed`);
    await endSession(session.id, "failed", {
      notes: err instanceof Error ? err.message : String(err),
      budgetUsdSpent: totalCostUsd,
    });
    process.exit(1);
  }
}

main();
