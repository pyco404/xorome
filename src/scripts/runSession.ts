import { startSession, endSession } from "../events/session.js";
import { logEvent } from "../events/log.js";
import { logSessionApiSpend } from "../events/ledger.js";
import { runReadingPipeline } from "../reading/pipeline.js";
import { generatePost } from "../posting/generatePost.js";
import { savePost } from "../posting/savePost.js";
import { makeAndCommitArtifact } from "../making/makeArtifact.js";

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
      const survived = post.candidates.filter((c) => c.mechanicalPass).length;

      console.log(`category: ${post.category}`);
      console.log(`candidates generated: ${post.candidates.length}`);
      console.log(`survived mechanical gate: ${survived}`);
      console.log(`judge verdict: ${post.winner ? "accepted a winner" : "accepted none"}\n`);

      // Every candidate, not just the winner — this is what makes veto
      // rate and rejected-text auditing possible instead of trusting a
      // single aggregate summary.
      for (const [i, c] of post.candidates.entries()) {
        const judgeLine = c.judgeVerdict
          ? `judge: ${c.judgeVerdict}${c.isWinner ? " (WINNER)" : ""} — ${c.judgeReason}`
          : "judge: not reached (failed mechanical gate)";
        console.log(`[${i}] ${c.mechanicalPass ? "mechanical PASS" : "mechanical REJECT"} — ${c.text}`);
        if (!c.mechanicalPass) console.log(`    mechanical reasons: ${c.mechanicalReasons.join("; ")}`);
        console.log(`    ${judgeLine}\n`);

        await logEvent(session.id, session.generation, "post_candidate", {
          category: post.category,
          text: c.text,
          is_winner: c.isWinner,
          mechanical_pass: c.mechanicalPass,
          mechanical_reasons: c.mechanicalReasons,
          judge_verdict: c.judgeVerdict,
          judge_reason: c.judgeReason,
        });
      }

      if (post.winner) {
        const postId = await savePost({
          session_id: session.id,
          generation: session.generation,
          category: post.category,
          content: post.winner,
          in_reply_to_id: null,
          in_reply_to_url: null,
          event_ids: post.eventIds,
          metadata: {},
        });
        await logEvent(session.id, session.generation, "post", {
          postId,
          category: post.category,
          content: post.winner,
        });
        console.log(`POSTED (pending approval): ${post.winner}`);
      } else {
        console.log("no candidate passed — posting nothing.");
      }

      await logEvent(session.id, session.generation, "journal", { text: post.journal });
      console.log(`\njournal: ${post.journal}`);
    }

    // Make step: after posting, not before — this session's artifact
    // isn't available to this session's own post (avoids a chicken-and-egg
    // ordering problem), but sits ready, unreferenced, for a future
    // session whose category lands on "artifact".
    try {
      const artifact = await makeAndCommitArtifact(session.generation, session.id);
      await logEvent(
        session.id,
        session.generation,
        "artifact",
        {
          artifactType: artifact.type,
          title: artifact.title,
          filePath: artifact.filePath,
          content: artifact.content,
          commitHash: artifact.commitHash,
        },
        undefined
      );
      console.log(`\nmade: ${artifact.title} (${artifact.type}) — ${artifact.filePath} @ ${artifact.commitHash.slice(0, 8)}`);
    } catch (err) {
      console.error("artifact step failed:", err);
      await logEvent(session.id, session.generation, "error", {
        source: "make_artifact",
        message: err instanceof Error ? err.message : String(err),
      });
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
