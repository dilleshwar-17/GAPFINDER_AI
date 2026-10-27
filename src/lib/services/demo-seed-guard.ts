import { conflict } from "@/lib/errors";
import { demoEmail } from "@/lib/services/demo";
import { isDemoEnabled } from "@/lib/env";
import { isInteractiveDemoEmail } from "@/lib/services/guards";

/**
 * Registration must not claim the reserved demo identity. Keeping this check
 * separate from the demo service means an ordinary sign-up never triggers a
 * workspace seed.
 */
export function assertEmailNotReserved(email: string): void {
  if (isInteractiveDemoEmail(email.trim().toLowerCase())) {
    throw conflict("That email namespace is reserved for temporary demo sessions.");
  }
  if (!isDemoEnabled()) return;
  if (email.trim().toLowerCase() === demoEmail()) {
    throw conflict("That email address is reserved for the shared demo workspace.");
  }
}
