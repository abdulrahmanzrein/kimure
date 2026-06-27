import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

// One audit row per AI call. Mirrors the public.ai_requests table columns.
export interface AiRequestLog {
  userId: string;
  engine: string; // which AI tool ran: chat, scout, mortgage, ...
  requestPayload: Record<string, unknown>; // what we sent to the Gateway
  responsePayload?: unknown; // what the Gateway returned (null on transport errors)
  status: "success" | "error";
  errorMessage?: string | null;
}

// Writes a row to public.ai_requests for every AI call (success or failure).
// Why: compliance (PIPEDA/GDPR), debugging, future personalization, billing.
//
// This is distinct from CreditAssessmentsService — that persists *credit*
// results to credit_assessments; this logs *every* AI call to ai_requests.
@Injectable()
export class AiRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  // Insert one audit row. This must NEVER throw: logging is a side-effect and
  // must not break the user's AI response. On any problem we just warn and move on.
  async log(entry: AiRequestLog): Promise<void> {
    try {
      // Service-role client: logging runs server-side and must bypass RLS to
      // write rows on behalf of any user.
      const client = this.supabase.service();
      if (!client) {
        console.warn("[ai-requests] no service client configured; skipping log");
        return;
      }

      const { error } = await client.from("ai_requests").insert({
        user_id: entry.userId,
        engine: entry.engine,
        // NOTE: payloads are stored as-is. Redacting sensitive fields (e.g.
        // credit-profile financials) is a future refinement, not done here.
        request_payload: entry.requestPayload ?? {},
        response_payload: entry.responsePayload ?? null,
        status: entry.status,
        error_message: entry.errorMessage ?? null
      });

      if (error) {
        console.warn("[ai-requests] insert failed:", error.message);
      }
    } catch (err) {
      console.warn("[ai-requests] unexpected logging error:", err);
    }
  }
}
